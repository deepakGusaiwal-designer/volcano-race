import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ParticleManager } from './ParticleManager';

export interface AICarConfig {
  id: string;
  name: string;
  modelType: 'iridium' | 'rd09' | 'mazda';
  colorHex: number;
  laneOffset: number; // Lateral offset from center line (-0.75m to +0.75m)
  skillMultiplier: number; // 0.92 to 1.05
  gridSlot: number; // 1, 2, 3
}

export class AICarController {
  public id: string;
  public name: string;
  public config: AICarConfig;
  public mesh: THREE.Group = new THREE.Group();
  public position = new THREE.Vector3();
  public quaternion = new THREE.Quaternion();
  public velocity = new THREE.Vector3();
  public speedKmH = 0;
  public currentHeading = -Math.PI / 2;
  public steerAngle = 0;
  public isBoosting = false;
  public currentLap = 1;
  public progressU = 0;
  public totalProgress = 0;
  public carScale = 0.14;

  private scene: THREE.Scene;
  private particleManager: ParticleManager;
  private trackSpline: THREE.CatmullRomCurve3;
  private splineLength: number;
  private modelRoot: THREE.Group | null = null;
  private wheelLF: THREE.Object3D | null = null;
  private wheelRF: THREE.Object3D | null = null;
  private wheelLR: THREE.Object3D | null = null;
  private wheelRR: THREE.Object3D | null = null;
  private initialQuatLF = new THREE.Quaternion();
  private initialQuatRF = new THREE.Quaternion();
  private initialQuatLR = new THREE.Quaternion();
  private initialQuatRR = new THREE.Quaternion();
  private isSkinnedHotWheels = false;
  private wheelSpinAngle = 0;

  // Physics & Raycasting
  private raycaster = new THREE.Raycaster();
  private rayOrigin = new THREE.Vector3();
  private rayDir = new THREE.Vector3(0, -1, 0);
  private surfaceNormal = new THREE.Vector3(0, 1, 0);
  public forwardVec = new THREE.Vector3();
  private rightVec = new THREE.Vector3();
  private alignedForward = new THREE.Vector3();
  private localZ = new THREE.Vector3();
  private rotMatrix = new THREE.Matrix4();
  private targetQuat = new THREE.Quaternion();
  private grounded = true;
  private verticalVelocity = 0;
  private lastTargetY = 0;
  private airTime = 0;
  private suspensionRestLength = 0.026 * 0.14;

  // AI Behaviors
  private currentLaneOffset: number;
  private smoothedLaneOffset: number;
  private bodyRollAngle = 0;
  private boostTimer = 0;
  private nextBoostTime = 8 + Math.random() * 12;
  private hasPassedMidpoint = false;

  constructor(
    scene: THREE.Scene,
    particleManager: ParticleManager,
    trackSpline: THREE.CatmullRomCurve3,
    config: AICarConfig
  ) {
    this.scene = scene;
    this.particleManager = particleManager;
    this.trackSpline = trackSpline;
    this.splineLength = trackSpline.getLength();
    this.config = config;
    this.id = config.id;
    this.name = config.name;
    this.currentLaneOffset = config.laneOffset;
    this.smoothedLaneOffset = config.laneOffset;
    (this.raycaster as any).firstHitOnly = true;

    this.scene.add(this.mesh);
  }

