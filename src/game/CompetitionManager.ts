import * as THREE from 'three';
import { AICarController, AICarConfig } from './AICarController';
import { ParticleManager } from './ParticleManager';
import { VehicleController } from './VehicleController';
import { soundEffects } from '../audio/SoundEffects';
import { useGameStore } from '../store/useGameStore';

// Exact 69-Waypoint Centerline extracted directly from the Volcano track geometry
// 100% on-road, continuous, non-branching, non-self-intersecting closed loop.
export const CIRCUIT_WAYPOINTS = [
  // Segment 0: Start Line straight across jump ramp to Western road entry
  new THREE.Vector3(-7.26, 0.08, 10.61), // 0: Start / Finish Line
  new THREE.Vector3(-3.50, 0.08, 10.20), // 1: Straightaway
  new THREE.Vector3(0.57, 0.08, 9.80),   // 2: Platform ramp approach (centered)
  new THREE.Vector3(3.80, 0.15, 10.80),  // 3: Platform takeoff / crest
  new THREE.Vector3(5.50, 0.08, 12.00),  // 4: Straightaway transition

  // Segment 1: Pure Western Mountain Sweep (NO LAVA SHORTCUT, follows outer road around volcano cone!)
  new THREE.Vector3(6.50, 0.08, 14.20),  // 5: Western road approach
  new THREE.Vector3(7.40, 0.08, 16.00),  // 6: Western sweeper entry
  new THREE.Vector3(8.80, 0.08, 17.80),  // 7: CP 1 (Western Mountain Pass entry)
  new THREE.Vector3(10.50, 0.08, 19.60), // 8: Western curve
  new THREE.Vector3(12.60, 0.08, 21.60), // 9: Western climb
  new THREE.Vector3(14.60, 0.08, 23.80), // 10: Western bank
  new THREE.Vector3(16.50, 0.08, 25.80), // 11: Rim approach
  new THREE.Vector3(19.50, 0.08, 27.60), // 12: Rim turn entry
  new THREE.Vector3(23.50, 0.10, 29.50), // 13: CP 2 (Caldera rim peak apex)

  // Segment 2: Pure East Road descent and dyke traverse to CP 3
  new THREE.Vector3(28.00, 0.08, 26.50), // 14: Rim descent entry
  new THREE.Vector3(29.20, 0.08, 22.00), // 15: East straight
  new THREE.Vector3(28.50, 0.08, 17.00), // 16: East descent lane
  new THREE.Vector3(27.00, 0.08, 14.50), // 17: East lane curve
  new THREE.Vector3(26.00, 0.08, 13.00), // 18: East sweep
  new THREE.Vector3(24.00, 0.08, 11.50), // 19: Dyke entry transition
  new THREE.Vector3(20.50, 0.08, 10.50), // 20: Lower dyke approach
  new THREE.Vector3(17.50, 0.08, 9.50),  // 21: Lower dyke sweep
  new THREE.Vector3(14.80, 0.08, 7.50),  // 22: Lower dyke apex
  new THREE.Vector3(16.50, 0.08, 5.50),  // 23: Lower dyke sweep
  new THREE.Vector3(21.00, 0.08, 5.50),  // 24: Lower dyke rise
  new THREE.Vector3(26.00, 0.08, 5.50),  // 25: Lower dyke sweep
  new THREE.Vector3(31.50, 0.08, 5.50),  // 26: Lower dyke sprint
  new THREE.Vector3(36.50, 0.08, 2.50),  // 27: Dyke straight
  new THREE.Vector3(41.00, 0.08, -0.50), // 28: Dyke transition
  new THREE.Vector3(44.50, 0.08, -3.00), // 29: Dyke straight
  new THREE.Vector3(46.89, 0.10, -6.54), // 30: CP 3 (Dyke entrance)

  // Segment 3: Dyke sweep and approach to outer southern hairpin CP 4
  new THREE.Vector3(47.32, 0.08, -10.69), // 31: Dyke curve
  new THREE.Vector3(45.83, 0.08, -13.96), // 32: Sweeper
  new THREE.Vector3(39.79, 0.08, -18.06), // 33: South curve
  new THREE.Vector3(33.40, 0.08, -20.60), // 34: Hairpin entry
  new THREE.Vector3(26.04, 0.08, -24.22), // 35: Hairpin approach
  new THREE.Vector3(21.64, 0.10, -28.44), // 36: CP 4 (Outer south hairpin)

  // Segment 4: Mountain pass chicane leading to CP 5
  new THREE.Vector3(16.20, 0.08, -27.36), // 37: Hairpin exit
  new THREE.Vector3(14.00, 0.08, -23.28), // 38: Chicane entry
  new THREE.Vector3(14.50, 0.08, -16.97), // 39: S-curve 1
  new THREE.Vector3(18.50, 0.08, -14.03), // 40: S-curve 2
  new THREE.Vector3(18.20, 0.08, -8.50),  // 41: S-curve apex
  new THREE.Vector3(15.00, 0.08, -4.50),  // 42: Pass bend
  new THREE.Vector3(10.87, 0.08, -4.98),  // 43: Tunnel pass
  new THREE.Vector3(7.24, 0.08, -9.15),   // 44: Mid pass
  new THREE.Vector3(1.91, 0.08, -11.05),  // 45: Pass curve
  new THREE.Vector3(-3.16, 0.08, -12.26), // 46: West pass
  new THREE.Vector3(-6.49, 0.08, -10.35), // 47: Mountain turn
  new THREE.Vector3(-8.50, 0.08, -5.50),  // 48: Pass approach
  new THREE.Vector3(-10.97, 0.08, -1.40), // 49: Switchback entry
  new THREE.Vector3(-13.00, 0.08, 0.50),  // 50: Canyon turn
  new THREE.Vector3(-17.00, 0.08, -3.50), // 51: Canyon midpoint
  new THREE.Vector3(-20.50, 0.08, -8.50), // 52: Canyon descent
  new THREE.Vector3(-21.00, 0.08, -12.00),// 53: Canyon exit
  new THREE.Vector3(-21.50, 0.08, -15.00),// 54: Pass approach
  new THREE.Vector3(-25.20, 0.08, -18.50),// 55: Pass apex
  new THREE.Vector3(-26.13, 0.10, -18.70),// 56: CP 5 (Mountain pass)

  // Segment 5: Western sweeping loop to CP 6
  new THREE.Vector3(-28.03, 0.08, -21.63), // 57: Mountain pass exit
  new THREE.Vector3(-33.83, 0.08, -20.99), // 58: West turn
  new THREE.Vector3(-39.08, 0.08, -18.57), // 59: Outer west curve
  new THREE.Vector3(-42.00, 0.08, -15.00), // 60: Sweeper entry
  new THREE.Vector3(-46.00, 0.08, -9.84),  // 61: West apex
  new THREE.Vector3(-46.50, 0.08, -3.50),  // 62: West bank
  new THREE.Vector3(-46.00, 0.08, 1.34),   // 63: Straight approach
  new THREE.Vector3(-42.80, 0.10, 5.80),   // 64: CP 6 (Final straight entrance)

  // Segment 6: Final straightaway back to Start Line
  new THREE.Vector3(-36.52, 0.08, 5.63),  // 65: Straight 1
  new THREE.Vector3(-31.36, 0.08, 4.00),  // 66: Straight 2
  new THREE.Vector3(-26.00, 0.08, 4.50),  // 67: Straight 3
  new THREE.Vector3(-21.23, 0.08, 6.25),  // 68: Straight 4
  new THREE.Vector3(-17.00, 0.08, 9.25),  // 69: Pre-grid bend
  new THREE.Vector3(-12.00, 0.08, 11.00), // 70: Grid approach
];

