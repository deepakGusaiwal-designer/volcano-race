import * as THREE from 'three';
import { CIRCUIT_WAYPOINTS } from './CompetitionManager';
import { RoadHintData } from '../types/game';

export interface CheckpointVisualDef {
  index: number;
  position: [number, number, number];
  radius: number;
}

export class ForzaTrackVisuals {
  public group = new THREE.Group();
  public railBarriers: THREE.Object3D[] = [];
  private scene: THREE.Scene;
  private trackSpline: THREE.CatmullRomCurve3;
  private splineLength: number;
  private checkpointGates: THREE.Group[] = [];
  private flareParticles: {
    mesh: THREE.Mesh;
    basePos: THREE.Vector3;
    offsetY: number;
    speed: number;
    phase: number;
    baseScale: number;
  }[] = [];
  private animatedLightBars: THREE.MeshStandardMaterial[] = [];
  private probeRaycaster = new THREE.Raycaster();
  private downVec = new THREE.Vector3(0, -1, 0);
  private probeOrigin = new THREE.Vector3();
  private nascarTextureCache = new Map<string, THREE.CanvasTexture>();
  private trackDirection: 'normal' | 'reverse' = 'reverse';
  private turnChevronMaterials: THREE.MeshStandardMaterial[] = [];
  private turnChevronTextureLeft: THREE.CanvasTexture | null = null;
  private turnChevronTextureRight: THREE.CanvasTexture | null = null;
  private drivingLineMesh: THREE.InstancedMesh | null = null;
  private drivingLineSegments: Array<{
    pos: THREE.Vector3;
    driveDir: THREE.Vector3;
    u: number;
    safeSpeedKmH: number;
    turnDirection: 'left' | 'right' | 'straight';
    turnName: string;
    baseColor: THREE.Color;
  }> = [];
  private drivingLineTexture: THREE.CanvasTexture | null = null;
  private colorCyan = new THREE.Color(0x00e5ff);
  private colorYellow = new THREE.Color(0xffb700);
  private colorRed = new THREE.Color(0xff1744);
  private tempColor = new THREE.Color();
  private carToSegVec = new THREE.Vector3();
  private lastClosestIdx = 0;
  private lastGuidelineUpdateTime = 0;
  public closestCarSegmentIdx = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group.name = 'ForzaTrackVisuals';
    this.trackSpline = new THREE.CatmullRomCurve3(CIRCUIT_WAYPOINTS, true, 'centripetal');
    this.splineLength = this.trackSpline.getLength();
    this.scene.add(this.group);
  }

  // -------------------------------------------------------------
  // Road & Ground Surface Probes: Vertical raycast against track colliders
  // Targets local road elevation, avoiding overhead cliffs or peaks
  // -------------------------------------------------------------
  public getRoadMeshes(colliders: THREE.Object3D[]): THREE.Object3D[] {
    const road = colliders.filter((c) => {
      const n = (c.name || '').toLowerCase();
      if (
        n.includes('ground') ||
        n.includes('mountain') ||
        n.includes('chimney') ||
        n.includes('rock') ||
        n.includes('boulder') ||
        n.includes('wall') ||
        n.includes('_2') ||
        n.includes('magma_top') ||
        n.includes('magma_near')
      ) {
        return false;
      }
      return (
        n.includes('specialroad') ||
        n.includes('dyke') ||
        n.includes('gangplank') ||
        n.includes('lavacracks') ||
        n.includes('trap')
      );
    });
    return road.length > 0 ? road : colliders;
  }

  public getTrueRoadHeight(
    x: number,
    z: number,
    roadMeshes: THREE.Object3D[],
    hintY: number = -0.385
  ): number {
    this.probeOrigin.set(x, 6.0, z);
    this.probeRaycaster.set(this.probeOrigin, this.downVec);
    this.probeRaycaster.far = 12.0;

    const hits = this.probeRaycaster.intersectObjects(roadMeshes, true);
    for (const h of hits) {
      if (h.face) {
        const norm = h.face.normal.clone().transformDirection(h.object.matrixWorld).normalize();
        if (norm.y >= 0.40) {
          return h.point.y;
        }
      }
    }
    return hintY;
  }

  public probeRoadPoint(
    x: number,
    z: number,
    baselineY: number,
    roadMeshes: THREE.Object3D[]
  ): { hit: boolean; y: number } {
    this.probeOrigin.set(x, baselineY + 2.5, z);
    this.probeRaycaster.set(this.probeOrigin, this.downVec);
    this.probeRaycaster.far = 5.0;

    const hits = this.probeRaycaster.intersectObjects(roadMeshes, true);
    for (const h of hits) {
      if (h.face) {
        const norm = h.face.normal.clone().transformDirection(h.object.matrixWorld).normalize();
        if (norm.y >= 0.30 && Math.abs(h.point.y - baselineY) < 2.2) {
          return { hit: true, y: h.point.y };
        }
      }
    }
    return { hit: false, y: baselineY };
  }

  // Dynamically measures the actual road boundary width from spline point outward along normal
  public findRoadEdge(
    pt: THREE.Vector3,
    norm: THREE.Vector3,
    side: number,
    baselineY: number,
    roadMeshes?: THREE.Object3D[]
  ): { dist: number; y: number } {
    const defaultHalfWidth = this.getRoadHalfWidth(0, pt);
    if (!roadMeshes || roadMeshes.length === 0) {
      return { dist: defaultHalfWidth, y: baselineY };
    }

    let lastDist = defaultHalfWidth;
    let lastY = baselineY;
    let foundRoad = false;
    let consecutiveMisses = 0;

    // Search outwards from 0.20m to 8.5m in precise 0.08m increments
    for (let d = 0.20; d <= 8.5; d += 0.08) {
      const qx = pt.x + norm.x * d * side;
      const qz = pt.z + norm.z * d * side;
      const probe = this.probeRoadPoint(qx, qz, baselineY, roadMeshes);

      if (probe.hit) {
        lastDist = d;
        lastY = probe.y;
        foundRoad = true;
        consecutiveMisses = 0;
      } else {
        if (foundRoad) {
          consecutiveMisses++;
          // Require at least 4 consecutive misses (0.32m) to avoid breaking on triangulated road mesh seams
          if (consecutiveMisses >= 4) {
            break;
          }
        }
      }
    }

    // Guard against road gap collapses (e.g. over lava pit, open air ramps, or broken road edges):
    // Road half-width is strictly >= 2.5m. Any reading < 2.5m was a gap collapse into the drivable lane!
    if (!foundRoad || lastDist < 2.50) {
      lastDist = Math.max(defaultHalfWidth, 3.8);
      lastY = baselineY;
    }

    // Never let rail elevation plunge into boiling lava pit (< -0.65m)
    if (lastY < -0.65) {
      lastY = baselineY;
    }

    return { dist: lastDist, y: lastY };
  }

  public probeGround(
    x: number,
    z: number,
    fallbackY: number = -0.385,
    colliders?: THREE.Object3D[]
  ): { y: number; normal: THREE.Vector3 } {
    const defaultNormal = new THREE.Vector3(0, 1, 0);
    if (!colliders || colliders.length === 0) {
      return { y: fallbackY, normal: defaultNormal };
    }

    this.probeOrigin.set(x, fallbackY + 1.8, z);
    this.probeRaycaster.set(this.probeOrigin, this.downVec);
    this.probeRaycaster.far = 4.2;
    const hits = this.probeRaycaster.intersectObjects(colliders, true);

    let bestHit: THREE.Intersection | null = null;
    let minDiff = Infinity;
    let bestNormal = defaultNormal;

    for (const h of hits) {
      const n = (h.object.name || '').toLowerCase();
      if (n.includes('chimney') || n.includes('mountain') || n.includes('rockobstacle') || n.includes('magma_top')) {
        continue;
      }
      if (h.face) {
        const norm = h.face.normal.clone().transformDirection(h.object.matrixWorld).normalize();
        if (norm.y >= 0.30) {
          const diff = Math.abs(h.point.y - fallbackY);
          if (diff < minDiff) {
            minDiff = diff;
            bestHit = h;
            bestNormal = norm;
          }
        }
      }
    }

    if (bestHit) {
      return { y: bestHit.point.y, normal: bestNormal };
    }

    return { y: fallbackY, normal: defaultNormal };
  }

  // Helper to determine road half-width along the circuit
  private getRoadHalfWidth(u: number, pt: THREE.Vector3): number {
    // Platform ramp / bridge across lava
    if (pt.x > -4.0 && pt.x < 8.5 && pt.z > 8.0 && pt.z < 12.5) {
      return 2.55;
    }
    // Eastern Dyke traverse
    if (pt.x > 38.0 && pt.x < 50.0 && pt.z > -15.0 && pt.z < 4.0) {
      return 2.85;
    }
    // Hairpin sweep
    if (pt.z < -25.0) {
      return 3.20;
    }
    // Standard wide circuit asphalt
    return 3.10;
  }

  // -------------------------------------------------------------
  // Master Build: Aligns All Rails & Systems with Track Geometry
  // -------------------------------------------------------------
  public buildAllSystems(colliders: THREE.Object3D[], direction: 'normal' | 'reverse' = 'reverse') {
    this.trackDirection = direction;
    this.clearDynamicVisuals();

    // 1. Safety Barrier Rails (Disabled per user request)
    this.railBarriers = [];

    // 2. Start / Finish Gantry & Numbered Grid Boxes
    this.buildStartFinishGantry(colliders, direction);

    // 3. Dynamic Forza Horizon Driving Guideline (Center of Road)
    this.buildForzaHorizonDrivingLine(colliders, direction);

    // 4. Trackside Glowing Turn Chevrons (Curve Indicators & Hints)
    this.buildTracksideTurnChevrons(colliders, direction);

    // 5. Authentic NASCAR Cup Series Trackside Advertisements
    this.buildNascarTracksideAdvertisements(colliders, direction);
  }

  private clearDynamicVisuals() {
    while (this.group.children.length > 0) {
      const child = this.group.children[0];
      this.group.remove(child);
    }
    this.railBarriers = [];
    this.checkpointGates = [];
    if (this.drivingLineTexture) {
      this.drivingLineTexture.dispose();
      this.drivingLineTexture = null;
    }
    if (this.drivingLineMesh) {
      this.drivingLineMesh.geometry.dispose();
      (this.drivingLineMesh.material as THREE.Material).dispose();
      this.drivingLineMesh = null;
    }
    this.drivingLineSegments = [];
    for (const mat of this.turnChevronMaterials) {
      mat.dispose();
    }
    this.turnChevronMaterials = [];
    for (const p of this.flareParticles) {
      this.scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      (p.mesh.material as THREE.Material).dispose();
    }
    this.flareParticles = [];
    this.animatedLightBars = [];
  }


  // -------------------------------------------------------------
  // 2. Start / Finish Gantry & Numbered Grid Boxes
  // -------------------------------------------------------------
  private buildStartFinishGantry(colliders: THREE.Object3D[], direction: 'normal' | 'reverse') {
    const gantry = new THREE.Group();
    gantry.name = 'StartFinishGantry';

    const p0 = this.trackSpline.getPointAt(0);
    const t0 = this.trackSpline.getTangentAt(0).normalize();
    const driveDir = (direction === 'reverse' ? t0.clone().negate() : t0.clone()).normalize();
    const heading = Math.atan2(-driveDir.x, -driveDir.z);
    const n0 = new THREE.Vector3(-driveDir.z, 0, driveDir.x).normalize();

    const ground = this.probeGround(p0.x, p0.z, p0.y, colliders);
    gantry.position.set(p0.x, ground.y, p0.z);
    gantry.rotation.y = heading;

    const roadMeshes = this.getRoadMeshes(colliders);
    const hw = this.getRoadHalfWidth(0, p0);
    const rightEdge = this.findRoadEdge(p0, n0, 1, ground.y, roadMeshes);
    const leftEdge = this.findRoadEdge(p0, n0, -1, ground.y, roadMeshes);
    const maxRoadEdge = Math.max(rightEdge.dist, leftEdge.dist, hw);
    const pylonDist = Math.max(maxRoadEdge + 1.35, 4.5);
    const towerHeight = 4.8;

    const trussMat = new THREE.MeshStandardMaterial({
      color: 0x1a1e24,
      metalness: 0.88,
      roughness: 0.32,
    });

    // Left and Right Truss Towers
    [-pylonDist, pylonDist].forEach((side) => {
      const tower = new THREE.Group();
      tower.position.set(side, 0, 0);

      const legGeo = new THREE.CylinderGeometry(0.065, 0.065, towerHeight, 8);
      const legSpacing = 0.38;
      const offsets = [
        [-legSpacing, -legSpacing],
        [legSpacing, -legSpacing],
        [-legSpacing, legSpacing],
        [legSpacing, legSpacing],
      ];

      offsets.forEach(([ox, oz]) => {
        const leg = new THREE.Mesh(legGeo, trussMat);
        leg.position.set(ox, towerHeight / 2, oz);
        tower.add(leg);
      });

      // Internal cross struts
      const strutGeo = new THREE.CylinderGeometry(0.03, 0.03, legSpacing * 1.414, 6);
      for (let y = 0.6; y < towerHeight; y += 0.85) {
        const strut = new THREE.Mesh(strutGeo, trussMat);
        strut.position.set(0, y, 0);
        strut.rotation.z = Math.PI / 4;
        tower.add(strut);
      }

      // Vertical sponsor banners atop tower
      const flagGeo = new THREE.PlaneGeometry(0.85, 3.4);
      const flagTex = this.createVerticalBannerTexture(side > 0 ? 'DEEPAK GUSAIWAL' : 'DG RACING', side > 0 ? '#0b0d12' : '#CB152F');
      const flagMat = new THREE.MeshBasicMaterial({ map: flagTex, side: THREE.DoubleSide, transparent: true });
      const flag = new THREE.Mesh(flagGeo, flagMat);
      flag.position.set(0, towerHeight * 0.55, side > 0 ? -legSpacing - 0.06 : legSpacing + 0.06);
      flag.rotation.y = Math.PI / 2;
      tower.add(flag);

      gantry.add(tower);
    });

    // Overhead horizontal lattice crossbeam
    const beamLength = pylonDist * 2 + 0.4;
    const beamGeo = new THREE.CylinderGeometry(0.075, 0.075, beamLength, 8);
    const beam1 = new THREE.Mesh(beamGeo, trussMat);
    beam1.position.set(0, towerHeight - 0.25, 0);
    beam1.rotation.z = Math.PI / 2;
    gantry.add(beam1);

    const beam2 = new THREE.Mesh(beamGeo, trussMat);
    beam2.position.set(0, towerHeight - 0.95, 0);
    beam2.rotation.z = Math.PI / 2;
    gantry.add(beam2);

    // Overhanging Festival Marquee Banner (Perpendicular to track, facing oncoming traffic)
    const bannerWidth = pylonDist * 2 - 0.4;
    const bannerHeight = 1.35;
    const bannerGeo = new THREE.PlaneGeometry(bannerWidth, bannerHeight);
    const bannerTex = this.createFestivalMarqueeTexture();
    const bannerMat = new THREE.MeshStandardMaterial({
      map: bannerTex,
      roughness: 0.35,
      metalness: 0.2,
      emissive: new THREE.Color(0x221133),
      emissiveIntensity: 0.55,
      side: THREE.DoubleSide,
    });
    const banner = new THREE.Mesh(bannerGeo, bannerMat);
    banner.position.set(0, towerHeight - 0.60, 0);
    gantry.add(banner);

    // 5 Start/Finish Race Lights under crossbeam
    for (let i = -2; i <= 2; i++) {
      const housingGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.14, 12);
      const housingMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
      const housing = new THREE.Mesh(housingGeo, housingMat);
      housing.position.set(i * 0.38, towerHeight - 1.25, 0);
      housing.rotation.x = Math.PI / 2;

      const bulbGeo = new THREE.SphereGeometry(0.08, 12, 12);
      const bulbMat = new THREE.MeshStandardMaterial({
        color: 0x00ff66,
        emissive: new THREE.Color(0x00ff66),
        emissiveIntensity: 1.8,
        roughness: 0.2,
      });
      const bulb = new THREE.Mesh(bulbGeo, bulbMat);
      bulb.position.set(i * 0.38, towerHeight - 1.25, -0.08);

      gantry.add(housing);
      gantry.add(bulb);
    }

    // Checkered finish line ribbon flush across road surface
    const checkGeo = new THREE.PlaneGeometry(hw * 2, 1.35);
    const checkTex = this.createCheckeredRibbonTexture();
    const checkMat = new THREE.MeshStandardMaterial({
      map: checkTex,
      roughness: 0.65,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    const checkMesh = new THREE.Mesh(checkGeo, checkMat);
    checkMesh.position.set(0, 0.015, 0);
    checkMesh.rotation.x = -Math.PI / 2;
    gantry.add(checkMesh);

    // Numbered Starting Grid Boxes along track spline
    const gridSpacings = [3.2, 6.4, 9.6, 12.8];
    gridSpacings.forEach((dist, idx) => {
      const slot = idx + 1;
      const deltaU = (dist / this.splineLength) * (direction === 'reverse' ? 1 : -1);
      const gridU = (1.0 + deltaU) % 1.0;

      const gPt = this.trackSpline.getPointAt(gridU);
      const gTan = this.trackSpline.getTangentAt(gridU).normalize();
      const gNorm = new THREE.Vector3(-gTan.z, 0, gTan.x).normalize();
      const gHead = Math.atan2(gTan.x, gTan.z);

      const lateralOffset = (slot % 2 === 1 ? 0.65 : -0.65);
      const boxX = gPt.x + gNorm.x * lateralOffset;
      const boxZ = gPt.z + gNorm.z * lateralOffset;
      const gGround = this.probeGround(boxX, boxZ, gPt.y, colliders);

      const boxGeo = new THREE.PlaneGeometry(1.4, 2.4);
      const boxTex = this.createGridBoxTexture(slot.toString());
      const boxMat = new THREE.MeshStandardMaterial({
        map: boxTex,
        transparent: true,
        roughness: 0.7,
        depthWrite: false,
      });
      const boxMesh = new THREE.Mesh(boxGeo, boxMat);
      boxMesh.position.set(boxX, gGround.y + 0.014, boxZ);
      boxMesh.rotation.x = -Math.PI / 2;
      boxMesh.rotation.z = -gHead;
      this.group.add(boxMesh);
    });

    this.group.add(gantry);
  }

  // -------------------------------------------------------------
  // 3. Spline-Aligned Apex Racing Curbs (Rumble Strips)
  // InstancedMesh implementation: cuts 144 draw calls down to 2
  // -------------------------------------------------------------
  private buildApexRacingCurbs(colliders: THREE.Object3D[]) {
    const curbsGroup = new THREE.Group();
    curbsGroup.name = 'ApexCurbs';

    const roadMeshes = this.getRoadMeshes(colliders);

    // Exact spline segments corresponding to curve apexes
    const apexSegments: { uStart: number; uEnd: number; side: 'left' | 'right'; isExit?: boolean }[] = [
      // Turn 1: Caldera Entry inner curve (left side)
      { uStart: 0.075, uEnd: 0.145, side: 'left' },
      // Turn 2: Caldera Rim peak (left side)
      { uStart: 0.155, uEnd: 0.220, side: 'left' },
      // Turn 3: Dyke Entrance sweep (right side)
      { uStart: 0.265, uEnd: 0.320, side: 'right' },
      // Turn 4: South Outer Hairpin Inner Apex (right side)
      { uStart: 0.355, uEnd: 0.435, side: 'right' },
      // Turn 4: Hairpin Exit Outer Rumble Strip (left side)
      { uStart: 0.395, uEnd: 0.445, side: 'left', isExit: true },
      // Turn 5: Mountain Pass Chicane 1 Apex (left side)
      { uStart: 0.450, uEnd: 0.495, side: 'left' },
      // Turn 5: Mountain Pass Chicane 2 Apex (right side)
      { uStart: 0.540, uEnd: 0.585, side: 'right' },
      // Turn 5: Mountain Switchback Apex (left side)
      { uStart: 0.605, uEnd: 0.655, side: 'left' },
      // Turn 6: Outer West Sweeper Apex (right side)
      { uStart: 0.785, uEnd: 0.885, side: 'right' },
    ];

    const redMat = new THREE.MeshStandardMaterial({
      color: 0xe50914,
      roughness: 0.35,
      metalness: 0.15,
    });
    const whiteMat = new THREE.MeshStandardMaterial({
      color: 0xf5f5f5,
      roughness: 0.35,
      metalness: 0.15,
    });

    const totalRedTeeth = apexSegments.length * 8; // 72
    const totalWhiteTeeth = apexSegments.length * 8; // 72
    const unitCurbGeo = new THREE.BoxGeometry(0.55, 0.045, 1.0);

    const redCurbsInstanced = new THREE.InstancedMesh(unitCurbGeo, redMat, totalRedTeeth);
    redCurbsInstanced.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    redCurbsInstanced.castShadow = true;
    redCurbsInstanced.receiveShadow = true;

    const whiteCurbsInstanced = new THREE.InstancedMesh(unitCurbGeo, whiteMat, totalWhiteTeeth);
    whiteCurbsInstanced.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    whiteCurbsInstanced.castShadow = true;
    whiteCurbsInstanced.receiveShadow = true;

    const dummy = new THREE.Object3D();
    let redIdx = 0;
    let whiteIdx = 0;

    apexSegments.forEach((seg) => {
      const segSteps = 16;
      const stepU = (seg.uEnd - seg.uStart) / segSteps;

      for (let s = 0; s < segSteps; s++) {
        const u = seg.uStart + s * stepU;
        const pt = this.trackSpline.getPointAt(u);
        const tan = this.trackSpline.getTangentAt(u).normalize();
        const norm = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
        const heading = Math.atan2(tan.x, tan.z);

        const sideSign = (seg.side === 'right' ? 1 : -1);
        const baseY = this.getTrueRoadHeight(pt.x, pt.z, roadMeshes, -0.385);
        const edge = this.findRoadEdge(pt, norm, sideSign, baseY, roadMeshes);
        const toothLength = (this.splineLength * stepU) * 1.05;

        // Position flush along road shoulder
        const toothX = pt.x + norm.x * (edge.dist * sideSign);
        const toothZ = pt.z + norm.z * (edge.dist * sideSign);

        dummy.position.set(toothX, edge.y + 0.022, toothZ);
        dummy.rotation.order = 'YXZ';
        dummy.rotation.set(0, heading, sideSign * 0.08); // Subtle bevel banked inwards to asphalt
        dummy.scale.set(1, 1, toothLength);
        dummy.updateMatrix();

        if (s % 2 === 0) {
          if (redIdx < totalRedTeeth) {
            redCurbsInstanced.setMatrixAt(redIdx++, dummy.matrix);
          }
        } else {
          if (whiteIdx < totalWhiteTeeth) {
            whiteCurbsInstanced.setMatrixAt(whiteIdx++, dummy.matrix);
          }
        }
      }
    });

    redCurbsInstanced.instanceMatrix.needsUpdate = true;
    whiteCurbsInstanced.instanceMatrix.needsUpdate = true;

    curbsGroup.add(redCurbsInstanced);
    curbsGroup.add(whiteCurbsInstanced);

    this.group.add(curbsGroup);
  }

  // -------------------------------------------------------------
  // 3. Authentic Forza Horizon Dynamic Racing Guideline (Center of Road)
  // High-density holographic laser chevron ribbon projected flush onto the asphalt centerline.
  // Real-time speed & braking zones: Cyan (Flat out) -> Amber (Prepare) -> Red (Hard Brake)
  // High-performance InstancedMesh: 520 chevrons in a SINGLE draw call at locked 60 FPS
  // -------------------------------------------------------------
  private createDrivingLineChevronTexture(): THREE.CanvasTexture {
    if (this.drivingLineTexture) return this.drivingLineTexture;

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, 256, 256);

    // Continuous dual outer guide rails along the lane edges (seamless pinstripes linking segments)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.fillRect(26, 0, 5, 256);
    ctx.fillRect(225, 0, 5, 256);

    // Continuous central laser core spine running through the entire ribbon
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.fillRect(125, 0, 6, 256);

    // Iconic Forza Horizon aerodynamic double-chevron arrows pointing forward
    const drawChevron = (cy: number, width: number, thickness: number, alpha: number) => {
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.beginPath();
      const tipY = cy - 44;
      const leftX = 128 - width * 0.5;
      const rightX = 128 + width * 0.5;
      const baseY = cy + 20;

      ctx.moveTo(128, tipY);
      ctx.lineTo(rightX, baseY);
      ctx.lineTo(rightX, baseY + thickness);
      ctx.lineTo(128, tipY + thickness);
      ctx.lineTo(leftX, baseY + thickness);
      ctx.lineTo(leftX, baseY);
      ctx.closePath();
      ctx.fill();
    };

    // Soft outer neon bloom glow
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 12;

    // Double chevron aerodynamic wings - dense, vibrant, high-contrast
    drawChevron(168, 168, 28, 0.95); // Rear Chevron wing
    drawChevron(96, 146, 26, 1.0);   // Lead Chevron tip

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    this.drivingLineTexture = tex;
    return tex;
  }

  private buildForzaHorizonDrivingLine(
    colliders: THREE.Object3D[],
    direction: 'normal' | 'reverse' = 'reverse'
  ) {
    const lineGroup = new THREE.Group();
    lineGroup.name = 'ForzaHorizonDrivingLine';
    const roadMeshes = this.getRoadMeshes(colliders);

    const totalSegments = 520;
    // Sleek narrow dense racing ribbon (0.38m width, 0.52m length)
    const chevronGeo = new THREE.PlaneGeometry(0.38, 0.52);
    chevronGeo.rotateX(-Math.PI / 2); // Lay flat on XZ plane with normal +Y

    const chevronTex = this.createDrivingLineChevronTexture();
    const lineMat = new THREE.MeshBasicMaterial({
      map: chevronTex,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      polygonOffset: true,
      polygonOffsetFactor: -4.0,
      polygonOffsetUnits: -4.0,
      side: THREE.DoubleSide,
    });

    const instanced = new THREE.InstancedMesh(chevronGeo, lineMat, totalSegments);
    instanced.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    instanced.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(totalSegments * 3), 3);
    instanced.instanceColor.setUsage(THREE.DynamicDrawUsage);
    instanced.renderOrder = 3;

    this.drivingLineSegments = [];
    const dummy = new THREE.Object3D();

    for (let i = 0; i < totalSegments; i++) {
      const u = i / totalSegments;
      const pt = this.trackSpline.getPointAt(u);
      const tan = this.trackSpline.getTangentAt(u).normalize();
      const driveDir = (direction === 'reverse' ? tan.clone().negate() : tan.clone()).normalize();

      // Precompute local track curvature over an apex window
      const nextU = (u + (direction === 'reverse' ? -0.012 : 0.012) + 1.0) % 1.0;
      const nextTan = this.trackSpline.getTangentAt(nextU).normalize();
      const nextDriveDir = (direction === 'reverse' ? nextTan.clone().negate() : nextTan.clone()).normalize();
      const angle = tan.angleTo(nextTan);
      const segDist = pt.distanceTo(this.trackSpline.getPointAt(nextU));
      const curvature = segDist > 0.001 ? angle / segDist : 0.05;

      // Realistic cornering speed guide in km/h: straights ~220 km/h, chicane ~85 km/h, hairpin ~58 km/h
      const safeSpeedKmH = Math.min(220, Math.max(52, Math.sqrt(28 / Math.max(curvature, 0.022)) * 3.6 * 2.1));

      // Calculate turn direction using 3D cross product of forward drive vectors
      // In Three.js coordinates (X=right, Y=up, Z=backward):
      // driveDir x nextDriveDir has cross.y < -0.003 when turning RIGHT, cross.y > 0.003 when turning LEFT
      const cross = new THREE.Vector3().crossVectors(driveDir, nextDriveDir);
      const turnDirection: 'left' | 'right' | 'straight' =
        cross.y < -0.003 ? 'right' : (cross.y > 0.003 ? 'left' : 'straight');

      let turnName = 'STRAIGHT';
      if (safeSpeedKmH < 75) {
        turnName = turnDirection === 'right' ? 'HAIRPIN RIGHT' : 'HAIRPIN LEFT';
      } else if (safeSpeedKmH < 105) {
        turnName = turnDirection === 'right' ? 'HARD RIGHT' : 'HARD LEFT';
      } else if (safeSpeedKmH < 135) {
        turnName = turnDirection === 'right' ? 'MEDIUM RIGHT' : 'MEDIUM LEFT';
      } else if (safeSpeedKmH < 170) {
        turnName = turnDirection === 'right' ? 'SWEEPER RIGHT' : 'SWEEPER LEFT';
      }

      // Probe exact asphalt surface elevation
      const roadHit = this.probeRoadPoint(pt.x, pt.z, pt.y, roadMeshes);
      const y = roadHit.hit ? roadHit.y + 0.026 : pt.y + 0.026;

      const pos = new THREE.Vector3(pt.x, y, pt.z);
      dummy.position.copy(pos);
      // lookAt opposite drive direction so chevron arrow points along forward driveDir
      dummy.lookAt(pt.x - driveDir.x, y, pt.z - driveDir.z);
      dummy.updateMatrix();

      instanced.setMatrixAt(i, dummy.matrix);

      // Initial color based on static track layout curvature
      let initialColor = this.colorCyan;
      if (safeSpeedKmH < 85) {
        initialColor = this.colorRed;
      } else if (safeSpeedKmH < 130) {
        initialColor = this.colorYellow;
      }
      instanced.setColorAt(i, initialColor);

      this.drivingLineSegments.push({
        pos,
        driveDir,
        u,
        safeSpeedKmH,
        turnDirection,
        turnName,
        baseColor: initialColor,
      });
    }

    instanced.instanceMatrix.needsUpdate = true;
    if (instanced.instanceColor) instanced.instanceColor.needsUpdate = true;

    lineGroup.add(instanced);
    this.drivingLineMesh = instanced;
    this.group.add(lineGroup);
  }

  // -------------------------------------------------------------
  // 4. Trackside Glowing Turn Chevrons (Curve Indicators & Apex Hints)
  // Luminous LED chevron signs mounted along outer barricades facing approaching cars
  // -------------------------------------------------------------
  private createTurnChevronTexture(dir: 'left' | 'right'): THREE.CanvasTexture {
    if (dir === 'left' && this.turnChevronTextureLeft) return this.turnChevronTextureLeft;
    if (dir === 'right' && this.turnChevronTextureRight) return this.turnChevronTextureRight;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Dark carbon background
    ctx.fillStyle = '#0a0d13';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Diagonal carbon pattern lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 2;
    for (let x = -256; x < canvas.width + 256; x += 12) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 256, 256);
      ctx.stroke();
    }

    // Outer high-visibility fluorescent border
    ctx.strokeStyle = '#ffcc00';
    ctx.lineWidth = 10;
    ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);

    // Glowing corner brackets
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(0, 0, 36, 14);
    ctx.fillRect(0, 0, 14, 36);
    ctx.fillRect(canvas.width - 36, 0, 36, 14);
    ctx.fillRect(canvas.width - 14, 0, 14, 36);
    ctx.fillRect(0, canvas.height - 14, 36, 14);
    ctx.fillRect(0, canvas.height - 36, 14, 36);
    ctx.fillRect(canvas.width - 36, canvas.height - 14, 36, 14);
    ctx.fillRect(canvas.width - 14, canvas.height - 36, 14, 36);

    // Draw bold directional chevrons [ ❯ ❯ ❯ ] or [ ❮ ❮ ❮ ]
    const drawChevronArrow = (cx: number) => {
      ctx.save();
      ctx.shadowColor = '#ffb700';
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#ffea00';
      ctx.beginPath();

      const sign = dir === 'right' ? 1 : -1;
      const w = 48 * sign;
      const t = 24 * sign;

      ctx.moveTo(cx - w, 38);
      ctx.lineTo(cx + w * 0.5, 128);
      ctx.lineTo(cx - w, 218);
      ctx.lineTo(cx - w + t, 218);
      ctx.lineTo(cx + w * 0.5 + t, 128);
      ctx.lineTo(cx - w + t, 38);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    const centers = dir === 'right' ? [130, 256, 382] : [382, 256, 130];
    centers.forEach((cx) => drawChevronArrow(cx));

    const tex = new THREE.CanvasTexture(canvas);
    if (dir === 'left') this.turnChevronTextureLeft = tex;
    else this.turnChevronTextureRight = tex;
    return tex;
  }

  private buildTracksideTurnChevrons(
    colliders: THREE.Object3D[],
    direction: 'normal' | 'reverse' = 'reverse'
  ) {
    const group = new THREE.Group();
    group.name = 'TracksideTurnChevrons';
    const roadMeshes = this.getRoadMeshes(colliders);

    const clusters: Array<{
      u: number;
      turnDir: 'left' | 'right';
      sideSign: number; // +1 outer left in reverse / track right in normal, -1 outer right in reverse / track left in normal
      count: number;
      spacingMeters: number;
    }> = direction === 'reverse' ? [
      { u: 0.880, turnDir: 'right', sideSign: 1, count: 3, spacingMeters: 3.2 },
      { u: 0.730, turnDir: 'right', sideSign: 1, count: 4, spacingMeters: 3.2 },
      { u: 0.630, turnDir: 'left', sideSign: -1, count: 3, spacingMeters: 3.0 },
      { u: 0.580, turnDir: 'right', sideSign: 1, count: 4, spacingMeters: 3.0 },
      { u: 0.485, turnDir: 'left', sideSign: -1, count: 3, spacingMeters: 3.0 },
      { u: 0.405, turnDir: 'right', sideSign: 1, count: 3, spacingMeters: 3.2 },
      { u: 0.290, turnDir: 'right', sideSign: 1, count: 3, spacingMeters: 3.4 },
      { u: 0.138, turnDir: 'left', sideSign: -1, count: 3, spacingMeters: 3.2 },
    ] : [
      { u: 0.155, turnDir: 'left', sideSign: -1, count: 3, spacingMeters: 3.2 },
      { u: 0.285, turnDir: 'left', sideSign: 1, count: 3, spacingMeters: 3.4 },
      { u: 0.400, turnDir: 'left', sideSign: 1, count: 3, spacingMeters: 3.2 },
      { u: 0.470, turnDir: 'right', sideSign: -1, count: 3, spacingMeters: 3.0 },
      { u: 0.575, turnDir: 'left', sideSign: 1, count: 4, spacingMeters: 3.0 },
      { u: 0.635, turnDir: 'right', sideSign: -1, count: 3, spacingMeters: 3.0 },
      { u: 0.720, turnDir: 'left', sideSign: 1, count: 4, spacingMeters: 3.2 },
      { u: 0.870, turnDir: 'left', sideSign: 1, count: 4, spacingMeters: 3.2 },
    ];

    const boardGeo = new THREE.BoxGeometry(2.2, 1.1, 0.06);
    const postGeo = new THREE.CylinderGeometry(0.045, 0.045, 1.8, 8);
    const postMat = new THREE.MeshStandardMaterial({
      color: 0x222222,
      roughness: 0.5,
      metalness: 0.7,
    });

    // Spline samples for high-accuracy circuit clearance checks
    const splineSamples: THREE.Vector3[] = [];
    const sampleCount = 360;
    for (let s = 0; s < sampleCount; s++) {
      splineSamples.push(this.trackSpline.getPointAt(s / sampleCount));
    }

    clusters.forEach((cl) => {
      const tex = this.createTurnChevronTexture(cl.turnDir);
      const signMat = new THREE.MeshStandardMaterial({
        map: tex,
        emissiveMap: tex,
        emissive: new THREE.Color(0xffb700),
        emissiveIntensity: 1.25,
        roughness: 0.25,
        metalness: 0.15,
      });
      this.turnChevronMaterials.push(signMat);

      const baseClusterTan = this.trackSpline.getTangentAt(cl.u).normalize();
      const baseClusterNormRight = new THREE.Vector3(-baseClusterTan.z, 0, baseClusterTan.x).normalize();

      for (let k = 0; k < cl.count; k++) {
        // Offset along spline
        const deltaU = (k * (cl.spacingMeters / this.splineLength)) * (direction === 'reverse' ? -1 : 1);
        const u = (cl.u + deltaU + 1.0) % 1.0;

        const pt = this.trackSpline.getPointAt(u);
        const tan = this.trackSpline.getTangentAt(u).normalize();
        const driveDir = (direction === 'reverse' ? tan.clone().negate() : tan.clone()).normalize();
        const normRight = new THREE.Vector3(-tan.z, 0, tan.x).normalize();

        // Discard any sign that flips direction across an apex or tight curve
        if (normRight.dot(baseClusterNormRight) < 0.65) {
          continue;
        }

        const baseY = this.getTrueRoadHeight(pt.x, pt.z, roadMeshes, pt.y);
        const edge = this.findRoadEdge(pt, normRight, cl.sideSign, baseY, roadMeshes);
        // Base lateral offset firmly on the grass/shoulder outside the asphalt and curbs
        let lateralDist = Math.max(edge.dist + 1.85, 5.2);

        let finalPosX = pt.x + normRight.x * lateralDist * cl.sideSign;
        let finalPosZ = pt.z + normRight.z * lateralDist * cl.sideSign;
        let finalFaceDir = new THREE.Vector3();
        let boardBaseY = baseY;

        let isValidPlacement = false;

        // Iterative multi-point verification: pushes the sign board and posts outward
        // until all support posts, corners, and center are completely clear of the road surface
        for (let iter = 0; iter < 12; iter++) {
          finalPosX = pt.x + normRight.x * lateralDist * cl.sideSign;
          finalPosZ = pt.z + normRight.z * lateralDist * cl.sideSign;
          const ground = this.probeGround(finalPosX, finalPosZ, pt.y, colliders);
          boardBaseY = Math.max(ground.y, edge.y) + 0.15;

          // Face towards oncoming car with subtle inward slant
          const toRoad = new THREE.Vector3(pt.x - finalPosX, 0, pt.z - finalPosZ).normalize();
          finalFaceDir = toRoad.clone().multiplyScalar(0.92).addScaledVector(driveDir, -0.38).normalize();

          // 5 multi-point verification test points (Center, Left Post, Right Post, Left Board Edge, Right Board Edge)
          const testPoints = [
            new THREE.Vector3(finalPosX, boardBaseY, finalPosZ), // Center
            new THREE.Vector3(finalPosX - finalFaceDir.z * 0.65, boardBaseY, finalPosZ + finalFaceDir.x * 0.65), // Left post
            new THREE.Vector3(finalPosX + finalFaceDir.z * 0.65, boardBaseY, finalPosZ - finalFaceDir.x * 0.65), // Right post
            new THREE.Vector3(finalPosX - finalFaceDir.z * 1.15, boardBaseY, finalPosZ + finalFaceDir.x * 1.15), // Left edge
            new THREE.Vector3(finalPosX + finalFaceDir.z * 1.15, boardBaseY, finalPosZ - finalFaceDir.x * 1.15), // Right edge
          ];

          let conflict = false;
          for (const tp of testPoints) {
            // 1. Vertical raycast against road meshes (using actual road baseY)
            const roadHit = this.probeRoadPoint(tp.x, tp.z, baseY, roadMeshes);
            if (roadHit.hit) {
              conflict = true;
              break;
            }
            // 2. Track spline clearance check (must be >= 4.40m from any road centerline point)
            for (let s = 0; s < sampleCount; s++) {
              const sp = splineSamples[s];
              if (Math.hypot(tp.x - sp.x, tp.z - sp.z) < 4.40) {
                conflict = true;
                break;
              }
            }
            if (conflict) break;
          }

          if (conflict) {
            lateralDist += 0.35;
          } else {
            isValidPlacement = true;
            break;
          }
        }

        // Guarantees that if no conflict-free placement exists outside the road,
        // the sign is strictly omitted rather than placed in the middle of the track!
        if (!isValidPlacement) {
          continue;
        }

        const boardMesh = new THREE.Mesh(boardGeo, signMat);
        boardMesh.position.set(finalPosX, boardBaseY + 0.95, finalPosZ);
        boardMesh.lookAt(boardMesh.position.clone().add(finalFaceDir));
        boardMesh.castShadow = true;
        group.add(boardMesh);

        // Twin support steel posts firmly planted in the terrain verge
        const leftPost = new THREE.Mesh(postGeo, postMat);
        leftPost.position.set(finalPosX - finalFaceDir.z * 0.65, boardBaseY + 0.65, finalPosZ + finalFaceDir.x * 0.65);
        group.add(leftPost);

        const rightPost = new THREE.Mesh(postGeo, postMat);
        rightPost.position.set(finalPosX + finalFaceDir.z * 0.65, boardBaseY + 0.65, finalPosZ - finalFaceDir.x * 0.65);
        group.add(rightPost);
      }
    });

    this.group.add(group);
  }

  // Real-time Road Hint queries: computes the upcoming corner name, direction, distance, and safe speed
  public getUpcomingTurnHint(carPos: THREE.Vector3, carSpeedKmH: number): RoadHintData | null {
    if (!this.drivingLineSegments || this.drivingLineSegments.length === 0) return null;

    const total = this.drivingLineSegments.length;
    // O(1) direct reuse of the segment index tracked during update()
    let closestIdx = this.closestCarSegmentIdx;
    if (closestIdx < 0 || closestIdx >= total) closestIdx = 0;

    // Look ahead 6 to 85 segments (approx 3.5m to 51m ahead along the active racing path)
    let mostDemandingSeg: typeof this.drivingLineSegments[0] | null = null;
    let minSpeed = Infinity;
    let aheadDistance = 0;

    for (let step = 6; step <= 90; step++) {
      const idx = (closestIdx + step * (this.trackDirection === 'reverse' ? -1 : 1) + total) % total;
      const seg = this.drivingLineSegments[idx];
      if (seg.safeSpeedKmH < minSpeed && seg.turnDirection !== 'straight') {
        minSpeed = seg.safeSpeedKmH;
        mostDemandingSeg = seg;
        aheadDistance = step * 0.596;
      }
    }

    if (!mostDemandingSeg || minSpeed > 145) {
      return null; // Flat out / Straightaway
    }

    const speedExcess = carSpeedKmH - minSpeed;
    let severity: 'safe' | 'caution' | 'brake' = 'safe';
    if (speedExcess > 16) {
      severity = 'brake';
    } else if (speedExcess > 4) {
      severity = 'caution';
    }

    return {
      title: mostDemandingSeg.turnName,
      direction: mostDemandingSeg.turnDirection,
      distanceMeters: Math.max(5, Math.round(aheadDistance)),
      safeSpeedKmH: Math.round(minSpeed),
      severity,
    };
  }

  // -------------------------------------------------------------
  // 5. Authentic NASCAR Cup Series Trackside Advertisements
  // Replaces cluttered freestanding hoardings with realistic, high-impact NASCAR sponsor boards
  // -------------------------------------------------------------
  private buildNascarTracksideAdvertisements(colliders: THREE.Object3D[], direction: 'normal' | 'reverse') {
    const adsGroup = new THREE.Group();
    adsGroup.name = 'NascarAdvertisements';
    const roadMeshes = this.getRoadMeshes(colliders);

    const nascarDefs: Array<{
      u: number;
      sponsor: 'deepak-gusaiwal' | 'nascar' | 'goodyear' | 'sunoco' | 'monster' | 'mobil1' | 'basspro' | 'castrol' | 'coca-cola' | 'valvoline' | 'chevy' | 'ford' | 'toyota';
      preferredSide?: 'left' | 'right';
      width?: number;
      height?: number;
    }> = [
      // 1. High Caldera Entrance Bank
      { u: 0.090, sponsor: 'goodyear', preferredSide: 'right', width: 4.8, height: 1.20 },
      { u: 0.160, sponsor: 'deepak-gusaiwal', preferredSide: 'left', width: 5.2, height: 1.25 },
      { u: 0.210, sponsor: 'monster', preferredSide: 'right', width: 4.8, height: 1.20 },
      { u: 0.260, sponsor: 'deepak-gusaiwal', preferredSide: 'left', width: 5.2, height: 1.25 },

      // 2. Eastern Dyke high-speed traverse (Spectacular water / cliff views)
      { u: 0.310, sponsor: 'deepak-gusaiwal', preferredSide: 'left', width: 5.2, height: 1.25 },
      { u: 0.360, sponsor: 'sunoco', preferredSide: 'left', width: 4.8, height: 1.20 },
      { u: 0.410, sponsor: 'deepak-gusaiwal', preferredSide: 'left', width: 5.2, height: 1.25 },

      // 3. Southern Hairpin outer perimeter
      { u: 0.480, sponsor: 'valvoline', preferredSide: 'right', width: 5.0, height: 1.20 },
      { u: 0.530, sponsor: 'deepak-gusaiwal', preferredSide: 'right', width: 5.2, height: 1.25 },

      // 4. Mountain pass outer ridge
      { u: 0.610, sponsor: 'mobil1', preferredSide: 'right', width: 4.8, height: 1.20 },
      { u: 0.690, sponsor: 'deepak-gusaiwal', preferredSide: 'left', width: 5.2, height: 1.25 },

      // 5. Western switchback outer ridge
      { u: 0.750, sponsor: 'deepak-gusaiwal', preferredSide: 'left', width: 5.2, height: 1.25 },
      { u: 0.800, sponsor: 'chevy', preferredSide: 'left', width: 4.8, height: 1.20 },
      { u: 0.850, sponsor: 'deepak-gusaiwal', preferredSide: 'left', width: 5.2, height: 1.25 },
      { u: 0.890, sponsor: 'ford', preferredSide: 'left', width: 4.8, height: 1.20 },
    ];

    const inwardAngle = 0.22; // ~12.5 degrees subtle viewing angle toward oncoming cars
    const sampleCount = 200;
    const splineSamples: THREE.Vector3[] = [];
    for (let s = 0; s < sampleCount; s++) {
      splineSamples.push(this.trackSpline.getPointAt(s / sampleCount));
    }

    // Shared high-performance materials: cuts dozens of shader pipeline state swaps
    const sharedBackMat = new THREE.MeshStandardMaterial({
      color: 0x14161a,
      roughness: 0.75,
      metalness: 0.55,
      side: THREE.FrontSide,
    });
    const sharedRailMat = new THREE.MeshStandardMaterial({
      color: 0x48505e,
      metalness: 0.88,
      roughness: 0.25,
    });
    const sharedPostMat = new THREE.MeshStandardMaterial({
      color: 0x1a1e24,
      metalness: 0.82,
      roughness: 0.35,
    });

    nascarDefs.forEach((item) => {
      const u = item.u;
      const pt = this.trackSpline.getPointAt(u);
      const tan = this.trackSpline.getTangentAt(u).normalize();
      const driveDir = (direction === 'reverse' ? tan.clone().negate() : tan.clone()).normalize();
      const normRight = new THREE.Vector3(-driveDir.z, 0, driveDir.x).normalize();

      // Automatically determine the SAFE, EXTERIOR side of the circuit (avoiding tight inside loops)
      let bestSide: 'left' | 'right' = item.preferredSide || 'left';
      let bestOtherClearance = -1;

      for (const candidateSide of ['left', 'right'] as const) {
        const testSign = candidateSide === 'right' ? 1 : -1;
        const testPoint = pt.clone().addScaledVector(normRight, 5.2 * testSign);
        let minOtherD = Infinity;

        for (let s = 0; s < sampleCount; s++) {
          const su = s / sampleCount;
          const diffU = Math.min(Math.abs(su - u), 1 - Math.abs(su - u));
          if (diffU > 0.045) { // Other sections of the racetrack
            const sp = splineSamples[s];
            const d = Math.hypot(testPoint.x - sp.x, testPoint.z - sp.z);
            if (d < minOtherD) minOtherD = d;
          }
        }

        // Bias towards preferredSide if both sides have ample clearance
        const score = minOtherD + (candidateSide === item.preferredSide ? 2.5 : 0);
        if (score > bestOtherClearance) {
          bestOtherClearance = score;
          bestSide = candidateSide;
        }
      }

      const sideSign = bestSide === 'right' ? 1 : -1;
      const baseY = this.getTrueRoadHeight(pt.x, pt.z, roadMeshes, -0.385);
      const edge = this.findRoadEdge(pt, normRight, sideSign, baseY, roadMeshes);

      const boardW = item.width || 4.8;
      const boardH = item.height || 1.2;

      // Base lateral offset firmly on the grass/shoulder outside the asphalt
      let lateralDist = Math.max(edge.dist + 1.85, 5.2);
      let isValidPlacement = false;

      const boardGroup = new THREE.Group();

      // Multi-point verification test offsets (in local billboard coordinates)
      const localTestPoints = [
        new THREE.Vector3(-boardW * 0.38, 0, 0),     // Left Post
        new THREE.Vector3(boardW * 0.38, 0, 0),      // Right Post
        new THREE.Vector3(-boardW * 0.50, 0, 0),     // Left Board Edge
        new THREE.Vector3(boardW * 0.50, 0, 0),      // Right Board Edge
        new THREE.Vector3(0, 0, 0),                  // Center
        new THREE.Vector3(-boardW * 0.38, 0, -0.40), // Left Rear Anchor
        new THREE.Vector3(boardW * 0.38, 0, -0.40),  // Right Rear Anchor
      ];

      for (let iter = 0; iter < 12; iter++) {
        const posX = pt.x + normRight.x * lateralDist * sideSign;
        const posZ = pt.z + normRight.z * lateralDist * sideSign;
        const ground = this.probeGround(posX, posZ, pt.y, colliders);
        const bannerBaseY = Math.max(ground.y, edge.y);

        // Billboard front face points towards the road centerline, with subtle slant toward oncoming traffic
        const toRoad = new THREE.Vector3(pt.x - posX, 0, pt.z - posZ).normalize();
        const faceDir = toRoad
          .clone()
          .multiplyScalar(Math.cos(inwardAngle))
          .addScaledVector(driveDir, -Math.sin(inwardAngle))
          .normalize();

        boardGroup.position.set(posX, bannerBaseY, posZ);
        boardGroup.lookAt(boardGroup.position.clone().add(faceDir));
        boardGroup.updateMatrixWorld(true);

        let conflict = false;

        for (const localPt of localTestPoints) {
          const worldPt = localPt.clone().applyMatrix4(boardGroup.matrixWorld);

          // 1. Global track spline clearance check: must never be within 4.4m of ANY road point
          for (let s = 0; s < sampleCount; s++) {
            const sp = splineSamples[s];
            if (Math.hypot(worldPt.x - sp.x, worldPt.z - sp.z) < 4.40) {
              conflict = true;
              break;
            }
          }
          if (conflict) break;

          // 2. Direct vertical raycast against all drivable road meshes
          const roadHit = this.probeRoadPoint(worldPt.x, worldPt.z, pt.y, roadMeshes);
          if (roadHit.hit) {
            conflict = true;
            break;
          }
        }

        if (!conflict) {
          isValidPlacement = true;
          break;
        }

        // Push billboard further outward into the terrain
        lateralDist += 0.35;
      }

      // If no conflict-free placement exists on this curve, skip to guarantee clean track
      if (!isValidPlacement) {
        return;
      }

      // Final ground anchor height
      const finalGround = this.probeGround(boardGroup.position.x, boardGroup.position.z, pt.y, colliders);
      const bannerBaseY = Math.max(finalGround.y, edge.y);
      boardGroup.position.y = bannerBaseY;

      // 1. Front High-Impact NASCAR Sponsor Billboard Plate
      const bannerGeo = new THREE.PlaneGeometry(boardW, boardH);
      const bannerTex = this.getNascarBannerTexture(item.sponsor);
      const bannerMat = new THREE.MeshStandardMaterial({
        map: bannerTex,
        roughness: 0.28,
        metalness: 0.18,
        emissive: new THREE.Color(0xffffff),
        emissiveMap: bannerTex,
        emissiveIntensity: 0.40,
        side: THREE.FrontSide,
      });
      const bannerMesh = new THREE.Mesh(bannerGeo, bannerMat);
      bannerMesh.position.set(0, boardH * 0.5 + 0.35, 0.018);
      boardGroup.add(bannerMesh);

      // 2. Back High-Impact Sponsor Billboard Plate (Authentic Double-Sided Circuit Presentation)
      const backMesh = new THREE.Mesh(bannerGeo, bannerMat);
      backMesh.position.set(0, boardH * 0.5 + 0.35, -0.018);
      backMesh.rotation.y = Math.PI;
      boardGroup.add(backMesh);

      // 3. Central Enclosure Core Box
      const coreGeo = new THREE.BoxGeometry(boardW + 0.04, boardH + 0.04, 0.032);
      const coreMesh = new THREE.Mesh(coreGeo, sharedBackMat);
      coreMesh.position.set(0, boardH * 0.5 + 0.35, 0);
      boardGroup.add(coreMesh);

      // 3. Brushed Aluminum Frame Retainer Rails (Top & Bottom, shared material)
      const railGeo = new THREE.BoxGeometry(boardW + 0.08, 0.05, 0.06);
      const topRail = new THREE.Mesh(railGeo, sharedRailMat);
      topRail.position.set(0, boardH + 0.37, 0);
      boardGroup.add(topRail);

      const btmRail = new THREE.Mesh(railGeo, sharedRailMat);
      btmRail.position.set(0, 0.33, 0);
      boardGroup.add(btmRail);

      // 4. Sturdy Structural Upright Mounting Posts (Anchored Deep Into Embankment, shared material)
      const postTop = boardH + 0.45;
      const postBottom = -1.10; // 1.1m deep foundation into the terrain so posts never float
      const postHeight = postTop - postBottom;
      const postGeo = new THREE.BoxGeometry(0.10, postHeight, 0.10);

      [-boardW * 0.38, boardW * 0.38].forEach((ox) => {
        const post = new THREE.Mesh(postGeo, sharedPostMat);
        post.position.set(ox, (postTop + postBottom) * 0.5, 0);
        boardGroup.add(post);

        // Rear diagonal brace / anchor strut (anchors into back embankment)
        const braceGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.25, 6);
        const brace = new THREE.Mesh(braceGeo, sharedPostMat);
        brace.position.set(ox, 0.45, -0.38);
        brace.rotation.x = Math.PI / 4;
        boardGroup.add(brace);
      });

      adsGroup.add(boardGroup);
    });

    this.group.add(adsGroup);
  }

  // -------------------------------------------------------------
  // 7. Horizon Checkpoint Festival Gates with Smoke Flares
  // -------------------------------------------------------------
  public createHorizonCheckpointGates(
    checkpoints: CheckpointVisualDef[],
    direction: 'normal' | 'reverse' = 'reverse',
    colliders?: THREE.Object3D[]
  ): THREE.Group[] {
    // Clear previous gates & flare particles
    this.checkpointGates.forEach((g) => {
      this.group.remove(g);
    });
    this.checkpointGates = [];
    for (const p of this.flareParticles) {
      this.scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      (p.mesh.material as THREE.Material).dispose();
    }
    this.flareParticles = [];
    this.animatedLightBars = [];

    const markers: THREE.Group[] = [];

    checkpoints.forEach((cp, idx) => {
      const gateGroup = new THREE.Group();

      // Find nearest spline point to determine exact road tangent and normal
      const cpVec = new THREE.Vector3(cp.position[0], cp.position[1], cp.position[2]);
      let bestU = 0;
      let minDist = Infinity;
      const samples = 100;
      for (let s = 0; s < samples; s++) {
        const u = s / samples;
        const pt = this.trackSpline.getPointAt(u);
        const d = pt.distanceTo(cpVec);
        if (d < minDist) {
          minDist = d;
          bestU = u;
        }
      }

      const tan = this.trackSpline.getTangentAt(bestU).normalize();
      const driveDir = (direction === 'reverse' ? tan.clone().negate() : tan.clone()).normalize();
      const heading = Math.atan2(-driveDir.x, -driveDir.z);

      const ground = this.probeGround(cp.position[0], cp.position[2], cp.position[1], colliders);
      gateGroup.position.set(cp.position[0], ground.y, cp.position[2]);
      gateGroup.rotation.y = heading;

      // Start line gate is covered by Start/Finish Gantry
      if (idx === 0) {
        markers.push(gateGroup);
        this.checkpointGates.push(gateGroup);
        this.group.add(gateGroup);
        return;
      }

      const norm = new THREE.Vector3(-driveDir.z, 0, driveDir.x).normalize();
      const roadMeshes = colliders ? this.getRoadMeshes(colliders) : [];
      const edgeR = this.findRoadEdge(cpVec, norm, 1, ground.y, roadMeshes).dist;
      const edgeL = this.findRoadEdge(cpVec, norm, -1, ground.y, roadMeshes).dist;
      const maxEdge = Math.max(edgeR, edgeL, 3.2);
      const pylonDist = Math.max(maxEdge + 1.25, 4.4);
      const pylonHeight = 3.6;

      const pylonMat = new THREE.MeshStandardMaterial({
        color: 0x1a1e24,
        metalness: 0.85,
        roughness: 0.35,
      });

      const ledMat = new THREE.MeshStandardMaterial({
        color: idx % 2 === 0 ? 0x00e5ff : 0xff007f,
        emissive: idx % 2 === 0 ? new THREE.Color(0x00e5ff) : new THREE.Color(0xff007f),
        emissiveIntensity: 1.8,
        roughness: 0.2,
      });
      this.animatedLightBars.push(ledMat);

      [-pylonDist, pylonDist].forEach((side) => {
        const pylon = new THREE.Group();
        pylon.position.set(side, 0, 0);

        // Angled base truss column
        const columnGeo = new THREE.BoxGeometry(0.24, pylonHeight, 0.24);
        const column = new THREE.Mesh(columnGeo, pylonMat);
        column.position.set(0, pylonHeight / 2, 0);
        column.rotation.z = (side > 0 ? -1 : 1) * 0.08;
        pylon.add(column);

        // Glowing vertical LED light strip (clean NASCAR timing marker)
        const ledGeo = new THREE.BoxGeometry(0.08, pylonHeight * 0.85, 0.08);
        const led = new THREE.Mesh(ledGeo, ledMat);
        led.position.set((side > 0 ? -0.12 : 0.12), pylonHeight * 0.52, 0);
        led.rotation.z = column.rotation.z;
        pylon.add(led);

        // Official Deepak Gusaiwal Trackside Sponsor Banner on Checkpoint Pylon
        const pylonSignGeo = new THREE.PlaneGeometry(0.70, 1.80);
        const pylonSignTex = this.createCheckpointSignTexture();
        const pylonSignMat = new THREE.MeshStandardMaterial({
          map: pylonSignTex,
          roughness: 0.35,
          metalness: 0.2,
          side: THREE.DoubleSide,
        });
        const pylonSign = new THREE.Mesh(pylonSignGeo, pylonSignMat);
        pylonSign.position.set(side > 0 ? -0.18 : 0.18, pylonHeight * 0.50, 0);
        pylonSign.rotation.y = Math.PI / 2;
        pylon.add(pylonSign);

        gateGroup.add(pylon);
      });

      // Overhead Speed Beam
      const beamGeo = new THREE.CylinderGeometry(0.04, 0.04, pylonDist * 2, 8);
      const beamMat = new THREE.MeshBasicMaterial({
        color: idx % 2 === 0 ? 0x00e5ff : 0xff007f,
        transparent: true,
        opacity: 0.9,
      });
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.set(0, pylonHeight - 0.2, 0);
      beam.rotation.z = Math.PI / 2;
      gateGroup.add(beam);

      markers.push(gateGroup);
      this.checkpointGates.push(gateGroup);
      this.group.add(gateGroup);
    });

    return markers;
  }

  // -------------------------------------------------------------
  // Texture Generator Helpers
  // -------------------------------------------------------------
  private static dgLogoPaths: { p1: Path2D; p2: Path2D; p3: Path2D; p4: Path2D } | null = null;

  private static getDgLogoPaths() {
    if (!ForzaTrackVisuals.dgLogoPaths && typeof Path2D !== 'undefined') {
      ForzaTrackVisuals.dgLogoPaths = {
        p1: new Path2D(
          'M171.57 572.666C209.172 572.666 246.406 565.26 281.145 550.87C315.885 536.481 347.45 515.39 374.038 488.801C400.627 462.213 421.718 430.648 436.108 395.908C450.497 361.168 457.903 323.935 457.903 286.333C457.903 248.731 450.497 211.498 436.108 176.758C421.718 142.019 400.627 110.453 374.038 83.865C347.45 57.2765 315.885 36.1854 281.145 21.7958C246.406 7.40622 209.172 -1.6436e-06 171.57 0V114.533C194.131 114.533 216.472 118.977 237.315 127.611C258.159 136.244 277.098 148.899 293.051 164.852C309.004 180.805 321.659 199.744 330.293 220.588C338.926 241.432 343.37 263.772 343.37 286.333C343.37 308.894 338.926 331.234 330.293 352.078C321.659 372.922 309.004 391.861 293.051 407.814C277.098 423.767 258.159 436.422 237.315 445.055C216.472 453.689 194.131 458.133 171.57 458.133V572.666Z'
        ),
        p2: new Path2D(
          'M744.236 0C683.412 3.44291 632.246 16.793 585.158 48.2557C538.071 79.7184 501.371 124.437 479.699 176.758C458.027 229.079 452.357 286.651 463.405 342.194C474.453 397.737 501.724 448.757 541.768 488.801C581.813 528.845 632.832 556.116 688.376 567.164C743.919 578.212 801.491 572.542 853.811 550.87C906.132 529.198 950.851 492.498 982.314 445.411C1013.78 398.324 1030.57 342.964 1030.57 286.333H916.036C916.036 320.312 905.96 353.527 887.083 381.78C868.205 410.032 841.374 432.052 809.981 445.055C778.589 458.058 744.046 461.461 710.72 454.832C677.394 448.203 646.782 431.84 622.756 407.814C598.729 383.787 582.367 353.175 575.738 319.849C569.109 286.524 572.511 251.98 585.514 220.588C598.517 189.196 620.537 162.364 648.79 143.487C677.042 124.609 710.258 114.533 744.236 114.533V0Z'
        ),
        p3: new Path2D(
          'M171.57 114.763C149.039 114.763 126.729 119.201 105.913 127.823C85.0973 136.445 66.1836 149.083 50.2518 165.015C34.32 180.946 21.6822 199.86 13.06 220.676C4.4378 241.492 -7.1618e-07 263.802 0 286.333C7.1618e-07 308.864 4.4378 331.174 13.06 351.99C21.6822 372.806 34.32 391.72 50.2518 407.652C66.1836 423.583 85.0974 436.221 105.913 444.843C126.729 453.466 149.039 457.903 171.57 457.903V114.763Z'
        ),
        p4: new Path2D('M749.974 286.907V183.62H911.216L1030.57 286.907H749.974Z'),
      };
    }
    return ForzaTrackVisuals.dgLogoPaths;
  }

  public drawDeepakGusaiwalLogo(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number
  ) {
    const paths = ForzaTrackVisuals.getDgLogoPaths();
    if (!paths) return;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(w / 1031, h / 573);

    // D and G white curved contours
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 4;
    ctx.fill(paths.p1);
    ctx.fill(paths.p2);

    // Crimson red #CB152F inner crescent and wedge arrow
    ctx.fillStyle = '#CB152F';
    ctx.shadowColor = '#CB152F';
    ctx.shadowBlur = 10;
    ctx.fill(paths.p3);
    ctx.fill(paths.p4);

    ctx.restore();
  }

  private getNascarBannerTexture(sponsor: string): THREE.CanvasTexture {
    if (this.nascarTextureCache.has(sponsor)) {
      return this.nascarTextureCache.get(sponsor)!;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Helper: draw checkered border bands
    const drawCheckeredBand = (x: number, y: number, w: number, h: number, size: number = 16) => {
      const cols = Math.ceil(w / size);
      const rows = Math.ceil(h / size);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          ctx.fillStyle = (r + c) % 2 === 0 ? '#ffffff' : '#111317';
          ctx.fillRect(x + c * size, y + r * size, Math.min(size, w - c * size), Math.min(size, h - r * size));
        }
      }
    };

    switch (sponsor) {
      case 'deepak-gusaiwal': {
        // High-end Motorsport Carbon Dark Background
        ctx.fillStyle = '#0a0c10';
        ctx.fillRect(0, 0, 1024, 256);

        // Carbon weave subtle diagonal micro-texture
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
        ctx.lineWidth = 2;
        for (let i = -256; i < 1024 + 256; i += 8) {
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i + 256, 256);
          ctx.stroke();
        }

        // Bold Racing Red / Crimson speed accents matching DG logo #CB152F
        const redGrad = ctx.createLinearGradient(0, 0, 1024, 0);
        redGrad.addColorStop(0, '#CB152F');
        redGrad.addColorStop(0.3, '#ff2442');
        redGrad.addColorStop(0.7, '#CB152F');
        redGrad.addColorStop(1, '#7a0010');

        // Top and bottom racing borders
        ctx.fillStyle = redGrad;
        ctx.fillRect(0, 0, 1024, 16);
        ctx.fillRect(0, 240, 1024, 16);

        // Gold pinstripe
        ctx.fillStyle = '#fed100';
        ctx.fillRect(0, 16, 1024, 4);
        ctx.fillRect(0, 236, 1024, 4);

        // Sleek outer frame
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.lineWidth = 3;
        ctx.strokeRect(6, 6, 1012, 244);

        // Draw the Official Deepak Gusaiwal DG Vector Logo on the left side
        this.drawDeepakGusaiwalLogo(ctx, 36, 56, 225, 125);

        // Sleek vertical separator
        const divGrad = ctx.createLinearGradient(0, 36, 0, 220);
        divGrad.addColorStop(0, 'rgba(203, 21, 47, 0)');
        divGrad.addColorStop(0.5, '#CB152F');
        divGrad.addColorStop(1, 'rgba(203, 21, 47, 0)');
        ctx.fillStyle = divGrad;
        ctx.fillRect(285, 36, 4, 184);

        // Main Brand Name: DEEPAK GUSAIWAL (clean, unobstructed presentation)
        ctx.font = 'italic 900 62px "Arial Black", Impact, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
        ctx.shadowBlur = 12;
        ctx.fillText('DEEPAK GUSAIWAL', 315, 126);

        // Subtitle: MOTORSPORTS • VOLCANO SPEEDWAY TITLE SPONSOR
        ctx.font = 'italic 900 34px "Arial Black", Impact, sans-serif';
        ctx.fillStyle = '#CB152F';
        ctx.shadowColor = '#CB152F';
        ctx.shadowBlur = 12;
        ctx.fillText('MOTORSPORTS', 318, 185);

        ctx.font = 'bold 22px "Arial Black", sans-serif';
        ctx.fillStyle = '#fed100';
        ctx.shadowBlur = 0;
        ctx.fillText('• OFFICIAL TITLE PARTNER', 615, 183);
        break;
      }
      case 'nascar': {
        // Deep race carbon background
        ctx.fillStyle = '#0a0d15';
        ctx.fillRect(0, 0, 1024, 256);

        // NASCAR iconic 4-color slanted bar on the left
        const colors = ['#fed100', '#ea0029', '#00a3e0', '#002b70'];
        const barW = 34;
        const skew = -42;
        colors.forEach((col, idx) => {
          ctx.fillStyle = col;
          ctx.beginPath();
          const bx = 55 + idx * (barW + 8);
          ctx.moveTo(bx, 24);
          ctx.lineTo(bx + barW, 24);
          ctx.lineTo(bx + barW + skew, 232);
          ctx.lineTo(bx + skew, 232);
          ctx.closePath();
          ctx.fill();
        });

        // NASCAR text
        ctx.save();
        ctx.font = 'italic 900 115px "Arial Black", Impact, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 12;
        ctx.fillText('NASCAR', 255, 145);

        // Cup Series banner bar
        ctx.fillStyle = '#fed100';
        ctx.fillRect(255, 168, 520, 48);
        ctx.font = 'italic 900 36px "Arial Black", Impact, sans-serif';
        ctx.fillStyle = '#000000';
        ctx.shadowBlur = 0;
        ctx.fillText('CUP SERIES', 270, 206);
        ctx.restore();

        // Right side checkered flag pattern
        drawCheckeredBand(840, 24, 140, 208, 26);
        break;
      }

      case 'goodyear': {
        // Goodyear Royal Blue
        ctx.fillStyle = '#002878';
        ctx.fillRect(0, 0, 1024, 256);

        // Top & bottom bright yellow accent lines
        ctx.fillStyle = '#fed100';
        ctx.fillRect(0, 0, 1024, 18);
        ctx.fillRect(0, 238, 1024, 18);

        // Wingfoot motif / chevron in center
        ctx.font = 'italic 900 110px "Arial Black", Impact, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fed100';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 10;
        ctx.fillText('GOOD•YEAR', 512, 145);

        ctx.font = 'bold 34px "Arial Black", sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('#1 IN RACING • EAGLE RADIALS', 512, 205);
        break;
      }

      case 'sunoco': {
        // Sunoco Royal Blue
        ctx.fillStyle = '#003380';
        ctx.fillRect(0, 0, 1024, 256);

        // Diamond emblem behind text
        ctx.fillStyle = '#fed100';
        ctx.beginPath();
        ctx.moveTo(512, 16);
        ctx.lineTo(840, 128);
        ctx.lineTo(512, 240);
        ctx.lineTo(184, 128);
        ctx.closePath();
        ctx.fill();

        // Red arrow through center
        ctx.fillStyle = '#d50000';
        ctx.beginPath();
        ctx.moveTo(140, 144);
        ctx.lineTo(884, 112);
        ctx.lineTo(870, 96);
        ctx.lineTo(920, 124);
        ctx.lineTo(860, 150);
        ctx.lineTo(870, 134);
        ctx.lineTo(140, 156);
        ctx.closePath();
        ctx.fill();

        // Bold SUNOCO text
        ctx.font = 'italic 900 100px "Arial Black", Impact, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#003380';
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 8;
        ctx.fillText('SUNOCO', 512, 160);

        // RACING FUEL subtext
        ctx.font = 'italic 900 30px "Arial Black", sans-serif';
        ctx.fillStyle = '#fed100';
        ctx.fillText('OFFICIAL RACING FUEL OF NASCAR', 512, 218);
        break;
      }

      case 'monster': {
        // Matte Black / Carbon
        ctx.fillStyle = '#0c0d10';
        ctx.fillRect(0, 0, 1024, 256);

        // Neon Green Glowing Claws
        ctx.fillStyle = '#00ff3c';
        ctx.shadowColor = '#00ff3c';
        ctx.shadowBlur = 24;

        // 3 Claws
        [-50, 0, 50].forEach((ox, i) => {
          ctx.beginPath();
          const cx = 180 + ox;
          ctx.moveTo(cx - 10, 30 + (i === 1 ? -10 : 10));
          ctx.lineTo(cx + 12, 30 + (i === 1 ? -10 : 10));
          ctx.lineTo(cx + 2 + ox * 0.1, 226);
          ctx.lineTo(cx - 16 + ox * 0.1, 226);
          ctx.closePath();
          ctx.fill();
        });

        // Monster text
        ctx.font = 'italic 900 88px "Arial Black", Impact, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 8;
        ctx.fillText('MONSTER', 340, 135);

        // Energy text
        ctx.font = 'italic 900 52px "Arial Black", Impact, sans-serif';
        ctx.fillStyle = '#00ff3c';
        ctx.shadowColor = '#00ff3c';
        ctx.shadowBlur = 16;
        ctx.fillText('ENERGY', 345, 198);
        break;
      }

      case 'mobil1': {
        // Deep Racing Navy
        ctx.fillStyle = '#0a1730';
        ctx.fillRect(0, 0, 1024, 256);

        // White border
        ctx.lineWidth = 12;
        ctx.strokeStyle = '#ffffff';
        ctx.strokeRect(16, 16, 992, 224);

        // Mobil text in white, 1 in red
        ctx.font = 'italic 900 115px "Arial Black", Impact, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 10;
        ctx.fillText('Mobil ', 430, 150);

        ctx.fillStyle = '#e51924';
        ctx.fillText('1', 650, 150);

        ctx.font = 'bold 30px "Arial Black", sans-serif';
        ctx.fillStyle = '#fed100';
        ctx.shadowBlur = 0;
        ctx.fillText('SYNTHETIC MOTOR OIL • OFFICIAL TECH PARTNER', 512, 206);
        break;
      }

      case 'basspro': {
        // Bass Pro Shops Forest Green & Gold
        ctx.fillStyle = '#0d2314';
        ctx.fillRect(0, 0, 1024, 256);

        // Golden oval
        ctx.lineWidth = 10;
        ctx.strokeStyle = '#f5b800';
        ctx.strokeRect(18, 18, 988, 220);

        ctx.font = 'italic 900 80px "Arial Black", Impact, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#f5b800';
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 12;
        ctx.fillText('Bass Pro Shops', 512, 135);

        ctx.fillStyle = '#e51924';
        ctx.font = 'bold 34px "Arial Black", sans-serif';
        ctx.fillText('TRACKER BOATS • OUTDOOR WORLD', 512, 195);
        break;
      }

      case 'castrol': {
        // Castrol Racing Green / Red
        ctx.fillStyle = '#006d35';
        ctx.fillRect(0, 0, 1024, 256);

        // Red top / bottom accents
        ctx.fillStyle = '#e31837';
        ctx.fillRect(0, 0, 1024, 22);
        ctx.fillRect(0, 234, 1024, 22);

        ctx.font = 'italic 900 110px "Arial Black", Impact, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 10;
        ctx.fillText('Castrol', 512, 140);

        ctx.font = 'italic 900 42px "Arial Black", sans-serif';
        ctx.fillStyle = '#fed100';
        ctx.fillText('EDGE • FLUID TITANIUM TECHNOLOGY', 512, 200);
        break;
      }

      case 'coca-cola': {
        // Classic Coca-Cola Red
        ctx.fillStyle = '#dd0026';
        ctx.fillRect(0, 0, 1024, 256);

        // Dynamic white ribbon wave
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(0, 180);
        ctx.bezierCurveTo(300, 240, 700, 120, 1024, 170);
        ctx.lineTo(1024, 256);
        ctx.lineTo(0, 256);
        ctx.closePath();
        ctx.fill();

        ctx.font = 'italic 900 100px "Arial Black", Impact, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 10;
        ctx.fillText('Coca-Cola', 512, 135);

        ctx.font = 'italic 900 32px "Arial Black", sans-serif';
        ctx.fillStyle = '#dd0026';
        ctx.shadowBlur = 0;
        ctx.fillText('RACING FAMILY • TASTE THE FEELING', 512, 226);
        break;
      }

      case 'valvoline': {
        // Valvoline Deep Navy & Racing Red
        ctx.fillStyle = '#0b1e3e';
        ctx.fillRect(0, 0, 1024, 256);

        // Red V chevron on left
        ctx.fillStyle = '#e31837';
        ctx.beginPath();
        ctx.moveTo(80, 28);
        ctx.lineTo(140, 28);
        ctx.lineTo(190, 170);
        ctx.lineTo(240, 28);
        ctx.lineTo(300, 28);
        ctx.lineTo(220, 228);
        ctx.lineTo(160, 228);
        ctx.closePath();
        ctx.fill();

        ctx.font = 'italic 900 95px "Arial Black", Impact, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('VALVOLINE', 330, 140);

        ctx.font = 'bold 30px "Arial Black", sans-serif';
        ctx.fillStyle = '#00a3e0';
        ctx.fillText('ORIGINAL MOTOR OIL • SINCE 1866', 335, 195);
        break;
      }

      case 'chevy': {
        // Chevrolet Performance Carbon & Gold
        ctx.fillStyle = '#101318';
        ctx.fillRect(0, 0, 1024, 256);

        // Gold bowtie
        ctx.fillStyle = '#d4af37';
        ctx.fillRect(110, 75, 120, 106);
        ctx.fillRect(55, 106, 230, 44);

        ctx.font = 'italic 900 84px "Arial Black", Impact, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('CHEVROLET', 320, 135);

        ctx.font = 'italic 900 44px "Arial Black", sans-serif';
        ctx.fillStyle = '#d4af37';
        ctx.fillText('PERFORMANCE', 325, 195);
        break;
      }

      case 'ford': {
        // Ford Performance Blue
        ctx.fillStyle = '#002878';
        ctx.fillRect(0, 0, 1024, 256);

        ctx.lineWidth = 10;
        ctx.strokeStyle = '#ffffff';
        ctx.strokeRect(18, 18, 988, 220);

        ctx.font = 'italic 900 100px "Arial Black", Impact, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('Ford', 512, 130);

        ctx.font = 'italic 900 42px "Arial Black", sans-serif';
        ctx.fillStyle = '#e31837';
        ctx.fillText('PERFORMANCE', 512, 195);
        break;
      }

      case 'toyota': {
        // Toyota TRD Black & Red
        ctx.fillStyle = '#0f1115';
        ctx.fillRect(0, 0, 1024, 256);

        // Red/Orange racing stripes
        ctx.fillStyle = '#ff2b00';
        ctx.fillRect(0, 0, 1024, 18);
        ctx.fillStyle = '#ff8800';
        ctx.fillRect(0, 18, 1024, 8);

        ctx.font = 'italic 900 90px "Arial Black", Impact, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('TOYOTA', 120, 150);

        ctx.font = 'italic 900 90px "Arial Black", Impact, sans-serif';
        ctx.fillStyle = '#e80018';
        ctx.shadowColor = '#e80018';
        ctx.shadowBlur = 15;
        ctx.fillText('TRD', 620, 150);

        ctx.font = 'bold 28px "Arial Black", sans-serif';
        ctx.fillStyle = '#aaaaaa';
        ctx.shadowBlur = 0;
        ctx.fillText('TOYOTA RACING DEVELOPMENT', 125, 205);
        break;
      }

      default: {
        ctx.fillStyle = '#0a0d15';
        ctx.fillRect(0, 0, 1024, 256);
        ctx.font = 'italic 900 80px "Arial Black", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(sponsor.toUpperCase(), 512, 150);
      }
    }

    // Overlay Deepak Gusaiwal Title Partner Header & Vector Logo onto EVERY partner advertisement
    if (sponsor !== 'deepak-gusaiwal') {
      const topBarH = 42;

      // Dark carbon background bar with subtle gloss
      ctx.fillStyle = '#0a0d14';
      ctx.fillRect(0, 0, 1024, topBarH);

      // Crimson #CB152F racing underline
      ctx.fillStyle = '#CB152F';
      ctx.fillRect(0, topBarH - 3, 1024, 3);

      // Gold pinstripe
      ctx.fillStyle = '#fed100';
      ctx.fillRect(0, topBarH, 1024, 2);

      // Left DG Vector Logo
      this.drawDeepakGusaiwalLogo(ctx, 14, 6, 54, 30);

      // Left Brand Text
      ctx.font = 'italic 900 22px "Arial Black", Impact, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 6;
      ctx.fillText('DEEPAK GUSAIWAL MOTORSPORTS', 78, 28);

      // Center title text
      ctx.font = 'bold 15px "Arial Black", sans-serif';
      ctx.fillStyle = '#fed100';
      ctx.shadowBlur = 0;
      ctx.textAlign = 'center';
      ctx.fillText('★ OFFICIAL CIRCUIT TITLE SPONSOR ★', 620, 27);

      // Right DG Vector Logo
      this.drawDeepakGusaiwalLogo(ctx, 954, 6, 54, 30);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    this.nascarTextureCache.set(sponsor, tex);
    return tex;
  }

  private createFestivalMarqueeTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Carbon dark gradient
    const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
    grad.addColorStop(0, '#0a0d14');
    grad.addColorStop(0.2, '#141824');
    grad.addColorStop(0.5, '#1e2436');
    grad.addColorStop(0.8, '#141824');
    grad.addColorStop(1, '#0a0d14');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // NASCAR 4-color racing bar across the top
    const barColors = ['#fed100', '#ea0029', '#00a3e0', '#002b70'];
    const barSegmentW = canvas.width / barColors.length;
    barColors.forEach((col, i) => {
      ctx.fillStyle = col;
      ctx.fillRect(i * barSegmentW, 0, barSegmentW, 14);
    });

    // Checkered border on the bottom
    const sq = 16;
    for (let x = 0; x < canvas.width; x += sq * 2) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, canvas.height - 20, sq, 10);
      ctx.fillRect(x + sq, canvas.height - 10, sq, 10);
    }

    // Top Header: DEEPAK GUSAIWAL RACING
    ctx.font = 'italic 900 34px "Arial Black", Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fed100';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 10;
    ctx.fillText('★ DEEPAK GUSAIWAL RACING PRESENTS ★', canvas.width / 2, 58);

    // Main Title: VOLCANO 500
    ctx.font = 'italic 900 84px "Arial Black", Impact, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#CB152F';
    ctx.shadowBlur = 18;
    ctx.fillText('VOLCANO 500', canvas.width / 2, 138);

    // Subtitle: OFFICIAL MAGMA MOTOR SPEEDWAY CHAMPIONSHIP
    ctx.font = 'italic 900 25px "Arial Black", sans-serif';
    ctx.fillStyle = '#00e5ff';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 8;
    ctx.fillText('OFFICIAL CHAMPIONSHIP ROUND • MAGMA MOTOR SPEEDWAY', canvas.width / 2, 196);

    // Draw Deepak Gusaiwal DG Vector Logos flanking the marquee on left and right
    this.drawDeepakGusaiwalLogo(ctx, 36, 52, 145, 80);
    this.drawDeepakGusaiwalLogo(ctx, canvas.width - 181, 52, 145, 80);

    return new THREE.CanvasTexture(canvas);
  }

  private createCheckeredRibbonTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    const rows = 4;
    const cols = 32;
    const cw = canvas.width / cols;
    const ch = canvas.height / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = ((r + c) % 2 === 0) ? '#ffffff' : '#111111';
        ctx.fillRect(c * cw, r * ch, cw, ch);
      }
    }

    // Center Title Sponsor Banner across finish line tarmac
    const bannerW = 640;
    const bannerH = 56;
    const bx = (canvas.width - bannerW) / 2;
    const by = (canvas.height - bannerH) / 2;

    ctx.fillStyle = '#0a0c10';
    ctx.fillRect(bx, by, bannerW, bannerH);

    ctx.lineWidth = 3;
    ctx.strokeStyle = '#CB152F';
    ctx.strokeRect(bx, by, bannerW, bannerH);

    // Left DG Logo
    this.drawDeepakGusaiwalLogo(ctx, bx + 16, by + 8, 68, 38);

    // Main Finish Line Text
    ctx.font = 'italic 900 28px "Arial Black", Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 8;
    ctx.fillText('DEEPAK GUSAIWAL GP', canvas.width / 2 + 10, by + 38);

    // Right DG Logo
    this.drawDeepakGusaiwalLogo(ctx, bx + bannerW - 84, by + 8, 68, 38);

    return new THREE.CanvasTexture(canvas);
  }

  private createGridBoxTexture(num: string): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 384;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#fed100';
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

    ctx.font = 'bold 150px "Arial Black", Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 8;
    ctx.fillText(num, canvas.width / 2, 245);

    return new THREE.CanvasTexture(canvas);
  }

  private checkpointSignTexture: THREE.CanvasTexture | null = null;

  private createCheckpointSignTexture(): THREE.CanvasTexture {
    if (this.checkpointSignTexture) return this.checkpointSignTexture;

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Carbon dark gradient
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#0a0c10');
    grad.addColorStop(0.5, '#151821');
    grad.addColorStop(1, '#0a0c10');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Crimson red borders #CB152F
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#CB152F';
    ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);

    // Top and bottom gold stripes
    ctx.fillStyle = '#fed100';
    ctx.fillRect(0, 0, canvas.width, 10);
    ctx.fillRect(0, canvas.height - 10, canvas.width, 10);

    // Top DG Logo
    this.drawDeepakGusaiwalLogo(ctx, 38, 28, 180, 100);

    // Vertical brand text
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2 + 10);
    ctx.rotate(-Math.PI / 2);
    ctx.font = 'italic 900 38px "Arial Black", Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 8;
    ctx.fillText('DEEPAK GUSAIWAL', 0, 14);
    ctx.restore();

    // Bottom DG Logo
    this.drawDeepakGusaiwalLogo(ctx, 38, canvas.height - 128, 180, 100);

    this.checkpointSignTexture = new THREE.CanvasTexture(canvas);
    return this.checkpointSignTexture;
  }

  private createVerticalBannerTexture(text: string, color: string): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Checkered headers top and bottom
    const sq = 16;
    for (let x = 0; x < canvas.width; x += sq * 2) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, 0, sq, 14);
      ctx.fillRect(x + sq, 14, sq, 14);
      ctx.fillRect(x, canvas.height - 28, sq, 14);
      ctx.fillRect(x + sq, canvas.height - 14, sq, 14);
    }

    if (text.includes('DEEPAK') || text.includes('DG')) {
      // Draw DG logo at the top
      this.drawDeepakGusaiwalLogo(ctx, 16, 36, 96, 53);
      // Draw DG logo at the bottom
      this.drawDeepakGusaiwalLogo(ctx, 16, canvas.height - 90, 96, 53);
    }

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.font = 'italic 900 56px "Arial Black", Impact, sans-serif';
    ctx.textAlign = 'center';
    if (text.includes('DEEPAK')) {
      ctx.fillStyle = '#ffffff';
    } else if (text.includes('DG')) {
      ctx.fillStyle = '#fed100';
    } else if (text.includes('GOODYEAR')) {
      ctx.fillStyle = '#fed100';
    } else if (text.includes('SUNOCO')) {
      ctx.fillStyle = '#002b70';
    } else {
      ctx.fillStyle = '#ffffff';
    }
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 6;
    ctx.fillText(text, 0, 20);
    ctx.restore();

    return new THREE.CanvasTexture(canvas);
  }

  // -------------------------------------------------------------
  // Frame Update: Dynamic Driving Line, Smoke Plumes & Pulse LEDs
  // -------------------------------------------------------------
  public update(delta: number, camera?: THREE.Camera, carPos?: THREE.Vector3, carSpeedKmH: number = 0) {
    const time = performance.now() * 0.003;

    // 1. Dynamic Forza Horizon Driving Guideline Color, Lookahead Spotlight & Forward Pulse
    if (this.drivingLineMesh && this.drivingLineSegments.length > 0) {
      const total = this.drivingLineSegments.length;

      // Find segment closest to car using efficient local window search
      let closestIdx = this.lastClosestIdx;
      if (carPos) {
        let minDistSq = Infinity;
        const searchHalf = 32;
        let bestI = closestIdx;
        for (let offset = -searchHalf; offset <= searchHalf; offset++) {
          const idx = (closestIdx + offset + total) % total;
          const seg = this.drivingLineSegments[idx];
          const dx = seg.pos.x - carPos.x;
          const dz = seg.pos.z - carPos.z;
          const dSq = dx * dx + dz * dz;
          if (dSq < minDistSq) {
            minDistSq = dSq;
            bestI = idx;
          }
        }
        // Fallback full scan only if vehicle teleported / reset
        if (minDistSq > 120) {
          for (let i = 0; i < total; i++) {
            const seg = this.drivingLineSegments[i];
            const dx = seg.pos.x - carPos.x;
            const dz = seg.pos.z - carPos.z;
            const dSq = dx * dx + dz * dz;
            if (dSq < minDistSq) {
              minDistSq = dSq;
              bestI = i;
            }
          }
        }
        closestIdx = bestI;
        this.lastClosestIdx = closestIdx;
        this.closestCarSegmentIdx = closestIdx;
      }

      // Throttle GPU buffer update to ~25 Hz (40ms) to eliminate GPU bus transfer bottlenecks
      const nowMs = performance.now();
      if (nowMs - this.lastGuidelineUpdateTime >= 40) {
        this.lastGuidelineUpdateTime = nowMs;
        const pulseTime = nowMs * 0.005;

        // Efficiently update only the active lookahead spotlight range (0 to 80 segments = ~48m ahead)
        const lookaheadSteps = 80;
        for (let step = 0; step <= lookaheadSteps; step++) {
          const i = (closestIdx + step * (this.trackDirection === 'reverse' ? -1 : 1) + total) % total;
          const seg = this.drivingLineSegments[i];
          const trackDist = step * 0.596;
          const speedExcess = carSpeedKmH - seg.safeSpeedKmH;

          // Dynamic speed & braking warning
          let targetColor = seg.baseColor;
          if (speedExcess > 16) {
            targetColor = this.colorRed; // Urgent braking zone!
          } else if (speedExcess > 4) {
            targetColor = this.colorYellow; // Moderate deceleration / trail brake
          } else {
            targetColor = this.colorCyan; // Safe accelerating line
          }

          // Forward guiding spotlight & pulse
          const proximity = 1.0 - Math.min(1.0, trackDist / 48.0);
          const forwardPulse = Math.sin(pulseTime * 6.5 - trackDist * 0.38) * 0.20 + 0.80;
          const intensity = (1.15 + proximity * 0.40) * forwardPulse;

          this.tempColor.copy(targetColor).multiplyScalar(intensity);
          this.drivingLineMesh.setColorAt(i, this.tempColor);
        }

        // Restore trailing segments behind the car back to clean baseColor
        for (let b = 1; b <= 10; b++) {
          const behindIdx = (closestIdx - b * (this.trackDirection === 'reverse' ? -1 : 1) + total) % total;
          this.drivingLineMesh.setColorAt(behindIdx, this.drivingLineSegments[behindIdx].baseColor);
        }

        if (this.drivingLineMesh.instanceColor) {
          this.drivingLineMesh.instanceColor.needsUpdate = true;
        }
      }
    }

    // Pulse trackside LED turn chevron signs
    if (this.turnChevronMaterials.length > 0) {
      const chevronPulse = 1.15 + Math.sin(time * 3.5) * 0.35;
      for (const mat of this.turnChevronMaterials) {
        mat.emissiveIntensity = chevronPulse;
      }
    }

    // Billow rising colored festival smoke from flare canisters
    for (const p of this.flareParticles) {
      p.offsetY += delta * p.speed;
      if (p.offsetY > 3.2) {
        p.offsetY = 0;
      }

      const lifeRatio = p.offsetY / 3.2;
      p.mesh.position.set(
        p.basePos.x + Math.sin(time + p.phase) * (0.15 + lifeRatio * 0.4),
        p.basePos.y + p.offsetY,
        p.basePos.z + Math.cos(time + p.phase) * (0.15 + lifeRatio * 0.4)
      );

      const s = p.baseScale * (1.0 + lifeRatio * 1.8);
      p.mesh.scale.set(s, s, s);

      const mat = p.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = (1.0 - lifeRatio) * 0.55;

      if (camera) {
        p.mesh.quaternion.copy(camera.quaternion);
      }
    }

    // Pulse checkpoint LED light strips
    const pulse = 1.4 + Math.sin(time * 2.5) * 0.5;
    for (const mat of this.animatedLightBars) {
      mat.emissiveIntensity = pulse;
    }
  }

  public dispose() {
    this.clearDynamicVisuals();
    if (this.turnChevronTextureLeft) {
      this.turnChevronTextureLeft.dispose();
      this.turnChevronTextureLeft = null;
    }
    if (this.turnChevronTextureRight) {
      this.turnChevronTextureRight.dispose();
      this.turnChevronTextureRight = null;
    }
    this.scene.remove(this.group);
  }
}