  async loadModel(): Promise<void> {
    const loader = new GLTFLoader();
    let modelPath = '/models/mazda.glb';
    // All 3 car models have Front at +Z in raw GLB coordinates.
    // Rotating by Math.PI around Y places the front nose at -Z (Three.js standard forward).
    const rotY = Math.PI;
    let baseScaleFactor = 1.0;

    if (this.config.modelType === 'iridium') {
      modelPath = '/models/hot_wheels_iridium.glb';
      baseScaleFactor = 0.009355; // Matches Mazda wheelbase exactly (2.75m)
    } else if (this.config.modelType === 'rd09') {
      modelPath = '/models/hotwheels_rd09.glb';
      baseScaleFactor = 0.01030; // Matches Mazda wheelbase exactly (2.75m)
    }

    return new Promise((resolve, reject) => {
      loader.load(
        modelPath,
        (gltf) => {
          while (this.mesh.children.length > 0) {
            this.mesh.remove(this.mesh.children[0]);
          }

          const model = gltf.scene;
          model.rotation.y = rotY;

          const scale = this.carScale * baseScaleFactor;
          model.scale.set(scale, scale, scale);

          this.isSkinnedHotWheels = this.config.modelType === 'iridium' || this.config.modelType === 'rd09';

          if (this.isSkinnedHotWheels) {
            this.wheelLF = model.getObjectByName('BONE_FL_VIS_WHEEL_010_18') || null;
            this.wheelRF = model.getObjectByName('BONE_FR_VIS_WHEEL_013_21') || null;
            this.wheelLR = model.getObjectByName('BONE_BL_VIS_WHEEL_03_11') || null;
            this.wheelRR = model.getObjectByName('BONE_BR_VIS_WHEEL_06_14') || null;
          } else {
            this.wheelLF = model.getObjectByName('WHEEL_LF') || null;
            this.wheelRF = model.getObjectByName('WHEEL_RF') || null;
            this.wheelLR = model.getObjectByName('WHEEL_LR') || null;
            this.wheelRR = model.getObjectByName('WHEEL_RR') || null;
          }

          if (this.wheelLF) this.initialQuatLF.copy(this.wheelLF.quaternion);
          if (this.wheelRF) this.initialQuatRF.copy(this.wheelRF.quaternion);
          if (this.wheelLR) this.initialQuatLR.copy(this.wheelLR.quaternion);
          if (this.wheelRR) this.initialQuatRR.copy(this.wheelRR.quaternion);

          model.traverse((child) => {
            if (child.name.includes('RIM_BLUR')) {
              child.visible = false;
            }

            if ((child as THREE.Mesh).isMesh) {
              const m = child as THREE.Mesh;
              m.castShadow = true;
              m.receiveShadow = true;

              const mat = m.material as THREE.MeshStandardMaterial;
              if (mat) {
                const matName = (mat.name || '').toLowerCase();
                // Apply distinctive rival team paint color
                if (
                  matName.includes('carpaint') ||
                  matName.includes('exterior') ||
                  matName.includes('livery') ||
                  matName.includes('body')
                ) {
                  // Clone so liveries don't cross-contaminate between cars
                  const clonedMat = mat.clone();
                  clonedMat.color.setHex(this.config.colorHex);
                  clonedMat.roughness = 0.22;
                  clonedMat.metalness = 0.45;
                  m.material = clonedMat;
                } else if (matName.includes('glass')) {
                  mat.transparent = true;
                  mat.opacity = 0.65;
                }
              }
            }
          });

          this.modelRoot = model;
          this.mesh.add(model);
          resolve();
        },
        undefined,
        (err) => reject(err)
      );
    });
  }

  setCarScale(scale: number) {
    this.carScale = scale;
    this.suspensionRestLength = 0.026 * scale;
    if (this.modelRoot) {
      let baseScaleFactor = 1.0;
      if (this.config.modelType === 'iridium') baseScaleFactor = 0.009355;
      else if (this.config.modelType === 'rd09') baseScaleFactor = 0.01030;
      const s = scale * baseScaleFactor;
      this.modelRoot.scale.set(s, s, s);
    }
  }

  setTrackSpline(spline: THREE.CatmullRomCurve3) {
    this.trackSpline = spline;
    this.splineLength = spline.getLength();
  }