// Reversed 69-Waypoint Centerline for Reverse Track Circuit
export const CIRCUIT_WAYPOINTS_REVERSE: THREE.Vector3[] = [
  CIRCUIT_WAYPOINTS[0],
  ...CIRCUIT_WAYPOINTS.slice(1).reverse(),
];

export interface CompetitorEntry {
  id: string;
  name: string;
  position: number;
  progress: number;
  lap: number;
  isPlayer: boolean;
  colorHex: string;
}

export class CompetitionManager {
  private scene: THREE.Scene;
  private particleManager: ParticleManager;
  public trackDirection: 'normal' | 'reverse' = 'reverse';
  public trackSplineNormal: THREE.CatmullRomCurve3;
  public trackSplineReverse: THREE.CatmullRomCurve3;
  public trackSpline: THREE.CatmullRomCurve3;
  public aiCars: AICarController[] = [];
  public playerVehicle: VehicleController;
  private lastPlayerU: number = 0;
  private hasInitialPlayerU: boolean = false;
  private lastReportedRank: number = -1;

  // AI Competitor configurations
  private configs: AICarConfig[] = [
    {
      id: 'ai-viper',
      name: 'Viper',
      modelType: 'iridium',
      colorHex: 0x00d4ff, // Electric Cyan
      laneOffset: 0.65,
      skillMultiplier: 1.02,
      gridSlot: 1,
    },
    {
      id: 'ai-ignis',
      name: 'Ignis',
      modelType: 'rd09',
      colorHex: 0xff5500, // Inferno Orange
      laneOffset: -0.65,
      skillMultiplier: 0.98,
      gridSlot: 2,
    },
    {
      id: 'ai-shadow',
      name: 'Shadow',
      modelType: 'mazda',
      colorHex: 0x8800ff, // Midnight Violet
      laneOffset: 0.20,
      skillMultiplier: 0.94,
      gridSlot: 3,
    },
  ];

