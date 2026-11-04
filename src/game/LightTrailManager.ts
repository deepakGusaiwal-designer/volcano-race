import * as THREE from 'three';
import { VehicleController } from './VehicleController';
import { AICarController } from './AICarController';
import { CAR_PRESETS } from '../types/game';

interface TrailPoint {
  x: number;
  y: number;
  z: number;
  age: number;
  maxAge: number;
  width: number;
  r: number;
  g: number;
  b: number;
  alpha: number;
}

interface TrailStream {
  points: TrailPoint[];
  maxPoints: number;
  lastPos: THREE.Vector3;
  hasLastPos: boolean;
  sideSign: number; // -1 for left nozzle, +1 for right nozzle
}

interface CarTrailRig {
  id: string;
  leftStream: TrailStream;
  rightStream: TrailStream;
}

/**
 * LightTrailManager
 * Renders small, sleek, minimal Asphalt-style nitro supersonic jet streams directly from twin exhaust nozzles.
 * Uses camera-facing billboarding so ribbons appear like volumetric glowing energy beams rather than flat walls.
 * High-performance: Pre-allocated single draw-call BufferGeometry with zero per-frame heap allocations.
 */
export class LightTrailManager {
  private scene: THREE.Scene;
  private maxSegmentsPerStream = 26;
  private totalStreams = 8; // 1 Player (2) + up to 3 AI cars (6)
  private geometry: THREE.BufferGeometry;
  private material: THREE.MeshBasicMaterial;
  private mesh: THREE.Mesh;
  private texture: THREE.CanvasTexture;

  private positions: Float32Array;
  private colors: Float32Array;
  private uvs: Float32Array;
  private indices: Uint16Array;

  private playerRig: CarTrailRig;
  private aiRigs: CarTrailRig[] = [];

  // Scratch vectors to prevent runtime allocations
  private tempPos = new THREE.Vector3();
  private tempFwd = new THREE.Vector3();
  private tempRight = new THREE.Vector3();
  private tempUp = new THREE.Vector3();
  private tempSegment = new THREE.Vector3();
  private tempToCam = new THREE.Vector3();
  private tempSide = new THREE.Vector3();
  private tempColor = new THREE.Color();
  private defaultCamPos = new THREE.Vector3(0, 5, 0);

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    const totalQuads = this.totalStreams * this.maxSegmentsPerStream;
    const numVertices = totalQuads * 4;
    const numIndices = totalQuads * 6;

    this.positions = new Float32Array(numVertices * 3);
    this.colors = new Float32Array(numVertices * 4);
    this.uvs = new Float32Array(numVertices * 2);
    this.indices = new Uint16Array(numIndices);

    // Initialize all positions below ground
    for (let i = 0; i < numVertices; i++) {
      this.positions[i * 3 + 0] = 0;
      this.positions[i * 3 + 1] = -1000;
      this.positions[i * 3 + 2] = 0;

      this.colors[i * 4 + 0] = 0.0;
      this.colors[i * 4 + 1] = 0.95;
      this.colors[i * 4 + 2] = 1.0;
      this.colors[i * 4 + 3] = 0.0;
    }

