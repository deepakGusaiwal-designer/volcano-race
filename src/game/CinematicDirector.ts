import * as THREE from 'three';

export interface CinematicShotPreset {
  name: string;
  fov: number;
  offset: THREE.Vector3; // in car local space (-Z forward, +X right, +Y up)
  lookAt: THREE.Vector3; // in car local space
  lerpRate: number;
}

export class CinematicDirector {
  private camera: THREE.PerspectiveCamera;
  private currentPosition = new THREE.Vector3();
  private currentLookAt = new THREE.Vector3();
  private isInitialized = false;

  // Hollywood-style action shot presets scaled by carScale
  private shotPresets: CinematicShotPreset[] = [
    {
      name: 'Asphalt Action Cam',
      fov: 62,
      offset: new THREE.Vector3(0.5, 0.7, 2.9),
      lookAt: new THREE.Vector3(0.0, 0.35, -2.5),
      lerpRate: 8.0,
    },
    {
      name: 'Wheel & Skirt Cam',
      fov: 54,
      offset: new THREE.Vector3(-0.95, 0.38, -0.15),
      lookAt: new THREE.Vector3(-0.1, 0.30, -3.8),
      lerpRate: 12.0,
    },
    {
      name: 'Front Low Tracking',
      fov: 48,
      offset: new THREE.Vector3(0.4, 0.45, -3.2),
      lookAt: new THREE.Vector3(0.0, 0.35, 0.2),
      lerpRate: 6.5,
    },
    {
      name: 'Volcano Vista Drone',
      fov: 46,
      offset: new THREE.Vector3(-2.2, 2.8, 5.0),
      lookAt: new THREE.Vector3(0.0, 0.4, -1.8),
      lerpRate: 4.5,
    },
    {
      name: 'Tarmac Bumper Cam',
      fov: 70,
      offset: new THREE.Vector3(0.0, 0.22, -1.5),
      lookAt: new THREE.Vector3(0.0, 0.22, -8.0),
      lerpRate: 16.0,
    },
  ];

  public currentShotIndex = 0;
  private shotTimer = 0;
  private shotDuration = 6.0; // Auto-cut every 6 seconds for dynamic pacing
  public carScale = 0.14;

  private targetFov = 58;
  private currentRoll = 0;
  private shakeIntensity = 0;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
  }

  nextShot() {
    this.currentShotIndex = (this.currentShotIndex + 1) % this.shotPresets.length;
    this.shotTimer = 0;
  }

  setShot(index: number) {
    this.currentShotIndex = (index + this.shotPresets.length) % this.shotPresets.length;
    this.shotTimer = 0;
  }

  getShotName(): string {
    return this.shotPresets[this.currentShotIndex].name;
  }

  addShake(amount: number) {
    this.shakeIntensity = Math.min(1.0, this.shakeIntensity + amount);
  }

  reset() {
    this.isInitialized = false;
    this.currentRoll = 0;
    this.camera.up.set(0, 1, 0);
  }

  update(
    carPosition: THREE.Vector3,
    carQuaternion: THREE.Quaternion,
    speedKmH: number,
    delta: number,
    steerAngle: number = 0,
    driftAngle: number = 0
  ) {
    const dt = Math.min(delta, 0.05);
    const s = this.carScale;

    // 1. Advance automatic shot director
    this.shotTimer += dt;
    if (this.shotTimer >= this.shotDuration) {
      this.currentShotIndex = (this.currentShotIndex + 1) % this.shotPresets.length;
      this.shotTimer = 0;
      this.shotDuration = 5.0 + Math.random() * 3.0; // 5-8s per cut
    }

    const shot = this.shotPresets[this.currentShotIndex];

    // 2. Dynamic Speed FOV modulation
    const speedRatio = Math.min(1.0, Math.abs(speedKmH) / 180);
    this.targetFov = shot.fov + speedRatio * 8.0;
    this.camera.fov += (this.targetFov - this.camera.fov) * Math.min(1.0, dt * 5.0);
    this.camera.updateProjectionMatrix();

    // 3. Compute Ideal World Position & LookAt from local shot definition
    const localOffset = shot.offset.clone().multiplyScalar(s / 0.14);
    const localLookAt = shot.lookAt.clone().multiplyScalar(s / 0.14);

    const idealPos = localOffset.clone().applyQuaternion(carQuaternion).add(carPosition);
    const idealLook = localLookAt.clone().applyQuaternion(carQuaternion).add(carPosition);

    if (!this.isInitialized) {
      this.currentPosition.copy(idealPos);
      this.currentLookAt.copy(idealLook);
      this.isInitialized = true;
    } else {
      const lerpFactor = Math.min(1.0, dt * shot.lerpRate);
      this.currentPosition.lerp(idealPos, lerpFactor);
      this.currentLookAt.lerp(idealLook, lerpFactor);
    }

    // 4. Subtle Speed Vibration & Collision Shake
    if (this.shakeIntensity > 0.001) {
      const shakeX = (Math.random() - 0.5) * this.shakeIntensity * 0.18;
      const shakeY = (Math.random() - 0.5) * this.shakeIntensity * 0.18;
      this.currentPosition.x += shakeX;
      this.currentPosition.y += shakeY;
      this.shakeIntensity = Math.max(0, this.shakeIntensity - dt * 2.8);
    }

    // 5. Cinematic Dutch Angle / Banking Roll
    const cornerG = (steerAngle * 0.04 + driftAngle * 0.03) * Math.min(1.4, Math.abs(speedKmH) / 90);
    const targetRoll = THREE.MathUtils.clamp(cornerG, -0.065, 0.065);
    this.currentRoll += (targetRoll - this.currentRoll) * Math.min(1.0, dt * 6.0);

    const forwardDir = new THREE.Vector3().subVectors(this.currentLookAt, this.currentPosition).normalize();
    const worldUp = new THREE.Vector3(0, 1, 0);
    const rightDir = new THREE.Vector3().crossVectors(forwardDir, worldUp).normalize();
    const rolledUp = new THREE.Vector3().crossVectors(rightDir, forwardDir).normalize();
    rolledUp.addScaledVector(rightDir, this.currentRoll).normalize();

    this.camera.up.copy(rolledUp);
    this.camera.position.copy(this.currentPosition);
    this.camera.lookAt(this.currentLookAt);
  }
}
