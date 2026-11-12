import * as THREE from 'three';
import { CIRCUIT_WAYPOINTS } from './CompetitionManager';
import { ParticleManager } from './ParticleManager';
import { VehicleController } from './VehicleController';
import { AICarController } from './AICarController';
import { soundEffects } from '../audio/SoundEffects';
import { useGameStore } from '../store/useGameStore';

export interface NitroBottlePickup {
  id: string;
  mesh: THREE.Group;
  bodyMesh: THREE.Mesh;
  orbitalRing: THREE.Mesh;
  splineU: number;
  basePosition: THREE.Vector3;
  groundY: number;
  rotationSpeed: number;
  bobPhase: number;
  active: boolean;
  cooldownTimer: number;
  respawnScale: number;
}

export class NitroPickupManager {
  public group = new THREE.Group();
  private scene: THREE.Scene;
  private trackSpline: THREE.CatmullRomCurve3;
  private pickups: NitroBottlePickup[] = [];
  private probeRaycaster = new THREE.Raycaster();
  private downVec = new THREE.Vector3(0, -1, 0);
  private probeOrigin = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group.name = 'NitroPickupManager';
    this.trackSpline = new THREE.CatmullRomCurve3(CIRCUIT_WAYPOINTS, true, 'centripetal');
    this.scene.add(this.group);
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
  // Spawns 3D Asphalt Nitro Bottles at Strategic Racetrack Locations
  // -------------------------------------------------------------
  public initPickups(colliders: THREE.Object3D[]) {
    this.dispose();

    // 10 high-octane locations along track spline (straights, ramp approach, corner exits)
    const bottleLocations: { u: number; lateralOffset: number }[] = [
      { u: 0.020, lateralOffset: 0.0 },   // Straightaway approach to jump ramp
      { u: 0.062, lateralOffset: 0.0 },   // Right before jump ramp takeoff
      { u: 0.145, lateralOffset: 0.4 },   // Caldera rim climb straight
      { u: 0.255, lateralOffset: -0.3 },  // Dyke high-speed entrance
      { u: 0.305, lateralOffset: 0.0 },   // Mid-Dyke sprint straight
      { u: 0.435, lateralOffset: 0.0 },   // South Hairpin exit launch straight
      { u: 0.520, lateralOffset: 0.0 },   // Mountain pass chicane straight
      { u: 0.655, lateralOffset: -0.4 },  // Switchback canyon exit
      { u: 0.815, lateralOffset: 0.0 },   // Outer west high-speed sweeper
      { u: 0.935, lateralOffset: 0.0 },   // Final straightaway back to start line
    ];

    bottleLocations.forEach((loc, idx) => {
      const pt = this.trackSpline.getPointAt(loc.u);
      const tan = this.trackSpline.getTangentAt(loc.u).normalize();
      const norm = new THREE.Vector3(-tan.z, 0, tan.x).normalize();

      const posX = pt.x + norm.x * loc.lateralOffset;
      const posZ = pt.z + norm.z * loc.lateralOffset;
      const groundY = this.probeGround(posX, posZ, pt.y, colliders);

      const bottleGroup = new THREE.Group();
      bottleGroup.position.set(posX, groundY + 0.52, posZ);

      // 1. Central N2O Pressure Canister Body
      const bodyGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.52, 16);
      const bodyMat = new THREE.MeshStandardMaterial({
        color: 0x00d4ff,
        emissive: new THREE.Color(0x00a8ff),
        emissiveIntensity: 2.2,
        metalness: 0.85,
        roughness: 0.15,
      });
      const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
      bottleGroup.add(bodyMesh);

      // 2. Chrome Top Nozzle & Valve Cap
      const capMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        metalness: 0.95,
        roughness: 0.1,
      });
      const topCapGeo = new THREE.CylinderGeometry(0.12, 0.16, 0.10, 16);
      const topCap = new THREE.Mesh(topCapGeo, capMat);
      topCap.position.set(0, 0.30, 0);
      bottleGroup.add(topCap);

