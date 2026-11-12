import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CheckpointDef } from '../types/game';
import { soundEffects } from '../audio/SoundEffects';
import { ForzaTrackVisuals } from './ForzaTrackVisuals';
import { useGameStore } from '../store/useGameStore';

export class VolcanoTrack {
  public model: THREE.Group = new THREE.Group();
  public colliders: THREE.Object3D[] = []; // Drivable floor surfaces for suspension raycasting
  public barriers: THREE.Object3D[] = [];  // Track borders, curbs, walls, rocks, and obstacles for collision resistance
  private hazardBeaconMaterials: THREE.MeshStandardMaterial[] = [];
  public trackDirection: 'normal' | 'reverse' = 'reverse';
  public spawnPosition = new THREE.Vector3(-7.26, 0.05, 10.61);
  public spawnHeading = Math.PI / 2; // Reverse mode: Facing -X down the straightaway
  public smokeMeshes: THREE.Mesh[] = [];
  public coinObjects: THREE.Object3D[] = [];
  public forzaVisuals: ForzaTrackVisuals;

  private scene: THREE.Scene;
  private checkpointMarkers: THREE.Group[] = [];
  private lastHintTime = 0;
  private prevHint: {
    title: string;
    direction: string;
    severity: string;
    distanceMeters: number;
    safeSpeedKmH: number;
  } | null = null;

  // Forward Circuit Checkpoints
  public checkpointsForward: CheckpointDef[] = [
    { index: 0, position: [-7.26, 0.05, 10.61], radius: 8.5, passed: false },  // Start / Finish Line
    { index: 1, position: [8.80, 0.1, 17.80], radius: 11.0, passed: false },   // Turn 1 (Western Mountain Pass entry)
    { index: 2, position: [23.50, 0.1, 29.50], radius: 12.0, passed: false },  // Caldera rim peak apex (centered)
    { index: 3, position: [46.89, 0.1, -6.54], radius: 12.0, passed: false },  // Dyke entrance (centered)
    { index: 4, position: [21.64, 0.1, -28.44], radius: 13.0, passed: false }, // Outer hairpin turn (centered)
    { index: 5, position: [-26.13, 0.1, -18.70], radius: 12.0, passed: false }, // Mountain pass (centered)
    { index: 6, position: [-42.8, 0.1, 5.8], radius: 12.0, passed: false },    // Final straightaway
  ];

  // Reverse Circuit Checkpoints (Opposite direction starting down the straightaway)
  public checkpointsReverse: CheckpointDef[] = [
    { index: 0, position: [-7.26, 0.05, 10.61], radius: 8.5, passed: false },  // Start / Finish Line
    { index: 1, position: [-42.8, 0.1, 5.8], radius: 12.0, passed: false },    // Straight entrance
    { index: 2, position: [-26.13, 0.1, -18.70], radius: 12.0, passed: false }, // Mountain pass (centered)
    { index: 3, position: [21.64, 0.1, -28.44], radius: 13.0, passed: false }, // Outer hairpin (centered)
    { index: 4, position: [46.89, 0.1, -6.54], radius: 12.0, passed: false },  // Dyke entrance (centered)
    { index: 5, position: [23.50, 0.1, 29.50], radius: 12.0, passed: false },  // Caldera rim peak apex (centered)
    { index: 6, position: [8.80, 0.1, 17.80], radius: 11.0, passed: false },   // Western Mountain Pass / Straight approach
  ];

  public checkpoints: CheckpointDef[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.scene.add(this.model);
    this.forzaVisuals = new ForzaTrackVisuals(this.scene);
    this.setTrackDirection('reverse');
  }

  setTrackDirection(dir: 'normal' | 'reverse') {
    this.trackDirection = dir;
    if (dir === 'reverse') {
      this.spawnHeading = Math.PI / 2; // Facing -X down the straightaway
      this.checkpoints = this.checkpointsReverse.map((cp) => ({ ...cp }));
    } else {
      this.spawnHeading = -Math.PI / 2; // Facing +X
      this.checkpoints = this.checkpointsForward.map((cp) => ({ ...cp }));
    }
    if (this.forzaVisuals && this.colliders.length > 0) {
      const oldRails = new Set(this.forzaVisuals.railBarriers);
      this.barriers = this.barriers.filter((b) => !oldRails.has(b));
      this.forzaVisuals.buildAllSystems(this.colliders, dir);
      this.forzaVisuals.railBarriers.forEach((b) => {
        const m = b as THREE.Mesh;
        if (m.geometry && !m.userData.worldSphere) {
          if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
          if (m.geometry.boundingSphere) {
            const s = m.geometry.boundingSphere.clone();
            s.applyMatrix4(m.matrixWorld);
            m.userData.worldSphere = s;
          }
        }
      });
      this.barriers.push(...this.forzaVisuals.railBarriers);
    }
    this.rebuildCheckpointVisuals();
  }