  setSpawn(gridSlot: number, direction: 'normal' | 'reverse' = 'reverse') {
    const startX = -7.26;
    const startZ = 10.61;
    const rowOffset = gridSlot * 3.2; // 3.2m spacing per grid row
    const lateralSide = gridSlot % 2 === 1 ? 0.65 : -0.65; // Stagger left/right lane

    if (direction === 'reverse') {
      // In reverse mode: Face -X (heading = Math.PI / 2), cars staggered along +X behind start line
      this.position.set(startX + rowOffset, 0.1, startZ + lateralSide);
      this.currentHeading = Math.PI / 2;
    } else {
      // In normal mode: Face +X (heading = -Math.PI / 2), cars staggered along -X behind start line
      this.position.set(startX - rowOffset, 0.1, startZ + lateralSide);
      this.currentHeading = -Math.PI / 2;
    }

    this.speedKmH = 0;
    this.velocity.set(0, 0, 0);
    this.currentLap = 1;
    this.hasPassedMidpoint = false;
    this.isBoosting = false;
    this.boostTimer = 0;
    this.nextBoostTime = 6 + Math.random() * 8;
    this.currentLaneOffset = this.config.laneOffset;
    this.smoothedLaneOffset = this.config.laneOffset;
    this.bodyRollAngle = 0;

    // Initialize progress U along spline
    this.progressU = this.findNearestU(this.position);
    // If spawned just behind the start line (U ~ 0.95-0.99), effective lap 1 progress is progressU - 1.0 (sub-zero)
    const normalizedProgress = this.progressU > 0.85 ? this.progressU - 1.0 : this.progressU;
    this.totalProgress = 1.0 + normalizedProgress;

    this.mesh.position.copy(this.position);
    this.forwardVec.set(-Math.sin(this.currentHeading), 0, -Math.cos(this.currentHeading)).normalize();
    this.surfaceNormal.set(0, 1, 0);
    this.rightVec.crossVectors(this.forwardVec, this.surfaceNormal).normalize();
    this.alignedForward.copy(this.forwardVec);
    this.localZ.copy(this.alignedForward).negate();
    this.rotMatrix.makeBasis(this.rightVec, this.surfaceNormal, this.localZ);
    this.mesh.quaternion.setFromRotationMatrix(this.rotMatrix);
    this.quaternion.copy(this.mesh.quaternion);
  }

  applyCollisionImpulse(impulse: THREE.Vector3, impactPoint: THREE.Vector3) {
    this.velocity.x += impulse.x;
    this.velocity.z += impulse.z;

    const forwardImpulse = impulse.x * this.forwardVec.x + impulse.z * this.forwardVec.z;
    this.speedKmH += (forwardImpulse * 3.6) / this.carScale;
    this.speedKmH = THREE.MathUtils.clamp(this.speedKmH, 20, 225);

    const rx = impactPoint.x - this.position.x;
    const rz = impactPoint.z - this.position.z;
    const torqueYaw = rx * impulse.z - rz * impulse.x;
    this.currentHeading += THREE.MathUtils.clamp(torqueYaw * 0.85, -0.40, 0.40);

    const lateralImpulse = impulse.x * this.rightVec.x + impulse.z * this.rightVec.z;
    this.bodyRollAngle = THREE.MathUtils.clamp(this.bodyRollAngle - lateralImpulse * 0.04, -0.055, 0.055);
  }

  private findNearestU(pos: THREE.Vector3): number {
    let bestU = 0;
    let minDist = Infinity;
    const samples = 100;
    for (let i = 0; i < samples; i++) {
      const u = i / samples;
      const pt = this.trackSpline.getPointAt(u);
      const d = pt.distanceTo(pos);
      if (d < minDist) {
        minDist = d;
        bestU = u;
      }
    }
    return bestU;
  }