      const valveGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.12, 12);
      const valve = new THREE.Mesh(valveGeo, capMat);
      valve.position.set(0, 0.38, 0);
      bottleGroup.add(valve);

      // 3. Chrome Rounded Bottom Base
      const bottomCapGeo = new THREE.SphereGeometry(0.16, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
      const bottomCap = new THREE.Mesh(bottomCapGeo, capMat);
      bottomCap.position.set(0, -0.26, 0);
      bottomCap.rotation.x = Math.PI;
      bottleGroup.add(bottomCap);

      // 4. Spinning Oblique Orbital Energy Aura Ring (Asphalt Signature)
      const ringGeo = new THREE.TorusGeometry(0.32, 0.038, 12, 28);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.88,
      });
      const orbitalRing = new THREE.Mesh(ringGeo, ringMat);
      orbitalRing.rotation.x = Math.PI / 3;
      orbitalRing.rotation.y = Math.PI / 4;
      bottleGroup.add(orbitalRing);

      this.group.add(bottleGroup);

      this.pickups.push({
        id: `nitro-bottle-${idx}`,
        mesh: bottleGroup,
        bodyMesh,
        orbitalRing,
        splineU: loc.u,
        basePosition: new THREE.Vector3(posX, groundY, posZ),
        groundY,
        rotationSpeed: 3.2 + (idx % 3) * 0.4,
        bobPhase: idx * 0.75,
        active: true,
        cooldownTimer: 0,
        respawnScale: 1.0,
      });
    });
  }

  // -------------------------------------------------------------
  // Frame Update: Bobbing, Rotation, Collision Detection & Surges
  // -------------------------------------------------------------
  public update(
    delta: number,
    playerVehicle: VehicleController,
    aiCars: AICarController[],
    particleManager: ParticleManager
  ) {
    const time = performance.now() * 0.003;
    const playerPos = playerVehicle.position;

    for (const bottle of this.pickups) {
      if (!bottle.active) {
        // Cooldown timer management & smooth respawn pop
        bottle.cooldownTimer -= delta;
        if (bottle.cooldownTimer <= 0) {
          bottle.active = true;
          bottle.mesh.visible = true;
          bottle.respawnScale = 0.1;
        }
        continue;
      }

      // Smooth respawn scale pop
      if (bottle.respawnScale < 1.0) {
        bottle.respawnScale = Math.min(1.0, bottle.respawnScale + delta * 4.0);
        bottle.mesh.scale.set(bottle.respawnScale, bottle.respawnScale, bottle.respawnScale);
      }

      // 1. 3D Animations: Rotation, Oblique Orbit Ring & Floating Bob
      bottle.mesh.rotation.y += delta * bottle.rotationSpeed;
      bottle.orbitalRing.rotation.x += delta * 4.2;
      bottle.orbitalRing.rotation.z += delta * 3.4;

      const floatY = bottle.groundY + 0.52 + Math.sin(time * 3.6 + bottle.bobPhase) * 0.09;
      bottle.mesh.position.y = floatY;

      // Pulse emissive intensity
      const pulse = 2.0 + Math.sin(time * 6.0 + bottle.bobPhase) * 0.7;
      (bottle.bodyMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = pulse;

      // 2. Player Nitro Pickup Detection
      const dx = playerPos.x - bottle.mesh.position.x;
      const dz = playerPos.z - bottle.mesh.position.z;
      const distSq = dx * dx + dz * dz;
      const collectDist = 2.3;

      if (distSq < collectDist * collectDist) {
        this.collectBottle(bottle, playerVehicle, particleManager);
        continue;
      }

      // 3. AI Competitor Nitro Pickup Detection
      for (const ai of aiCars) {
        const adx = ai.position.x - bottle.mesh.position.x;
        const adz = ai.position.z - bottle.mesh.position.z;
        if (adx * adx + adz * adz < collectDist * collectDist) {
          bottle.active = false;
          bottle.mesh.visible = false;
          bottle.cooldownTimer = 7.5;
          ai.activateBoost(2.8, 22);
          particleManager.spawnNitroCollectFlash(bottle.mesh.position);
          soundEffects.playBoost();
          break;
        }
      }
    }
  }

  // -------------------------------------------------------------
  // Player Takes Nitro -> Asphalt Rocket Surge ("car go fast")
  // -------------------------------------------------------------
  private collectBottle(bottle: NitroBottlePickup, playerVehicle: VehicleController, particleManager: ParticleManager) {
    bottle.active = false;
    bottle.mesh.visible = false;
    bottle.cooldownTimer = 7.0; // Respawns smoothly after 7 seconds for the next lap!

    // 1. Instant Nitro Gauge Refill (+45%)
    playerVehicle.addNitro(45);

    // 2. Explosive Audio
    soundEffects.playNitroPickup();
    soundEffects.playBoost();

    // 3. Visual Particles: Cyan & Yellow Expanding Starburst Flash
    particleManager.spawnNitroCollectFlash(bottle.mesh.position);

    // 4. UI Toast
    useGameStore.getState().setNotification('⚡ ASPHALT NITRO SURGE! 248 KM/H 🔥');
  }

  public resetAll() {
    for (const bottle of this.pickups) {
      bottle.active = true;
      bottle.mesh.visible = true;
      bottle.cooldownTimer = 0;
      bottle.respawnScale = 1.0;
      bottle.mesh.scale.set(1, 1, 1);
    }
  }

  public dispose() {
    while (this.group.children.length > 0) {
      const child = this.group.children[0];
      this.group.remove(child);
    }
    this.pickups = [];
  }
}
