import * as THREE from 'three';

export class FollowCamera {
  private camera: THREE.PerspectiveCamera;
  private currentPosition = new THREE.Vector3();
  private currentLookAt = new THREE.Vector3();

  private baseFov = 58;
  private targetFov = 58;
  private shakeIntensity = 0;
  private currentRoll = 0;
  public zoomDistanceMultiplier = 1.0;
  public carScale = 0.14;
  private isInitialized = false;

  // Reusable vectors to eliminate per-frame GC allocations
  private tempIdealOffset = new THREE.Vector3();
  private tempIdealLookAt = new THREE.Vector3();
  private tempForwardOffset = new THREE.Vector3();
  private tempLookOffset = new THREE.Vector3();

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    this.camera.fov = this.baseFov;
    this.camera.updateProjectionMatrix();
  }

  addShake(amount: number) {
    this.shakeIntensity = Math.min(1.0, this.shakeIntensity + amount);
  }

  zoomIn(factor: number = 0.88) {
    this.zoomDistanceMultiplier = Math.max(0.75, this.zoomDistanceMultiplier * factor);
  }

  zoomOut(factor: number = 1.12) {
    this.zoomDistanceMultiplier = Math.min(1.30, this.zoomDistanceMultiplier * factor);
  }

  resetZoom() {
    this.zoomDistanceMultiplier = 1.0;
    this.currentRoll = 0;
    this.camera.up.set(0, 1, 0);
    this.isInitialized = false;
  }

  reset() {
    this.currentRoll = 0;
    this.camera.up.set(0, 1, 0);
    this.isInitialized = false;
  }

  update(
    carPosition: THREE.Vector3,
    carQuaternion: THREE.Quaternion,
    speedKmH: number,
    isBoosting: boolean,
    cameraMode: 'chase' | 'hood' | 'far' | 'cinematic',
    delta: number,
    steerAngle: number = 0,
    driftAngle: number = 0
  ) {
    // Dynamic FOV based on speed and boost (only update projection matrix when FOV moves)
    const speedFactor = Math.min(1, Math.abs(speedKmH) / 190);
    const boostBonus = isBoosting ? 12 : 0;
    this.targetFov = this.baseFov + speedFactor * 10 + boostBonus;
    const fovDiff = this.targetFov - this.camera.fov;
    if (Math.abs(fovDiff) > 0.015) {
      this.camera.fov += fovDiff * Math.min(1, delta * 5);
      this.camera.updateProjectionMatrix();
    }

    // Standard Three.js coordinates:
    // Car forward is -Z (in front), Car backward is +Z (behind)
    const s = this.carScale;
    const idealOffset = this.tempIdealOffset;
    const idealLookAt = this.tempIdealLookAt.copy(carPosition);
    idealLookAt.y += 0.55 * s;

    if (cameraMode === 'hood') {
      idealOffset.set(0, 0.65 * s, -0.5 * s).applyQuaternion(carQuaternion).add(carPosition);
      const lookOffset = this.tempLookOffset.set(0, 0.45 * s, -12 * s).applyQuaternion(carQuaternion);
      idealLookAt.copy(carPosition).add(lookOffset);
    } else if (cameraMode === 'far') {
      idealOffset.set(0, 10 * this.zoomDistanceMultiplier * s, 16 * this.zoomDistanceMultiplier * s).applyQuaternion(carQuaternion).add(carPosition);
    } else {
      // Standard Chase Cam (Behind car looking forward)
      const distance = (6.2 + speedFactor * 1.8) * this.zoomDistanceMultiplier * s;
      const height = (2.6 + speedFactor * 0.6) * Math.sqrt(this.zoomDistanceMultiplier) * s;
      idealOffset.set(0, height, distance).applyQuaternion(carQuaternion).add(carPosition);

      // Look ahead of car in its forward direction (-Z)
      const forwardOffset = this.tempForwardOffset.set(0, 0.35 * s, -4.5 * s).applyQuaternion(carQuaternion);
      idealLookAt.add(forwardOffset);
    }

    // Snap on first frame or after reset
    if (!this.isInitialized) {
      this.currentPosition.copy(idealOffset);
      this.currentLookAt.copy(idealLookAt);
      this.isInitialized = true;
    } else {
      const lerpPos = Math.min(1, delta * (cameraMode === 'hood' ? 24 : 6.8));
      const lerpLook = Math.min(1, delta * (cameraMode === 'hood' ? 24 : 8.2));
      this.currentPosition.lerp(idealOffset, lerpPos);
      this.currentLookAt.lerp(idealLookAt, lerpLook);
    }

    // Screen shake
    if (this.shakeIntensity > 0.001) {
      const shakeX = (Math.random() - 0.5) * this.shakeIntensity * 0.25;
      const shakeY = (Math.random() - 0.5) * this.shakeIntensity * 0.25;
      this.currentPosition.x += shakeX;
      this.currentPosition.y += shakeY;
      this.shakeIntensity = Math.max(0, this.shakeIntensity - delta * 2.5);
    }

    // Cinematic IMAX camera roll (centrifugal banking into corners)
    if (cameraMode !== 'far') {
      const turnG = (steerAngle * 0.040 + driftAngle * 0.030) * Math.min(1.5, Math.abs(speedKmH) / 100);
      const targetRoll = THREE.MathUtils.clamp(turnG, -0.050, 0.050); // ~2.8 degrees max banking
      this.currentRoll += (targetRoll - this.currentRoll) * Math.min(1, delta * 4.2);

      const forwardDir = new THREE.Vector3().subVectors(this.currentLookAt, this.currentPosition).normalize();
      const worldUp = new THREE.Vector3(0, 1, 0);
      const rightDir = new THREE.Vector3().crossVectors(forwardDir, worldUp).normalize();
      const rolledUp = new THREE.Vector3().crossVectors(rightDir, forwardDir).normalize();
      rolledUp.addScaledVector(rightDir, this.currentRoll).normalize();

      this.camera.up.copy(rolledUp);
    } else {
      this.currentRoll = 0;
      this.camera.up.set(0, 1, 0);
    }

    this.camera.position.copy(this.currentPosition);
    this.camera.lookAt(this.currentLookAt);
  }
}
