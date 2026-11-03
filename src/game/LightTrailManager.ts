import * as THREE from 'three';
import { VehicleController } from './VehicleController';
import { AICarController } from './AICarController';
import { CAR_PRESETS } from '../types/game';

interface TrailPoint {
  x: number;
  y: number;
  z: number;
  upX: number;
  upY: number;
  upZ: number;
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
  sideSign: number; // -1 for left taillight, +1 for right taillight
}

interface CarTrailRig {
  id: string;
  leftStream: TrailStream;
  rightStream: TrailStream;
}

/**
 * LightTrailManager
 * Renders small, sleek, minimal Asphalt-style neon taillight ribbons behind moving vehicles.
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
  private tempUp = new THREE.Vector3();
  private tempFwd = new THREE.Vector3();
  private tempRight = new THREE.Vector3();
  private tempColor = new THREE.Color();

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

      this.colors[i * 4 + 0] = 1.0;
      this.colors[i * 4 + 1] = 0.1;
      this.colors[i * 4 + 2] = 0.2;
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

      this.uvs[v * 2 + 0] = 0.0; this.uvs[v * 2 + 1] = 0.0;
      this.uvs[v * 2 + 2] = 1.0; this.uvs[v * 2 + 3] = 0.0;
      this.uvs[v * 2 + 4] = 1.0; this.uvs[v * 2 + 5] = 1.0;
      this.uvs[v * 2 + 6] = 0.0; this.uvs[v * 2 + 7] = 1.0;
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

  private createTrailTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Sleek vertical falloff: glowing white core with smooth neon aura
      const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      grad.addColorStop(0.0, 'rgba(255, 255, 255, 0.0)');
      grad.addColorStop(0.20, 'rgba(255, 255, 255, 0.25)');
      grad.addColorStop(0.50, 'rgba(255, 255, 255, 1.0)');
      grad.addColorStop(0.80, 'rgba(255, 255, 255, 0.25)');
      grad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');

      ctx.fillStyle = grad;
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
  public update(delta: number, playerVehicle: VehicleController, aiCars: AICarController[] = []) {
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

    // 3. Rebuild and stream ribbon quads into GPU buffers
    let quadIndex = 0;
    quadIndex = this.writeStreamQuads(this.playerRig.leftStream, quadIndex);
    quadIndex = this.writeStreamQuads(this.playerRig.rightStream, quadIndex);

    for (let i = 0; i < this.aiRigs.length; i++) {
      quadIndex = this.writeStreamQuads(this.aiRigs[i].leftStream, quadIndex);
      quadIndex = this.writeStreamQuads(this.aiRigs[i].rightStream, quadIndex);
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
  }

  private updateCarTrail(rig: CarTrailRig, vehicle: VehicleController, dt: number) {
    this.ageStream(rig.leftStream, dt);
    this.ageStream(rig.rightStream, dt);

    const speed = Math.abs(vehicle.speedKmH);
    const minSpeedThreshold = 26; // km/h

    if (speed < minSpeedThreshold) {
      rig.leftStream.hasLastPos = false;
      rig.rightStream.hasLastPos = false;
      return;
    }

    // Determine trail color based on car preset & driving dynamic
    const preset = CAR_PRESETS[vehicle.carModelId] || CAR_PRESETS.mazda;
    let baseHex = 0xff1e27; // Mazda hypercar red
    let baseAlpha = 0.72;
    let width = 0.082; // Sleek, slender minimal ribbon
    let maxLifetime = 0.28; // Snappy Asphalt-style fade

    if (vehicle.isBoosting) {
      // Electric Neon Cyan Nitro Trail (Asphalt nitro burst)
      baseHex = 0x00f0ff;
      baseAlpha = 0.95;
      width = 0.118;
      maxLifetime = 0.38;
    } else if (vehicle.isDrifting) {
      // Glowing Neon Drift Flare
      baseHex = 0xff1493;
      baseAlpha = 0.88;
      width = 0.105;
      maxLifetime = 0.34;
    } else if (preset.accentColor) {
      this.tempColor.set(preset.accentColor);
      baseHex = this.tempColor.getHex();
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
    const rearDist = 2.06 * carScale;
    const tailY = 0.18 * (carScale / 0.20);
    const tailOffset = 0.42 * carScale;

    // Base rear center
    const rearCenter = vehicle.position.clone().addScaledVector(this.tempFwd, -rearDist);
    rearCenter.addScaledVector(this.tempUp, tailY);

    // Left and Right Taillight emission origins
    const leftPos = rearCenter.clone().addScaledVector(this.tempRight, -tailOffset);
    const rightPos = rearCenter.clone().addScaledVector(this.tempRight, tailOffset);

    this.sampleStream(rig.leftStream, leftPos, this.tempUp, dt, r, g, b, baseAlpha, width, maxLifetime);
    this.sampleStream(rig.rightStream, rightPos, this.tempUp, dt, r, g, b, baseAlpha, width, maxLifetime);
  }

  private updateAICarTrail(rig: CarTrailRig, aiCar: AICarController, dt: number) {
    this.ageStream(rig.leftStream, dt);
    this.ageStream(rig.rightStream, dt);

    const speed = Math.abs(aiCar.speedKmH);
    if (speed < 30) {
      rig.leftStream.hasLastPos = false;
      rig.rightStream.hasLastPos = false;
      return;
    }

    let baseHex = aiCar.config.colorHex || 0x2563eb;
    let baseAlpha = 0.65;
    let width = 0.078;
    let maxLifetime = 0.25;

    if (aiCar.isBoosting) {
      baseHex = 0x00e5ff;
      baseAlpha = 0.90;
      width = 0.110;
      maxLifetime = 0.34;
    }

    this.tempColor.setHex(baseHex);
    const r = this.tempColor.r;
    const g = this.tempColor.g;
    const b = this.tempColor.b;

    this.tempFwd.copy(aiCar.forwardVec);
    this.tempRight.set(1, 0, 0).applyQuaternion(aiCar.mesh.quaternion);
    this.tempUp.set(0, 1, 0).applyQuaternion(aiCar.mesh.quaternion);

    const carScale = aiCar.carScale;
    const rearDist = 2.05 * carScale;
    const tailY = 0.16 * (carScale / 0.20);
    const tailOffset = 0.40 * carScale;

    const rearCenter = aiCar.position.clone().addScaledVector(this.tempFwd, -rearDist);
    rearCenter.addScaledVector(this.tempUp, tailY);

    const leftPos = rearCenter.clone().addScaledVector(this.tempRight, -tailOffset);
    const rightPos = rearCenter.clone().addScaledVector(this.tempRight, tailOffset);

    this.sampleStream(rig.leftStream, leftPos, this.tempUp, dt, r, g, b, baseAlpha, width, maxLifetime);
    this.sampleStream(rig.rightStream, rightPos, this.tempUp, dt, r, g, b, baseAlpha, width, maxLifetime);
  }

  private sampleStream(
    stream: TrailStream,
    curPos: THREE.Vector3,
    upVec: THREE.Vector3,
    dt: number,
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
    // Add point when car moves at least ~0.09m
    if (dist >= 0.085) {
      stream.points.unshift({
        x: curPos.x,
        y: curPos.y,
        z: curPos.z,
        upX: upVec.x,
        upY: upVec.y,
        upZ: upVec.z,
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
   * Writes continuous ribbon quads connecting successive trail sample points
   */
  private writeStreamQuads(stream: TrailStream, startQuadIndex: number): number {
    let qIdx = startQuadIndex;
    const count = stream.points.length;
    if (count < 2) return qIdx;

    const maxQuads = this.totalStreams * this.maxSegmentsPerStream;

    for (let i = 0; i < count - 1; i++) {
      if (qIdx >= maxQuads) break;

      const p0 = stream.points[i];
      const p1 = stream.points[i + 1];

      // Smooth life falloff ratio
      const ratio0 = 1.0 - Math.min(1.0, p0.age / p0.maxAge);
      const ratio1 = 1.0 - Math.min(1.0, p1.age / p1.maxAge);

      const a0 = Math.pow(ratio0, 1.35) * p0.alpha;
      const a1 = Math.pow(ratio1, 1.35) * p1.alpha;

      const h0 = p0.width * 0.5 * (0.45 + ratio0 * 0.55);
      const h1 = p1.width * 0.5 * (0.45 + ratio1 * 0.55);

      const v = qIdx * 4;

      // Vertex 0: p0 Top
      this.positions[(v + 0) * 3 + 0] = p0.x + p0.upX * h0;
      this.positions[(v + 0) * 3 + 1] = p0.y + p0.upY * h0;
      this.positions[(v + 0) * 3 + 2] = p0.z + p0.upZ * h0;
      this.colors[(v + 0) * 4 + 0] = p0.r;
      this.colors[(v + 0) * 4 + 1] = p0.g;
      this.colors[(v + 0) * 4 + 2] = p0.b;
      this.colors[(v + 0) * 4 + 3] = a0;

      // Vertex 1: p0 Bottom
      this.positions[(v + 1) * 3 + 0] = p0.x - p0.upX * h0;
      this.positions[(v + 1) * 3 + 1] = p0.y - p0.upY * h0;
      this.positions[(v + 1) * 3 + 2] = p0.z - p0.upZ * h0;
      this.colors[(v + 1) * 4 + 0] = p0.r;
      this.colors[(v + 1) * 4 + 1] = p0.g;
      this.colors[(v + 1) * 4 + 2] = p0.b;
      this.colors[(v + 1) * 4 + 3] = a0;

      // Vertex 2: p1 Bottom
      this.positions[(v + 2) * 3 + 0] = p1.x - p1.upX * h1;
      this.positions[(v + 2) * 3 + 1] = p1.y - p1.upY * h1;
      this.positions[(v + 2) * 3 + 2] = p1.z - p1.upZ * h1;
      this.colors[(v + 2) * 4 + 0] = p1.r;
      this.colors[(v + 2) * 4 + 1] = p1.g;
      this.colors[(v + 2) * 4 + 2] = p1.b;
      this.colors[(v + 2) * 4 + 3] = a1;

      // Vertex 3: p1 Top
      this.positions[(v + 3) * 3 + 0] = p1.x + p1.upX * h1;
      this.positions[(v + 3) * 3 + 1] = p1.y + p1.upY * h1;
      this.positions[(v + 3) * 3 + 2] = p1.z + p1.upZ * h1;
      this.colors[(v + 3) * 4 + 0] = p1.r;
      this.colors[(v + 3) * 4 + 1] = p1.g;
      this.colors[(v + 3) * 4 + 2] = p1.b;
      this.colors[(v + 3) * 4 + 3] = a1;

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