  constructor(scene: THREE.Scene, particleManager: ParticleManager, playerVehicle: VehicleController) {
    this.scene = scene;
    this.particleManager = particleManager;
    this.playerVehicle = playerVehicle;

    // Build smooth closed racing line splines for both directions
    this.trackSplineNormal = new THREE.CatmullRomCurve3(CIRCUIT_WAYPOINTS, true, 'centripetal');
    this.trackSplineReverse = new THREE.CatmullRomCurve3(CIRCUIT_WAYPOINTS_REVERSE, true, 'centripetal');
    this.trackSpline = this.trackSplineReverse;

    // Instantiate AI competitor controllers
    for (const cfg of this.configs) {
      const car = new AICarController(this.scene, this.particleManager, this.trackSpline, cfg);
      this.aiCars.push(car);
    }
  }

  setTrackDirection(dir: 'normal' | 'reverse') {
    this.trackDirection = dir;
    this.trackSpline = dir === 'reverse' ? this.trackSplineReverse : this.trackSplineNormal;
    for (const car of this.aiCars) {
      car.setTrackSpline(this.trackSpline);
    }
    this.resetGrid(dir);
  }

  async loadCompetitors(onProgress?: (loaded: number, total: number) => void): Promise<void> {
    let completed = 0;
    const total = this.aiCars.length;

    await Promise.all(
      this.aiCars.map(async (car) => {
        await car.loadModel();
        completed++;
        if (onProgress) {
          onProgress(completed, total);
        }
      })
    );

    this.resetGrid();
  }

  setCarScale(scale: number) {
    for (const car of this.aiCars) {
      car.setCarScale(scale);
    }
  }

  resetGrid(direction: 'normal' | 'reverse' = this.trackDirection) {
    this.hasInitialPlayerU = false;
    for (const car of this.aiCars) {
      car.setSpawn(car.config.gridSlot, direction);
    }
  }

  private getPlayerProgressU(): number {
    const playerPos = this.playerVehicle.position;
    let bestU = this.lastPlayerU;
    let minDist = Infinity;

    // Fast localized search window around previous frame's progress for 60 FPS performance
    if (this.hasInitialPlayerU) {
      // Vehicle travels forward along spline, allow small reverse window and forward window
      for (let du = -0.025; du <= 0.045; du += 0.005) {
        const u = (this.lastPlayerU + du + 1.0) % 1.0;
        const pt = this.trackSpline.getPointAt(u);
        const d = pt.distanceTo(playerPos);
        if (d < minDist) {
          minDist = d;
          bestU = u;
        }
      }

      // If within normal track boundaries, refine locally
      if (minDist < 10.0) {
        for (let du = -0.004; du <= 0.004; du += 0.001) {
          const testU = (bestU + du + 1.0) % 1.0;
          const pt = this.trackSpline.getPointAt(testU);
          const d = pt.distanceTo(playerPos);
          if (d < minDist) {
            minDist = d;
            bestU = testU;
          }
        }
        this.lastPlayerU = bestU;
        return bestU;
      }
    }

    // Coarse global search fallback (first frame or after respawn/teleport)
    minDist = Infinity;
    const coarseSamples = 80;
    for (let i = 0; i < coarseSamples; i++) {
      const u = i / coarseSamples;
      const pt = this.trackSpline.getPointAt(u);
      const d = pt.distanceTo(playerPos);
      if (d < minDist) {
        minDist = d;
        bestU = u;
      }
    }

    // Fine local search for sub-meter progress precision
    for (let du = -0.015; du <= 0.015; du += 0.002) {
      const testU = (bestU + du + 1.0) % 1.0;
      const pt = this.trackSpline.getPointAt(testU);
      const d = pt.distanceTo(playerPos);
      if (d < minDist) {
        minDist = d;
        bestU = testU;
      }
    }

    this.lastPlayerU = bestU;
    this.hasInitialPlayerU = true;
    return bestU;
  }

