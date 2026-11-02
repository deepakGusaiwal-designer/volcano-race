import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { soundEffects } from '../audio/SoundEffects';
import { ParticleManager } from './ParticleManager';
import { SkidmarkManager } from './SkidmarkManager';
import { useGameStore } from '../store/useGameStore';
import { CarModelId } from '../types/game';

export interface VehicleTelemetry {
  speed: number;
  rpm: number;
  gear: number | string;
  nitro: number;
  isBoosting: boolean;
  isDrifting: boolean;
  isBraking: boolean;
  isOnLava: boolean;
  carScale: number;
}

export class VehicleController {
  public mesh: THREE.Group = new THREE.Group();
  public position = new THREE.Vector3(-7.26, 0.1, 10.61);
  public quaternion = new THREE.Quaternion();
  public velocity = new THREE.Vector3();
  public speedKmH = 0;
  public rpm = 1000;
  public gear: number | string = 1;
  public nitro = 100;
  public asphaltNitroTimer = 0;
  public isAsphaltSurging = false;

  public isBoosting = false;
  public isDrifting = false;
  public isBraking = false;

  private scene: THREE.Scene;
  private particleManager: ParticleManager;
  private colliders: THREE.Object3D[] = []; // Drivable ground floor surfaces
  private barriers: THREE.Object3D[] = [];  // Track borders, curbs, walls, rocks, and obstacles
  private raycaster = new THREE.Raycaster();
  private bumperRaycaster = new THREE.Raycaster();

  // 4 Wheel mesh references for visual steering and spinning
  private wheelLF: THREE.Object3D | null = null;
  private wheelRF: THREE.Object3D | null = null;
  private wheelLR: THREE.Object3D | null = null;
  private wheelRR: THREE.Object3D | null = null;
  private initialQuatLF = new THREE.Quaternion();
  private initialQuatRF = new THREE.Quaternion();
  private initialQuatLR = new THREE.Quaternion();
  private initialQuatRR = new THREE.Quaternion();
  private qSteerLF = new THREE.Quaternion();
  private qSteerRF = new THREE.Quaternion();
  private qSpinLF = new THREE.Quaternion();
  private qSpinRF = new THREE.Quaternion();
  private readonly steerAxisZ = new THREE.Vector3(0, 0, 1);
  private readonly rollAxisX = new THREE.Vector3(1, 0, 0);
  private wheelSpinAngle = 0;

  // Exhaust pipe node references
  private exhaust1: THREE.Object3D | null = null;
  private exhaust2: THREE.Object3D | null = null;

  // Skidmark manager
  public skidmarkManager: SkidmarkManager | null = null;

  // Lava hazard resistance state
  public isOnLava = false;
  private lavaRatio = 0.0;
  private lavaPullHeading = 0.0;
  private deepLavaTimer = 0.0;
  private respawnCooldown = 0.0;
  private wheelRaycaster = new THREE.Raycaster();
  private wheelProbePos = new THREE.Vector3();

  // Driving parameters
  public carModelId: CarModelId = 'mazda';
  public baseScaleFactor = 1.0;
  private isSkinnedHotWheels = false;
  private modelRoot: THREE.Object3D | null = null;
  public carScale = 0.14; // Compact scale for multi-car racing and spacious lane overtaking
  public steerAngle = 0;
  private maxSteerAngle = 0.58; // ~33.2 degrees: balanced sports car steering
  private yawVelocity = 0; // Angular velocity with physical rotational inertia (eliminates twitchy turns)
  private bodyRollAngle = 0; // Subtle dynamic chassis lean into corners
  // In Three.js: -Z is forward. Initial heading -Math.PI / 2 points forward along +X
  public currentHeading = -Math.PI / 2;
  public driftAngle = 0;
  private grounded = true;
  private verticalVelocity = 0;
  private suspensionRestLength = 0.026 * 0.14; // Bottom of Mazda tires rests cleanly at ~1.5mm above asphalt

