import * as THREE from 'three';

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color;
  size: number;
  life: number;
  maxLife: number;
}

export class ParticleManager {
  private scene: THREE.Scene;

  // Dynamic particles (tire drift smoke, nitro boost exhaust)
  private dynamicParticles: Particle[] = [];
  private dynamicGeometry: THREE.BufferGeometry;
  private dynamicMaterial: THREE.PointsMaterial;
  private dynamicPoints: THREE.Points;
  private dynamicPositions: Float32Array;
  private dynamicColors: Float32Array;
  private dynamicSizes: Float32Array;
  private maxDynamic = 500; // Optimized buffer footprint for smooth 60 FPS on low-end hardware

  // Antialiased round particle texture
  private createRoundParticleTexture(glow: boolean = false): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    if (glow) {
      gradient.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
      gradient.addColorStop(0.25, 'rgba(255, 220, 150, 0.95)');
      gradient.addColorStop(0.55, 'rgba(255, 120, 30, 0.45)');
      gradient.addColorStop(0.85, 'rgba(255, 50, 0, 0.12)');
      gradient.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
    } else {
      gradient.addColorStop(0.0, 'rgba(255, 255, 255, 0.90)');
      gradient.addColorStop(0.30, 'rgba(255, 255, 255, 0.65)');
      gradient.addColorStop(0.60, 'rgba(255, 255, 255, 0.28)');
      gradient.addColorStop(0.85, 'rgba(255, 255, 255, 0.06)');
      gradient.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
    }

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(64, 64, 63, 0, Math.PI * 2);
    ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    return tex;
  }

  private patchRoundPointsShader(mat: THREE.PointsMaterial) {
    mat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_particle_fragment>',
        `#include <map_particle_fragment>
         float coordDist = length(gl_PointCoord - vec2(0.5));
         if (coordDist > 0.5) discard;
         float circleEdge = smoothstep(0.5, 0.44, coordDist);
         diffuseColor.a *= circleEdge;`
      );
    };
  }

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Setup dynamic vehicle particles (drift smoke and boost exhaust)
    this.dynamicGeometry = new THREE.BufferGeometry();
    this.dynamicPositions = new Float32Array(this.maxDynamic * 3);
    this.dynamicColors = new Float32Array(this.maxDynamic * 3);
    this.dynamicSizes = new Float32Array(this.maxDynamic);

    this.dynamicGeometry.setAttribute('position', new THREE.BufferAttribute(this.dynamicPositions, 3));
    this.dynamicGeometry.setAttribute('color', new THREE.BufferAttribute(this.dynamicColors, 3));

    this.dynamicMaterial = new THREE.PointsMaterial({
      size: 0.20,
      map: this.createRoundParticleTexture(false),
      vertexColors: true,
      transparent: true,
      opacity: 0.28,
      blending: THREE.NormalBlending,
      depthWrite: false,
    });
    this.patchRoundPointsShader(this.dynamicMaterial);
    this.dynamicPoints = new THREE.Points(this.dynamicGeometry, this.dynamicMaterial);
    this.scene.add(this.dynamicPoints);
  }

  spawnDriftSmoke(pos: THREE.Vector3) {
    if (this.dynamicParticles.length >= this.maxDynamic - 1) return;
    this.dynamicParticles.push({
      position: pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.08, 0.02, (Math.random() - 0.5) * 0.08)),
      velocity: new THREE.Vector3((Math.random() - 0.5) * 0.25, 0.2 + Math.random() * 0.2, (Math.random() - 0.5) * 0.25),
      color: new THREE.Color(0.72, 0.72, 0.75),
      size: 0.16,
      life: 0,
      maxLife: 0.6 + Math.random() * 0.3,
    });
  }

  spawnTireSmoke(pos: THREE.Vector3, intensity: number = 0.5) {
    if (this.dynamicParticles.length >= this.maxDynamic - 2) return;
    const count = Math.min(2, Math.ceil(intensity * 2));
    for (let i = 0; i < count; i++) {
      this.dynamicParticles.push({
        position: pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.06, 0.02, (Math.random() - 0.5) * 0.06)),
        velocity: new THREE.Vector3((Math.random() - 0.5) * 0.2, 0.15 + Math.random() * 0.25, (Math.random() - 0.5) * 0.2),
        color: new THREE.Color(0.85, 0.85, 0.88),
        size: 0.18 + Math.random() * 0.08,
        life: 0,
        maxLife: 0.5 + Math.random() * 0.3,
      });
    }
  }

  spawnTireSparks(pos: THREE.Vector3, count: number = 2) {
    for (let i = 0; i < count; i++) {
      if (this.dynamicParticles.length >= this.maxDynamic) break;
      this.dynamicParticles.push({
        position: pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.04, 0.02, (Math.random() - 0.5) * 0.04)),
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 2.0,
          0.8 + Math.random() * 1.5,
          (Math.random() - 0.5) * 2.0
        ),
        color: new THREE.Color(1.0, 0.85, 0.3),
        size: 0.10,
        life: 0,
        maxLife: 0.25 + Math.random() * 0.2,
      });
    }
  }

  spawnCollisionSparks(pos: THREE.Vector3, normal: THREE.Vector3, intensity: number = 1.0) {
    const sparkCount = Math.min(26, Math.max(10, Math.floor(intensity * 20)));
    for (let i = 0; i < sparkCount; i++) {
      if (this.dynamicParticles.length >= this.maxDynamic) break;
      const tangent = new THREE.Vector3(-normal.z, 0, normal.x).normalize();
      const spread = (Math.random() - 0.5) * 4.2;
      const bounce = Math.random() * 2.8 + 0.8;
      const vel = new THREE.Vector3()
        .addScaledVector(tangent, spread)
        .addScaledVector(normal, bounce)
        .add(new THREE.Vector3(0, 1.2 + Math.random() * 2.4, 0));

      const isWhiteHot = Math.random() < 0.45;
      this.dynamicParticles.push({
        position: pos.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * 0.08,
          (Math.random() - 0.5) * 0.08,
          (Math.random() - 0.5) * 0.08
        )),
        velocity: vel,
        color: isWhiteHot ? new THREE.Color(1.0, 0.98, 0.80) : new THREE.Color(1.0, 0.52, 0.08),
        size: 0.14 + Math.random() * 0.08,
        life: 0,
        maxLife: 0.28 + Math.random() * 0.22,
      });
    }

    // Impact debris smoke puff
    this.spawnTireSmoke(pos, Math.min(1.0, intensity * 0.75));
  }

  spawnNitroCollectFlash(pos: THREE.Vector3) {
    const sparkCount = 22;
    for (let i = 0; i < sparkCount; i++) {
      if (this.dynamicParticles.length >= this.maxDynamic) break;
      const angle = (i / sparkCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const speed = 2.8 + Math.random() * 2.8;
      const vel = new THREE.Vector3(
        Math.cos(angle) * speed,
        1.2 + Math.random() * 2.2,
        Math.sin(angle) * speed
      );

      const isCyan = i % 2 === 0;
      this.dynamicParticles.push({
        position: pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.12, 0.25, (Math.random() - 0.5) * 0.12)),
        velocity: vel,
        color: isCyan ? new THREE.Color(0.0, 0.95, 1.0) : new THREE.Color(1.0, 0.90, 0.25),
        size: 0.18 + Math.random() * 0.10,
        life: 0,
        maxLife: 0.38 + Math.random() * 0.22,
      });
    }

    // High energy expanding flash puff
    this.spawnTireSmoke(pos, 0.85);
  }

  spawnHotWheelsCollectBurst(pos: THREE.Vector3) {
    const sparkCount = 30;
    for (let i = 0; i < sparkCount; i++) {
      if (this.dynamicParticles.length >= this.maxDynamic) break;
      const angle = (i / sparkCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      const speed = 3.2 + Math.random() * 3.2;
      const vel = new THREE.Vector3(
        Math.cos(angle) * speed,
        1.5 + Math.random() * 2.8,
        Math.sin(angle) * speed
      );

      // Fiery Hot Wheels colors: blazing red, bright orange, radiant gold
      const r = Math.random();
      const col = r < 0.4 ? new THREE.Color(1.0, 0.15, 0.0) : (r < 0.75 ? new THREE.Color(1.0, 0.55, 0.05) : new THREE.Color(1.0, 0.95, 0.3));
      this.dynamicParticles.push({
        position: pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.15, 0.25, (Math.random() - 0.5) * 0.15)),
        velocity: vel,
        color: col,
        size: 0.20 + Math.random() * 0.12,
        life: 0,
        maxLife: 0.45 + Math.random() * 0.25,
      });
    }

    // High energy expanding flame puff
    this.spawnTireSmoke(pos, 0.95);
  }

  spawnBoostFlame(exhaustPos: THREE.Vector3, carForward: THREE.Vector3) {
    if (this.dynamicParticles.length >= this.maxDynamic) return;
    const reverseDir = carForward.clone().negate();
    const spread = new THREE.Vector3((Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.08, (Math.random() - 0.5) * 0.12);
    const vel = reverseDir.multiplyScalar(3.5 + Math.random() * 1.5).add(spread);

    const isHotCyan = Math.random() < 0.75;
    this.dynamicParticles.push({
      position: exhaustPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.02, (Math.random() - 0.5) * 0.02, (Math.random() - 0.5) * 0.02)),
      velocity: vel,
      color: isHotCyan ? new THREE.Color(0.1, 0.85, 1.0) : new THREE.Color(0.4, 0.2, 1.0),
      size: 0.16 + Math.random() * 0.06,
      life: 0,
      maxLife: 0.16 + Math.random() * 0.1,
    });
  }

  spawnExhaustSmoke(exhaustPos: THREE.Vector3, carForward: THREE.Vector3, intensity: number = 0.4, isIdle: boolean = false) {
    if (this.dynamicParticles.length >= this.maxDynamic) return;
    const reverseDir = isIdle ? new THREE.Vector3(0, 0.2, 0) : carForward.clone().negate().multiplyScalar(1.2);
    const spread = new THREE.Vector3((Math.random() - 0.5) * 0.08, 0.1 + Math.random() * 0.15, (Math.random() - 0.5) * 0.08);

    this.dynamicParticles.push({
      position: exhaustPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.03, 0.02, (Math.random() - 0.5) * 0.03)),
      velocity: reverseDir.add(spread),
      color: isIdle ? new THREE.Color(0.65, 0.65, 0.68) : new THREE.Color(0.55, 0.55, 0.58),
      size: (0.12 + Math.random() * 0.06) * intensity,
      life: 0,
      maxLife: isIdle ? 0.35 : 0.45,
    });
  }

  spawnBoostFlames(exhaustPos: THREE.Vector3, carForward: THREE.Vector3) {
    this.spawnBoostFlame(exhaustPos, carForward);
  }

  update(delta: number, _carCenterPos?: THREE.Vector3) {
    // Update dynamic particles (drift smoke, boost flame bursts)
    for (let i = this.dynamicParticles.length - 1; i >= 0; i--) {
      const p = this.dynamicParticles[i];
      p.life += delta;
      if (p.life >= p.maxLife) {
        this.dynamicParticles.splice(i, 1);
        continue;
      }
      p.position.addScaledVector(p.velocity, delta);
      p.velocity.y += delta * 0.35; // gentle upward drift
    }

    const dynPosAttr = this.dynamicGeometry.attributes.position as THREE.BufferAttribute;
    const dynColAttr = this.dynamicGeometry.attributes.color as THREE.BufferAttribute;
    const dPositions = dynPosAttr.array as Float32Array;
    const dColors = dynColAttr.array as Float32Array;
    const count = this.dynamicParticles.length;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const p = this.dynamicParticles[i];
      dPositions[i3 + 0] = p.position.x;
      dPositions[i3 + 1] = p.position.y;
      dPositions[i3 + 2] = p.position.z;

      const lifeRatio = 1 - p.life / p.maxLife;
      dColors[i3 + 0] = p.color.r * lifeRatio;
      dColors[i3 + 1] = p.color.g * lifeRatio;
      dColors[i3 + 2] = p.color.b * lifeRatio;
    }

    // Only upload active elements across the GPU bus and limit draw call range
    dynPosAttr.clearUpdateRanges();
    dynPosAttr.addUpdateRange(0, count * 3);
    dynPosAttr.needsUpdate = true;

    dynColAttr.clearUpdateRanges();
    dynColAttr.addUpdateRange(0, count * 3);
    dynColAttr.needsUpdate = true;

    this.dynamicGeometry.setDrawRange(0, count);
  }

  dispose() {
    this.scene.remove(this.dynamicPoints);
    this.dynamicGeometry.dispose();
    this.dynamicMaterial.dispose();
  }
}