  private rebuildCheckpointVisuals() {
    this.checkpointMarkers.forEach((m) => {
      this.scene.remove(m);
    });
    this.checkpointMarkers = [];
    this.createCheckpointVisuals();
  }

  async loadTrack(onProgress?: (progress: number) => void): Promise<void> {
    const loader = new GLTFLoader();

    return new Promise((resolve, reject) => {
      loader.load(
        '/models/Volcano.glb',
        (gltf) => {
          const volcano = gltf.scene;

          // 1. Accurately center the racetrack at origin (0, 0, 0)
          let roadMesh: THREE.Object3D | null = null;
          volcano.traverse((child) => {
            if (child.name.toLowerCase().includes('specialroad')) {
              roadMesh = child;
            }
          });

          const roadBox = new THREE.Box3();
          if (roadMesh) {
            roadBox.setFromObject(roadMesh);
          } else {
            roadBox.setFromObject(volcano);
          }

          const roadCenter = new THREE.Vector3();
          roadBox.getCenter(roadCenter);

          // Shift model so the racetrack is centered at (0, 0, 0)
          volcano.position.set(-roadCenter.x, -roadCenter.y, -roadCenter.z);
          volcano.updateMatrixWorld(true);

          this.colliders = [];
          this.barriers = [];
          this.smokeMeshes = [];

          // 2. Classify and configure each environment element for flawless rendering
          const toRemove: THREE.Object3D[] = [];
          let lavaTexture: THREE.Texture | null = null;
          volcano.traverse((child) => {
            const name = (child.name || '').replace(/["']/g, '').toLowerCase().trim();

            // Completely remove roadblocks, boulders, detritus debris, and obstacle stones obstructing the drivable racetrack road
            const isRoadObstacleStone =
              name.includes('roadblock') ||       // "RoadBlock" barricades baked across the circuit
              name.includes('rockobstacle') ||    // Primary rock obstacle in front of magma/road
              name.includes('obstacle') ||        // Any obstacle stones on the circuit
              name.includes('large_boulder') ||   // Boulders on/near the road
              name.includes('small_boulder') ||   // Boulders on/near the road
              name.includes('detritus') ||        // Debris / rocks on road surface
              name.includes('crack_');            // Pothole / crack decal plates on the road surface

            // Completely remove obsolete low-res static signs, hoardings, billboards, and old baked coins
            // so they don't block the view, clutter the scenery, or clash with the 3D spinning Hot Wheels tokens
            const isLegacySign = name.includes('sign') || name.includes('checkpoint');
            const isLegacyCoin = name.includes('coin');

            if (isRoadObstacleStone || isLegacySign || isLegacyCoin) {
              child.visible = false;
              toRemove.push(child);
              return;
            }

            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;

              // Clone materials to prevent texture sharing leaks between road and volcano/magma
              if (mesh.material) {
                if (Array.isArray(mesh.material)) {
                  mesh.material = mesh.material.map((m) => m.clone());
                } else {
                  mesh.material = (mesh.material as THREE.Material).clone();
                }
              }

              // Hide collision bounds and flat road decal cards ("on road pictures")
              const isRoadDecal =
                name.includes('crack_') ||
                name.includes('detritus') ||
                (name.includes('object0') && !name.includes('road'));

              if (name.includes('colwall') || isRoadDecal) {
                mesh.visible = false;
                return;
              }

              const mat = mesh.material as THREE.MeshStandardMaterial;
              if (mat) {
                const matName = (mat.name || '').toLowerCase();
                // Configure shadows: only dynamic vehicles cast shadows to lock 60 FPS!
                // Static mountains, rocks, chimneys and terrain do not cast shadows, saving massive GPU draw calls.
                // Road decks and ground terrain receive shadows so dynamic car shadows are cast razor-sharp.
                const isRoadOrGround =
                  name.includes('specialroad') ||
                  name.includes('dyke') ||
                  name.includes('gangplank') ||
                  name.includes('ground');
                mesh.castShadow = false;
                mesh.receiveShadow = isRoadOrGround;

                if (name.includes('sphere01')) {
                  // 1. Sky Dome: outermost background sphere, unlit luminous sky
                  mesh.renderOrder = -100;
                  mat.transparent = false;
                  mat.depthWrite = false;
                  mat.depthTest = false;
                  mat.side = THREE.BackSide;
                  mat.roughness = 1.0;
                  mat.metalness = 0.0;
                  if (mat.map) {
                    mat.emissiveMap = mat.map;
                    mat.emissive.set(0xffffff);
                    mat.emissiveIntensity = 1.1;
                  }
                } else if (name.includes('horizon')) {
                  // 2. Horizon mountain silhouette against the sky
                  mesh.renderOrder = -90;
                  mat.transparent = true;
                  mat.depthWrite = false;
                  mat.depthTest = true;
                  mat.side = THREE.DoubleSide;
                  mat.roughness = 1.0;
                  if (mat.map) {
                    mat.emissiveMap = mat.map;
                    mat.emissive.set(0x888888);
                    mat.emissiveIntensity = 0.8;
                  }
                } else if (name.includes('cylinder01')) {
                  // 3. Volcanic horizon cloud fog band
                  mesh.renderOrder = -80;
                  mat.transparent = true;
                  mat.depthWrite = false;
                  mat.depthTest = true;
                  mat.side = THREE.DoubleSide;
                  mat.blending = THREE.NormalBlending;
                  mat.roughness = 1.0;
                  if (mat.map) {
                    mat.emissiveMap = mat.map;
                    mat.emissive.set(0xaaaaaa);
                    mat.emissiveIntensity = 0.85;
                  }
                } else if (name.includes('smoke') || name.includes('bbz')) {
                  // 4. Volcanic smoke plumes rising from chimneys
                  mesh.renderOrder = 10;
                  mat.transparent = true;
                  mat.depthWrite = false;
                  mat.depthTest = true;
                  mat.alphaTest = 0.02;
                  mat.side = THREE.DoubleSide;
                  mat.blending = THREE.NormalBlending;
                  this.smokeMeshes.push(mesh);
                } else if (name.includes('palm')) {
                  // 5. Palm trees: trunk is solid, fronds use alpha cutout
                  mat.depthWrite = true;
                  mat.depthTest = true;
                  mat.side = THREE.DoubleSide;
                  if (name.includes('_2') || name.includes('leaf') || name.includes('frond')) {
                    mat.transparent = true;
                    mat.alphaTest = 0.4;
                  } else {
                    mat.transparent = false;
                  }
                } else if (name.includes('lava') || name.includes('magma')) {
                  // 6. Glowing molten volcanic lava
                  mesh.userData.isLava = true;
                  mat.transparent = false;
                  mat.depthWrite = true;
                  mat.depthTest = true;
                  mat.side = THREE.DoubleSide;

                  // Capture lava texture from genuine lava elements
                  if (name.includes('magma_01') && mat.map) {
                    lavaTexture = mat.map;
                  }

                  // Mountain peak "magma_near" mistakenly referenced the red-and-white curb texture (Material 18 / 9.1).
                  // Replace it with authentic glowing volcanic lava!
                  if (name.includes('magma_near') || (name.includes('magma') && matName.includes('9.1'))) {
                    if (lavaTexture) {
                      mat.map = lavaTexture;
                      mat.emissiveMap = lavaTexture;
                    }
                    mat.color.setHex(0xff4400);
                    mat.emissive.setHex(0xff3300);
                    mat.emissiveIntensity = 2.5;
                    mat.needsUpdate = true;
                  } else {
                    if (mat.map) {
                      mat.emissiveMap = mat.map;
                      mat.emissive.set(0xff5511);
                      mat.emissiveIntensity = 2.0;
                    }
                  }

                  // Lava surfaces are in colliders so vehicle contacts the terrain
                  this.colliders.push(mesh);

                  // Smooth flush invisible bridge deck across the sunken lava potholes (lava pots / pits)
                  // Allows cars to drive smoothly over the lava pothole at full speed without sinking into the 37cm hole
                  if (name.includes('sortlava_trap')) {
                    const deckGeo = mesh.geometry.clone();
                    const posAttr = deckGeo.attributes.position;
                    for (let i = 0; i < posAttr.count; i++) {
                      // Road surface is flush at local Z = -614.425 in Volcano.glb
                      posAttr.setZ(i, -614.425);
                    }
                    deckGeo.computeVertexNormals();

                    const deckMat = new THREE.MeshBasicMaterial({
                      transparent: true,
                      opacity: 0.0,
                      depthWrite: false,
                      side: THREE.DoubleSide,
                    });
                    const deckMesh = new THREE.Mesh(deckGeo, deckMat);
                    deckMesh.name = 'specialroad_lavadeck';
                    deckMesh.rotation.copy(mesh.rotation);
                    deckMesh.position.copy(mesh.position);
                    deckMesh.scale.copy(mesh.scale);
                    deckMesh.visible = true;
                    deckMesh.userData.isPlatform = true;
                    deckMesh.userData.isRoad = true;
                    deckMesh.userData.isLavaHazard = false;
                    if (mesh.parent) {
                      mesh.parent.add(deckMesh);
                    }
                    this.colliders.push(deckMesh);
                  }
                } else if (name.includes('water')) {
                  // 7. Caldera lake water
                  mesh.renderOrder = 5;
                  mat.transparent = true;
                  mat.opacity = 0.82;
                  mat.depthWrite = false;
                  mat.depthTest = true;
                  mat.roughness = 0.12;
                  mat.metalness = 0.25;
                } else if (
                  matName.includes('colwall') ||
                  matName.includes('9.2') ||
                  name.includes('colwall') ||
                  (name.includes('specialroad') && name.includes('_3'))
                ) {
                  // Invisible collision barrier wall along the racetrack borders (ColWall.dds)
                  // Hidden from driver view, but retained in barriers for raycast collision detection
                  mesh.renderOrder = 0;
                  mesh.visible = false;
                  mat.transparent = true;
                  mat.opacity = 0.0;
                  mat.depthWrite = false;
                  mat.depthTest = true;
                  mat.side = THREE.DoubleSide;
                  this.barriers.push(mesh);
                } else if (
                  name.includes('specialroad') ||
                  name.includes('dyke') ||
                  name.includes('gangplank')
                ) {
                  // Drivable road surface with glowing red and white racing curb strips & markings
                  mesh.renderOrder = 0;
                  const roadMats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE.MeshStandardMaterial[];
                  roadMats.forEach((m) => {
                    if (!m) return;
                    const mName = (m.name || '').toLowerCase();
                    if (mName.includes('colwall') || mName.includes('9.2')) {
                      // Invisible collision wall primitive
                      m.transparent = true;
                      m.opacity = 0.0;
                      m.depthWrite = false;
                      m.depthTest = true;
                      m.side = THREE.DoubleSide;
                    } else if (mName.includes('9.1') || mName.includes('lava') || mName.includes('magma')) {
                      // Lava gap primitive: molten volcanic lava
                      m.transparent = false;
                      m.opacity = 1.0;
                      m.depthWrite = true;
                      m.depthTest = true;
                      m.side = THREE.DoubleSide;
                      if (lavaTexture) {
                        m.map = lavaTexture;
                        m.emissiveMap = lavaTexture;
                        m.emissive = new THREE.Color(0xff4400);
                        m.emissiveIntensity = 2.4;
                      }
                    } else {
                      // Drivable road surface (Material 9.0) - authentic natural racetrack asphalt & curbs
                      m.transparent = false;
                      m.opacity = 1.0;
                      m.depthWrite = true;
                      m.depthTest = true;
                      m.side = THREE.FrontSide;
                      m.roughness = 0.50;
                      m.metalness = 0.08;
                    }
                  });
                  this.colliders.push(mesh);
                } else if (name.includes('ground')) {
                  // Island ground terrain surrounding the circuit: solid drivable off-road floor
                  mat.transparent = false;
                  mat.depthWrite = true;
                  mat.depthTest = true;
                  mat.side = THREE.FrontSide;
                  this.colliders.push(mesh);
                } else {
                  // 8. Opaque mountains, rocks, bridges, barriers, signs
                  mat.transparent = false;
                  mat.depthWrite = true;
                  mat.depthTest = true;
                  mat.side = THREE.FrontSide;
                }

                // Collect coin objects for collection and rotation
                if (name.includes('coin0') && !name.includes('_')) {
                  this.coinObjects.push(mesh);
                }

                // Tag platform / ramp across the lava hazard
                if (name.includes('gangplank')) {
                  mesh.userData.isPlatform = true;
                }

                // Physical track barriers, mountain cliffs, chimneys, and volcano walls for boundary collisions
                if (
                  name.includes('mountain') ||
                  name.includes('chimney') ||
                  name.includes('volcano') ||
                  name.includes('magma')
                ) {
                  mat.side = THREE.DoubleSide;
                  this.barriers.push(mesh);
                }
              }
            }
          });

          // Completely detach any road obstacle stones from parent hierarchy
          toRemove.forEach((obj) => {
            obj.traverse((c) => {
              c.visible = false;
            });
            if (obj.parent) {
              obj.parent.remove(obj);
            }
          });

          this.model.add(volcano);
          volcano.updateMatrixWorld(true);

          // Pre-compute world bounding spheres on all barrier meshes for O(1) mathematical collision filtering
          this.barriers.forEach((b) => {
            const m = b as THREE.Mesh;
            if (m.geometry) {
              if (!m.geometry.boundingSphere) {
                m.geometry.computeBoundingSphere();
              }
              if (m.geometry.boundingSphere) {
                const s = m.geometry.boundingSphere.clone();
                s.applyMatrix4(m.matrixWorld);
                m.userData.worldSphere = s;
              }
            }
          });

          // 3. Build & Align all Track Rails, Festival Gantry, Curbs & Systems
          if (this.forzaVisuals) {
            this.forzaVisuals.buildAllSystems(this.colliders, this.trackDirection);
            this.forzaVisuals.railBarriers.forEach((b) => {
              const m = b as THREE.Mesh;
              if (m.geometry && !m.userData.worldSphere) {
                if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
                if (m.geometry.boundingSphere) {
                  const s = m.geometry.boundingSphere.clone();
                  s.applyMatrix4(m.matrixWorld);
                  m.userData.worldSphere = s;
                }
              }
            });
            this.barriers.push(...this.forzaVisuals.railBarriers);
          }

          // 4. Build Heavy Lava Road Blockades (Barricades, Road Closed Signs & Collision Walls)
          this.buildLavaRoadBlockades();

          // 5. Setup Checkpoint Gate Visuals
          this.createCheckpointVisuals();

          resolve();
        },
        (xhr) => {
          if (xhr.total > 0 && onProgress) {
            onProgress(xhr.loaded / xhr.total);
          }
        },
        (err) => reject(err)
      );
    });
  }

  // -------------------------------------------------------------
  // Lava Road 5-Tiered "WRONG WAY" Signboards & Active Hazard Closure
  // Cascades 5 luminous "WRONG WAY" barricades down the lava road
  // exactly matching the 5 tiers marked by the driver
  // -------------------------------------------------------------
  private buildLavaRoadBlockades() {
    const blockadeGroup = new THREE.Group();
    blockadeGroup.name = 'LavaRoadBlockades';

    // 1. Procedural High-Contrast Hazard Barrier Base Texture (Diagonal Yellow & Black Stripes)
    const stripeCanvas = document.createElement('canvas');
    stripeCanvas.width = 512;
    stripeCanvas.height = 128;
    const sCtx = stripeCanvas.getContext('2d')!;
    sCtx.fillStyle = '#1c1f24';
    sCtx.fillRect(0, 0, 512, 128);

    const stripeW = 36;
    for (let x = -128; x < 512 + 128; x += stripeW * 2) {
      sCtx.fillStyle = '#ffcc00';
      sCtx.beginPath();
      sCtx.moveTo(x, 0);
      sCtx.lineTo(x + stripeW, 0);
      sCtx.lineTo(x + stripeW - 48, 128);
      sCtx.lineTo(x - 48, 128);
      sCtx.closePath();
      sCtx.fill();
    }
    sCtx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    sCtx.lineWidth = 4;
    sCtx.strokeRect(2, 2, 508, 124);

    const barrierTex = new THREE.CanvasTexture(stripeCanvas);
    barrierTex.wrapS = THREE.RepeatWrapping;
    barrierTex.wrapT = THREE.ClampToEdgeWrapping;
    barrierTex.repeat.set(2, 1);

    const barrierMat = new THREE.MeshStandardMaterial({
      map: barrierTex,
      metalness: 0.15,
      roughness: 0.70,
    });

    const railMat = new THREE.MeshStandardMaterial({
      color: 0xd8dde4,
      metalness: 0.92,
      roughness: 0.20,
    });

    // 2. Procedural Luminous "WRONG WAY / DO NOT ENTER" Warning Signboard Texture (1024x256)
    const signCanvas = document.createElement('canvas');
    signCanvas.width = 1024;
    signCanvas.height = 256;
    const signCtx = signCanvas.getContext('2d')!;

    // Carbon / Industrial Hazard Frame
    signCtx.fillStyle = '#0a0d12';
    signCtx.fillRect(0, 0, 1024, 256);

    // Thick Red Hazard Border
    signCtx.strokeStyle = '#ff1a00';
    signCtx.lineWidth = 14;
    signCtx.strokeRect(10, 10, 1004, 236);

    // Inner White Accent Border
    signCtx.strokeStyle = '#ffffff';
    signCtx.lineWidth = 3;
    signCtx.strokeRect(20, 20, 984, 216);

    // Top & Bottom Yellow/Black Diagonal Hazard Striping
    for (let x = -40; x < 1080; x += 32) {
      signCtx.fillStyle = '#ffcc00';
      signCtx.beginPath();
      signCtx.moveTo(x, 22);
      signCtx.lineTo(x + 16, 22);
      signCtx.lineTo(x - 2, 44);
      signCtx.lineTo(x - 18, 44);
      signCtx.closePath();
      signCtx.fill();

      signCtx.beginPath();
      signCtx.moveTo(x, 212);
      signCtx.lineTo(x + 16, 212);
      signCtx.lineTo(x - 2, 234);
      signCtx.lineTo(x - 18, 234);
      signCtx.closePath();
      signCtx.fill();
    }

    // Bold "WRONG WAY" Typography
    signCtx.textAlign = 'center';
    signCtx.textBaseline = 'middle';

    signCtx.save();
    signCtx.shadowColor = '#ff2200';
    signCtx.shadowBlur = 28;
    signCtx.font = '900 70px "Impact", "Arial Black", sans-serif';
    signCtx.fillStyle = '#ffffff';
    signCtx.fillText('⛔   WRONG WAY   ⛔', 512, 108);
    signCtx.restore();

    // Directional Warning Chevrons & Subtitle
    signCtx.font = '900 28px "Arial Black", sans-serif';
    signCtx.fillStyle = '#ffcc00';
    signCtx.fillText('❮ ❮ ❮   DO NOT ENTER   ❯ ❯ ❯', 512, 172);

    const signTex = new THREE.CanvasTexture(signCanvas);
    const signMat = new THREE.MeshStandardMaterial({
      map: signTex,
      emissiveMap: signTex,
      emissive: new THREE.Color(0xff2200),
      emissiveIntensity: 2.2,
      metalness: 0.2,
      roughness: 0.35,
      side: THREE.DoubleSide,
    });

    const beaconMat = new THREE.MeshStandardMaterial({
      color: 0xff4400,
      emissive: new THREE.Color(0xff2200),
      emissiveIntensity: 3.2,
      metalness: 0.8,
      roughness: 0.2,
    });
    this.hazardBeaconMaterials.push(beaconMat);

    // 3. Procedural Glowing Red Highlighted Boundary Line Texture (1024x128)
    const lineCanvas = document.createElement('canvas');
    lineCanvas.width = 1024;
    lineCanvas.height = 128;
    const lCtx = lineCanvas.getContext('2d')!;
    lCtx.clearRect(0, 0, 1024, 128);

    // Outer red laser glow
    const grad = lCtx.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0.0, 'rgba(255, 20, 0, 0.0)');
    grad.addColorStop(0.22, 'rgba(255, 24, 0, 0.85)');
    grad.addColorStop(0.5, 'rgba(255, 60, 20, 1.0)');
    grad.addColorStop(0.78, 'rgba(255, 24, 0, 0.85)');
    grad.addColorStop(1.0, 'rgba(255, 20, 0, 0.0)');
    lCtx.fillStyle = grad;
    lCtx.fillRect(0, 0, 1024, 128);

    // Crisp bright white-hot core strip along center
    lCtx.fillStyle = '#ffe5e0';
    lCtx.fillRect(12, 52, 1000, 24);

    // High-contrast diagonal hazard ticks along edges
    lCtx.fillStyle = '#ffcc00';
    for (let x = 16; x < 1008; x += 48) {
      lCtx.fillRect(x, 22, 24, 10);
      lCtx.fillRect(x + 12, 96, 24, 10);
    }

    const lineTex = new THREE.CanvasTexture(lineCanvas);
    const highlightedLineMat = new THREE.MeshStandardMaterial({
      map: lineTex,
      emissiveMap: lineTex,
      emissive: new THREE.Color(0xff1a00),
      emissiveIntensity: 2.8,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
      side: THREE.DoubleSide,
    });
    this.hazardBeaconMaterials.push(highlightedLineMat);

    // Helper to lay a glowing red highlighted curb-to-curb boundary line flush on the road surface
    const createHighlightedBoundaryLine = (
      start: [number, number],
      end: [number, number],
      y: number = -0.33,
      lineDepth: number = 0.52
    ) => {
      const dx = end[0] - start[0];
      const dz = end[1] - start[1];
      const length = Math.hypot(dx, dz);
      const rotY = -Math.atan2(dz, dx);

      const lineGeo = new THREE.PlaneGeometry(length, lineDepth);
      lineGeo.rotateX(-Math.PI / 2);
      const lineMesh = new THREE.Mesh(lineGeo, highlightedLineMat);
      lineMesh.position.set((start[0] + end[0]) * 0.5, y, (start[1] + end[1]) * 0.5);
      lineMesh.rotation.y = rotY;
      lineMesh.renderOrder = 4;
      blockadeGroup.add(lineMesh);

      // End-cap glowing hazard bollards anchoring both curbs
      const bollardGeo = new THREE.CylinderGeometry(0.08, 0.10, 0.42, 12);
      const capGeo = new THREE.CylinderGeometry(0.085, 0.085, 0.10, 12);
      for (const pt of [start, end]) {
        const post = new THREE.Mesh(bollardGeo, barrierMat);
        post.position.set(pt[0], y + 0.18, pt[1]);
        blockadeGroup.add(post);

        const cap = new THREE.Mesh(capGeo, beaconMat);
        cap.position.set(pt[0], y + 0.42, pt[1]);
        blockadeGroup.add(cap);
      }
    };

    // Helper to create a complete realistic "WRONG WAY" barrier unit aligned curb-to-curb
    const createWrongWaySignUnit = (
      width: number,
      pos: THREE.Vector3,
      rotY: number
    ) => {
      const unit = new THREE.Group();
      unit.position.copy(pos);
      unit.rotation.y = rotY;

      // 1. Concrete Jersey Barrier Base
      const baseGeo = new THREE.BoxGeometry(width, 0.36, 0.28);
      const baseMesh = new THREE.Mesh(baseGeo, barrierMat);
      baseMesh.position.set(0, 0.18, 0);
      baseMesh.castShadow = false;
      baseMesh.receiveShadow = true;
      unit.add(baseMesh);

      // 2. Steel Crash Rails (Top & Middle)
      const rail1 = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, width, 16), railMat);
      rail1.rotation.z = Math.PI / 2;
      rail1.position.set(0, 0.42, 0);
      unit.add(rail1);