  // Input state
  public input = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    handbrake: false,
    boost: false,
  };

  private lastSafePosition = new THREE.Vector3(-7.26, 0.1, 10.61);
  private lastSafeHeading = -Math.PI / 2;
  private lastCheckpointPosition = new THREE.Vector3(-7.26, 0.1, 10.61);
  private lastCheckpointHeading = -Math.PI / 2;

  // Reusable math objects
  private rayOrigin = new THREE.Vector3();
  private rayDir = new THREE.Vector3(0, -1, 0);
  public forwardVec = new THREE.Vector3();
  private rightVec = new THREE.Vector3();
  private alignedForward = new THREE.Vector3();
  private surfaceNormal = new THREE.Vector3(0, 1, 0);
  private localZ = new THREE.Vector3();
  private rotMatrix = new THREE.Matrix4();
  private targetQuat = new THREE.Quaternion();

  // Reusable barrier probe objects
  private probeCenter = new THREE.Vector3();
  private probeDirFL = new THREE.Vector3();
  private probeDirFR = new THREE.Vector3();
  private probeDirRL = new THREE.Vector3();
  private probeDirRR = new THREE.Vector3();
  private probeDirLeft = new THREE.Vector3();
  private probeDirRear = new THREE.Vector3();

  constructor(scene: THREE.Scene, particleManager: ParticleManager) {
    this.scene = scene;
    this.particleManager = particleManager;
    (this.raycaster as any).firstHitOnly = true;
    (this.bumperRaycaster as any).firstHitOnly = true;
    (this.wheelRaycaster as any).firstHitOnly = true;
    this.scene.add(this.mesh);

    this.setupKeyboardListeners();
  }

  setColliders(colliders: THREE.Object3D[], barriers: THREE.Object3D[] = []) {
    this.colliders = colliders;
    this.barriers = barriers.length > 0 ? barriers : colliders;
  }

  private setupKeyboardListeners() {
    window.addEventListener('keydown', (e) => {
      soundEffects.init();
      soundEffects.resume();

      const k = e.key.toLowerCase();
      if (e.code === 'KeyW' || e.code === 'ArrowUp' || k === 'w' || k === 'arrowup') {
        this.input.forward = true;
      }
      if (e.code === 'KeyS' || e.code === 'ArrowDown' || k === 's' || k === 'arrowdown') {
        this.input.backward = true;
      }
      if (e.code === 'KeyA' || e.code === 'ArrowLeft' || k === 'a' || k === 'arrowleft') {
        this.input.left = true;
      }
      if (e.code === 'KeyD' || e.code === 'ArrowRight' || k === 'd' || k === 'arrowright') {
        this.input.right = true;
      }
      if (e.code === 'Space') {
        this.input.handbrake = true;
        e.preventDefault();
      }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        this.input.boost = true;
        e.preventDefault();
      }
      if (e.code === 'KeyR' || k === 'r') {
        this.respawn();
      }
    });

    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      if (e.code === 'KeyW' || e.code === 'ArrowUp' || k === 'w' || k === 'arrowup') {
        this.input.forward = false;
      }
      if (e.code === 'KeyS' || e.code === 'ArrowDown' || k === 's' || k === 'arrowdown') {
        this.input.backward = false;
      }
      if (e.code === 'KeyA' || e.code === 'ArrowLeft' || k === 'a' || k === 'arrowleft') {
        this.input.left = false;
      }
      if (e.code === 'KeyD' || e.code === 'ArrowRight' || k === 'd' || k === 'arrowright') {
        this.input.right = false;
      }
      if (e.code === 'Space') this.input.handbrake = false;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.input.boost = false;
    });
  }

  async loadCar(modelType: CarModelId = 'mazda', preservePosition: boolean = false): Promise<void> {
    const loader = new GLTFLoader();
    let modelPath = '/models/mazda.glb';
    let baseScale = 1.0;

    if (modelType === 'iridium') {
      modelPath = '/models/hot_wheels_iridium.glb';
      baseScale = 0.009355; // Matches Mazda wheelbase (2.75m)
    } else if (modelType === 'rd09') {
      modelPath = '/models/hotwheels_rd09.glb';
      baseScale = 0.01030; // Matches Mazda wheelbase (2.75m)
    }

    this.carModelId = modelType;
    this.baseScaleFactor = baseScale;
    this.isSkinnedHotWheels = (modelType === 'iridium' || modelType === 'rd09');

    return new Promise((resolve, reject) => {
      loader.load(
        modelPath,
        (gltf) => {
          while (this.mesh.children.length > 0) {
            this.mesh.remove(this.mesh.children[0]);
          }

          const model = gltf.scene;

          // In raw GLB coordinates, nose is at +Z.
          // Rotate by Math.PI around Y so nose points to -Z (Three.js standard forward):
          model.rotation.y = Math.PI;

          // Scale car model to authentically fit the Volcano track environment
          const finalScale = this.carScale * this.baseScaleFactor;
          model.scale.set(finalScale, finalScale, finalScale);

          // Configure meshes & hide speed-blur rim overlays so crisp 3D alloy rims & tyres show
          model.traverse((child) => {
            if (child.name.includes('RIM_BLUR')) {
              child.visible = false;
            }

            if ((child as THREE.Mesh).isMesh) {
              const m = child as THREE.Mesh;
              m.castShadow = true;
              m.receiveShadow = true;

              // Cinematic Nolan PBR material enhancement
              const mat = m.material as THREE.MeshStandardMaterial;
              if (mat) {
                const matName = (mat.name || '').toLowerCase();
                if (matName.includes('carpaint') || matName.includes('exterior') || matName.includes('livery') || matName.includes('body')) {
                  mat.roughness = 0.18;
                  mat.metalness = 0.40;
                } else if (matName.includes('chrome') || matName.includes('mirror')) {
                  mat.roughness = 0.08;
                  mat.metalness = 0.95;
                } else if (matName.includes('rim') || matName.includes('metal') || matName.includes('gear')) {
                  mat.roughness = 0.24;
                  mat.metalness = 0.82;
                } else if (matName.includes('tyre') || matName.includes('rubber')) {
                  mat.roughness = 0.92;
                  mat.metalness = 0.02;
                } else if (matName.includes('brakedisk') || matName.includes('caliper')) {
                  mat.roughness = 0.30;
                  mat.metalness = 0.85;
                } else if (matName.includes('carbon')) {
                  mat.roughness = 0.42;
                  mat.metalness = 0.18;
                } else if (matName.includes('glass')) {
                  mat.roughness = 0.06;
                  mat.metalness = 0.10;
                  mat.transparent = true;
                  mat.opacity = 0.65;
                } else if (matName.includes('led') || matName.includes('reflector')) {
                  mat.emissive = new THREE.Color(0xff1800);
                  mat.emissiveIntensity = 2.8;
                }
                mat.needsUpdate = true;
              }
            }
          });

          // Cache all 4 wheel objects and their initial orientations
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

          // Cache dual exhaust pipe objects for accurate particle emission
          this.exhaust1 = model.getObjectByName('EXHAUST1') || null;
          this.exhaust2 = model.getObjectByName('EXHAUST2') || null;

          this.modelRoot = model;
          this.mesh.add(model);

          // Twin High-Intensity Forward Xenon Headlights
          // Casts light forward onto the asphalt road deck and glowing curb rumble strips
          const leftHeadlight = new THREE.SpotLight(0xfff5ea, 5.5, 36, Math.PI / 4, 0.45, 1.1);
          leftHeadlight.position.set(-0.35 * this.carScale, 0.22 * this.carScale, -1.8 * this.carScale);
          leftHeadlight.target.position.set(-0.35 * this.carScale, -0.1, -14 * this.carScale);
          this.mesh.add(leftHeadlight);
          this.mesh.add(leftHeadlight.target);

          const rightHeadlight = new THREE.SpotLight(0xfff5ea, 5.5, 36, Math.PI / 4, 0.45, 1.1);
          rightHeadlight.position.set(0.35 * this.carScale, 0.22 * this.carScale, -1.8 * this.carScale);
          rightHeadlight.target.position.set(0.35 * this.carScale, -0.1, -14 * this.carScale);
          this.mesh.add(rightHeadlight);
          this.mesh.add(rightHeadlight.target);

          // Wide forward flood fill light for bumper vicinity
          const roadFlood = new THREE.PointLight(0xffecd0, 2.5, 12, 1.4);
          roadFlood.position.set(0, 0.26 * this.carScale, -1.2 * this.carScale);
          this.mesh.add(roadFlood);

          if (!preservePosition) {
            this.setSpawn(new THREE.Vector3(-7.26, 0.1, 10.61), -Math.PI / 2);
          } else {
            this.mesh.position.copy(this.position);
            this.mesh.quaternion.copy(this.quaternion);
          }
          resolve();
        },
        undefined,
        (err) => reject(err)
      );
    });
  }

  setSpawn(pos: THREE.Vector3, heading: number = -Math.PI / 2) {
    this.position.copy(pos);
    this.currentHeading = heading;
    this.lastSafePosition.copy(pos);
    this.lastSafeHeading = heading;
    this.lastCheckpointPosition.copy(pos);
    this.lastCheckpointHeading = heading;
    this.velocity.set(0, 0, 0);
    this.speedKmH = 0;
    this.verticalVelocity = 0;
    this.rpm = 1000;
    this.driftAngle = 0;
    this.steerAngle = 0;
    this.yawVelocity = 0;
    this.bodyRollAngle = 0;
    this.nitro = 100;
    this.surfaceNormal.set(0, 1, 0);

    // Initial orientation: Nose along heading, Up along world Y
    this.forwardVec.set(-Math.sin(heading), 0, -Math.cos(heading)).normalize();
    this.rightVec.crossVectors(this.forwardVec, this.surfaceNormal).normalize();
    this.alignedForward.copy(this.forwardVec);
    this.localZ.copy(this.alignedForward).negate();

    this.rotMatrix.makeBasis(this.rightVec, this.surfaceNormal, this.localZ);
    this.mesh.quaternion.setFromRotationMatrix(this.rotMatrix);
    this.mesh.position.copy(this.position);
    this.quaternion.copy(this.mesh.quaternion);

    this.wheelSpinAngle = 0;
    this.isOnLava = false;
    this.lavaRatio = 0.0;
    this.lavaPullHeading = 0.0;
    this.deepLavaTimer = 0.0;
    if (this.wheelLF) this.wheelLF.quaternion.copy(this.initialQuatLF);
    if (this.wheelRF) this.wheelRF.quaternion.copy(this.initialQuatRF);
    if (this.wheelLR) this.wheelLR.quaternion.copy(this.initialQuatLR);
    if (this.wheelRR) this.wheelRR.quaternion.copy(this.initialQuatRR);
    if (this.skidmarkManager) {
      this.skidmarkManager.reset();
    }
  }

  setCarScale(scale: number) {
    this.carScale = scale;
    this.suspensionRestLength = 0.026 * scale;
    if (this.modelRoot) {
      const s = scale * this.baseScaleFactor;
      this.modelRoot.scale.set(s, s, s);
    }
  }

  setCheckpointReached(pos: THREE.Vector3, heading: number) {
    this.lastCheckpointPosition.copy(pos);
    this.lastCheckpointHeading = heading;
    this.lastSafePosition.copy(pos);
    this.lastSafeHeading = heading;
  }

  applyCollisionImpulse(impulse: THREE.Vector3, impactPoint: THREE.Vector3) {
    // 1. Direct 2D velocity impulse
    this.velocity.x += impulse.x;
    this.velocity.z += impulse.z;

    // 2. Transfer forward/backward impact into longitudinal speedKmH
    const forwardImpulse = impulse.x * this.forwardVec.x + impulse.z * this.forwardVec.z;
    this.speedKmH += (forwardImpulse * 3.6) / this.carScale;
    this.speedKmH = THREE.MathUtils.clamp(this.speedKmH, -45, 230);

    // 3. Off-center rotational torque: causes realistic yaw perturbation and drift step-out
    const rx = impactPoint.x - this.position.x;
    const rz = impactPoint.z - this.position.z;
    const torqueYaw = rx * impulse.z - rz * impulse.x;
    this.yawVelocity += THREE.MathUtils.clamp(torqueYaw * 15.0, -15, 15);
    this.currentHeading += this.yawVelocity * 0.02;

    // 4. Dynamic chassis body roll reaction to impact
    const lateralImpulse = impulse.x * this.rightVec.x + impulse.z * this.rightVec.z;
    this.bodyRollAngle = THREE.MathUtils.clamp(this.bodyRollAngle - lateralImpulse * 0.05, -0.065, 0.065);
  }

  // Asphalt-style Nitro Intake & Hyper Speed Surge
  addNitro(amount: number = 45) {
    this.nitro = Math.min(100, this.nitro + amount);
    this.activateAsphaltNitro(3.5);
  }

  activateAsphaltNitro(duration: number = 3.5) {
    this.asphaltNitroTimer = Math.max(this.asphaltNitroTimer, duration);
    this.isAsphaltSurging = true;
    this.isBoosting = true;

    // Instant Asphalt Rocket Kick: immediate physical velocity surge
    if (this.speedKmH > 25) {
      this.speedKmH = Math.min(248, this.speedKmH + 28);
    } else {
      this.speedKmH = Math.max(this.speedKmH, 70);
    }

    const fwdKickMs = (28 * 1000 / 3600) * this.carScale;
    this.velocity.x += -Math.sin(this.currentHeading) * fwdKickMs;
    this.velocity.z += -Math.cos(this.currentHeading) * fwdKickMs;
  }

  respawn() {
    let targetPos = this.lastSafePosition.clone();
    let targetHeading = this.lastSafeHeading;

    // Guard against corrupted or submerged safe positions (e.g. inside lava pot or off-track)
    if (targetPos.y < -0.10 || targetPos.y > 0.80 || targetPos.distanceTo(this.lastCheckpointPosition) > 28) {
      targetPos.copy(this.lastCheckpointPosition);
      targetHeading = this.lastCheckpointHeading;
    }

    // Spawn gently on the asphalt road surface (+0.04m above road, no dropping from sky or plunging underground)
    targetPos.y = Math.max(0.04, Math.min(0.20, targetPos.y));
    this.setSpawn(targetPos, targetHeading);
    this.speedKmH = 0; // Stationary on respawn for full player control, preventing instant re-entry into hazard
    this.velocity.set(0, 0, 0);
    this.verticalVelocity = 0;
    this.surfaceNormal.set(0, 1, 0);
    this.targetQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), targetHeading);
    this.mesh.quaternion.copy(this.targetQuat);
    this.quaternion.copy(this.targetQuat);
    this.yawVelocity = 0;
    this.bodyRollAngle = 0;
    this.driftAngle = 0;
    this.steerAngle = 0;
    this.isOnLava = false;
    this.lavaRatio = 0.0;
    this.deepLavaTimer = 0.0;
    this.respawnCooldown = 1.0;
    useGameStore.getState().setNotification('Recovered back to track! 🔄');
  }

  update(delta: number) {
    const dt = Math.min(delta, 0.05);

    if (this.respawnCooldown > 0) {
      this.respawnCooldown -= dt;
    }

    // 1. Steering Input & Physics
    // Smooth, progressive sports-car steering response with speed-sensitive stability
    const speedAbs = Math.abs(this.speedKmH);
    const speedFactor = Math.min(1.0, speedAbs / 200);
    // Dynamic max steer angle: refined, progressive angle without snappy or twitchy behavior
    const dynamicMaxSteer = THREE.MathUtils.lerp(this.maxSteerAngle, this.maxSteerAngle * 0.76, speedFactor);
    const targetSteer = (this.input.left ? dynamicMaxSteer : 0) - (this.input.right ? dynamicMaxSteer : 0);

    // Smooth, progressive steering build-up (avoids overly fast snap-turns) and stable self-centering
    const isSteeringInput = this.input.left || this.input.right;
    const steerSpeed = isSteeringInput ? 8.2 : 10.5;
    this.steerAngle += (targetSteer - this.steerAngle) * Math.min(1, dt * steerSpeed);

    // 2. Handbrake and Nitro (Asphalt Hyper-Boost Surge)
    if (this.asphaltNitroTimer > 0) {
      this.asphaltNitroTimer -= dt;
      this.isAsphaltSurging = true;
    } else {
      this.isAsphaltSurging = false;
    }

    this.isDrifting = this.input.handbrake && Math.abs(this.speedKmH) > 16;
    this.isBoosting = (this.input.boost && this.nitro > 0 && this.input.forward) || this.isAsphaltSurging;
    this.isBraking = (this.input.backward && this.speedKmH > 3) || this.input.handbrake;

    if (this.isAsphaltSurging) {
      // Asphalt Hyper-Nitro auto-surge: preserves nitro bar for additional player boosting!
      soundEffects.playBoost();
    } else if (this.isBoosting) {
      this.nitro = Math.max(0, this.nitro - dt * 25);
      soundEffects.playBoost();
    } else if (this.isDrifting) {
      // Rapid nitro recharge during drift rewarding stylish power-sliding
      let driftNitroRefill = 32;
      if (this.carModelId === 'rd09') {
        driftNitroRefill = 42; // Extra reward for drifting muscle beast
      } else if (this.carModelId === 'iridium') {
        driftNitroRefill = 30;
      }
      this.nitro = Math.min(100, this.nitro + dt * driftNitroRefill);
    } else {
      this.nitro = Math.min(100, this.nitro + dt * 6);
    }

    // 3. Acceleration & Speed Physics: unique per vehicle model
    let maxSpeed = 185;
    let baseAccel = 68;
    let baseTurnMultiplier = 2.75;
    let driftTurnMultiplier = 3.45;

    if (this.carModelId === 'iridium') {
      maxSpeed = this.isAsphaltSurging ? 255 : (this.isBoosting ? 238 : 192);
      baseAccel = this.isAsphaltSurging ? 148 : (this.isBoosting ? 112 : 74);
      baseTurnMultiplier = 2.55;
      driftTurnMultiplier = 3.35;
    } else if (this.carModelId === 'rd09') {
      maxSpeed = this.isAsphaltSurging ? 242 : (this.isBoosting ? 226 : 180);
      baseAccel = this.isAsphaltSurging ? 135 : (this.isBoosting ? 100 : 66);
      baseTurnMultiplier = 2.70;
      driftTurnMultiplier = 3.85; // Supreme wide drifting capability
    } else {
      // Mazda LM Vision
      maxSpeed = this.isAsphaltSurging ? 248 : (this.isBoosting ? 232 : 185);
      baseAccel = this.isAsphaltSurging ? 140 : (this.isBoosting ? 105 : 68);
      baseTurnMultiplier = 2.75;
      driftTurnMultiplier = 3.45;
    }

    const accelRate = baseAccel * Math.max(0.22, 1 - Math.abs(this.speedKmH) / maxSpeed);

    // Firm, authoritative high-performance sports brakes
    const brakeRate = 170;
    const naturalDrag = 12;

    if (this.input.forward) {
      if (this.speedKmH < 0) {
        this.speedKmH += brakeRate * dt;
      } else {
        this.speedKmH += accelRate * dt;
      }
    } else if (this.input.backward) {
      if (this.speedKmH > 0) {
        this.speedKmH -= brakeRate * dt;
      } else {
        this.speedKmH -= accelRate * 0.55 * dt;
      }
    } else {
      if (this.speedKmH > 0) {
        this.speedKmH = Math.max(0, this.speedKmH - naturalDrag * dt);
      } else if (this.speedKmH < 0) {
        this.speedKmH = Math.min(0, this.speedKmH + naturalDrag * dt);
      }
    }

    if (this.input.handbrake) {
      // Smooth drift speed regulation: maintains cornering momentum without stalling
      if (this.speedKmH > 55) {
        this.speedKmH = Math.max(55, this.speedKmH - 30 * dt);
      }
    }

    this.speedKmH = THREE.MathUtils.clamp(this.speedKmH, -45, maxSpeed);

    // 4. Turning Physics: Car steers with refined, smooth, balanced sports-car agility
    const isAccelerating = this.input.forward || this.input.backward;
    let turnEffectiveness = 0;
    if (speedAbs > 0.5) {
      // Scales progressively from standstill up to full turning at 10 km/h
      turnEffectiveness = Math.min(1.0, speedAbs / 10.0);
    } else if (isAccelerating) {
      turnEffectiveness = 0.55;
    }

    // Dynamic Cornering Bite: Trail-braking transfers weight to front axle smoothly
    let corneringBite = 1.0;
    if (this.input.backward && this.speedKmH > 10) {
      corneringBite = 1.28;
    } else if (!this.input.forward && this.speedKmH > 20) {
      corneringBite = 1.15;
    }

    // Invert turn rate when reversing so backing out turns naturally
    const isReversing = this.speedKmH < -0.2 || (this.input.backward && this.speedKmH <= 0.5);
    const reverseMult = isReversing ? -1 : 1;
    const turnMultiplier = this.isDrifting ? driftTurnMultiplier : baseTurnMultiplier;

    // Physical angular yaw acceleration with smooth rotational momentum
    const targetYawRate = this.steerAngle * turnMultiplier * turnEffectiveness * corneringBite * reverseMult;
    const yawAccel = this.isDrifting ? 9.5 : (isSteeringInput ? 7.8 : 9.5);
    this.yawVelocity += (targetYawRate - this.yawVelocity) * Math.min(1, dt * yawAccel);
    this.currentHeading += this.yawVelocity * dt;

    if (this.isDrifting) {
      // Rear steps out in a smooth, controllable power-slide
      const targetDrift = -this.steerAngle * 0.45;
      this.driftAngle += (targetDrift - this.driftAngle) * Math.min(1, dt * 7.5);
    } else {
      // Fluid counter-steer recovery out of drift
      this.driftAngle += (0 - this.driftAngle) * Math.min(1, dt * 8.5);
    }

    // Wheel rolling physics: rotate wheels around axle X based on distance travelled
    const speedMps = this.speedKmH / 3.6;
    this.wheelSpinAngle += (speedMps * dt) / 0.33;

    const visualSteer = THREE.MathUtils.clamp(this.steerAngle, -0.65, 0.65);

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
      this.qSpinLF.setFromAxisAngle(this.rollAxisX, this.wheelSpinAngle);
      this.qSpinRF.copy(this.qSpinLF);

      if (this.wheelLF) {
        this.qSteerLF.setFromAxisAngle(this.steerAxisZ, -visualSteer);
        this.wheelLF.quaternion.copy(this.qSteerLF).multiply(this.initialQuatLF).multiply(this.qSpinLF);
      }
      if (this.wheelRF) {
        this.qSteerRF.setFromAxisAngle(this.steerAxisZ, -visualSteer);
        this.wheelRF.quaternion.copy(this.qSteerRF).multiply(this.initialQuatRF).multiply(this.qSpinRF);
      }

      // Visually roll rear wheels around axle X
      if (this.wheelLR) {
        this.wheelLR.quaternion.copy(this.initialQuatLR).multiply(this.qSpinLF);
      }
      if (this.wheelRR) {
        this.wheelRR.quaternion.copy(this.initialQuatRR).multiply(this.qSpinRF);
      }
    }

    const halfW = 0.95 * this.carScale;
    const halfL = 2.18 * this.carScale;
    const diagDist = Math.hypot(halfL, halfW);

    // 5. Track Ground Raycasting (Center and Front Axle probes for seamless curb/ramp roll-over)
    const rayHeadroom = Math.max(0.35, 0.8 * this.carScale);
    this.rayOrigin.set(this.position.x, this.position.y + rayHeadroom, this.position.z);
    this.raycaster.set(this.rayOrigin, this.rayDir);
    this.raycaster.far = Math.max(1.8, 3.5 * this.carScale);

    let hit: THREE.Intersection | null = null;
    let hitNormal: THREE.Vector3 | null = null;
    let groundIsLava = false;
    let groundIsPlatform = false;

    let centerHit: THREE.Intersection | null = null;
    let centerHitNormal: THREE.Vector3 | null = null;
    let frontHit: THREE.Intersection | null = null;
    let frontHitNormal: THREE.Vector3 | null = null;

    if (this.colliders.length > 0) {
      const hits = this.raycaster.intersectObjects(this.colliders, true);
      for (const h of hits) {
        if (h.face) {
          const norm = h.face.normal.clone().transformDirection(h.object.matrixWorld).normalize();
          const objName = (h.object.name || '').toLowerCase();
          const isRoadSurface = h.object.userData.isPlatform || objName.includes('specialroad') || objName.includes('gangplank');
          // On road, allow banked turns (normal.y >= 0.35).
          // Off-road terrain/ground: require gentle/moderate slope (normal.y >= 0.70, up to ~45 deg).
          // Rejects steep hills and vertical mountain faces so car CANNOT climb mountains into the sky!
          const minNormY = isRoadSurface ? 0.35 : 0.70;
          if (norm.y >= minNormY) {
            centerHit = h;
            centerHitNormal = norm;
            break;
          }
        }
      }

      // Check front axle probe to anticipate ramps / curbs / steps
      const frontX = this.position.x + this.forwardVec.x * (halfL * 0.7);
      const frontZ = this.position.z + this.forwardVec.z * (halfL * 0.7);
      this.rayOrigin.set(frontX, this.position.y + rayHeadroom, frontZ);
      this.raycaster.set(this.rayOrigin, this.rayDir);
      const frontHits = this.raycaster.intersectObjects(this.colliders, true);
      for (const fh of frontHits) {
        if (fh.face) {
          const fNorm = fh.face.normal.clone().transformDirection(fh.object.matrixWorld).normalize();
          const fObjName = (fh.object.name || '').toLowerCase();
          const isRoadSurface = fh.object.userData.isPlatform || fObjName.includes('specialroad') || fObjName.includes('gangplank');
          const minNormY = isRoadSurface ? 0.35 : 0.70;
          if (fNorm.y >= minNormY) {
            frontHit = fh;
            frontHitNormal = fNorm;
            break;
          }
        }
      }
    }

    // The center probe strictly dictates vehicle chassis elevation.
    // Front probe ONLY aids pitch normal blending; it NEVER overrides chassis height when center is off-road.
    if (centerHit && centerHitNormal) {
      hit = centerHit;
      if (frontHit && frontHitNormal) {
        hitNormal = centerHitNormal.clone().lerp(frontHitNormal, 0.35).normalize();
      } else {
        hitNormal = centerHitNormal;
      }
    } else {
      hit = null;
      hitNormal = null;
    }

    if (hit) {
      const hitName = (hit.object.name || '').toLowerCase();
      const isOnRoad =
        hit.object.userData.isPlatform ||
        hitName.includes('specialroad') ||
        hitName.includes('dyke') ||
        hitName.includes('gangplank');

      groundIsPlatform = !!hit.object.userData.isPlatform;
      groundIsLava = !isOnRoad && (hit.object.userData.isLava || hitName.includes('lava') || hitName.includes('magma'));
      if (hit.object.userData.isLavaHazard) {
        this.isOnLava = true;
      }
    }

    if (hit && hitNormal) {
      const targetY = hit.point.y + this.suspensionRestLength;
      const heightDiff = targetY - this.position.y;

      // Contact window: suspension tracks ground drops and step-ups smoothly within 0.85m reach
      const inContact = heightDiff >= -0.85 && heightDiff <= 0.45;

      if (inContact) {
        this.grounded = true;
        this.verticalVelocity = 0;

        if (heightDiff > 0) {
          // Stepping up: smoothly glide up over curbs or inclines
          const stepUp = THREE.MathUtils.clamp(heightDiff * Math.min(1, dt * 14.0), 0, 5.0 * dt);
          this.position.y += stepUp;
        } else {
          // Stepping down / drop: smoothly track downward slope without bouncing, jitter, or oscillation
          const stepDown = THREE.MathUtils.clamp(heightDiff * Math.min(1, dt * 16.0), -6.0 * dt, 0);
          this.position.y += stepDown;
        }

        // Keep vehicle upright: surface normal never tilts into inversion
        hitNormal.y = Math.max(0.60, hitNormal.y);
        hitNormal.normalize();
        this.surfaceNormal.lerp(hitNormal, Math.min(1, dt * 9.0));

        // 1. Only save safe track position when firmly on the flat asphalt deck (never on steep embankments)
        const hitName = (hit.object.name || '').toLowerCase();
        const isOnCleanRoad =
          !groundIsLava &&
          (hitName.includes('specialroad') || hit.object.userData.isPlatform) &&
          !hitName.includes('dyke') &&
          !hitName.includes('ground') &&
          !hitName.includes('water') &&
          !hitName.includes('lava') &&
          !hitName.includes('magma') &&
          !hitName.includes('trap') &&
          this.position.y >= -0.05 &&
          this.position.y <= 0.25;

        if (isOnCleanRoad && Math.abs(this.speedKmH) > 10) {
          this.lastSafePosition.copy(this.position);
          this.lastSafeHeading = this.currentHeading;
        }
      } else {
        // True airborne free fall: flew off crest or launched
        this.grounded = false;
        this.verticalVelocity = Math.max(-15, this.verticalVelocity - 20 * dt);
        this.position.y += this.verticalVelocity * dt;

        // Smooth landing catch when descending into contact reach
        if (this.verticalVelocity < 0 && this.position.y <= targetY) {
          this.position.y = targetY;
          this.verticalVelocity = 0;
          this.grounded = true;
        }

        this.surfaceNormal.lerp(new THREE.Vector3(0, 1, 0), Math.min(1, dt * 4.0));
      }
    } else {
      this.grounded = false;
      this.verticalVelocity = Math.max(-15, this.verticalVelocity - 20 * dt);
      this.position.y += this.verticalVelocity * dt;
      this.surfaceNormal.lerp(new THREE.Vector3(0, 1, 0), Math.min(1, dt * 4.0));
    }

    // 2. Off-track Abyss, Lava Trap & Sky Launch Boundary Recovery:
    // Recovers vehicle if it drops into the deep caldera lake (y < -0.85m), is launched into the sky (y > 2.8m), or is stopped on a lava hazard:
    const isFallenInAbyss = this.position.y < -0.85;
    const isLaunchedInSky = this.position.y > 2.8;
    const isLavaStuck = (groundIsLava || this.isOnLava) && Math.abs(this.speedKmH) < 5;

    if (this.respawnCooldown <= 0 && (isFallenInAbyss || isLaunchedInSky || isLavaStuck)) {
      this.deepLavaTimer += dt;
      const timeout = (isFallenInAbyss || isLaunchedInSky) ? 0.35 : 0.75;
      if (this.deepLavaTimer >= timeout) {
        this.respawn();
        this.deepLavaTimer = 0;
      }
    } else {
      this.deepLavaTimer = 0;
    }

    // Absolute boundary failsafes
    if (this.position.y < -1.5 || this.position.y > 4.5) {
      this.respawn();
    }

    // 6. Movement in XZ plane with High-Speed Anti-Tunneling Substeps
    const moveHeading = this.currentHeading + this.driftAngle;
    const speedMs = (this.speedKmH * 1000 / 3600) * this.carScale;
    const desiredVelX = -Math.sin(moveHeading) * speedMs;
    const desiredVelZ = -Math.cos(moveHeading) * speedMs;

    // Lateral tire grip: progressive traction curve provides smooth, planted road holding
    const gripTraction = this.isDrifting ? 7.5 : THREE.MathUtils.lerp(14.0, 20.0, Math.min(1.0, speedAbs / 180));
    this.velocity.x += (desiredVelX - this.velocity.x) * Math.min(1, dt * gripTraction);
    this.velocity.z += (desiredVelZ - this.velocity.z) * Math.min(1, dt * gripTraction);

    const substeps = Math.abs(this.speedKmH) > 40 ? 2 : 1;
    const subDt = dt / substeps;

    // Pre-filter candidate barriers using precomputed bounding spheres for locked 60 FPS performance
    const candidateBarriers: THREE.Object3D[] = [];
    if (this.barriers.length > 0) {
      const carPos = this.position;
      const checkDist = 6.5 * (this.carScale / 0.14);
      for (let bIdx = 0; bIdx < this.barriers.length; bIdx++) {
        const b = this.barriers[bIdx];
        const s = b.userData.worldSphere as THREE.Sphere | undefined;
        if (s) {
          if (s.distanceToPoint(carPos) < checkDist) {
            candidateBarriers.push(b);
          }
        } else {
          const dx = b.position.x - carPos.x;
          const dz = b.position.z - carPos.z;
          if (dx * dx + dz * dz < checkDist * checkDist) {
            candidateBarriers.push(b);
          }
        }
      }
    }

    for (let step = 0; step < substeps; step++) {
      this.position.x += this.velocity.x * subDt;
      this.position.z += this.velocity.z * subDt;

      // Multi-Probe Perimeter Barrier Collision & Resistance System
      if (candidateBarriers.length > 0) {
        this.probeCenter.set(this.position.x, this.position.y + 0.16 * this.carScale, this.position.z);

        this.probeDirFL.copy(this.forwardVec).multiplyScalar(0.85).addScaledVector(this.rightVec, -0.52).normalize();
        this.probeDirFR.copy(this.forwardVec).multiplyScalar(0.85).addScaledVector(this.rightVec, 0.52).normalize();
        this.probeDirLeft.copy(this.rightVec).negate();
        this.probeDirRL.copy(this.forwardVec).multiplyScalar(-0.85).addScaledVector(this.rightVec, -0.52).normalize();
        this.probeDirRR.copy(this.forwardVec).multiplyScalar(-0.85).addScaledVector(this.rightVec, 0.52).normalize();
        this.probeDirRear.copy(this.forwardVec).negate();

        const probeDefs = [
          { dir: this.forwardVec, dist: halfL + 0.08 },
          { dir: this.probeDirFL, dist: diagDist + 0.08 },
          { dir: this.probeDirFR, dist: diagDist + 0.08 },
          { dir: this.probeDirLeft, dist: halfW + 0.08 },
          { dir: this.rightVec, dist: halfW + 0.08 },
          { dir: this.probeDirRL, dist: diagDist + 0.08 },
          { dir: this.probeDirRR, dist: diagDist + 0.08 },
          { dir: this.probeDirRear, dist: halfL + 0.08 },
        ];

        let maxPenetration = 0;
        let bestNormX = 0;
        let bestNormZ = 0;
        let hitBarrier = false;

        for (const p of probeDefs) {
          this.bumperRaycaster.set(this.probeCenter, p.dir);
          this.bumperRaycaster.far = p.dist;
          const hits = this.bumperRaycaster.intersectObjects(candidateBarriers, true);
          if (hits.length > 0) {
            const hit = hits[0];
            // Never treat drivable road floor meshes as barrier obstacles
            if (this.colliders.includes(hit.object)) {
              continue;
            }
            if (hit.distance < p.dist && hit.face) {
              const rawNorm = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
              // Steep obstacle, curb, or vertical barrier face (|normal.y| < 0.65)
              if (Math.abs(rawNorm.y) < 0.65) {
                const penetration = p.dist - hit.distance;
                let normX = rawNorm.x;
                let normZ = rawNorm.z;
                const normLen = Math.hypot(normX, normZ);
                if (normLen > 0.0001) {
                  normX /= normLen;
                  normZ /= normLen;
                } else {
                  normX = -p.dir.x;
                  normZ = -p.dir.z;
                }
                // Ensure normal points inward towards the track / car center
                if (normX * p.dir.x + normZ * p.dir.z > 0) {
                  normX = -normX;
                  normZ = -normZ;
                }

                if (penetration > maxPenetration) {
                  maxPenetration = penetration;
                  bestNormX = normX;
                  bestNormZ = normZ;
                  hitBarrier = true;
                }
              }
            }
          }
        }

        if (hitBarrier && maxPenetration > 0) {
          // 1. Depenetrate: gently slide vehicle away from wall without jarring pops
          const push = maxPenetration * 0.92 + 0.025;
          this.position.x += bestNormX * push;
          this.position.z += bestNormZ * push;

          // 2. Deflect velocity: slide along the barrier surface without losing momentum completely
          const speedIntoWall = this.velocity.x * bestNormX + this.velocity.z * bestNormZ;
          if (speedIntoWall < 0) {
            // Remove velocity component into the wall and add small outward repulsion cushion
            this.velocity.x -= (speedIntoWall - 0.12) * bestNormX;
            this.velocity.z -= (speedIntoWall - 0.12) * bestNormZ;

            const impactSpeed = Math.abs(speedIntoWall);
            if (impactSpeed > 0.6) {
              soundEffects.playCollision(Math.min(1.0, impactSpeed / 7));
            }

            // High impact angles absorb speed; glancing angles slide with ultra-low friction
            if (impactSpeed > 4.5) {
              this.speedKmH *= 0.92;
            } else {
              this.speedKmH *= 0.995;
            }

            // 3. Smooth Barrier Tangent Redirection (eliminates "Sticky Wall" bug)
            // Redirect currentHeading along the forward barrier tangent to guide car naturally back to track
            const tX = -bestNormZ;
            const tZ = bestNormX;
            const fwdDot = -Math.sin(this.currentHeading) * tX - Math.cos(this.currentHeading) * tZ;
            const tanX = fwdDot >= 0 ? tX : -tX;
            const tanZ = fwdDot >= 0 ? tZ : -tZ;
            const wallHeading = Math.atan2(-tanX, -tanZ);

            let headingDiff = wallHeading - this.currentHeading;
            while (headingDiff > Math.PI) headingDiff -= Math.PI * 2;
            while (headingDiff < -Math.PI) headingDiff += Math.PI * 2;
            this.currentHeading += headingDiff * Math.min(0.55, (impactSpeed + 0.4) * 0.28);
          }
        }
      }
    }

    this.mesh.position.copy(this.position);

    // 7. Track Slope & Bank Alignment (Right-Handed Orthonormal Basis)
    // Guarantee vehicle stays upright: surface normal never inverts
    this.surfaceNormal.y = Math.max(0.55, this.surfaceNormal.y);
    this.surfaceNormal.normalize();

    this.forwardVec.set(-Math.sin(this.currentHeading), 0, -Math.cos(this.currentHeading)).normalize();
    this.rightVec.crossVectors(this.forwardVec, this.surfaceNormal).normalize();
    this.alignedForward.crossVectors(this.surfaceNormal, this.rightVec).normalize();
    this.localZ.copy(this.alignedForward).negate();

    this.rotMatrix.makeBasis(this.rightVec, this.surfaceNormal, this.localZ);
    this.targetQuat.setFromRotationMatrix(this.rotMatrix);

    // Subtle dynamic chassis body roll into corners (weight transfer)
    const targetRoll = THREE.MathUtils.clamp(-this.steerAngle * (speedAbs / 140) * 0.036, -0.040, 0.040);
    this.bodyRollAngle += (targetRoll - this.bodyRollAngle) * Math.min(1, dt * 7.5);
    if (Math.abs(this.bodyRollAngle) > 0.0005) {
      const rollQuat = new THREE.Quaternion().setFromAxisAngle(this.alignedForward, this.bodyRollAngle);
      this.targetQuat.multiply(rollQuat);
    }

    this.mesh.quaternion.slerp(this.targetQuat, Math.min(1, dt * 11.5));
    this.quaternion.copy(this.mesh.quaternion);

    // 8. Particle Spawning: Exhaust & Moving Tire Smoke & Skid Marks
    // Twin Exhaust Position Calculation (relative to car chassis rear diffuser)
    const rearDist = 2.12 * this.carScale;
    const exhaustY = 0.11 * (this.carScale / 0.20);
    const pipeOffset = 0.16 * this.carScale;

    const rearCenter = this.position.clone().addScaledVector(this.forwardVec, -rearDist);
    rearCenter.y = this.position.y + exhaustY;

    const posEx1 = rearCenter.clone().addScaledVector(this.rightVec, -pipeOffset);
    const posEx2 = rearCenter.clone().addScaledVector(this.rightVec, pipeOffset);

    // A. Boost Flame Jets (Supersonic blue/orange fire)
    if (this.isBoosting) {
      this.particleManager.spawnBoostFlame(posEx1, this.forwardVec);
      this.particleManager.spawnBoostFlame(posEx2, this.forwardVec);
    }

    // B. Acceleration Exhaust Smoke & Idle Engine Wisps (Controlled & subtle)
    if (this.input.forward && this.rpm > 5500 && Math.random() < 0.20) {
      // High-RPM aggressive throttle exhaust wisp
      this.particleManager.spawnExhaustSmoke(posEx1, this.forwardVec, 0.4);
      this.particleManager.spawnExhaustSmoke(posEx2, this.forwardVec, 0.4);
    } else if (!this.input.forward && Math.abs(this.speedKmH) < 1.0 && Math.random() < 0.02) {
      // Very occasional faint warm idle wisp at standstill
      this.particleManager.spawnExhaustSmoke(posEx1, this.forwardVec, 0.15, true);
    }

    // C. Lava Hazard Wheel Detection & Tire Burning Simulation
    const wheels = [this.wheelLF, this.wheelRF, this.wheelLR, this.wheelRR];
    const tireWidth = 0.052 * (this.carScale / 0.20);
    const wPos = new THREE.Vector3();
    let lavaWheelsCount = 0;
    let leftLava = 0;
    let rightLava = 0;

    const probeHeadroom = 0.15 * (this.carScale / 0.20);
    const probeFar = 0.45 * (this.carScale / 0.20);

    const isSkidding = this.grounded && (
      (this.isDrifting && Math.abs(this.speedKmH) > 18) ||
      (this.input.backward && this.speedKmH > 25)
    );

    for (let i = 0; i < 4; i++) {
      const w = wheels[i];
      if (!w) continue;
      w.getWorldPosition(wPos);
      const contactPos = wPos.clone();
      contactPos.y = this.position.y; // on road surface

      let wheelInLava = false;

      if (this.grounded && this.colliders.length > 0) {
        // Fast AABB check for lava zone: skips 4 raycasts per frame across 95% of the circuit
        const isNearLavaZone = this.position.x > -8.0 && this.position.x < 15.0 && this.position.z > 4.0 && this.position.z < 20.0;
        if (isNearLavaZone) {
          this.wheelRaycaster.set(
            this.wheelProbePos.set(wPos.x, wPos.y + probeHeadroom, wPos.z),
            this.rayDir
          );
          this.wheelRaycaster.far = probeFar;
          const wHits = this.wheelRaycaster.intersectObjects(this.colliders, true);
          let onPlatform = false;
          let onLava = false;
          for (const wh of wHits) {
            if (wh.object.userData.isPlatform) {
              onPlatform = true;
            }
            if (
              wh.object.userData.isLava ||
              wh.object.name.toLowerCase().includes('lava') ||
              wh.object.name.toLowerCase().includes('magma')
            ) {
              onLava = true;
            }
          }
          if (onLava && !onPlatform) {
            wheelInLava = true;
          }
        }
      }

      if (wheelInLava) {
        lavaWheelsCount++;
        if (i === 0 || i === 2) leftLava++;
        else rightLava++;

        // Do not draw asphalt rubber ribbons when in molten rock
        if (this.skidmarkManager) {
          this.skidmarkManager.stopSkidMark(i);
        }
      } else if (isSkidding) {
        // Billowy moving tire smoke puffs
        if (i >= 2 || Math.random() > 0.4) {
          this.particleManager.spawnDriftSmoke(contactPos);
        }

        // Dark rubber skid marks ribbon on road surface
        if (this.skidmarkManager) {
          const intensity = this.isDrifting ? 0.85 : 0.65;
          this.skidmarkManager.addSkidMark(i, contactPos, this.surfaceNormal, this.forwardVec, tireWidth, intensity);
        }
      } else {
        if (this.skidmarkManager) {
          this.skidmarkManager.stopSkidMark(i);
        }
      }
    }

    if (groundIsLava && !groundIsPlatform) {
      lavaWheelsCount = Math.max(lavaWheelsCount, 2);
    }

    this.isOnLava = this.grounded && (lavaWheelsCount > 0 || (groundIsLava && !groundIsPlatform));
    this.lavaRatio = THREE.MathUtils.clamp(lavaWheelsCount / 4, 0, 1);
    if (this.isOnLava && this.lavaRatio === 0) this.lavaRatio = 0.5;

    // Pull steering slightly if wheels on only one side are bogged in lava
    this.lavaPullHeading = (leftLava > rightLava ? 0.35 : (rightLava > leftLava ? -0.35 : 0));

    // 9. Gear & RPM
    this.calculateGearAndRpm();

    // 10. Audio
    soundEffects.updateEngine(this.rpm, Math.abs(this.speedKmH), this.isDrifting, this.isBoosting);
  }

  private calculateGearAndRpm() {
    if (this.speedKmH < 0) {
      this.gear = 'R';
      this.rpm = 1000 + Math.abs(this.speedKmH) * 120;
      return;
    }

    const s = this.speedKmH;
    let gearRatio = 1;
    let baseSpeed = 0;

    if (s < 35) {
      this.gear = 1;
      baseSpeed = s;
      gearRatio = 220;
    } else if (s < 70) {
      this.gear = 2;
      baseSpeed = s - 35;
      gearRatio = 180;
    } else if (s < 110) {
      this.gear = 3;
      baseSpeed = s - 70;
      gearRatio = 150;
    } else if (s < 150) {
      this.gear = 4;
      baseSpeed = s - 110;
      gearRatio = 130;
    } else if (s < 190) {
      this.gear = 5;
      baseSpeed = s - 150;
      gearRatio = 110;
    } else {
      this.gear = 6;
      baseSpeed = s - 190;
      gearRatio = 90;
    }

    this.rpm = Math.min(9000, 1100 + baseSpeed * gearRatio);
  }

  getTelemetry(): VehicleTelemetry {
    return {
      speed: Math.round(this.speedKmH),
      rpm: Math.round(this.rpm),
      gear: this.gear,
      nitro: Math.round(this.nitro),
      isBoosting: this.isBoosting,
      isDrifting: this.isDrifting,
      isBraking: this.isBraking,
      isOnLava: this.isOnLava,
      carScale: this.carScale,
    };
  }

  dispose() {
    if (this.mesh.parent) {
      this.mesh.parent.remove(this.mesh);
    }
  }
}