    // Pre-populate quad indices (0, 1, 2,  0, 2, 3)
    for (let q = 0; q < totalQuads; q++) {
      const v = q * 4;
      const idx = q * 6;
      this.indices[idx + 0] = v + 0;
      this.indices[idx + 1] = v + 1;
      this.indices[idx + 2] = v + 2;
      this.indices[idx + 3] = v + 0;
      this.indices[idx + 4] = v + 2;
      this.indices[idx + 5] = v + 3;

      this.uvs[v * 2 + 0] = 0.0; this.uvs[v * 2 + 1] = 1.0;
      this.uvs[v * 2 + 2] = 0.0; this.uvs[v * 2 + 3] = 0.0;
      this.uvs[v * 2 + 4] = 1.0; this.uvs[v * 2 + 5] = 0.0;
      this.uvs[v * 2 + 6] = 1.0; this.uvs[v * 2 + 7] = 1.0;
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 4));
    this.geometry.setAttribute('uv', new THREE.BufferAttribute(this.uvs, 2));
    this.geometry.setIndex(new THREE.BufferAttribute(this.indices, 1));

    this.texture = this.createTrailTexture();

    this.material = new THREE.MeshBasicMaterial({
      map: this.texture,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
    this.scene.add(this.mesh);

    // Create player trail rig
    this.playerRig = this.createRig('player');

    // Create 3 AI trail rigs
    for (let i = 0; i < 3; i++) {
      this.aiRigs.push(this.createRig(`ai_${i}`));
    }
  }

  private createRig(id: string): CarTrailRig {
    return {
      id,
      leftStream: {
        points: [],
        maxPoints: this.maxSegmentsPerStream,
        lastPos: new THREE.Vector3(),
        hasLastPos: false,
        sideSign: -1,
      },
      rightStream: {
        points: [],
        maxPoints: this.maxSegmentsPerStream,
        lastPos: new THREE.Vector3(),
        hasLastPos: false,
        sideSign: 1,
      },
    };
  }

  /**
   * Supersonic laser core texture:
   * Across Y (lateral): Intense white-hot core centered in the middle falling off smoothly.
   * Across X (longitudinal): Root at exhaust is bright ignition burst, tapering smoothly to 0 at tip.
   */
  private createTrailTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // 1. Sleek laser core across Y: brilliant supersonic center core falling off to soft neon aura
      const gradY = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradY.addColorStop(0.0, 'rgba(255, 255, 255, 0.0)');
      gradY.addColorStop(0.32, 'rgba(255, 255, 255, 0.25)');
      gradY.addColorStop(0.46, 'rgba(255, 255, 255, 0.90)');
      gradY.addColorStop(0.50, 'rgba(255, 255, 255, 1.00)');
      gradY.addColorStop(0.54, 'rgba(255, 255, 255, 0.90)');
      gradY.addColorStop(0.68, 'rgba(255, 255, 255, 0.25)');
      gradY.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');

      ctx.fillStyle = gradY;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 2. Length-wise fade across X: nozzle root is intense ignition burst, tail tip fades to 0
      ctx.globalCompositeOperation = 'destination-in';
      const gradX = ctx.createLinearGradient(0, 0, canvas.width, 0);
      gradX.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
      gradX.addColorStop(0.40, 'rgba(255, 255, 255, 0.95)');
      gradX.addColorStop(0.80, 'rgba(255, 255, 255, 0.40)');
      gradX.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
      ctx.fillStyle = gradX;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }

  /**
   * Main per-frame update: advances ages, samples vehicle taillights, and fills buffer geometry
   */
  public update(
    delta: number,
    playerVehicle: VehicleController,
    aiCars: AICarController[] = [],
    camera?: THREE.Camera
  ) {
    const dt = Math.min(delta, 0.05);

    // 1. Update Player Vehicle Trails
    this.updateCarTrail(this.playerRig, playerVehicle, dt);

    // 2. Update AI Competitor Trails
    for (let i = 0; i < this.aiRigs.length; i++) {
      const aiRig = this.aiRigs[i];
      const aiCar = aiCars[i];
      if (aiCar) {
        this.updateAICarTrail(aiRig, aiCar, dt);
      } else {
        this.clearStream(aiRig.leftStream);
        this.clearStream(aiRig.rightStream);
      }
    }

    // 3. Rebuild and stream ribbon quads into GPU buffers using camera-facing billboarding
    let quadIndex = 0;
    quadIndex = this.writeStreamQuads(this.playerRig.leftStream, quadIndex, camera);
    quadIndex = this.writeStreamQuads(this.playerRig.rightStream, quadIndex, camera);

    for (let i = 0; i < this.aiRigs.length; i++) {
      quadIndex = this.writeStreamQuads(this.aiRigs[i].leftStream, quadIndex, camera);
      quadIndex = this.writeStreamQuads(this.aiRigs[i].rightStream, quadIndex, camera);
    }

    // Hide any unused quads below ground
    const totalQuads = this.totalStreams * this.maxSegmentsPerStream;
    for (let q = quadIndex; q < totalQuads; q++) {
      const v = q * 4;
      for (let k = 0; k < 4; k++) {
        const vi = v + k;
        this.positions[vi * 3 + 1] = -1000;
        this.colors[vi * 4 + 3] = 0.0;
      }
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
    this.geometry.attributes.uv.needsUpdate = true;
  }

  private updateCarTrail(rig: CarTrailRig, vehicle: VehicleController, dt: number) {
    this.ageStream(rig.leftStream, dt);
    this.ageStream(rig.rightStream, dt);

    const speed = Math.abs(vehicle.speedKmH);

    // Clean aesthetic: Only emit trails when Nitro is active, when drifting, or faint wisp at extreme speed.
    // Cruising at normal speeds leaves the car clean without distracting curtains.
    const isNitro = vehicle.isBoosting;
    const isDrift = vehicle.isDrifting && speed > 32;
    const isHighSpeedSprint = speed > 70 && vehicle.input.forward;

    if (!isNitro && !isDrift && !isHighSpeedSprint) {
      rig.leftStream.hasLastPos = false;
      rig.rightStream.hasLastPos = false;
      return;
    }

    // Determine trail color and profile based on driving state
    const preset = CAR_PRESETS[vehicle.carModelId] || CAR_PRESETS.mazda;
    let baseHex = 0x00f0ff; // Brilliant electric cyan nitro default
    let baseAlpha = 0.95;
    let width = 0.034;      // Small, compact nozzle diameter (~3.4cm)
    let maxLifetime = 0.12; // Snappy supersonic jet length (~1.2m at speed)

    if (isNitro) {
      // Supersonic Electric Cyan Nitro Thrust Jet
      baseHex = 0x00f0ff;
      baseAlpha = 0.95;
      width = 0.034;
      maxLifetime = 0.13;
    } else if (isDrift) {
      // Glowing Neon Drift Plasma Trace
      baseHex = 0xff1493;
      baseAlpha = 0.80;
      width = 0.026;
      maxLifetime = 0.11;
    } else if (isHighSpeedSprint) {
      // Very faint, razor-thin aerodynamic exhaust heat wisp
      baseHex = preset.accentColor ? this.tempColor.set(preset.accentColor).getHex() : 0x67e8f9;
      baseAlpha = 0.20;
      width = 0.018;
      maxLifetime = 0.065;
    }

    this.tempColor.setHex(baseHex);
    const r = this.tempColor.r;
    const g = this.tempColor.g;
    const b = this.tempColor.b;

    // Vehicle orientation vectors from mesh quaternion (accounts for 3D banking, pitch & roll)
    this.tempFwd.copy(vehicle.forwardVec);
    this.tempRight.set(1, 0, 0).applyQuaternion(vehicle.mesh.quaternion);
    this.tempUp.set(0, 1, 0).applyQuaternion(vehicle.mesh.quaternion);

    const carScale = vehicle.carScale;
    // Precisely anchored to the real twin exhaust nozzles of the car chassis
    const rearDist = 2.12 * carScale;
    const exhaustY = 0.105 * (carScale / 0.20);
    const pipeOffset = 0.155 * carScale;

    // Base rear exhaust center
    const rearCenter = vehicle.position.clone().addScaledVector(this.tempFwd, -rearDist);
    rearCenter.addScaledVector(this.tempUp, exhaustY);

    // Left and Right Exhaust Nozzle emission points
    const leftPos = rearCenter.clone().addScaledVector(this.tempRight, -pipeOffset);
    const rightPos = rearCenter.clone().addScaledVector(this.tempRight, pipeOffset);

    this.sampleStream(rig.leftStream, leftPos, dt, r, g, b, baseAlpha, width, maxLifetime);
    this.sampleStream(rig.rightStream, rightPos, dt, r, g, b, baseAlpha, width, maxLifetime);
  }

  private updateAICarTrail(rig: CarTrailRig, aiCar: AICarController, dt: number) {
    this.ageStream(rig.leftStream, dt);
    this.ageStream(rig.rightStream, dt);

    const speed = Math.abs(aiCar.speedKmH);
    const isNitro = aiCar.isBoosting;
    const isHighSpeed = speed > 72;

    if (!isNitro && !isHighSpeed) {
      rig.leftStream.hasLastPos = false;
      rig.rightStream.hasLastPos = false;
      return;
    }

    let baseHex = 0x00e5ff;
    let baseAlpha = 0.90;
    let width = 0.032;
    let maxLifetime = 0.12;

    if (!isNitro && isHighSpeed) {
      baseHex = aiCar.config.colorHex || 0x38bdf8;
      baseAlpha = 0.18;
      width = 0.016;
      maxLifetime = 0.06;
    }

    this.tempColor.setHex(baseHex);
    const r = this.tempColor.r;
    const g = this.tempColor.g;
    const b = this.tempColor.b;

    this.tempFwd.copy(aiCar.forwardVec);
    this.tempRight.set(1, 0, 0).applyQuaternion(aiCar.mesh.quaternion);
    this.tempUp.set(0, 1, 0).applyQuaternion(aiCar.mesh.quaternion);

    const carScale = aiCar.carScale;
    const rearDist = 2.15 * carScale;
    const exhaustY = 0.105 * (carScale / 0.20);
    const pipeOffset = 0.150 * carScale;

    const rearCenter = aiCar.position.clone().addScaledVector(this.tempFwd, -rearDist);
    rearCenter.addScaledVector(this.tempUp, exhaustY);

    const leftPos = rearCenter.clone().addScaledVector(this.tempRight, -pipeOffset);
    const rightPos = rearCenter.clone().addScaledVector(this.tempRight, pipeOffset);

    this.sampleStream(rig.leftStream, leftPos, dt, r, g, b, baseAlpha, width, maxLifetime);
    this.sampleStream(rig.rightStream, rightPos, dt, r, g, b, baseAlpha, width, maxLifetime);
  }

  private sampleStream(
    stream: TrailStream,
    curPos: THREE.Vector3,
    _dt: number,
    r: number,
    g: number,
    b: number,
    alpha: number,
    width: number,
    maxLifetime: number
  ) {
    if (!stream.hasLastPos) {
      stream.lastPos.copy(curPos);
      stream.hasLastPos = true;
      return;
    }

    const dist = stream.lastPos.distanceTo(curPos);
    // Dense 5.5cm sampling gives silky-smooth high-frequency curved streams
    if (dist >= 0.055) {
      stream.points.unshift({
        x: curPos.x,
        y: curPos.y,
        z: curPos.z,
        age: 0,
        maxAge: maxLifetime,
        width,
        r,
        g,
        b,
        alpha,
      });

      if (stream.points.length > stream.maxPoints) {
        stream.points.pop();
      }

      stream.lastPos.copy(curPos);
    }
  }

  private ageStream(stream: TrailStream, dt: number) {
    for (let i = stream.points.length - 1; i >= 0; i--) {
      const p = stream.points[i];
      p.age += dt;
      if (p.age >= p.maxAge) {
        stream.points.splice(i, 1);
      }
    }
  }

  private clearStream(stream: TrailStream) {
    stream.points.length = 0;
    stream.hasLastPos = false;
  }

  /**
   * Writes continuous ribbon quads connecting successive trail sample points.
   * Employs camera-facing billboarding so streams maintain volumetric laser appearance from all angles.
   */
  private writeStreamQuads(
    stream: TrailStream,
    startQuadIndex: number,
    camera?: THREE.Camera
  ): number {
    let qIdx = startQuadIndex;
    const count = stream.points.length;
    if (count < 2) return qIdx;

    const maxQuads = this.totalStreams * this.maxSegmentsPerStream;
    const camPos = camera ? camera.position : this.defaultCamPos;

    for (let i = 0; i < count - 1; i++) {
      if (qIdx >= maxQuads) break;

      const p0 = stream.points[i];
      const p1 = stream.points[i + 1];

      // Normalized progress from nozzle (0.0) to tail tip (1.0)
      const u0 = Math.min(1.0, p0.age / p0.maxAge);
      const u1 = Math.min(1.0, p1.age / p1.maxAge);

      const ratio0 = 1.0 - u0;
      const ratio1 = 1.0 - u1;

      // Smooth cubic life falloff
      const a0 = Math.pow(ratio0, 1.6) * p0.alpha;
      const a1 = Math.pow(ratio1, 1.6) * p1.alpha;

      // Supersonic taper: starts at nozzle width, tapers down to needle point
      const w0 = p0.width * (0.12 + ratio0 * 0.88);
      const w1 = p1.width * (0.12 + ratio1 * 0.88);

      const h0 = w0 * 0.5;
      const h1 = w1 * 0.5;

      // Midpoint between p0 and p1
      const midX = (p0.x + p1.x) * 0.5;
      const midY = (p0.y + p1.y) * 0.5;
      const midZ = (p0.z + p1.z) * 0.5;

      // Segment vector
      this.tempSegment.set(p0.x - p1.x, p0.y - p1.y, p0.z - p1.z);
      const segLenSq = this.tempSegment.lengthSq();
      if (segLenSq < 1e-6) continue;
      this.tempSegment.divideScalar(Math.sqrt(segLenSq));

      // Vector towards camera
      this.tempToCam.set(camPos.x - midX, camPos.y - midY, camPos.z - midZ).normalize();

      // Lateral vector perpendicular to segment & view direction
      this.tempSide.crossVectors(this.tempSegment, this.tempToCam);
      if (this.tempSide.lengthSq() < 1e-4) {
        this.tempSide.set(0, 1, 0);
      } else {
        this.tempSide.normalize();
      }

      const v = qIdx * 4;

      // Vertex 0: p0 Top
      this.positions[(v + 0) * 3 + 0] = p0.x + this.tempSide.x * h0;
      this.positions[(v + 0) * 3 + 1] = p0.y + this.tempSide.y * h0;
      this.positions[(v + 0) * 3 + 2] = p0.z + this.tempSide.z * h0;
      this.colors[(v + 0) * 4 + 0] = p0.r;
      this.colors[(v + 0) * 4 + 1] = p0.g;
      this.colors[(v + 0) * 4 + 2] = p0.b;
      this.colors[(v + 0) * 4 + 3] = a0;
      this.uvs[(v + 0) * 2 + 0] = u0;
      this.uvs[(v + 0) * 2 + 1] = 1.0;

      // Vertex 1: p0 Bottom
      this.positions[(v + 1) * 3 + 0] = p0.x - this.tempSide.x * h0;
      this.positions[(v + 1) * 3 + 1] = p0.y - this.tempSide.y * h0;
      this.positions[(v + 1) * 3 + 2] = p0.z - this.tempSide.z * h0;
      this.colors[(v + 1) * 4 + 0] = p0.r;
      this.colors[(v + 1) * 4 + 1] = p0.g;
      this.colors[(v + 1) * 4 + 2] = p0.b;
      this.colors[(v + 1) * 4 + 3] = a0;
      this.uvs[(v + 1) * 2 + 0] = u0;
      this.uvs[(v + 1) * 2 + 1] = 0.0;

      // Vertex 2: p1 Bottom
      this.positions[(v + 2) * 3 + 0] = p1.x - this.tempSide.x * h1;
      this.positions[(v + 2) * 3 + 1] = p1.y - this.tempSide.y * h1;
      this.positions[(v + 2) * 3 + 2] = p1.z - this.tempSide.z * h1;
      this.colors[(v + 2) * 4 + 0] = p1.r;
      this.colors[(v + 2) * 4 + 1] = p1.g;
      this.colors[(v + 2) * 4 + 2] = p1.b;
      this.colors[(v + 2) * 4 + 3] = a1;
      this.uvs[(v + 2) * 2 + 0] = u1;
      this.uvs[(v + 2) * 2 + 1] = 0.0;

      // Vertex 3: p1 Top
      this.positions[(v + 3) * 3 + 0] = p1.x + this.tempSide.x * h1;
      this.positions[(v + 3) * 3 + 1] = p1.y + this.tempSide.y * h1;
      this.positions[(v + 3) * 3 + 2] = p1.z + this.tempSide.z * h1;
      this.colors[(v + 3) * 4 + 0] = p1.r;
      this.colors[(v + 3) * 4 + 1] = p1.g;
      this.colors[(v + 3) * 4 + 2] = p1.b;
      this.colors[(v + 3) * 4 + 3] = a1;
      this.uvs[(v + 3) * 2 + 0] = u1;
      this.uvs[(v + 3) * 2 + 1] = 1.0;

      qIdx++;
    }

    return qIdx;
  }

  public reset() {
    this.clearStream(this.playerRig.leftStream);
    this.clearStream(this.playerRig.rightStream);
    for (const rig of this.aiRigs) {
      this.clearStream(rig.leftStream);
      this.clearStream(rig.rightStream);
    }
  }

  public dispose() {
    if (this.mesh.parent) {
      this.mesh.parent.remove(this.mesh);
    }
    this.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
    this.reset();
  }
}
