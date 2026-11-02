import * as THREE from 'three';

interface WheelSkidState {
  lastPos: THREE.Vector3 | null;
  lastNormal: THREE.Vector3 | null;
  lastLeft: THREE.Vector3 | null;
  lastRight: THREE.Vector3 | null;
  active: boolean;
}

export class SkidmarkManager {
  private scene: THREE.Scene;
  private maxSegments = 1600; // 1600 quads = 3200 triangles = 6400 vertices
  private geometry: THREE.BufferGeometry;
  private material: THREE.MeshBasicMaterial;
  private mesh: THREE.Mesh;

  private positions: Float32Array;
  private colors: Float32Array;
  private uvs: Float32Array;
  private indices: Uint16Array;
  private segmentLife: Float32Array;

  private currentSegment = 0;
  private totalSegmentsUsed = 0;
  private fadeFrameCounter = 0;

  // Track state for up to 4 wheels (0: LF, 1: RF, 2: LR, 3: RR)
  private wheelStates: WheelSkidState[] = [
    { lastPos: null, lastNormal: null, lastLeft: null, lastRight: null, active: false },
    { lastPos: null, lastNormal: null, lastLeft: null, lastRight: null, active: false },
    { lastPos: null, lastNormal: null, lastLeft: null, lastRight: null, active: false },
    { lastPos: null, lastNormal: null, lastLeft: null, lastRight: null, active: false },
  ];

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    const numVertices = this.maxSegments * 4;
    const numIndices = this.maxSegments * 6;

    this.positions = new Float32Array(numVertices * 3);
    this.colors = new Float32Array(numVertices * 4); // RGBA
    this.uvs = new Float32Array(numVertices * 2);
    this.indices = new Uint16Array(numIndices);
    this.segmentLife = new Float32Array(this.maxSegments);

    // Initialize all positions below ground
    for (let i = 0; i < numVertices; i++) {
      this.positions[i * 3 + 0] = 0;
      this.positions[i * 3 + 1] = -1000;
      this.positions[i * 3 + 2] = 0;

      this.colors[i * 4 + 0] = 0.08;
      this.colors[i * 4 + 1] = 0.08;
      this.colors[i * 4 + 2] = 0.08;
      this.colors[i * 4 + 3] = 0.0;
    }