  update(
    delta: number,
    colliders: THREE.Object3D[],
    playerLap: number,
    onPlayerCollision?: (impactIntensity: number, contactPos: THREE.Vector3) => void
  ): { playerRank: number; leaderboard: CompetitorEntry[] } {
    // 1. Compute Live Player Progress along circuit
    const playerProgressU = this.getPlayerProgressU();
    const playerTotalProgress = playerLap + playerProgressU;

    // 2. Update AI Cars with player progress context
    for (const car of this.aiCars) {
      car.update(delta, colliders, this.playerVehicle.position, playerTotalProgress);
    }

    // 3. High-Impact Forza Horizon Multi-Car Physical Collision Engine (Active only during race)
    const gState = useGameStore.getState().gameState;
    if (gState === 'racing') {
      this.resolveCarCollisions(onPlayerCollision);
    }

    // 4. Compute Live Race Standings
    const entries: CompetitorEntry[] = [
      {
        id: 'player',
        name: 'Player',
        position: 1,
        progress: playerTotalProgress,
        lap: playerLap,
        isPlayer: true,
        colorHex: '#ffffff',
      },
      ...this.aiCars.map((car) => ({
        id: car.id,
        name: car.name,
        position: 1,
        progress: car.totalProgress,
        lap: car.currentLap,
        isPlayer: false,
        colorHex: '#' + car.config.colorHex.toString(16).padStart(6, '0'),
      })),
    ];

    // Sort descending by total race progress
    entries.sort((a, b) => b.progress - a.progress);

    // Assign positions 1st, 2nd, 3rd, 4th
    let playerRank = 1;
    entries.forEach((entry, idx) => {
      entry.position = idx + 1;
      if (entry.isPlayer) {
        playerRank = entry.position;
      }
    });

    // Detect Overtake Stunt (Active only during race)
    if (gState === 'racing' && this.lastReportedRank !== -1 && playerRank < this.lastReportedRank) {
      const store = useGameStore.getState();
      const overtakerPos = entries.find((e) => e.position === playerRank + 1);
      const targetName = overtakerPos ? overtakerPos.name.toUpperCase() : 'RIVAL';
      store.triggerStunt(`PASSED ${targetName}! 🏆`, 150, 'overtake');
      soundEffects.playStuntScore();
    }

    // Update telemetry in Game Store ONLY when rank actually changes
    if (playerRank !== this.lastReportedRank) {
      this.lastReportedRank = playerRank;
      useGameStore.getState().updateTelemetry({
        racePosition: playerRank,
        totalRacers: entries.length,
      });
    }

    // Export real-time positions for AAA Minimap Radar & Leaderboard
    const fullLeaderboard = entries.map((entry) => {
      let x = 0;
      let z = 0;
      if (entry.isPlayer) {
        x = this.playerVehicle.position.x;
        z = this.playerVehicle.position.z;
      } else {
        const ai = this.aiCars.find((c) => c.id === entry.id);
        if (ai) {
          x = ai.position.x;
          z = ai.position.z;
        }
      }
      return {
        ...entry,
        x,
        z,
      };
    });
    useGameStore.getState().updateLeaderboard(fullLeaderboard);

    return { playerRank, leaderboard: entries };
  }

