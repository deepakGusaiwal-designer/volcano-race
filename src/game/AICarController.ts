import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ParticleManager } from './ParticleManager';
import { useGameStore } from '../store/useGameStore';

export interface AICarConfig {
  id: string;
  name: string;
  modelType: 'iridium' | 'rd09' | 'mazda';
  colorHex: number;
  laneOffset: number; // Lateral offset from center line (-0.5m to +0.5m)
  skillMultiplier: number; // Competitive pace factor (~1.00 to 1.10)
  gridSlot: number; // 1, 2, 3
}

export interface ObstacleCarInfo {
  id: string;
  position: THREE.Vector3;
  speedKmH: number;
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
  private boostRemaining = 0;
  private nextBoostTime = 1.5;
  private hasPassedMidpoint = false;
  private overtakeSide = 0;
  private overtakeCooldown = 0;

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

  setSpawn(gridSlot: number, _direction: 'normal' | 'reverse' = 'reverse') {
    // Spawn directly behind the start/finish line along the true centered spline
    const rowBackMeters = gridSlot * 1.85;
    const uSpawn = (1.0 - rowBackMeters / Math.max(10, this.splineLength)) % 1.0;
    const pt = this.trackSpline.getPointAt(uSpawn);
    const tangent = this.trackSpline.getTangentAt(uSpawn).normalize();
    const trackNormal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    const lateralSide = gridSlot % 2 === 1 ? 0.42 : -0.42;

    this.position.set(
      pt.x + trackNormal.x * lateralSide,
      pt.y + 0.04,
      pt.z + trackNormal.z * lateralSide
    );
    this.currentHeading = Math.atan2(-tangent.x, -tangent.z);

    this.speedKmH = 0;
    this.velocity.set(0, 0, 0);
    this.verticalVelocity = 0;
    this.grounded = true;
    this.airTime = 0;
    this.lastTargetY = this.position.y;
    this.currentLap = 1;
    this.hasPassedMidpoint = false;
    this.isBoosting = false;
    this.boostTimer = 0;
    this.boostRemaining = 0;
    // Trigger competitive opening battle boost shortly after green flag
    this.nextBoostTime = 1.1 + gridSlot * 0.45 + Math.random() * 0.6;
    this.currentLaneOffset = this.config.laneOffset;
    this.smoothedLaneOffset = lateralSide;
    this.overtakeSide = 0;
    this.overtakeCooldown = 0;
    this.bodyRollAngle = 0;
    this.steerAngle = 0;
    this.wheelSpinAngle = 0;
    if (this.wheelLF) this.wheelLF.quaternion.copy(this.initialQuatLF);
    if (this.wheelRF) this.wheelRF.quaternion.copy(this.initialQuatRF);
    if (this.wheelLR) this.wheelLR.quaternion.copy(this.initialQuatLR);
    if (this.wheelRR) this.wheelRR.quaternion.copy(this.initialQuatRR);

    // Initialize progress U along spline
    this.progressU = uSpawn;
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

  public activateBoost(duration: number = 2.6, instantKickKmH: number = 22) {
    this.isBoosting = true;
    this.boostRemaining = Math.max(this.boostRemaining, duration);
    if (this.speedKmH > 20) {
      const maxBoost = 250 * this.config.skillMultiplier;
      this.speedKmH = Math.min(maxBoost, this.speedKmH + instantKickKmH);
    } else {
      this.speedKmH = Math.max(this.speedKmH, 68);
    }
    const fwdKickMs = (instantKickKmH * 1000 / 3600) * this.carScale;
    this.velocity.x += -Math.sin(this.currentHeading) * fwdKickMs;
    this.velocity.z += -Math.cos(this.currentHeading) * fwdKickMs;
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
    const samples = 240;
    for (let i = 0; i < samples; i++) {
      const u = i / samples;
      const pt = this.trackSpline.getPointAt(u);
      const d = Math.hypot(pt.x - pos.x, pt.z - pos.z);
      if (d < minDist) {
        minDist = d;
        bestU = u;
      }
    }
    return bestU;
  }

  private sampleSplineCurvature(uStart: number, uEnd: number): number {
    const t0 = this.trackSpline.getTangentAt((uStart + 1.0) % 1.0);
    const t1 = this.trackSpline.getTangentAt((uEnd + 1.0) % 1.0);
    const angle = Math.acos(THREE.MathUtils.clamp(t0.x * t1.x + t0.z * t1.z, -1, 1));
    const du = Math.abs(uEnd - uStart);
    const arcDist = Math.max(0.5, du * this.splineLength);
    return angle / arcDist; // rad per meter (1 / radius)
  }

  update(
    delta: number,
    colliders: THREE.Object3D[],
    _playerPos: THREE.Vector3,
    playerTotalProgress?: number,
    otherCars?: ObstacleCarInfo[],
    _onPlayerHit?: (impulseSpeed: number) => void
  ) {
    const dt = Math.min(delta, 0.05);

    // Keep AI cars parked on their starting grid slots during welcome screen and countdown
    const gState = useGameStore.getState().gameState;
    if (gState === 'welcome' || gState === 'countdown') {
      this.speedKmH = 0;
      this.velocity.set(0, 0, 0);
      this.mesh.position.copy(this.position);
      this.mesh.quaternion.copy(this.quaternion);
      return;
    }

    // 1. Sub-Decimeter Spline Position U Tracking (2D XZ prevents vertical bias & S-curve jumping)
    let bestU = this.progressU;
    let minDist = Infinity;
    for (let du = -0.004; du <= 0.025; du += 0.001) {
      const testU = (this.progressU + du + 1.0) % 1.0;
      const pt = this.trackSpline.getPointAt(testU);
      const d = Math.hypot(pt.x - this.position.x, pt.z - this.position.z);
      if (d < minDist) {
        minDist = d;
        bestU = testU;
      }
    }
    // Fine local search (~5cm resolution) eliminates quantized steering jitter
    for (let du = -0.0015; du <= 0.0015; du += 0.00015) {
      const testU = (bestU + du + 1.0) % 1.0;
      const pt = this.trackSpline.getPointAt(testU);
      const d = Math.hypot(pt.x - this.position.x, pt.z - this.position.z);
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

    // 2. Multi-Horizon Curvature & Pure-Pursuit Navigation
    const nearCurvature = Math.max(
      this.sampleSplineCurvature(this.progressU, this.progressU + 0.008),
      this.sampleSplineCurvature(this.progressU + 0.004, this.progressU + 0.015)
    );
    const brakeCurvature = Math.max(
      nearCurvature,
      this.sampleSplineCurvature(this.progressU + 0.012, this.progressU + 0.026),
      this.sampleSplineCurvature(this.progressU + 0.024, this.progressU + 0.044)
    );

    // Short corner-hugging lookahead (1.5m - 4.3m) eliminates cutting corners / jumping curbs
    const speedNorm = THREE.MathUtils.clamp(this.speedKmH / 230, 0, 1);
    const straightLookahead = THREE.MathUtils.lerp(1.9, 4.3, speedNorm);
    const sharpFactor = THREE.MathUtils.clamp((nearCurvature - 0.04) / 0.16, 0, 1);
    const lookaheadDist = THREE.MathUtils.clamp(
      THREE.MathUtils.lerp(straightLookahead, 1.55, sharpFactor),
      1.5,
      4.3
    );

    const targetU = (this.progressU + lookaheadDist / this.splineLength) % 1.0;
    const targetPt = this.trackSpline.getPointAt(targetU);
    const tangent = this.trackSpline.getTangentAt(targetU).normalize();
    const trackNormal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

    // Overtake detection: check if a slower racer is blocking directly ahead
    if (this.overtakeCooldown > 0) {
      this.overtakeCooldown -= dt;
    } else {
      this.overtakeSide = 0;
    }

    if (otherCars && this.speedKmH > 50 && nearCurvature < 0.14) {
      const fwdX = -Math.sin(this.currentHeading);
      const fwdZ = -Math.cos(this.currentHeading);
      const rightX = -fwdZ;
      const rightZ = fwdX;

      for (const other of otherCars) {
        if (other.id === this.id) continue;
        const ox = other.position.x - this.position.x;
        const oz = other.position.z - this.position.z;
        const ahead = ox * fwdX + oz * fwdZ;
        const side = ox * rightX + oz * rightZ;
        if (ahead > 0.3 && ahead < 3.4 && Math.abs(side) < 0.45 && other.speedKmH < this.speedKmH + 18) {
          // Pick passing lane away from the blocking car (clamped inside safe asphalt width)
          this.overtakeSide = side >= 0 ? -0.52 : 0.52;
          this.overtakeCooldown = 0.85;
          break;
        }
      }
    }

    // Adaptive lane offset: converge cleanly toward centerline through corners, shift smoothly when overtaking
    let effectiveLaneOffset = this.overtakeSide !== 0 ? this.overtakeSide : this.currentLaneOffset;
    if (sharpFactor > 0.15) {
      effectiveLaneOffset *= THREE.MathUtils.lerp(1.0, 0.15, sharpFactor);
    }
    effectiveLaneOffset = THREE.MathUtils.clamp(effectiveLaneOffset, -0.55, 0.55);

    this.smoothedLaneOffset += (effectiveLaneOffset - this.smoothedLaneOffset) * Math.min(1, dt * 4.5);
    targetPt.addScaledVector(trackNormal, this.smoothedLaneOffset);

    // Pure-Pursuit Heading & Yaw Control
    const fdx = targetPt.x - this.position.x;
    const fdz = targetPt.z - this.position.z;
    const distToTarget = Math.max(0.8, Math.hypot(fdx, fdz));
    const finalDesiredHeading = Math.atan2(-fdx, -fdz);
    let finalAngleDiff = finalDesiredHeading - this.currentHeading;
    while (finalAngleDiff > Math.PI) finalAngleDiff -= Math.PI * 2;
    while (finalAngleDiff < -Math.PI) finalAngleDiff += Math.PI * 2;

    const maxSteer = 0.72;
    const targetSteer = THREE.MathUtils.clamp(finalAngleDiff * 2.4, -maxSteer, maxSteer);
    this.steerAngle += (targetSteer - this.steerAngle) * Math.min(1, dt * 14.0);

    const speedMsRaw = (this.speedKmH * 1000 / 3600) * this.carScale;
    const purePursuitYaw = speedMsRaw * (2.0 * Math.sin(finalAngleDiff) / distToTarget);
    const correctiveYaw = finalAngleDiff * THREE.MathUtils.lerp(2.2, 4.2, Math.min(1.0, Math.abs(finalAngleDiff) * 2.0));
    const speedRatio = Math.min(1.0, Math.abs(this.speedKmH) / 6.0);
    this.currentHeading += (purePursuitYaw + correctiveYaw) * 0.65 * dt * speedRatio;

    // 3. Tactical Nitro Boost System (Launch surge, straights, corner exits & catch-up)
    const isTrailing = playerTotalProgress !== undefined && this.totalProgress < playerTotalProgress - 0.015;
    const farAhead = playerTotalProgress !== undefined && this.totalProgress > playerTotalProgress + 0.25;

    if (this.boostRemaining > 0) {
      this.boostRemaining -= dt;
      this.isBoosting = true;
      if (this.boostRemaining <= 0) {
        this.isBoosting = false;
        this.boostTimer = 0;
        this.nextBoostTime = isTrailing ? (3.2 + Math.random() * 2.8) : (5.2 + Math.random() * 4.2);
      }
    } else {
      this.isBoosting = false;
      this.boostTimer += dt;
      if (
        this.boostTimer >= this.nextBoostTime &&
        nearCurvature < 0.065 &&
        Math.abs(finalAngleDiff) < 0.16 &&
        this.speedKmH > 55 &&
        !farAhead
      ) {
        this.activateBoost(2.4 + Math.random() * 0.6, 18);
      }
    }

    // 4. Competitive Speed, Cornering & Acceleration Physics
    let targetSpeed = 198 * this.config.skillMultiplier;
    if (this.isBoosting) {
      targetSpeed = 245 * this.config.skillMultiplier;
    }

    // Physically grounded cornering speed from max lateral acceleration (takes sweepers flat out!)
    const effectiveCurv = Math.max(brakeCurvature, Math.abs(finalAngleDiff) * 0.22);
    if (effectiveCurv > 0.055) {
      const latGrip = 5.9 * Math.min(1.12, this.config.skillMultiplier);
      const speedFromCurv = (Math.sqrt(latGrip / effectiveCurv) / this.carScale) * 3.6;
      const cornerFloor = 118 * this.config.skillMultiplier;
      targetSpeed = Math.min(targetSpeed, Math.max(cornerFloor, speedFromCurv));
    }

    // Dynamic Race Balancing: fierce pursuit when trailing, strong defense when leading
    if (playerTotalProgress !== undefined) {
      const progressDiff = this.totalProgress - playerTotalProgress;
      if (progressDiff > 0.10) {
        // Gentle cap only if far ahead (> ~33m) so races stay exciting without gifting P1
        const leadRatio = Math.min(1.0, (progressDiff - 0.10) / 0.18);
        targetSpeed *= THREE.MathUtils.lerp(1.0, 0.95, leadRatio);
      } else if (progressDiff < -0.01) {
        // Strong catch-up surge so dropped rivals hunt down the player
        const trailRatio = Math.min(1.0, (-progressDiff - 0.01) / 0.07);
        targetSpeed *= THREE.MathUtils.lerp(1.02, 1.22, trailRatio);
      }
    }

    if (this.speedKmH < targetSpeed) {
      const baseAccel = (this.isBoosting ? 136 : 90) * this.config.skillMultiplier;
      const currentRatio = Math.min(1.0, Math.max(0, this.speedKmH) / (targetSpeed + 5));
      const accel = baseAccel * Math.max(0.42, 1.0 - currentRatio * 0.58);
      this.speedKmH += accel * dt;
    } else {
      const brake = 155;
      this.speedKmH = Math.max(targetSpeed, this.speedKmH - brake * dt);
    }

    // 5. Movement in XZ plane with crisp lateral grip
    const speedMs = (this.speedKmH * 1000 / 3600) * this.carScale;
    const desiredVelX = -Math.sin(this.currentHeading) * speedMs;
    const desiredVelZ = -Math.cos(this.currentHeading) * speedMs;

    this.velocity.x += (desiredVelX - this.velocity.x) * Math.min(1, dt * 20.0);
    this.velocity.z += (desiredVelZ - this.velocity.z) * Math.min(1, dt * 20.0);

    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;

    // Strict boundary enforcement: AI cars can NEVER enter or drive on the blocked lava canal
    if (
      this.position.x >= 16.5 &&
      this.position.x <= 21.8 &&
      this.position.z >= 14.8 &&
      this.position.z <= 22.8
    ) {
      const safePt = this.trackSpline.getPointAt(this.progressU);
      this.position.x = safePt.x;
      this.position.z = safePt.z;
      this.velocity.multiplyScalar(0.5);
      this.speedKmH = Math.min(this.speedKmH, 95);
    }

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

    // 7. Track Corridor Guard & Recovery (asphalt sits at y ~ -0.38, minWallDist = 1.15m)
    const targetSplinePt = this.trackSpline.getPointAt(this.progressU);
    const devX = this.position.x - targetSplinePt.x;
    const devZ = this.position.z - targetSplinePt.z;
    const distFromSpline = Math.hypot(devX, devZ);
    if (distFromSpline > 0.88) {
      // Smooth elastic curb containment keeps AI cars cleanly on asphalt & away from barriers
      const nx = devX / distFromSpline;
      const nz = devZ / distFromSpline;
      const clampedDist = Math.min(distFromSpline, 1.05);
      const pull = (distFromSpline - 0.88) * Math.min(1, dt * 10.0);
      this.position.x -= nx * pull;
      this.position.z -= nz * pull;
      if (distFromSpline > 1.25) {
        this.position.x = targetSplinePt.x + nx * clampedDist;
        this.position.z = targetSplinePt.z + nz * clampedDist;
      }
      // Cancel outward velocity component so car glides parallel to road edge
      const outwardVel = this.velocity.x * nx + this.velocity.z * nz;
      if (outwardVel > 0) {
        this.velocity.x -= nx * outwardVel;
        this.velocity.z -= nz * outwardVel;
      }
    }
    if (distFromSpline > 2.4 || this.position.y < -0.90) {
      // Emergency recovery onto true road centerline
      this.position.x = targetSplinePt.x;
      this.position.z = targetSplinePt.z;
      this.position.y = targetSplinePt.y + 0.04;
      this.verticalVelocity = 0;
      this.speedKmH = Math.max(135, this.speedKmH);
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