    // Pre-populate quad indices (0, 1, 2,  0, 2, 3)
    for (let s = 0; s < this.maxSegments; s++) {
      const v = s * 4;
      const idx = s * 6;
      this.indices[idx + 0] = v + 0;
      this.indices[idx + 1] = v + 1;
      this.indices[idx + 2] = v + 2;
      this.indices[idx + 3] = v + 0;
      this.indices[idx + 4] = v + 2;
      this.indices[idx + 5] = v + 3;

      this.uvs[v * 2 + 0] = 0; this.uvs[v * 2 + 1] = 0;
      this.uvs[v * 2 + 2] = 1; this.uvs[v * 2 + 3] = 0;
      this.uvs[v * 2 + 4] = 1; this.uvs[v * 2 + 5] = 1;
      this.uvs[v * 2 + 6] = 0; this.uvs[v * 2 + 7] = 1;
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 4));
    this.geometry.setAttribute('uv', new THREE.BufferAttribute(this.uvs, 2));
    this.geometry.setIndex(new THREE.BufferAttribute(this.indices, 1));

    // Dynamic procedural rubber tread texture
    const texture = this.createSkidTexture();

    this.material = new THREE.MeshBasicMaterial({
      map: texture,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1.0,
      polygonOffsetUnits: -3.0,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    this.scene.add(this.mesh);
  }

  private createSkidTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.fillRect(0, 0, 64, 128);

    // Tread groove pattern
    const grad = ctx.createLinearGradient(0, 0, 64, 0);
    grad.addColorStop(0.0, 'rgba(15, 12, 10, 0.0)');
    grad.addColorStop(0.15, 'rgba(15, 12, 10, 0.85)');
    grad.addColorStop(0.35, 'rgba(25, 20, 18, 0.55)');
    grad.addColorStop(0.50, 'rgba(15, 12, 10, 0.90)');
    grad.addColorStop(0.65, 'rgba(25, 20, 18, 0.55)');
    grad.addColorStop(0.85, 'rgba(15, 12, 10, 0.85)');
    grad.addColorStop(1.0, 'rgba(15, 12, 10, 0.0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 128);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  addSkidMark(
    wheelIndex: number,
    contactPos: THREE.Vector3,
    surfaceNormal: THREE.Vector3,
    forwardVec: THREE.Vector3,
    width: number = 0.065,
    intensity: number = 0.85
  ) {
    if (wheelIndex < 0 || wheelIndex >= this.wheelStates.length) return;
    const state = this.wheelStates[wheelIndex];

    // Lift mark slightly above the road surface along surface normal to guarantee zero z-fighting
    const markPos = contactPos.clone().addScaledVector(surfaceNormal, 0.007);

    // Calculate lateral width vector perpendicular to driving direction along ground plane
    const rightVec = new THREE.Vector3().crossVectors(forwardVec, surfaceNormal).normalize();
    const halfWidth = width * 0.5;
    const leftPt = markPos.clone().addScaledVector(rightVec, -halfWidth);
    const rightPt = markPos.clone().addScaledVector(rightVec, halfWidth);

    if (!state.active || !state.lastLeft || !state.lastRight || !state.lastPos) {
      state.lastPos = markPos.clone();
      state.lastNormal = surfaceNormal.clone();
      state.lastLeft = leftPt;
      state.lastRight = rightPt;
      state.active = true;
      return;
    }

    // Minimum distance between segments to avoid over-clustering
    const distSq = markPos.distanceToSquared(state.lastPos);
    if (distSq < 0.02 * 0.02) return;
    if (distSq > 3.0 * 3.0) {
      // Discontinuity (jump / respawn)
      this.stopSkidMark(wheelIndex);
      return;
    }

    // Add quad segment connecting lastLeft/lastRight to new leftPt/rightPt
    const s = this.currentSegment;
    const vBase = s * 4;

    // p0: lastLeft
    this.positions[vBase * 3 + 0] = state.lastLeft.x;
    this.positions[vBase * 3 + 1] = state.lastLeft.y;
    this.positions[vBase * 3 + 2] = state.lastLeft.z;

    // p1: lastRight
    this.positions[(vBase + 1) * 3 + 0] = state.lastRight.x;
    this.positions[(vBase + 1) * 3 + 1] = state.lastRight.y;
    this.positions[(vBase + 1) * 3 + 2] = state.lastRight.z;

    // p2: rightPt
    this.positions[(vBase + 2) * 3 + 0] = rightPt.x;
    this.positions[(vBase + 2) * 3 + 1] = rightPt.y;
    this.positions[(vBase + 2) * 3 + 2] = rightPt.z;

    // p3: leftPt
    this.positions[(vBase + 3) * 3 + 0] = leftPt.x;
    this.positions[(vBase + 3) * 3 + 1] = leftPt.y;
    this.positions[(vBase + 3) * 3 + 2] = leftPt.z;

    // Rubber mark color and alpha
    const alpha = Math.min(0.9, Math.max(0.2, intensity));
    for (let i = 0; i < 4; i++) {
      const cBase = (vBase + i) * 4;
      this.colors[cBase + 0] = 0.05;
      this.colors[cBase + 1] = 0.05;
      this.colors[cBase + 2] = 0.05;
      this.colors[cBase + 3] = alpha;
    }

    this.segmentLife[s] = 1.0; // full life

    // Advance circular buffer
    this.currentSegment = (this.currentSegment + 1) % this.maxSegments;
    this.totalSegmentsUsed = Math.min(this.maxSegments, this.totalSegmentsUsed + 1);

    // Flag attributes for GPU upload
    (this.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;

    // Save previous state for next segment
    state.lastPos.copy(markPos);
    state.lastLeft = leftPt;
    state.lastRight = rightPt;
  }

  stopSkidMark(wheelIndex: number) {
    if (wheelIndex >= 0 && wheelIndex < this.wheelStates.length) {
      this.wheelStates[wheelIndex].active = false;
      this.wheelStates[wheelIndex].lastPos = null;
      this.wheelStates[wheelIndex].lastLeft = null;
      this.wheelStates[wheelIndex].lastRight = null;
    }
  }

  update(delta: number) {
    if (this.totalSegmentsUsed === 0) return;

    // Throttle GPU buffer uploads: fade skidmarks every 3 frames (~50ms) instead of every frame
    this.fadeFrameCounter++;
    if (this.fadeFrameCounter % 3 !== 0) return;

    // Fade out older skid marks gradually over ~14 seconds
    const decay = (delta * 3) / 14.0;
    let anyChanged = false;

    for (let s = 0; s < this.maxSegments; s++) {
      if (this.segmentLife[s] > 0) {
        this.segmentLife[s] = Math.max(0, this.segmentLife[s] - decay);
        const alpha = this.segmentLife[s] * 0.85;
        const vBase = s * 4;
        for (let i = 0; i < 4; i++) {
          this.colors[(vBase + i) * 4 + 3] = alpha;
        }
        anyChanged = true;
      }
    }

    if (anyChanged) {
      (this.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    }
  }

  reset() {
    this.currentSegment = 0;
    this.totalSegmentsUsed = 0;
    const numVertices = this.maxSegments * 4;

    for (let i = 0; i < numVertices; i++) {
      this.positions[i * 3 + 1] = -1000;
      this.colors[i * 4 + 3] = 0.0;
    }
    this.segmentLife.fill(0);

    for (const ws of this.wheelStates) {
      ws.active = false;
      ws.lastPos = null;
      ws.lastLeft = null;
      ws.lastRight = null;
    }

    (this.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }

  dispose() {
    if (this.mesh.parent) {
      this.mesh.parent.remove(this.mesh);
    }
    this.geometry.dispose();
    this.material.dispose();
  }
}
