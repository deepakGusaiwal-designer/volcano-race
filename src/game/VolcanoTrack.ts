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
    { index: 1, position: [11.42, 0.1, 9.05], radius: 11.0, passed: false },   // Turn 1 (Caldera entry - centered)
    { index: 2, position: [27.73, 0.1, 20.64], radius: 12.0, passed: false },  // Caldera rim curve (centered)
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
    { index: 5, position: [27.73, 0.1, 20.64], radius: 12.0, passed: false },  // Caldera rim curve (centered)
    { index: 6, position: [11.42, 0.1, 9.05], radius: 11.0, passed: false },   // Caldera entry / Jump approach (centered)
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

            // Completely remove obsolete low-res static signs, hoardings, and billboards baked into Volcano.glb (turn_sign, checkpoint_01, etc.)
            // so they don't block the view, clutter the scenery, or confuse the driver
            const isLegacySign = name.includes('sign') || name.includes('checkpoint');

            if (isRoadObstacleStone || isLegacySign) {
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

                  // Lava is solid so the vehicle can drive over the lava surface and NEVER fall through the mesh into the void!
                  this.colliders.push(mesh);

                  // If this is the sunken lava trap pot on the road deck, bridge it with a smooth invisible deck
                  // so the vehicle can drive over the lava hazard smoothly without sinking into a 37cm deep hole and getting stuck
                  if (name.includes('sortlava_trap')) {
                    const deckGeo = mesh.geometry.clone();
                    const posAttr = deckGeo.attributes.position;
                    for (let i = 0; i < posAttr.count; i++) {
                      // Road surface is flush at local Z = -614.43 in Volcano.glb
                      posAttr.setZ(i, -614.43);
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
                    deckMesh.userData.isLavaHazard = true;
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
                  (name.includes('specialroad') && name.includes('_2'))
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

          // 4. Setup Checkpoint Gate Visuals
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
