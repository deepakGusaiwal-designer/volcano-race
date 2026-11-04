import * as THREE from 'three';
import { CIRCUIT_WAYPOINTS } from './CompetitionManager';
import { ParticleManager } from './ParticleManager';
import { VehicleController } from './VehicleController';
import { AICarController } from './AICarController';
import { soundEffects } from '../audio/SoundEffects';
import { useGameStore } from '../store/useGameStore';

export interface HotWheelsPickup {
  id: string;
  group: THREE.Group;
  frontFace: THREE.Mesh;
  backFace: THREE.Mesh;
  edgeMesh: THREE.Mesh;
  bevelMesh: THREE.Mesh;
  outerRing: THREE.Mesh;
  glowHalo: THREE.Mesh;
  basePosition: THREE.Vector3;
  groundY: number;
  rotationSpeed: number;
  bobPhase: number;
  active: boolean;
  cooldownTimer: number;
  respawnScale: number;
  collectAnimTimer: number;
}

export class HotWheelsPickupManager {
  public group = new THREE.Group();
  private scene: THREE.Scene;
  private trackSpline: THREE.CatmullRomCurve3;
  private pickups: HotWheelsPickup[] = [];
  private probeRaycaster = new THREE.Raycaster();
  private downVec = new THREE.Vector3(0, -1, 0);
  private probeOrigin = new THREE.Vector3();

  // Shared Procedural Textures & Materials for 60 FPS
  private diffuseTexture: THREE.CanvasTexture | null = null;
  private bumpTexture: THREE.CanvasTexture | null = null;
  private haloTexture: THREE.CanvasTexture | null = null;

  private sharedFaceGeo: THREE.CircleGeometry | null = null;
  private sharedEdgeGeo: THREE.CylinderGeometry | null = null;
  private sharedBevelGeo: THREE.TorusGeometry | null = null;
  private sharedRingGeo: THREE.TorusGeometry | null = null;
  private sharedHaloGeo: THREE.PlaneGeometry | null = null;