  update(
    delta: number,
    colliders: THREE.Object3D[],
    playerPos: THREE.Vector3,
    playerTotalProgress?: number,
    onPlayerHit?: (impulseSpeed: number) => void
  ) {
    const dt = Math.min(delta, 0.05);

    // 1. Advance Spline Position U
    let bestU = this.progressU;
    let minDist = Infinity;
    for (let du = -0.005; du <= 0.030; du += 0.001) {
      const testU = (this.progressU + du + 1.0) % 1.0;
      const pt = this.trackSpline.getPointAt(testU);
      const d = pt.distanceTo(this.position);
      if (d < minDist) {
        minDist = d;
        bestU = testU;
      }
    }

    // Midpoint check to prevent false lap completion right after grid start
    if (this.progressU > 0.40 && this.progressU < 0.60) {
      this.hasPassedMidpoint = true;
    }

    // Legitimate lap crossing detection: only completes lap after passing circuit midpoint
    if (this.hasPassedMidpoint && this.progressU > 0.88 && bestU < 0.12) {
      this.currentLap++;
      this.hasPassedMidpoint = false;
    }
    this.progressU = bestU;

    const normalizedProgress = (!this.hasPassedMidpoint && this.currentLap === 1 && this.progressU > 0.85)
      ? this.progressU - 1.0
      : this.progressU;
    this.totalProgress = this.currentLap + normalizedProgress;

    // 2. Curvature-Aware Adaptive Lookahead Navigation
    const currentTangent = this.trackSpline.getTangentAt(this.progressU);
    const aheadTangent = this.trackSpline.getTangentAt((this.progressU + 0.025) % 1.0);
    const trackCurvature = 1.0 - Math.max(0, currentTangent.dot(aheadTangent));

    const lookaheadDist = THREE.MathUtils.lerp(
      THREE.MathUtils.clamp(this.speedKmH * 0.058, 3.5, 11.5),
      2.8,
      Math.min(1.0, trackCurvature * 2.2)
    );

    const targetU = (this.progressU + lookaheadDist / this.splineLength) % 1.0;
    const targetPt = this.trackSpline.getPointAt(targetU);
    const tangent = this.trackSpline.getTangentAt(targetU).normalize();
    const trackNormal = new THREE.Vector3(-tangent.z, 0, tangent.x);

    // Initial heading estimation
    const dx = targetPt.x - this.position.x;
    const dz = targetPt.z - this.position.z;
    const rawHeading = Math.atan2(-dx, -dz);
    let rawAngleDiff = rawHeading - this.currentHeading;
    while (rawAngleDiff > Math.PI) rawAngleDiff -= Math.PI * 2;
    while (rawAngleDiff < -Math.PI) rawAngleDiff += Math.PI * 2;

    // Adaptive lane offset: in tight corners and hairpins, smoothly converge to racing line
    let effectiveLaneOffset = this.currentLaneOffset;
    const curveTightness = Math.max(trackCurvature * 1.5, Math.abs(rawAngleDiff));
    if (curveTightness > 0.18) {
      effectiveLaneOffset *= Math.max(0.08, 1.0 - (curveTightness - 0.18) * 2.5);
    }
    // Force center offset across jump platform ramp
    if (this.position.x > -4.0 && this.position.x < 8.0 && this.position.z > 8.0 && this.position.z < 13.0) {
      effectiveLaneOffset = 0.0;
    }

    // Smooth lane offset transition so AI never abruptly side-shifts or weaves
    this.smoothedLaneOffset += (effectiveLaneOffset - this.smoothedLaneOffset) * Math.min(1, dt * 2.5);

    targetPt.addScaledVector(trackNormal, this.smoothedLaneOffset);

    // Recompute steering angle towards final offset target point
    const fdx = targetPt.x - this.position.x;
    const fdz = targetPt.z - this.position.z;
    const finalDesiredHeading = Math.atan2(-fdx, -fdz);
    let finalAngleDiff = finalDesiredHeading - this.currentHeading;
    while (finalAngleDiff > Math.PI) finalAngleDiff -= Math.PI * 2;
    while (finalAngleDiff < -Math.PI) finalAngleDiff += Math.PI * 2;

    const maxSteer = 0.58;
    const targetSteer = THREE.MathUtils.clamp(finalAngleDiff * 2.0, -maxSteer, maxSteer);
    this.steerAngle += (targetSteer - this.steerAngle) * Math.min(1, dt * 7.5);

    const speedRatio = Math.min(1.0, Math.abs(this.speedKmH) / 8);
    const turnMultiplier = THREE.MathUtils.lerp(3.2, 4.8, Math.min(1.0, Math.abs(finalAngleDiff) * 1.6));
    this.currentHeading += this.steerAngle * dt * speedRatio * turnMultiplier;

    // 3. Nitro Boost AI Trigger
    this.boostTimer += dt;
    if (this.boostTimer >= this.nextBoostTime) {
      // Boost on clear straights to challenge and pressure the player
      const isAheadOfPlayer = playerTotalProgress !== undefined && (this.totalProgress > playerTotalProgress + 0.08);
      if (trackCurvature < 0.07 && Math.abs(finalAngleDiff) < 0.16 && this.speedKmH > 70 && !isAheadOfPlayer) {
        this.isBoosting = true;
        if (this.boostTimer >= this.nextBoostTime + 2.2) {
          this.isBoosting = false;
          this.boostTimer = 0;
          this.nextBoostTime = 8 + Math.random() * 8;
        }
      }
    }

    // 4. Speed, Curvature & Braking Physics: Matched to player car performance (~170 - 185 km/h)
    let targetSpeed = 175 * this.config.skillMultiplier;
    if (this.isBoosting) {
      targetSpeed = 220 * this.config.skillMultiplier;
    }

    // Dynamic Cornering Slowdown: rivals realistically brake for bends while retaining racing momentum
    const curveIntensity = Math.max(trackCurvature * 2.5, (Math.abs(finalAngleDiff) - 0.12) * 2.2);
    if (curveIntensity > 0.06) {
      const slowRatio = Math.min(1.0, (curveIntensity - 0.06) * 1.8);
      const cornerTarget = THREE.MathUtils.lerp(150, 105, slowRatio) * this.config.skillMultiplier;
      targetSpeed = Math.min(targetSpeed, cornerTarget);
    }

    // Dynamic Race Balancing (Rubber-banding): keeps racing close, intense, and competitive
    if (playerTotalProgress !== undefined) {
      const progressDiff = this.totalProgress - playerTotalProgress;
      if (progressDiff > 0.035) {
        // AI is leading ahead: slight modulation so player can chase and battle
        const leadRatio = Math.min(1.0, (progressDiff - 0.035) / 0.08);
        const catchupFactor = THREE.MathUtils.lerp(1.0, 0.92, leadRatio);
        targetSpeed *= catchupFactor;
      } else if (progressDiff < -0.015) {
        // AI is trailing: stay competitive and attack to challenge player
        const trailRatio = Math.min(1.0, (-progressDiff - 0.015) / 0.08);
        const pressureFactor = THREE.MathUtils.lerp(1.0, 1.12, trailRatio);
        targetSpeed *= pressureFactor;
      }
    }

    if (this.speedKmH < targetSpeed) {
      // Aggressive sports-car acceleration matched to player car
      const baseAccel = (this.isBoosting ? 92 : 62) * this.config.skillMultiplier;
      const currentRatio = Math.min(1.0, Math.max(0, this.speedKmH) / (targetSpeed + 5));
      const accel = baseAccel * Math.max(0.35, 1.0 - currentRatio * 0.65);
      this.speedKmH += accel * dt;
    } else {
      const brake = 75;
      this.speedKmH = Math.max(targetSpeed, this.speedKmH - brake * dt);
    }

    // 5. Movement in XZ plane with lateral grip traction
    const speedMs = (this.speedKmH * 1000 / 3600) * this.carScale;
    const desiredVelX = -Math.sin(this.currentHeading) * speedMs;
    const desiredVelZ = -Math.cos(this.currentHeading) * speedMs;

    this.velocity.x += (desiredVelX - this.velocity.x) * Math.min(1, dt * 14.0);
    this.velocity.z += (desiredVelZ - this.velocity.z) * Math.min(1, dt * 14.0);

    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;

    // 6. Ground Raycasting & Suspension
    const rayHeadroom = Math.max(0.35, 0.8 * this.carScale);
    this.rayOrigin.set(this.position.x, this.position.y + rayHeadroom, this.position.z);
    this.raycaster.set(this.rayOrigin, this.rayDir);
    this.raycaster.far = Math.max(3.2, 5.0 * this.carScale);

    let groundHit: THREE.Intersection | null = null;
    let groundNormal: THREE.Vector3 | null = null;

    if (colliders.length > 0) {
      const hits = this.raycaster.intersectObjects(colliders, true);
      for (const h of hits) {
        if (h.face) {
          const norm = h.face.normal.clone().transformDirection(h.object.matrixWorld).normalize();
          if (norm.y >= 0.40) {
            groundHit = h;
            groundNormal = norm;
            break;
          }
        }
      }
    }

    if (groundHit && groundNormal) {
      const targetY = groundHit.point.y + this.suspensionRestLength;
      const heightDiff = targetY - this.position.y;

      // Incline slope momentum tracking
      this.forwardVec.set(-Math.sin(this.currentHeading), 0, -Math.cos(this.currentHeading)).normalize();
      const slopeAngle = - (this.forwardVec.x * groundNormal.x + this.forwardVec.z * groundNormal.z) / Math.max(0.18, groundNormal.y);
      const slopeLaunchVy = slopeAngle > 0.04 ? speedMs * slopeAngle : 0;
      const elevationVy = dt > 0.001 ? Math.max(0, (targetY - this.lastTargetY) / dt) : 0;
      this.lastTargetY = targetY;

      if (this.grounded) {
        if (slopeLaunchVy > 0.15 || elevationVy > 0.15) {
          this.verticalVelocity = Math.max(this.verticalVelocity, slopeLaunchVy, elevationVy);
        }
      }

      // Detachment over bump/crest
      const isDropping = heightDiff < -0.045;
      const hasJumpSpeed = Math.abs(this.speedKmH) > 30 || this.verticalVelocity > 0.25;
      const inContact = (!isDropping || !hasJumpSpeed) && heightDiff >= -0.35 && heightDiff <= 0.45 && this.airTime <= 0;

      if (inContact) {
        this.grounded = true;
        this.verticalVelocity = 0;
        if (heightDiff > 0) {
          this.position.y += THREE.MathUtils.clamp(heightDiff * Math.min(1, dt * 18.0), 0, 8.0 * dt);
        } else {
          this.position.y += THREE.MathUtils.clamp(heightDiff * Math.min(1, dt * 14.0), -4.0 * dt, 0);
        }
        this.surfaceNormal.lerp(groundNormal, Math.min(1, dt * 12));
      } else {
        // Airborne jump over bump or ramp
        if (this.grounded) {
          this.grounded = false;
          this.airTime = 0.08;
          const minLaunchKick = THREE.MathUtils.clamp((Math.abs(this.speedKmH) / 140) * 3.0, 1.2, 4.5);
          this.verticalVelocity = Math.max(this.verticalVelocity, minLaunchKick);
        }

        this.airTime -= dt;
        const gravity = 20.0;
        this.verticalVelocity = Math.max(-14, this.verticalVelocity - gravity * dt);
        this.position.y += this.verticalVelocity * dt;

        // Touchdown
        if (this.verticalVelocity < 0 && this.airTime <= 0 && this.position.y <= targetY) {
          const impact = Math.abs(this.verticalVelocity);
          this.position.y = targetY;
          this.verticalVelocity = 0;
          this.grounded = true;
          this.surfaceNormal.lerp(groundNormal, Math.min(1, dt * 14.0));
          if (impact > 1.8) {
            this.particleManager.spawnTireSparks(this.position, Math.min(10, Math.floor(impact * 2)));
          }
        } else {
          // Mid-air flight pitch
          const airPitch = THREE.MathUtils.clamp((this.verticalVelocity / Math.max(1.0, speedMs)) * 0.35, -0.22, 0.30);
          const airNormal = new THREE.Vector3(0, 1, 0).addScaledVector(this.forwardVec, -airPitch).normalize();
          this.surfaceNormal.lerp(airNormal, Math.min(1, dt * 5.0));
        }
      }
    } else {
      this.grounded = false;
      this.airTime -= dt;
      const gravity = 20.0;
      this.verticalVelocity = Math.max(-14, this.verticalVelocity - gravity * dt);
      this.position.y += this.verticalVelocity * dt;
    }

    this.mesh.position.copy(this.position);

    // 7. Track Corridor Guard & Recovery
    const targetSplinePt = this.trackSpline.getPointAt(this.progressU);
    const distFromSpline = Math.hypot(this.position.x - targetSplinePt.x, this.position.z - targetSplinePt.z);
    if (distFromSpline > 2.2) {
      // Soft-guide rival car to stay within drivable track boundaries
      const corr = Math.min(1.0, (distFromSpline - 2.2) * dt * 4.0);
      this.position.x += (targetSplinePt.x - this.position.x) * corr;
      this.position.z += (targetSplinePt.z - this.position.z) * corr;
    }
    if (distFromSpline > 3.0 || this.position.y < -0.45) {
      // Firm recovery back onto the track
      this.position.x += (targetSplinePt.x - this.position.x) * Math.min(1, dt * 7.5);
      this.position.z += (targetSplinePt.z - this.position.z) * Math.min(1, dt * 7.5);
      this.position.y = targetSplinePt.y + 0.08;
      this.speedKmH = Math.max(120, this.speedKmH);
      this.mesh.position.copy(this.position);
    }

    // Keep AI car aligned with track tangent (swift recovery if bumped sideways)
    const splineTangent = this.trackSpline.getTangentAt(this.progressU).normalize();
    const tangentHeading = Math.atan2(-splineTangent.x, -splineTangent.z);
    let headingDiffToTrack = tangentHeading - this.currentHeading;
    while (headingDiffToTrack > Math.PI) headingDiffToTrack -= Math.PI * 2;
    while (headingDiffToTrack < -Math.PI) headingDiffToTrack += Math.PI * 2;
    if (Math.abs(headingDiffToTrack) > 1.0) {
      this.currentHeading += headingDiffToTrack * Math.min(1.0, dt * 4.0);
    }

    // 8. Orientation Alignment (Local -Z is Forward, +X is Right, +Y is Surface Normal)
    this.forwardVec.set(-Math.sin(this.currentHeading), 0, -Math.cos(this.currentHeading)).normalize();
    this.rightVec.crossVectors(this.forwardVec, this.surfaceNormal).normalize();
    this.alignedForward.crossVectors(this.surfaceNormal, this.rightVec).normalize();
    this.localZ.copy(this.alignedForward).negate();
    this.rotMatrix.makeBasis(this.rightVec, this.surfaceNormal, this.localZ);
    this.targetQuat.setFromRotationMatrix(this.rotMatrix);

    // Subtle AI chassis lean
    const aiSpeedAbs = Math.abs(this.speedKmH);
    const aiTargetRoll = THREE.MathUtils.clamp(-this.steerAngle * (aiSpeedAbs / 140) * 0.038, -0.040, 0.040);
    this.bodyRollAngle += (aiTargetRoll - this.bodyRollAngle) * Math.min(1, dt * 8.0);
    if (Math.abs(this.bodyRollAngle) > 0.0005) {
      const rollQuat = new THREE.Quaternion().setFromAxisAngle(this.alignedForward, this.bodyRollAngle);
      this.targetQuat.multiply(rollQuat);
    }

    this.mesh.quaternion.slerp(this.targetQuat, Math.min(1, dt * 15));
    this.quaternion.copy(this.mesh.quaternion);

    // 8. Wheel Visual Spin & Dynamic Steering Alignment
    const speedMps = this.speedKmH / 3.6;
    this.wheelSpinAngle += (speedMps * dt) / 0.33;
    const visualSteer = THREE.MathUtils.clamp(this.steerAngle, -0.60, 0.60);

    if (this.isSkinnedHotWheels) {
      // Hot Wheels bones: local Y is axle roll, local Z is steering upright
      const qSpin = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.wheelSpinAngle);
      const qSteer = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), visualSteer);

      if (this.wheelLF) this.wheelLF.quaternion.copy(qSteer).multiply(qSpin);
      if (this.wheelRF) this.wheelRF.quaternion.copy(qSteer).multiply(qSpin);
      if (this.wheelLR) this.wheelLR.quaternion.copy(qSpin);
      if (this.wheelRR) this.wheelRR.quaternion.copy(qSpin);
    } else {
      // Mazda rigid hierarchy: local X is axle roll, local Z is steering upright
      const qSpin = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.wheelSpinAngle);
      const qSteer = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -visualSteer);

      if (this.wheelLF) this.wheelLF.quaternion.copy(qSteer).multiply(this.initialQuatLF).multiply(qSpin);
      if (this.wheelRF) this.wheelRF.quaternion.copy(qSteer).multiply(this.initialQuatRF).multiply(qSpin);
      if (this.wheelLR) this.wheelLR.quaternion.copy(this.initialQuatLR).multiply(qSpin);
      if (this.wheelRR) this.wheelRR.quaternion.copy(this.initialQuatRR).multiply(qSpin);
    }

    // 9. Particle Spawning: Boost Flames & Occasional Tire Drift Smoke
    if (this.grounded) {
      if (this.isBoosting) {
        const rearPos = this.position.clone().addScaledVector(this.forwardVec, -2.15 * this.carScale);
        rearPos.y = this.position.y + 0.11 * (this.carScale / 0.20);
        this.particleManager.spawnBoostFlame(rearPos, this.forwardVec);
      }

      // Occasional tire drift smoke in sharp high-speed hairpins
      if (Math.abs(this.steerAngle) > 0.45 && this.speedKmH > 60 && Math.random() < 0.20) {
        const rearWheelPos = this.position.clone().addScaledVector(this.forwardVec, -1.3 * this.carScale);
        this.particleManager.spawnDriftSmoke(rearWheelPos);
      }
    }
  }

  dispose() {
    if (this.mesh.parent) {
      this.mesh.parent.remove(this.mesh);
    }
  }
}