      const rail2 = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, width, 16), railMat);
      rail2.rotation.z = Math.PI / 2;
      rail2.position.set(0, 0.56, 0);
      unit.add(rail2);

      // 3. Stanchion Support Posts
      const postGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.38, 12);
      const stepX = width / 4;
      for (let i = -1.5; i <= 1.5; i += 1.0) {
        const post = new THREE.Mesh(postGeo, railMat);
        post.position.set(i * stepX, 0.50, 0);
        unit.add(post);
      }

      // 4. Prominent Double-Sided "WRONG WAY" Signboard
      const signWidth = Math.min(width * 0.88, 3.3);
      const signGeo = new THREE.BoxGeometry(signWidth, 0.68, 0.06);
      const signMesh = new THREE.Mesh(signGeo, signMat);
      signMesh.position.set(0, 0.78, 0);
      unit.add(signMesh);

      // 5. Pulsing Amber / Red Hazard Beacons
      const beaconGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.12, 12);
      const beaconL = new THREE.Mesh(beaconGeo, beaconMat);
      beaconL.position.set(-signWidth * 0.45, 1.18, 0);
      unit.add(beaconL);

      const beaconR = new THREE.Mesh(beaconGeo, beaconMat);
      beaconR.position.set(signWidth * 0.45, 1.18, 0);
      unit.add(beaconR);

      // 6. Solid Physics Barrier Mesh for VehicleController
      const colGeo = new THREE.BoxGeometry(width, 3.2, 0.85);
      const colMat = new THREE.MeshBasicMaterial({ visible: false, depthWrite: false });
      const colMesh = new THREE.Mesh(colGeo, colMat);
      colMesh.position.copy(pos);
      colMesh.position.y += 1.6;
      colMesh.rotation.y = rotY;
      colMesh.updateMatrixWorld(true);

      colGeo.computeBoundingBox();
      colGeo.computeBoundingSphere();
      if (colGeo.boundingSphere) {
        const s = colGeo.boundingSphere.clone();
        s.applyMatrix4(colMesh.matrixWorld);
        colMesh.userData.worldSphere = s;
      }
      this.barriers.push(colMesh);
      blockadeGroup.add(colMesh);

      blockadeGroup.add(unit);
    };

    // Helper to place a barrier centered across a [startX, startZ] -> [endX, endZ] curb span
    const placeAcrossSpan = (
      start: [number, number],
      end: [number, number],
      y: number,
      extraWidth: number = 0.25
    ) => {
      const dx = end[0] - start[0];
      const dz = end[1] - start[1];
      const width = Math.hypot(dx, dz) + extraWidth;
      const rotY = -Math.atan2(dz, dx);
      createWrongWaySignUnit(
        width,
        new THREE.Vector3((start[0] + end[0]) * 0.5, y, (start[1] + end[1]) * 0.5),
        rotY
      );
    };

    // 5 Curb-to-Curb "WRONG WAY" Signs spanning cleanly across the lava canal:
    // Tier 1 (Bottom Entrance Mouth: Pond curb [19.05, 13.72] -> Volcano curb [22.25, 14.50]):
    placeAcrossSpan([19.05, 13.72], [22.25, 14.50], -0.38, 0.25);
    // Glowing red highlighted boundary line slightly forward on the road threshold:
    createHighlightedBoundaryLine([18.88, 13.46], [22.42, 14.32], -0.33, 0.52);

    // Tier 2 (Lower-Middle Canal):
    placeAcrossSpan([18.60, 16.12], [21.25, 16.78], -0.38, 0.25);

    // Tier 3 (Center Canal):
    placeAcrossSpan([17.75, 18.68], [20.00, 19.53], -0.32, 0.35);

    // Tier 4 (Upper-Middle Canal):
    placeAcrossSpan([16.75, 21.12], [18.95, 22.20], -0.35, 0.35);

    // Tier 5 (Top Entrance Mouth: Pond curb [15.45, 21.65] -> Volcano curb [17.55, 24.85]):
    placeAcrossSpan([15.45, 21.65], [17.55, 24.85], -0.38, 0.25);
    // Glowing red highlighted boundary line slightly forward on the upper road threshold:
    createHighlightedBoundaryLine([15.22, 21.78], [17.34, 25.02], -0.33, 0.52);

    // Heavy Interior Lava Zone Solid Blocker Volume (Aligned along the canal axis)
    const lavaColGeo = new THREE.BoxGeometry(3.0, 4.0, 9.6);
    const lavaColMat = new THREE.MeshBasicMaterial({ visible: false, depthWrite: false });
    const lavaColMesh = new THREE.Mesh(lavaColGeo, lavaColMat);
    lavaColMesh.position.set(18.6, 1.6, 18.7);
    lavaColMesh.rotation.y = -0.40;
    lavaColMesh.updateMatrixWorld(true);
    lavaColGeo.computeBoundingBox();
    lavaColGeo.computeBoundingSphere();
    if (lavaColGeo.boundingSphere) {
      const s = lavaColGeo.boundingSphere.clone();
      s.applyMatrix4(lavaColMesh.matrixWorld);
      lavaColMesh.userData.worldSphere = s;
    }
    this.barriers.push(lavaColMesh);
    blockadeGroup.add(lavaColMesh);

    this.model.add(blockadeGroup);
  }

  private createCheckpointVisuals() {
    if (this.forzaVisuals) {
      this.checkpointMarkers = this.forzaVisuals.createHorizonCheckpointGates(
        this.checkpoints,
        this.trackDirection,
        this.colliders
      );
    }
  }

  checkCheckpoints(
    carPos: THREE.Vector3,
    currentIdx: number,
    onProgress: (newIdx: number, isLapComplete: boolean) => void
  ) {
    const nextIdx = (currentIdx + 1) % this.checkpoints.length;
    const targetCP = this.checkpoints[nextIdx];
    const targetPos = new THREE.Vector3(...targetCP.position);

    // Distance in XZ plane
    const dx = carPos.x - targetPos.x;
    const dz = carPos.z - targetPos.z;
    const distSq = dx * dx + dz * dz;

    if (distSq < targetCP.radius * targetCP.radius) {
      const isLapComplete = nextIdx === 0 && currentIdx === this.checkpoints.length - 1;
      soundEffects.playCheckpoint();
      onProgress(nextIdx, isLapComplete);

      // Pulse checkpoint visual
      const marker = this.checkpointMarkers[nextIdx];
      if (marker) {
        marker.scale.set(1.2, 1.2, 1.2);
        setTimeout(() => marker.scale.set(1.0, 1.0, 1.0), 300);
      }
    }
  }

  update(delta: number, camera?: THREE.Camera, carPos?: THREE.Vector3, carSpeedKmH: number = 0) {
    // 1. Billboarding smoke: every smoke plume quad faces the camera
    if (camera) {
      for (const sm of this.smokeMeshes) {
        sm.quaternion.copy(camera.quaternion);
      }
    }

    // 2. Gentle floating pulse for checkpoint gates
    const time = performance.now() * 0.002;
    for (let i = 1; i < this.checkpointMarkers.length; i++) {
      const marker = this.checkpointMarkers[i];
      marker.position.y = this.checkpoints[i].position[1] + Math.sin(time + i) * 0.04;
    }

    // 3. Spin collectible coins
    for (const coin of this.coinObjects) {
      if (coin.visible) {
        coin.rotation.y += delta * 2.5;
      }
    }

    // 4. Pulse warning beacons on lava road barricades
    if (this.hazardBeaconMaterials.length > 0) {
      const beaconPulse = 1.6 + Math.sin(time * 5.0) * 1.2;
      for (const bMat of this.hazardBeaconMaterials) {
        bMat.emissiveIntensity = beaconPulse;
      }
    }

    // 4. Update Forza Horizon Track Visuals (Driving Line, Turn Chevrons & Flare Smoke)
    if (this.forzaVisuals) {
      this.forzaVisuals.update(delta, camera, carPos, carSpeedKmH);
      if (carPos) {
        const nowMs = performance.now();
        // Throttle road guidance queries to ~12 Hz and only dispatch when hint actually changes
        if (nowMs - this.lastHintTime >= 85) {
          this.lastHintTime = nowMs;
          const hint = this.forzaVisuals.getUpcomingTurnHint(carPos, carSpeedKmH);
          const prev = this.prevHint;
          const isSame =
            (!prev && !hint) ||
            (prev &&
              hint &&
              prev.title === hint.title &&
              prev.direction === hint.direction &&
              prev.severity === hint.severity &&
              Math.abs(prev.distanceMeters - hint.distanceMeters) < 2 &&
              prev.safeSpeedKmH === hint.safeSpeedKmH);

          if (!isSame) {
            this.prevHint = hint ? { ...hint } : null;
            useGameStore.getState().setRoadHint(hint);
          }
        }
      }
    }
  }

  private tempCoinPos = new THREE.Vector3();

  checkCoins(carPos: THREE.Vector3, onCollect: () => void) {
    for (const coin of this.coinObjects) {
      if (coin.visible) {
        coin.getWorldPosition(this.tempCoinPos);
        const dx = carPos.x - this.tempCoinPos.x;
        const dz = carPos.z - this.tempCoinPos.z;
        if (dx * dx + dz * dz < 2.5) {
          coin.visible = false;
          soundEffects.playCoin();
          onCollect();
        }
      }
    }
  }

  resetCoins() {
    this.coinObjects.forEach((c) => {
      c.visible = true;
    });
  }

  dispose() {
    this.checkpointMarkers.forEach((m) => {
      this.scene.remove(m);
    });
    this.checkpointMarkers = [];
    this.colliders = [];
    this.barriers = [];
    if (this.forzaVisuals) {
      this.forzaVisuals.dispose();
    }
    if (this.model.parent) {
      this.model.parent.remove(this.model);
    }
  }
}