  private sharedFaceMaterial: THREE.MeshStandardMaterial | null = null;
  private sharedEdgeMaterial: THREE.MeshStandardMaterial | null = null;
  private sharedBevelMaterial: THREE.MeshStandardMaterial | null = null;
  private sharedRingMaterial: THREE.MeshStandardMaterial | null = null;
  private sharedHaloMaterial: THREE.MeshBasicMaterial | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group.name = 'HotWheelsPickupManager';
    this.trackSpline = new THREE.CatmullRomCurve3(CIRCUIT_WAYPOINTS, true, 'centripetal');
    this.scene.add(this.group);
    this.initProceduralAssets();
  }

  // -------------------------------------------------------------
  // High-Resolution Procedural 3D Embossed Coin & Bump Map Textures
  // -------------------------------------------------------------
  private initProceduralAssets() {
    // 1. Generate Embossed Diffuse (Color) Map (512x512)
    const diffCanvas = document.createElement('canvas');
    diffCanvas.width = 512;
    diffCanvas.height = 512;
    const diffCtx = diffCanvas.getContext('2d')!;
    this.renderDiffuseCoin(diffCtx, 512, 512);

    this.diffuseTexture = new THREE.CanvasTexture(diffCanvas);
    this.diffuseTexture.generateMipmaps = true;
    this.diffuseTexture.minFilter = THREE.LinearMipmapLinearFilter;
    this.diffuseTexture.magFilter = THREE.LinearFilter;

    // 2. Generate Heightmap / Bump Map for Real-Time Normal Specular (512x512)
    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = 512;
    bumpCanvas.height = 512;
    const bumpCtx = bumpCanvas.getContext('2d')!;
    this.renderBumpCoin(bumpCtx, 512, 512);

    this.bumpTexture = new THREE.CanvasTexture(bumpCanvas);
    this.bumpTexture.generateMipmaps = true;
    this.bumpTexture.minFilter = THREE.LinearMipmapLinearFilter;
    this.bumpTexture.magFilter = THREE.LinearFilter;

    // 3. Generate Soft Radial Flame Glow Sprite Texture (128x128)
    const haloCanvas = document.createElement('canvas');
    haloCanvas.width = 128;
    haloCanvas.height = 128;
    const haloCtx = haloCanvas.getContext('2d')!;
    const haloGrad = haloCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
    haloGrad.addColorStop(0.0, 'rgba(255, 235, 120, 0.85)');
    haloGrad.addColorStop(0.3, 'rgba(255, 110, 0, 0.55)');
    haloGrad.addColorStop(0.65, 'rgba(210, 25, 0, 0.22)');
    haloGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
    haloCtx.fillStyle = haloGrad;
    haloCtx.fillRect(0, 0, 128, 128);

    this.haloTexture = new THREE.CanvasTexture(haloCanvas);

    // 4. Shared Geometries for compact coin (Radius 0.26m, Thickness 0.042m)
    this.sharedFaceGeo = new THREE.CircleGeometry(0.26, 48);
    const edgeGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.042, 48, 1, true);
    edgeGeo.rotateX(Math.PI / 2);
    this.sharedEdgeGeo = edgeGeo;
    this.sharedBevelGeo = new THREE.TorusGeometry(0.26, 0.010, 16, 48);
    this.sharedRingGeo = new THREE.TorusGeometry(0.31, 0.007, 12, 36);
    this.sharedHaloGeo = new THREE.PlaneGeometry(0.70, 0.70);

    // 5. Shared Materials
    this.sharedFaceMaterial = new THREE.MeshStandardMaterial({
      map: this.diffuseTexture,
      bumpMap: this.bumpTexture,
      bumpScale: 0.045,
      metalness: 0.85,
      roughness: 0.20,
      side: THREE.FrontSide,
    });

    this.sharedEdgeMaterial = new THREE.MeshStandardMaterial({
      color: 0xdfb132,
      emissive: new THREE.Color(0x3a2200),
      emissiveIntensity: 0.45,
      metalness: 0.95,
      roughness: 0.18,
      side: THREE.DoubleSide,
    });

    this.sharedBevelMaterial = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: new THREE.Color(0x553300),
      emissiveIntensity: 0.55,
      metalness: 0.98,
      roughness: 0.12,
    });

    this.sharedRingMaterial = new THREE.MeshStandardMaterial({
      color: 0xff7700,
      emissive: new THREE.Color(0xff4400),
      emissiveIntensity: 2.2,
      metalness: 0.8,
      roughness: 0.2,
    });

    this.sharedHaloMaterial = new THREE.MeshBasicMaterial({
      map: this.haloTexture,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  }

  // -------------------------------------------------------------
  // Full 3D Embossed Minted Coin Diffuse Renderer (Canvas 512x512)
  // -------------------------------------------------------------
  private renderDiffuseCoin(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const outerR = 246;

    ctx.clearRect(0, 0, w, h);

    // Strictly circular minted coin boundary
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    // 1. Outer Gold Rim with Directional Bevel (Top-Left Highlight to Bottom-Right Shadow)
    const rimGrad = ctx.createLinearGradient(cx - outerR, cy - outerR, cx + outerR, cy + outerR);
    rimGrad.addColorStop(0.0, '#fff8b0'); // Top-left specular gleam
    rimGrad.addColorStop(0.28, '#ffd700'); // Pure minted gold
    rimGrad.addColorStop(0.68, '#cc9900'); // Deep metallic gold
    rimGrad.addColorStop(1.0, '#664d00'); // Bottom-right shadow bronze
    ctx.fillStyle = rimGrad;
    ctx.fillRect(0, 0, w, h);

    // 2. Milled Coin Rim Fluting / Notches (72 serrated teeth)
    ctx.save();
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 72; i++) {
      const angle = (i * Math.PI * 2) / 72;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const rInner = 226;
      const rOuter = 244;

      ctx.beginPath();
      ctx.moveTo(cx + cosA * rInner, cy + sinA * rInner);
      ctx.lineTo(cx + cosA * rOuter, cy + sinA * rOuter);

      if (i % 2 === 0) {
        ctx.strokeStyle = '#fff8b8';
      } else {
        ctx.strokeStyle = '#473200';
      }
      ctx.stroke();
    }
    ctx.restore();

    // 3. Stepped Inner Coin Rim Rings
    ctx.beginPath();
    ctx.arc(cx, cy, 225, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#3d2800'; // Cast shadow groove
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, 222, 0, Math.PI * 2);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#fff4a3'; // Raised highlight ridge
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, 218, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#d4a017'; // Inner gold border
    ctx.stroke();

    // 4. Recessed Coin Bed (Radius 216)
    ctx.beginPath();
    ctx.arc(cx, cy, 216, 0, Math.PI * 2);
    ctx.closePath();
    const bedGrad = ctx.createRadialGradient(cx - 45, cy - 45, 15, cx, cy, 216);
    bedGrad.addColorStop(0.0, '#ff3b00'); // Radiant molten fiery center
    bedGrad.addColorStop(0.4, '#c41200'); // Deep racing red
    bedGrad.addColorStop(0.8, '#700700'); // Volcanic ruby
    bedGrad.addColorStop(0.96, '#380000'); // Ambient occlusion rim shadow
    bedGrad.addColorStop(1.0, '#200000'); // Recessed edge
    ctx.fillStyle = bedGrad;
    ctx.fill();

    // Subtle machined circular concentric rings
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 210, 120, 0.08)';
    ctx.lineWidth = 1;
    for (let r = 25; r < 210; r += 12) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // 5. Minted Embossed Stars at Top Rim
    this.drawEmbossedStar(ctx, cx, cy - 176, 14, 6);
    this.drawEmbossedStar(ctx, cx - 60, cy - 164, 10, 4.5);
    this.drawEmbossedStar(ctx, cx + 60, cy - 164, 10, 4.5);

    // 6. Minted Embossed Inscription at Bottom Rim
    this.drawCurvedEmbossedText(ctx, '★ RACING TOKEN ★', cx, cy, 185, Math.PI * 0.28, Math.PI * 0.72);

    // 7. Iconic Embossed Hot Wheels Flame Logo (Center)
    this.drawEmbossedHotWheelsFlame(ctx, cx, cy);

    ctx.restore();
  }

  // -------------------------------------------------------------
  // Chiseled 3D Embossed Star Facets
  // -------------------------------------------------------------
  private drawEmbossedStar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    rOuter: number,
    rInner: number,
    points: number = 5
  ) {
    ctx.save();
    for (let i = 0; i < points; i++) {
      const tipAngle = (i * Math.PI * 2) / points - Math.PI / 2;
      const innerAngle1 = tipAngle - Math.PI / points;
      const innerAngle2 = tipAngle + Math.PI / points;

      const tipX = x + Math.cos(tipAngle) * rOuter;
      const tipY = y + Math.sin(tipAngle) * rOuter;
      const inX1 = x + Math.cos(innerAngle1) * rInner;
      const inY1 = y + Math.sin(innerAngle1) * rInner;
      const inX2 = x + Math.cos(innerAngle2) * rInner;
      const inY2 = y + Math.sin(innerAngle2) * rInner;

      // Light facet (Left: catches top-left light)
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(inX1, inY1);
      ctx.lineTo(tipX, tipY);
      ctx.closePath();
      ctx.fillStyle = '#fff4a3';
      ctx.fill();

      // Shadow facet (Right: cast shadow)
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(tipX, tipY);
      ctx.lineTo(inX2, inY2);
      ctx.closePath();
      ctx.fillStyle = '#6b4700';
      ctx.fill();
    }
    ctx.restore();
  }

  // -------------------------------------------------------------
  // Curved Embossed Text Along Coin Arch
  // -------------------------------------------------------------
  private drawCurvedEmbossedText(
    ctx: CanvasRenderingContext2D,
    text: string,
    cx: number,
    cy: number,
    radius: number,
    startAngle: number,
    endAngle: number
  ) {
    ctx.save();
    ctx.font = '900 18px "Arial Black", "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const angleStep = (endAngle - startAngle) / (text.length - 1);

    for (let i = 0; i < text.length; i++) {
      const angle = startAngle + i * angleStep;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle - Math.PI / 2);

      // Embossed cast shadow
      ctx.fillStyle = '#240000';
      ctx.fillText(text[i], 1.5, 1.5);

      // Embossed highlight
      ctx.fillStyle = '#fff5a3';
      ctx.fillText(text[i], -0.8, -0.8);

      // Minted gold face
      ctx.fillStyle = '#ffcc00';
      ctx.fillText(text[i], 0, 0);

      ctx.restore();
    }
    ctx.restore();
  }

  // -------------------------------------------------------------
  // Embossed Hot Wheels Flame Logo (Drop Shadows, Bevels & 3D Typography)
  // -------------------------------------------------------------
  private drawEmbossedHotWheelsFlame(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
    const traceFlamePath = (ox: number, oy: number) => {
      ctx.beginPath();
      // Leftmost swept flame lick
      ctx.moveTo(cx - 150 + ox, cy + 5 + oy);
      // Upper sweeping fire contours
      ctx.bezierCurveTo(cx - 130 + ox, cy - 25 + oy, cx - 110 + ox, cy - 45 + oy, cx - 85 + ox, cy - 35 + oy);
      ctx.bezierCurveTo(cx - 70 + ox, cy - 30 + oy, cx - 60 + ox, cy - 50 + oy, cx - 40 + ox, cy - 60 + oy);
      ctx.bezierCurveTo(cx - 15 + ox, cy - 70 + oy, cx + 10 + ox, cy - 60 + oy, cx + 35 + ox, cy - 50 + oy);
      ctx.bezierCurveTo(cx + 65 + ox, cy - 75 + oy, cx + 105 + ox, cy - 80 + oy, cx + 135 + ox, cy - 60 + oy);
      // Far right apex
      ctx.bezierCurveTo(cx + 160 + ox, cy - 45 + oy, cx + 168 + ox, cy - 15 + oy, cx + 155 + ox, cy + 10 + oy);
      // Lower aerodynamic returning sweep
      ctx.bezierCurveTo(cx + 140 + ox, cy + 38 + oy, cx + 105 + ox, cy + 58 + oy, cx + 65 + ox, cy + 60 + oy);
      ctx.bezierCurveTo(cx + 15 + ox, cy + 62 + oy, cx - 30 + ox, cy + 52 + oy, cx - 70 + ox, cy + 45 + oy);
      ctx.bezierCurveTo(cx - 110 + ox, cy + 38 + oy, cx - 135 + ox, cy + 25 + oy, cx - 150 + ox, cy + 5 + oy);
      ctx.closePath();
    };

    // 1. Deep Embossed Drop Shadow (cast into coin recess)
    traceFlamePath(4, 5);
    ctx.fillStyle = 'rgba(20, 0, 0, 0.88)';
    ctx.fill();

    // 2. Chiseled Bevel Highlight (top-left specular edge)
    traceFlamePath(-2, -2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#fffbb8';
    ctx.stroke();

    // 3. Main Fiery Flame Body
    traceFlamePath(0, 0);
    const flameGrad = ctx.createLinearGradient(cx - 140, cy - 60, cx + 140, cy + 60);
    flameGrad.addColorStop(0.0, '#fff433'); // Vibrant gold flame
    flameGrad.addColorStop(0.25, '#ffa200'); // Hot orange
    flameGrad.addColorStop(0.60, '#ff1a00'); // Hot rod red
    flameGrad.addColorStop(1.0, '#b30000'); // Racing crimson
    ctx.fillStyle = flameGrad;
    ctx.fill();

    // 4. Stamped Golden Outline Contour
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#ffffff';
    ctx.lineJoin = 'round';
    ctx.stroke();

    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#ffbb00';
    ctx.stroke();

    // 5. Embossed "HOT WHEELS" Typography
    ctx.save();
    ctx.translate(cx + 8, cy + 2);
    ctx.transform(1, 0, -0.28, 1, 0, 0); // Dynamic forward speed slant

    ctx.font = '900 46px "Arial Black", "Impact", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 3D Extrusion Depth Shadows
    ctx.fillStyle = '#240000';
    ctx.fillText('HOT WHEELS', 3.5, 4.5);
    ctx.fillStyle = '#420000';
    ctx.fillText('HOT WHEELS', 2, 2.5);

    // Outer chiseled white border
    ctx.lineWidth = 9;
    ctx.strokeStyle = '#ffffff';
    ctx.lineJoin = 'round';
    ctx.strokeText('HOT WHEELS', 0, 0);

    // Inner red bevel line
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#990000';
    ctx.strokeText('HOT WHEELS', 0, 0);

    // Letter Face Gradient (Yellow into fiery red)
    const textGrad = ctx.createLinearGradient(0, -22, 0, 22);
    textGrad.addColorStop(0.0, '#ffffff'); // Top specular gleam
    textGrad.addColorStop(0.18, '#fff952'); // Radiant gold
    textGrad.addColorStop(0.52, '#ff2e00'); // Hot rod red
    textGrad.addColorStop(1.0, '#a30000'); // Deep shadow
    ctx.fillStyle = textGrad;
    ctx.fillText('HOT WHEELS', 0, 0);

    // Internal reflection streak across letters
    ctx.save();
    ctx.beginPath();
    ctx.rect(-145, -2, 290, 3.5);
    ctx.clip();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.fillText('HOT WHEELS', 0, 0);
    ctx.restore();

    ctx.restore();
  }

  // -------------------------------------------------------------
  // Real-Time PBR Bump Map Generator (Grayscale Heightmap)
  // -------------------------------------------------------------
  private renderBumpCoin(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const cx = w * 0.5;
    const cy = h * 0.5;

    ctx.clearRect(0, 0, w, h);

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, 246, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    // 1. Raised Outer Coin Rim (Elevation = 0.82)
    ctx.fillStyle = 'rgb(210, 210, 210)';
    ctx.fillRect(0, 0, w, h);

    // 2. Milled Teeth on Rim (Alternating 240 and 180)
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 72; i++) {
      const angle = (i * Math.PI * 2) / 72;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      ctx.beginPath();
      ctx.moveTo(cx + cosA * 226, cy + sinA * 226);
      ctx.lineTo(cx + cosA * 244, cy + sinA * 244);
      ctx.strokeStyle = i % 2 === 0 ? 'rgb(240, 240, 240)' : 'rgb(180, 180, 180)';
      ctx.stroke();
    }

    // 3. Stepped Inner Bevel Groove (Elevation = 0.20)
    ctx.beginPath();
    ctx.arc(cx, cy, 224, 0, Math.PI * 2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgb(50, 50, 50)';
    ctx.stroke();

    // 4. Recessed Coin Bed (Elevation = 0.47)
    ctx.beginPath();
    ctx.arc(cx, cy, 216, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = 'rgb(120, 120, 120)';
    ctx.fill();

    // 5. Embossed Stars (Elevation = 0.94)
    this.drawBumpStar(ctx, cx, cy - 176, 14, 6);
    this.drawBumpStar(ctx, cx - 60, cy - 164, 10, 4.5);
    this.drawBumpStar(ctx, cx + 60, cy - 164, 10, 4.5);

    // 6. Embossed Bottom Text (Elevation = 0.90)
    this.drawCurvedBumpText(ctx, '★ RACING TOKEN ★', cx, cy, 185, Math.PI * 0.28, Math.PI * 0.72);

    // 7. Raised Flame Emblem & Letters in Bump Map
    const traceFlamePath = () => {
      ctx.beginPath();
      ctx.moveTo(cx - 150, cy + 5);
      ctx.bezierCurveTo(cx - 130, cy - 25, cx - 110, cy - 45, cx - 85, cy - 35);
      ctx.bezierCurveTo(cx - 70, cy - 30, cx - 60, cy - 50, cx - 40, cy - 60);
      ctx.bezierCurveTo(cx - 15, cy - 70, cx + 10, cy - 60, cx + 35, cy - 50);
      ctx.bezierCurveTo(cx + 65, cy - 75, cx + 105, cy - 80, cx + 135, cy - 60);
      ctx.bezierCurveTo(cx + 160, cy - 45, cx + 168, cy - 15, cx + 155, cy + 10);
      ctx.bezierCurveTo(cx + 140, cy + 38, cx + 105, cy + 58, cx + 65, cy + 60);
      ctx.bezierCurveTo(cx + 15, cy + 62, cx - 30, cy + 52, cx - 70, cy + 45);
      ctx.bezierCurveTo(cx - 110, cy + 38, cx - 135, cy + 25, cx - 150, cy + 5);
      ctx.closePath();
    };

    // Flame body raised to 185
    traceFlamePath();
    ctx.fillStyle = 'rgb(185, 185, 185)';
    ctx.fill();

    // Flame border raised to 220
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgb(220, 220, 220)';
    ctx.stroke();

    // "HOT WHEELS" Letters raised to 255 (Max relief)
    ctx.save();
    ctx.translate(cx + 8, cy + 2);
    ctx.transform(1, 0, -0.28, 1, 0, 0);

    ctx.font = '900 46px "Arial Black", "Impact", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgb(225, 225, 225)';
    ctx.lineJoin = 'round';
    ctx.strokeText('HOT WHEELS', 0, 0);

    ctx.fillStyle = 'rgb(255, 255, 255)';
    ctx.fillText('HOT WHEELS', 0, 0);

    ctx.restore();

    ctx.restore();
  }

  private drawBumpStar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    rOuter: number,
    rInner: number,
    points: number = 5
  ) {
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const angle = (i * Math.PI) / points - Math.PI / 2;
      const r = i % 2 === 0 ? rOuter : rInner;
      const px = x + Math.cos(angle) * r;
      const py = y + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgb(245, 245, 245)';
    ctx.fill();
    ctx.restore();
  }

  private drawCurvedBumpText(
    ctx: CanvasRenderingContext2D,
    text: string,
    cx: number,
    cy: number,
    radius: number,
    startAngle: number,
    endAngle: number
  ) {
    ctx.save();
    ctx.font = '900 18px "Arial Black", "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const angleStep = (endAngle - startAngle) / (text.length - 1);

    for (let i = 0; i < text.length; i++) {
      const angle = startAngle + i * angleStep;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle - Math.PI / 2);

      ctx.fillStyle = 'rgb(235, 235, 235)';
      ctx.fillText(text[i], 0, 0);

      ctx.restore();
    }
    ctx.restore();
  }

  private probeGround(x: number, z: number, fallbackY: number = 0.08, colliders?: THREE.Object3D[]): number {
    if (!colliders || colliders.length === 0) return fallbackY;
    this.probeOrigin.set(x, 25.0, z);
    this.probeRaycaster.set(this.probeOrigin, this.downVec);
    this.probeRaycaster.far = 45.0;
    const hits = this.probeRaycaster.intersectObjects(colliders, true);
    for (const h of hits) {
      if (h.face && h.point.y > -0.65) {
        return h.point.y;
      }
    }
    return fallbackY;
  }

  // -------------------------------------------------------------
  // Spawns 3D Spinning Hot Wheels Collectibles Along Track
  // -------------------------------------------------------------
  public initPickups(colliders: THREE.Object3D[]) {
    this.dispose();

    if (!this.sharedFaceMaterial) {
      this.initProceduralAssets();
    }

    // High-octane locations along circuit:
    // Location 0 is EXACTLY (2.95, 0.45, 12.17) from user screenshot
    const tokenLocations: Array<{ x?: number; z?: number; u?: number; lateralOffset?: number }> = [
      // 0: EXACT USER SPOT (facing jump ramp straightaway)
      { x: 2.95, z: 12.17 },

      // 1: Takeoff crest across ramp
      { x: 3.80, z: 10.80 },

      // 2: Western Mountain Pass entry
      { x: 8.80, z: 17.80 },

      // 3: Western Mountain Pass climb
      { x: 14.60, z: 23.80 },

      // 4: Caldera Rim Peak Apex
      { x: 23.50, z: 29.50 },

      // 5: East Pass descent straight
      { x: 28.50, z: 17.00 },

      // 6: Lower Dyke approach
      { x: 21.00, z: 5.50 },

      // 7: Dyke Entrance
      { x: 46.89, z: -6.54 },

      // 8: South Hairpin apex
      { x: 21.64, z: -28.44 },

      // 9: Canyon Switchback mid
      { x: 18.20, z: -8.50 },

      // 10: Mountain Pass chicane
      { x: -26.13, z: -18.70 },

      // 11: Outer West Sweeper Apex
      { x: -46.00, z: -9.84 },

      // 12: Final Straightaway sprint
      { x: -21.23, z: 6.25 },
    ];

    tokenLocations.forEach((loc, idx) => {
      let posX = loc.x !== undefined ? loc.x : 0;
      let posZ = loc.z !== undefined ? loc.z : 0;
      let fallbackY = 0.08;

      if (loc.u !== undefined) {
        const pt = this.trackSpline.getPointAt(loc.u);
        const tan = this.trackSpline.getTangentAt(loc.u).normalize();
        const norm = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
        posX = pt.x + norm.x * (loc.lateralOffset || 0);
        posZ = pt.z + norm.z * (loc.lateralOffset || 0);
        fallbackY = pt.y;
      }

      const groundY = this.probeGround(posX, posZ, fallbackY, colliders);

      const tokenGroup = new THREE.Group();
      // Lower hover height to 0.36m (perfect bumper/hood height)
      tokenGroup.position.set(posX, groundY + 0.36, posZ);

      // 1. Front Round Embossed Minted Coin Face (+Z)
      const frontFace = new THREE.Mesh(this.sharedFaceGeo!, this.sharedFaceMaterial!);
      frontFace.position.set(0, 0, 0.0215);
      tokenGroup.add(frontFace);

      // 2. Back Round Embossed Minted Coin Face (-Z)
      const backFace = new THREE.Mesh(this.sharedFaceGeo!, this.sharedFaceMaterial!);
      backFace.position.set(0, 0, -0.0215);
      backFace.rotation.y = Math.PI;
      tokenGroup.add(backFace);

      // 3. Polished Minted Gold Coin Rim / Edge Cylinder
      const edgeMesh = new THREE.Mesh(this.sharedEdgeGeo!, this.sharedEdgeMaterial!);
      tokenGroup.add(edgeMesh);

      // 4. Chamfered Gold Torus Rim Bevel
      const bevelMesh = new THREE.Mesh(this.sharedBevelGeo!, this.sharedBevelMaterial!);
      tokenGroup.add(bevelMesh);

      // 5. Fiery Neon Outer Halo Ring
      const outerRing = new THREE.Mesh(this.sharedRingGeo!, this.sharedRingMaterial!);
      tokenGroup.add(outerRing);

      // 6. Soft Radial Glow Halo Sprite
      const glowHalo = new THREE.Mesh(this.sharedHaloGeo!, this.sharedHaloMaterial!);
      tokenGroup.add(glowHalo);

      this.group.add(tokenGroup);

      this.pickups.push({
        id: `hotwheels_pickup_${idx}`,
        group: tokenGroup,
        frontFace,
        backFace,
        edgeMesh,
        bevelMesh,
        outerRing,
        glowHalo,
        basePosition: new THREE.Vector3(posX, groundY + 0.36, posZ),
        groundY,
        rotationSpeed: 3.2 + (idx % 3) * 0.4,
        bobPhase: idx * 0.75,
        active: true,
        cooldownTimer: 0,
        respawnScale: 1.0,
        collectAnimTimer: 0,
      });
    });
  }

  // -------------------------------------------------------------
  // Frame Update: Bobbing, 3D Spinning, and Vehicle Interaction
  // -------------------------------------------------------------
  public update(
    delta: number,
    playerVehicle: VehicleController,
    aiCars?: AICarController[],
    particleManager?: ParticleManager
  ) {
    const time = performance.now() * 0.003;
    const playerPos = playerVehicle.position;
    const store = useGameStore.getState();

    for (const token of this.pickups) {
      if (!token.active) {
        // Collect Pop Animation
        if (token.collectAnimTimer > 0) {
          token.collectAnimTimer -= delta * 4.5;
          const popProgress = 1.0 - Math.max(0, token.collectAnimTimer);
          const popScale = 1.0 + popProgress * 0.65;
          token.group.scale.set(popScale, popScale, popScale);
          if (token.collectAnimTimer <= 0) {
            token.group.visible = false;
          }
        }

        // Respawn cooldown (10 seconds or new lap)
        token.cooldownTimer -= delta;
        if (token.cooldownTimer <= 0) {
          token.active = true;
          token.respawnScale = 0.0;
          token.group.visible = true;
          token.collectAnimTimer = 0;
        }
        continue;
      }

      // Smooth Scale In on Respawn
      if (token.respawnScale < 1.0) {
        token.respawnScale = Math.min(1.0, token.respawnScale + delta * 3.5);
        token.group.scale.set(token.respawnScale, token.respawnScale, token.respawnScale);
      }

      // 1. Continuous 3D Spinning Animation (Y-axis)
      token.group.rotation.y += delta * token.rotationSpeed;

      // 2. Counter-rotating dynamic outer ring & halo
      token.outerRing.rotation.z += delta * 1.6;
      token.glowHalo.rotation.z -= delta * 0.8;

      // 3. Floating hover bob (Gentle sinusoidal vertical motion)
      token.group.position.y = token.groundY + 0.36 + Math.sin(time + token.bobPhase) * 0.06;

      // 4. Pulsing halo fire intensity
      const pulse = 0.55 + Math.sin(time * 3.0 + token.bobPhase) * 0.22;
      (token.glowHalo.material as THREE.MeshBasicMaterial).opacity = pulse;

      // 5. Collision Check with Player Vehicle (Radius: 2.1m)
      const dx = playerPos.x - token.group.position.x;
      const dy = playerPos.y - token.group.position.y;
      const dz = playerPos.z - token.group.position.z;
      const distSq = dx * dx + dy * dy * 0.6 + dz * dz;

      if (distSq < 4.2) {
        this.collectToken(token, particleManager, store);
        continue;
      }

      // 6. AI Car collection
      if (aiCars && aiCars.length > 0) {
        for (const ai of aiCars) {
          const aiDx = ai.position.x - token.group.position.x;
          const aiDz = ai.position.z - token.group.position.z;
          if (aiDx * aiDx + aiDz * aiDz < 3.8) {
            token.active = false;
            token.cooldownTimer = 8.0;
            token.collectAnimTimer = 1.0;
            if (particleManager) {
              particleManager.spawnHotWheelsCollectBurst(token.group.position);
            }
            soundEffects.playCoin();
            break;
          }
        }
      }
    }
  }

  // -------------------------------------------------------------
  // Token Collection Event: Sound, VFX, Stunts & Telemetry
  // -------------------------------------------------------------
  private collectToken(
    token: HotWheelsPickup,
    particleManager: ParticleManager | undefined,
    store: ReturnType<typeof useGameStore.getState>
  ) {
    token.active = false;
    token.cooldownTimer = 10.0;
    token.collectAnimTimer = 1.0;

    // 1. Shower of incandescent Hot Wheels flame sparks & smoke
    if (particleManager) {
      particleManager.spawnHotWheelsCollectBurst(token.group.position);
    }

    // 2. High-octane arcade synth coin chime & stunt sound
    soundEffects.playCoin();
    soundEffects.playStuntScore();

    // 3. Update game store telemetry & award driver XP
    const newCoins = store.coinsCollected + 1;
    store.updateTelemetry({ coinsCollected: newCoins });
    store.addDriverXp(250, newCoins, false);

    // 4. Trigger AAA Stunt Banner & Notification
    store.triggerStunt('HOT WHEELS COIN! 🔥', 250, 'boost');
    store.setNotification(`+1 HOT WHEELS COIN! (${newCoins}) 🔥`);
  }

  public resetAll() {
    for (const token of this.pickups) {
      token.active = true;
      token.cooldownTimer = 0;
      token.respawnScale = 1.0;
      token.collectAnimTimer = 0;
      token.group.visible = true;
      token.group.scale.set(1, 1, 1);
    }
  }

  public dispose() {
    for (const token of this.pickups) {
      this.group.remove(token.group);
    }
    this.pickups = [];
    while (this.group.children.length > 0) {
      this.group.remove(this.group.children[0]);
    }
  }
}