  private resolveCarCollisions(onPlayerCollision?: (intensity: number, contactPos: THREE.Vector3) => void) {
    interface VehicleCollider {
      position: THREE.Vector3;
      forwardVec: THREE.Vector3;
      velocity: THREE.Vector3;
      carScale: number;
      isPlayer: boolean;
      applyCollisionImpulse: (impulse: THREE.Vector3, impactPoint: THREE.Vector3) => void;
    }

    const allVehicles: VehicleCollider[] = [
      {
        position: this.playerVehicle.position,
        forwardVec: this.playerVehicle.forwardVec,
        velocity: this.playerVehicle.velocity,
        carScale: this.playerVehicle.carScale,
        isPlayer: true,
        applyCollisionImpulse: (imp, pt) => this.playerVehicle.applyCollisionImpulse(imp, pt),
      },
      ...this.aiCars.map((car) => ({
        position: car.position,
        forwardVec: car.forwardVec,
        velocity: car.velocity,
        carScale: car.carScale,
        isPlayer: false,
        applyCollisionImpulse: (imp: THREE.Vector3, pt: THREE.Vector3) => car.applyCollisionImpulse(imp, pt),
      })),
    ];

    for (let i = 0; i < allVehicles.length; i++) {
      for (let j = i + 1; j < allVehicles.length; j++) {
        const vA = allVehicles[i];
        const vB = allVehicles[j];

        // Fast broad-phase bounding distance
        const centerDist = Math.hypot(vA.position.x - vB.position.x, vA.position.z - vB.position.z);
        const maxCheckDist = (vA.carScale + vB.carScale) * 2.8;
        if (centerDist > maxCheckDist) continue;

        // Two-sphere capsule layout for each vehicle (Front axle and Rear axle)
        const dAxleA = 1.15 * vA.carScale;
        const dAxleB = 1.15 * vB.carScale;
        const rSphereA = 1.05 * vA.carScale;
        const rSphereB = 1.05 * vB.carScale;
        const collisionRadius = rSphereA + rSphereB;

        const spheresA = [
          new THREE.Vector3().copy(vA.position).addScaledVector(vA.forwardVec, dAxleA),
          new THREE.Vector3().copy(vA.position).addScaledVector(vA.forwardVec, -dAxleA),
        ];

        const spheresB = [
          new THREE.Vector3().copy(vB.position).addScaledVector(vB.forwardVec, dAxleB),
          new THREE.Vector3().copy(vB.position).addScaledVector(vB.forwardVec, -dAxleB),
        ];

        let minSphereDist = Infinity;
        let bestPair: { sA: THREE.Vector3; sB: THREE.Vector3 } | null = null;

        for (const sA of spheresA) {
          for (const sB of spheresB) {
            const d = Math.hypot(sA.x - sB.x, sA.z - sB.z);
            if (d < minSphereDist) {
              minSphereDist = d;
              bestPair = { sA, sB };
            }
          }
        }

        if (bestPair && minSphereDist < collisionRadius && minSphereDist > 0.0001) {
          const penetration = collisionRadius - minSphereDist;

          // Normal points from B to A in XZ plane
          const nx = (bestPair.sA.x - bestPair.sB.x) / minSphereDist;
          const nz = (bestPair.sA.z - bestPair.sB.z) / minSphereDist;
          const normVec = new THREE.Vector3(nx, 0, nz);

          // Contact position
          const contactPos = new THREE.Vector3(
            (bestPair.sA.x + bestPair.sB.x) * 0.5,
            Math.max(vA.position.y, vB.position.y) + 0.06,
            (bestPair.sA.z + bestPair.sB.z) * 0.5
          );

          // 1. Physical Depenetration (push away along normal)
          const push = penetration * 0.55;
          vA.position.x += nx * push;
          vA.position.z += nz * push;
          vB.position.x -= nx * push;
          vB.position.z -= nz * push;

          // 2. Relative Velocity & Impulse
          const relVelX = vA.velocity.x - vB.velocity.x;
          const relVelZ = vA.velocity.z - vB.velocity.z;
          const normalVel = relVelX * nx + relVelZ * nz;

          // Penetration approach velocity gives solid separation kick even at rubbing speeds
          const approachSpeed = Math.max(0.65, -normalVel + penetration * 18.0);
          const impactIntensity = THREE.MathUtils.clamp(approachSpeed / 10.0, 0.25, 1.0);

          // Forza Horizon restitution (e = 0.52 gives punchy kinetic bounce)
          const restitution = 0.52;
          const impulseMag = Math.min(8.5, (1.0 + restitution) * approachSpeed * 0.55);

          const normalImpulse = new THREE.Vector3(nx * impulseMag, 0, nz * impulseMag);

          // 3. Tangential Friction Impulse (reduces car gluing / sliding along hulls)
          const tangVelX = relVelX - normalVel * nx;
          const tangVelZ = relVelZ - normalVel * nz;
          const tangImpulse = new THREE.Vector3(tangVelX * 0.25, 0, tangVelZ * 0.25);

          // Apply impulses to both vehicles
          const impulseOnA = new THREE.Vector3().add(normalImpulse).sub(tangImpulse);
          const impulseOnB = new THREE.Vector3().sub(normalImpulse).add(tangImpulse);

          vA.applyCollisionImpulse(impulseOnA, contactPos);
          vB.applyCollisionImpulse(impulseOnB, contactPos);

          // 4. VFX: Explosive Shower of Incandescent Sparks & Smoke
          this.particleManager.spawnCollisionSparks(contactPos, normVec, impactIntensity);

          // 5. Audio: Heavy Metal Collision Thud & Scrape
          soundEffects.playCollision(impactIntensity);

          // 6. Camera Trauma & Vibration
          if ((vA.isPlayer || vB.isPlayer) && onPlayerCollision) {
            onPlayerCollision(impactIntensity, contactPos);
          }
        }
      }
    }
  }

  dispose() {
    for (const car of this.aiCars) {
      car.dispose();
    }
    this.aiCars = [];
  }
}
