import * as THREE from 'three';
import { modelCache } from './ModelCache';
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
  public launchDelay = 0;
  public raceActiveTime = 0;

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

  // Reusable scratch objects for zero heap allocations per frame
  private scratchPt = new THREE.Vector3();
  private scratchTargetPt = new THREE.Vector3();
  private scratchTangent = new THREE.Vector3();
  private scratchNormal = new THREE.Vector3();
  private scratchHitNormal = new THREE.Vector3();

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
  private isGridGrounded = false;
  private suspensionRestLength = 0.026 * 0.14;

  // Zero-allocation static scratch objects for 60 FPS animation loop
  private static scratchRollQuat = new THREE.Quaternion();
  private static scratchQSpin = new THREE.Quaternion();
  private static scratchQSteer = new THREE.Quaternion();
  private static readonly scratchAxisX = new THREE.Vector3(1, 0, 0);
  private static readonly scratchAxisY = new THREE.Vector3(0, 1, 0);
  private static readonly scratchAxisZ = new THREE.Vector3(0, 0, 1);
  private static scratchRearPos = new THREE.Vector3();

  // AI Behaviors
  private currentLaneOffset: number;
  private smoothedLaneOffset: number;
  private bodyRollAngle = 0;
  private boostTimer = 0;
  private boostRemaining = 0;
  private nextBoostTime = 3.5;
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
    let modelPath = '/models/mazda.glb';
    const rotY = Math.PI;
    let baseScaleFactor = 1.0;

    if (this.config.modelType === 'iridium') {
      modelPath = '/models/hot_wheels_iridium.glb';
      baseScaleFactor = 0.009355;
    } else if (this.config.modelType === 'rd09') {
      modelPath = '/models/hotwheels_rd09.glb';
      baseScaleFactor = 0.01030;
    }

    const model = await modelCache.cloneModel(modelPath);

    while (this.mesh.children.length > 0) {
      this.mesh.remove(this.mesh.children[0]);
    }

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
          if (
            matName.includes('carpaint') ||
            matName.includes('exterior') ||
            matName.includes('livery') ||
            matName.includes('body')
          ) {
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
    // Professional staggered GT starting grid ahead of player:
    // Slot 1 (Pole / Viper): +4.8m ahead on Left lane
    // Slot 2 (P2 / Ignis): +3.2m ahead on Right lane
    // Slot 3 (P3 / Shadow): +1.6m ahead on Left lane
    // (Player starts at Slot 4 / start line at 0m on Right lane)
    const distAhead = (4 - gridSlot) * 1.6;
    const uSpawn = (distAhead / Math.max(10, this.splineLength)) % 1.0;
    this.trackSpline.getPointAt(uSpawn, this.scratchPt);
    this.trackSpline.getTangentAt(uSpawn, this.scratchTangent).normalize();
    this.scratchNormal.set(-this.scratchTangent.z, 0, this.scratchTangent.x).normalize();

    // Lateral staggering: Slot 1 Left (-0.42m), Slot 2 Right (+0.42m), Slot 3 Left (-0.42m)
    const lateralSide = gridSlot % 2 === 1 ? -0.42 : 0.42;

    this.position.set(
      this.scratchPt.x + this.scratchNormal.x * lateralSide,
      0.05,
      this.scratchPt.z + this.scratchNormal.z * lateralSide
    );
    this.currentHeading = Math.atan2(-this.scratchTangent.x, -this.scratchTangent.z);

    this.speedKmH = 0;
    this.velocity.set(0, 0, 0);
    this.grounded = true;
    this.isGridGrounded = false;
    this.currentLap = 1;
    this.hasPassedMidpoint = false;
    this.isBoosting = false;
    this.boostTimer = 0;
    this.boostRemaining = 0;

    // Realistic driver launch reaction time so cars pull away in clean staggered formation
    this.launchDelay = 0.04 + (gridSlot - 1) * 0.12;
    this.raceActiveTime = 0;

    // Tactical boost trigger delayed until first open straightaway (no launch collisions)
    this.nextBoostTime = 3.6 + gridSlot * 0.8 + Math.random() * 1.2;

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

    this.progressU = uSpawn;
    this.totalProgress = 1.0 + this.progressU;

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

  public activateBoost(duration: number = 2.4, instantKickKmH: number = 18) {
    this.isBoosting = true;
    this.boostRemaining = Math.max(this.boostRemaining, duration);
    if (this.speedKmH > 20) {
      const maxBoost = 248 * this.config.skillMultiplier;
      this.speedKmH = Math.min(maxBoost, this.speedKmH + instantKickKmH);
    } else {
      this.speedKmH = Math.max(this.speedKmH, 65);
    }
    const fwdKickMs = (instantKickKmH * 1000 / 3600) * this.carScale;
    this.velocity.x += -Math.sin(this.currentHeading) * fwdKickMs;
    this.velocity.z += -Math.cos(this.currentHeading) * fwdKickMs;
  }

  applyCollisionImpulse(impulse: THREE.Vector3, _impactPoint: THREE.Vector3) {
    // Smooth physical impulse without violent yaw torque that spins AI out
    this.velocity.x += impulse.x * 0.45;
    this.velocity.z += impulse.z * 0.45;

    const forwardImpulse = impulse.x * this.forwardVec.x + impulse.z * this.forwardVec.z;
    this.speedKmH += (forwardImpulse * 2.2) / this.carScale;
    this.speedKmH = THREE.MathUtils.clamp(this.speedKmH, 15, 230);

    // Lateral impulse causes controlled, visual chassis roll
    const lateralImpulse = impulse.x * this.rightVec.x + impulse.z * this.rightVec.z;
    this.bodyRollAngle = THREE.MathUtils.clamp(this.bodyRollAngle - lateralImpulse * 0.025, -0.045, 0.045);
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
    const gState = useGameStore.getState().gameState;

    // Keep AI parked on grid during Welcome & Countdown
    if (gState === 'welcome' || gState === 'countdown') {
      this.speedKmH = 0;
      this.velocity.set(0, 0, 0);
      this.raceActiveTime = 0;

      // Ground probe to ensure tires rest perfectly flush on road surface (executed once on placement)
      if (!this.isGridGrounded && colliders.length > 0) {
        this.rayOrigin.set(this.position.x, this.position.y + 0.50, this.position.z);
        this.raycaster.set(this.rayOrigin, this.rayDir);
        this.raycaster.far = 1.8;
        const hits = this.raycaster.intersectObjects(colliders, true);
        for (const h of hits) {
          if (h.face) {
            this.scratchHitNormal.copy(h.face.normal).transformDirection(h.object.matrixWorld).normalize();
            if (this.scratchHitNormal.y >= 0.35) {
              this.position.y = h.point.y + this.suspensionRestLength;
              this.surfaceNormal.copy(this.scratchHitNormal);
              this.isGridGrounded = true;
              break;
            }
          }
        }
      }

      this.forwardVec.set(-Math.sin(this.currentHeading), 0, -Math.cos(this.currentHeading)).normalize();
      this.rightVec.crossVectors(this.forwardVec, this.surfaceNormal).normalize();
      this.alignedForward.crossVectors(this.surfaceNormal, this.rightVec).normalize();
      this.localZ.copy(this.alignedForward).negate();
      this.rotMatrix.makeBasis(this.rightVec, this.surfaceNormal, this.localZ);
      this.mesh.quaternion.setFromRotationMatrix(this.rotMatrix);
      this.quaternion.copy(this.mesh.quaternion);

      this.mesh.position.copy(this.position);
      return;
    }

    this.raceActiveTime += dt;
    // Staggered launch reaction delay: car holds line for a fraction of a second before rolling
    if (this.raceActiveTime < this.launchDelay) {
      this.speedKmH = 0;
      this.velocity.set(0, 0, 0);
      this.mesh.position.copy(this.position);
      this.mesh.quaternion.copy(this.quaternion);
      return;
    }

    // 1. Zero-Allocation Fast Spline Progress Tracking
    // Predict expected progress advance from forward velocity
    const speedMs = (this.speedKmH * 1000 / 3600) * this.carScale;
    const expectedDu = (speedMs * dt) / Math.max(10, this.splineLength);
    const predictedU = (this.progressU + expectedDu + 1.0) % 1.0;

    let bestU = predictedU;
    let minDist = Infinity;
    // Scan narrow window around predicted position using single scratch vector (0 heap allocations!)
    for (let i = -3; i <= 4; i++) {
      const testU = (predictedU + i * 0.0012 + 1.0) % 1.0;
      this.trackSpline.getPointAt(testU, this.scratchPt);
      const d = Math.hypot(this.scratchPt.x - this.position.x, this.scratchPt.z - this.position.z);
      if (d < minDist) {
        minDist = d;
        bestU = testU;
      }
    }

    // Circuit midpoint check for clean lap completion
    if (this.progressU > 0.40 && this.progressU < 0.60) {
      this.hasPassedMidpoint = true;
    }
    if (this.hasPassedMidpoint && this.progressU > 0.88 && bestU < 0.12) {
      this.currentLap++;
      this.hasPassedMidpoint = false;
    }
    this.progressU = bestU;

    const normalizedProgress = (!this.hasPassedMidpoint && this.currentLap === 1 && this.progressU > 0.85)
      ? this.progressU - 1.0
      : this.progressU;
    this.totalProgress = this.currentLap + normalizedProgress;

    // 2. Pure-Pursuit Lookahead & Lane Steering
    const lookaheadDist = THREE.MathUtils.clamp(2.4 + (this.speedKmH / 220) * 2.2, 2.2, 4.6);
    const targetU = (this.progressU + lookaheadDist / this.splineLength) % 1.0;
    this.trackSpline.getPointAt(targetU, this.scratchTargetPt);
    this.trackSpline.getTangentAt(targetU, this.scratchTangent).normalize();
    this.scratchNormal.set(-this.scratchTangent.z, 0, this.scratchTangent.x).normalize();

    // Overtaking & Lane selection
    if (this.overtakeCooldown > 0) {
      this.overtakeCooldown -= dt;
    } else {
      this.overtakeSide = 0;
    }

    if (otherCars && this.speedKmH > 40) {
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
        if (ahead > 0.4 && ahead < 3.2 && Math.abs(side) < 0.48 && other.speedKmH < this.speedKmH + 16) {
          this.overtakeSide = side >= 0 ? -0.48 : 0.48;
          this.overtakeCooldown = 0.9;
          break;
        }
      }
    }

    const effectiveLaneOffset = this.overtakeSide !== 0 ? this.overtakeSide : this.currentLaneOffset;
    this.smoothedLaneOffset += (effectiveLaneOffset - this.smoothedLaneOffset) * Math.min(1, dt * 3.5);
    this.scratchTargetPt.addScaledVector(this.scratchNormal, this.smoothedLaneOffset);

    // Pure pursuit heading angle
    const fdx = this.scratchTargetPt.x - this.position.x;
    const fdz = this.scratchTargetPt.z - this.position.z;
    const desiredHeading = Math.atan2(-fdx, -fdz);
    let angleDiff = desiredHeading - this.currentHeading;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    // Critically damped steering tracking (eliminates pendulum yaw hunting)
    const maxSteer = 0.65;
    const targetSteer = THREE.MathUtils.clamp(angleDiff * 1.6, -maxSteer, maxSteer);
    this.steerAngle += (targetSteer - this.steerAngle) * Math.min(1, dt * 10.0);

    const turnRate = THREE.MathUtils.clamp(angleDiff * 3.4, -3.0, 3.0);
    const speedRatio = THREE.MathUtils.clamp(Math.abs(this.speedKmH) / 12.0, 0.15, 1.0);
    this.currentHeading += turnRate * dt * speedRatio;

    // 3. Tactical Nitro Boost System
    if (this.boostRemaining > 0) {
      this.boostRemaining -= dt;
      this.isBoosting = true;
      if (this.boostRemaining <= 0) {
        this.isBoosting = false;
        this.boostTimer = 0;
        this.nextBoostTime = 4.2 + Math.random() * 3.2;
      }
    } else {
      this.isBoosting = false;
      this.boostTimer += dt;
      if (
        this.boostTimer >= this.nextBoostTime &&
        Math.abs(angleDiff) < 0.14 &&
        this.speedKmH > 65
      ) {
        this.activateBoost(2.4, 18);
      }
    }

    // 4. Smooth Acceleration / Cornering Physics
    let targetSpeed = 196 * this.config.skillMultiplier;
    if (this.isBoosting) {
      targetSpeed = 244 * this.config.skillMultiplier;
    }

    // Cornering slowdown proportional to angle difference
    const cornerFactor = Math.abs(angleDiff) / 0.32;
    if (cornerFactor > 0.15) {
      targetSpeed = Math.max(118 * this.config.skillMultiplier, targetSpeed * (1.0 - Math.min(0.38, cornerFactor * 0.32)));
    }

    // Rubber-banding: keeps pack competitive without rubber-band snapping
    if (playerTotalProgress !== undefined) {
      const diff = this.totalProgress - playerTotalProgress;
      if (diff > 0.12) {
        targetSpeed *= 0.94;
      } else if (diff < -0.02) {
        targetSpeed *= 1.08;
      }
    }

    if (this.speedKmH < targetSpeed) {
      const baseAccel = (this.isBoosting ? 125 : 82) * this.config.skillMultiplier;
      this.speedKmH += baseAccel * dt;
    } else {
      const brake = 135;
      this.speedKmH = Math.max(targetSpeed, this.speedKmH - brake * dt);
    }

    // 5. Horizontal Planar Movement
    const desiredVelX = -Math.sin(this.currentHeading) * speedMs;
    const desiredVelZ = -Math.cos(this.currentHeading) * speedMs;
    this.velocity.x += (desiredVelX - this.velocity.x) * Math.min(1, dt * 16.0);
    this.velocity.z += (desiredVelZ - this.velocity.z) * Math.min(1, dt * 16.0);

    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;

    // 6. Smooth Elastic Track Corridor Containment (Velocity Spring, NO Position Warping)
    this.trackSpline.getPointAt(this.progressU, this.scratchPt);
    const devX = this.position.x - this.scratchPt.x;
    const devZ = this.position.z - this.scratchPt.z;
    const distFromSpline = Math.hypot(devX, devZ);

    if (distFromSpline > 0.82) {
      const nx = devX / distFromSpline;
      const nz = devZ / distFromSpline;
      const excess = distFromSpline - 0.82;
      const springForce = excess * 22.0;
      this.velocity.x -= nx * springForce * dt;
      this.velocity.z -= nz * springForce * dt;

      // Soft damp if pushed very wide
      if (distFromSpline > 1.35) {
        const softSnap = (distFromSpline - 1.35) * 0.25;
        this.position.x -= nx * softSnap;
        this.position.z -= nz * softSnap;
      }
    }

    // 7. Ground Raycasting & Suspension (Always glides on asphalt, never falls through track)
    const rayHeadroom = 0.50;
    this.rayOrigin.set(this.position.x, this.position.y + rayHeadroom, this.position.z);
    this.raycaster.set(this.rayOrigin, this.rayDir);
    this.raycaster.far = 1.8;

    let targetY = this.position.y;
    let targetNormal = this.surfaceNormal;

    if (colliders.length > 0) {
      const hits = this.raycaster.intersectObjects(colliders, true);
      for (const h of hits) {
        if (h.face) {
          this.scratchHitNormal.copy(h.face.normal).transformDirection(h.object.matrixWorld).normalize();
          if (this.scratchHitNormal.y >= 0.35) {
            targetY = h.point.y + this.suspensionRestLength;
            targetNormal = this.scratchHitNormal;
            break;
          }
        }
      }
    }

    // Critically damped suspension tracking (smoothly glides, NEVER falls through track or teleports)
    this.position.y += (targetY - this.position.y) * Math.min(1.0, dt * 20.0);
    this.surfaceNormal.lerp(targetNormal, Math.min(1.0, dt * 10.0));
    this.mesh.position.copy(this.position);

    // 8. Visual Orientation & Smooth Chassis Lean
    this.forwardVec.set(-Math.sin(this.currentHeading), 0, -Math.cos(this.currentHeading)).normalize();
    this.rightVec.crossVectors(this.forwardVec, this.surfaceNormal).normalize();
    this.alignedForward.crossVectors(this.surfaceNormal, this.rightVec).normalize();
    this.localZ.copy(this.alignedForward).negate();
    this.rotMatrix.makeBasis(this.rightVec, this.surfaceNormal, this.localZ);
    this.targetQuat.setFromRotationMatrix(this.rotMatrix);

    const aiTargetRoll = THREE.MathUtils.clamp(-this.steerAngle * (Math.abs(this.speedKmH) / 160) * 0.035, -0.035, 0.035);
    this.bodyRollAngle += (aiTargetRoll - this.bodyRollAngle) * Math.min(1, dt * 8.0);
    if (Math.abs(this.bodyRollAngle) > 0.0005) {
      AICarController.scratchRollQuat.setFromAxisAngle(this.alignedForward, this.bodyRollAngle);
      this.targetQuat.multiply(AICarController.scratchRollQuat);
    }

    this.mesh.quaternion.slerp(this.targetQuat, Math.min(1.0, dt * 16.0));
    this.quaternion.copy(this.mesh.quaternion);

    // 9. Wheel Visual Spin & Dynamic Steering Alignment (Zero-allocation)
    const speedMps = this.speedKmH / 3.6;
    this.wheelSpinAngle += (speedMps * dt) / 0.33;
    const visualSteer = THREE.MathUtils.clamp(this.steerAngle, -0.55, 0.55);

    if (this.isSkinnedHotWheels) {
      AICarController.scratchQSpin.setFromAxisAngle(AICarController.scratchAxisY, this.wheelSpinAngle);
      AICarController.scratchQSteer.setFromAxisAngle(AICarController.scratchAxisZ, visualSteer);

      if (this.wheelLF) this.wheelLF.quaternion.copy(AICarController.scratchQSteer).multiply(AICarController.scratchQSpin);
      if (this.wheelRF) this.wheelRF.quaternion.copy(AICarController.scratchQSteer).multiply(AICarController.scratchQSpin);
      if (this.wheelLR) this.wheelLR.quaternion.copy(AICarController.scratchQSpin);
      if (this.wheelRR) this.wheelRR.quaternion.copy(AICarController.scratchQSpin);
    } else {
      AICarController.scratchQSpin.setFromAxisAngle(AICarController.scratchAxisX, this.wheelSpinAngle);
      AICarController.scratchQSteer.setFromAxisAngle(AICarController.scratchAxisZ, -visualSteer);

      if (this.wheelLF) this.wheelLF.quaternion.copy(AICarController.scratchQSteer).multiply(this.initialQuatLF).multiply(AICarController.scratchQSpin);
      if (this.wheelRF) this.wheelRF.quaternion.copy(AICarController.scratchQSteer).multiply(this.initialQuatRF).multiply(AICarController.scratchQSpin);
      if (this.wheelLR) this.wheelLR.quaternion.copy(this.initialQuatLR).multiply(AICarController.scratchQSpin);
      if (this.wheelRR) this.wheelRR.quaternion.copy(this.initialQuatRR).multiply(AICarController.scratchQSpin);
    }

    // 10. Particle Spawning: Boost Flames & Occasional Tire Drift Smoke (Zero-allocation)
    if (this.isBoosting) {
      AICarController.scratchRearPos.copy(this.position).addScaledVector(this.forwardVec, -2.15 * this.carScale);
      AICarController.scratchRearPos.y = this.position.y + 0.11 * (this.carScale / 0.20);
      this.particleManager.spawnBoostFlame(AICarController.scratchRearPos, this.forwardVec);
    }
  }

  dispose() {
    if (this.mesh.parent) {
      this.mesh.parent.remove(this.mesh);
    }
  }
}
