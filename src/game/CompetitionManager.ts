import * as THREE from 'three';
import { AICarController, AICarConfig } from './AICarController';
import { ParticleManager } from './ParticleManager';
import { VehicleController } from './VehicleController';
import { soundEffects } from '../audio/SoundEffects';
import { useGameStore } from '../store/useGameStore';

// Exact 110-Waypoint Centerline extracted directly from the Volcano track geometry
// 100% centered on drivable asphalt (minHalfWidth >= 1.30m), continuous, non-self-intersecting closed loop.
export const CIRCUIT_WAYPOINTS = [
  new THREE.Vector3(-7.26, -0.34, 10.61), // 0: Start / Finish Line
  new THREE.Vector3(-4.38, -0.34, 10.27), // 1
  new THREE.Vector3(-1.50, -0.34, 10.22), // 2
  new THREE.Vector3(1.33, -0.34, 10.24), // 3
  new THREE.Vector3(3.83, -0.32, 11.39), // 4
  new THREE.Vector3(5.63, -0.34, 13.52), // 5
  new THREE.Vector3(7.36, -0.34, 15.76), // 6
  new THREE.Vector3(9.26, -0.34, 17.91), // 7
  new THREE.Vector3(11.20, -0.33, 20.07), // 8
  new THREE.Vector3(13.12, -0.34, 22.27), // 9
  new THREE.Vector3(15.14, -0.34, 24.38), // 10
  new THREE.Vector3(17.15, -0.33, 26.47), // 11
  new THREE.Vector3(19.60, -0.34, 27.90), // 12
  new THREE.Vector3(22.22, -0.34, 28.62), // 13
  new THREE.Vector3(24.75, -0.34, 27.95), // 14
  new THREE.Vector3(26.96, -0.34, 26.54), // 15
  new THREE.Vector3(28.55, -0.34, 24.40), // 16
  new THREE.Vector3(29.06, -0.34, 21.70), // 17
  new THREE.Vector3(28.55, -0.34, 18.98), // 18
  new THREE.Vector3(27.28, -0.34, 16.57), // 19
  new THREE.Vector3(25.40, -0.34, 14.71), // 20
  new THREE.Vector3(23.19, -0.33, 13.29), // 21
  new THREE.Vector3(20.54, -0.34, 12.28), // 22
  new THREE.Vector3(17.38, -0.34, 11.35), // 23
  new THREE.Vector3(14.10, -0.34, 9.54), // 24
  new THREE.Vector3(13.32, -0.34, 5.69), // 25
  new THREE.Vector3(16.55, -0.34, 3.44), // 26
  new THREE.Vector3(20.26, -0.34, 4.26), // 27
  new THREE.Vector3(23.51, -0.34, 5.19), // 28
  new THREE.Vector3(26.54, -0.34, 5.99), // 29
  new THREE.Vector3(29.55, -0.34, 6.25), // 30
  new THREE.Vector3(32.29, -0.34, 5.04), // 31
  new THREE.Vector3(34.12, -0.34, 2.55), // 32
  new THREE.Vector3(36.22, -0.34, 0.31), // 33
  new THREE.Vector3(39.33, -0.34, -0.09), // 34
  new THREE.Vector3(42.35, -0.34, -0.74), // 35
  new THREE.Vector3(44.64, -0.34, -2.71), // 36
  new THREE.Vector3(46.28, -0.34, -5.20), // 37
  new THREE.Vector3(47.29, -0.34, -7.98), // 38
  new THREE.Vector3(47.27, -0.34, -10.89), // 39
  new THREE.Vector3(46.09, -0.34, -13.56), // 40
  new THREE.Vector3(44.13, -0.34, -15.72), // 41
  new THREE.Vector3(41.68, -0.34, -17.35), // 42
  new THREE.Vector3(38.94, -0.27, -18.43), // 43
  new THREE.Vector3(36.13, -0.34, -19.28), // 44
  new THREE.Vector3(33.30, -0.34, -20.09), // 45
  new THREE.Vector3(30.52, -0.34, -21.12), // 46
  new THREE.Vector3(27.97, -0.34, -22.63), // 47
  new THREE.Vector3(25.77, -0.34, -24.62), // 48
  new THREE.Vector3(23.99, -0.34, -27.03), // 49
  new THREE.Vector3(21.48, -0.34, -28.53), // 50
  new THREE.Vector3(18.55, -0.34, -28.45), // 51
  new THREE.Vector3(15.92, -0.34, -27.10), // 52
  new THREE.Vector3(14.06, -0.34, -24.81), // 53
  new THREE.Vector3(13.51, -0.34, -21.99), // 54
  new THREE.Vector3(14.80, -0.34, -19.48), // 55
  new THREE.Vector3(16.64, -0.34, -17.35), // 56
  new THREE.Vector3(18.57, -0.34, -15.17), // 57
  new THREE.Vector3(19.76, -0.34, -12.34), // 58
  new THREE.Vector3(19.69, -0.34, -9.18), // 59
  new THREE.Vector3(17.99, -0.33, -6.56), // 60
  new THREE.Vector3(15.30, -0.34, -5.17), // 61
  new THREE.Vector3(12.42, -0.34, -4.73), // 62
  new THREE.Vector3(9.67, -0.34, -5.46), // 63
  new THREE.Vector3(7.23, -0.33, -6.87), // 64
  new THREE.Vector3(4.93, -0.34, -8.47), // 65
  new THREE.Vector3(2.74, -0.34, -10.34), // 66
  new THREE.Vector3(0.31, -0.34, -12.12), // 67
  new THREE.Vector3(-2.69, -0.34, -12.78), // 68
  new THREE.Vector3(-5.71, -0.34, -11.90), // 69
  new THREE.Vector3(-7.72, -0.34, -9.45), // 70
  new THREE.Vector3(-7.59, -0.34, -6.11), // 71
  new THREE.Vector3(-7.52, -0.34, -2.78), // 72
  new THREE.Vector3(-9.67, -0.34, -0.52), // 73
  new THREE.Vector3(-12.66, -0.34, -0.54), // 74
  new THREE.Vector3(-15.24, -0.34, -1.79), // 75
  new THREE.Vector3(-17.43, -0.33, -3.58), // 76
  new THREE.Vector3(-19.06, -0.33, -5.94), // 77
  new THREE.Vector3(-20.01, -0.33, -8.69), // 78
  new THREE.Vector3(-20.50, -0.33, -11.62), // 79
  new THREE.Vector3(-20.74, -0.33, -14.68), // 80
  new THREE.Vector3(-21.61, -0.33, -17.65), // 81
  new THREE.Vector3(-23.90, -0.33, -19.62), // 82
  new THREE.Vector3(-26.69, -0.33, -20.46), // 83
  new THREE.Vector3(-29.44, -0.33, -20.64), // 84
  new THREE.Vector3(-32.10, -0.33, -20.31), // 85
  new THREE.Vector3(-34.69, -0.33, -19.61), // 86
  new THREE.Vector3(-37.20, -0.33, -18.57), // 87
  new THREE.Vector3(-39.50, -0.33, -17.05), // 88
  new THREE.Vector3(-41.57, -0.33, -15.12), // 89
  new THREE.Vector3(-43.50, -0.33, -12.99), // 90
  new THREE.Vector3(-45.28, -0.33, -10.68), // 91
  new THREE.Vector3(-46.65, -0.33, -8.07), // 92
  new THREE.Vector3(-47.32, -0.33, -5.18), // 93
  new THREE.Vector3(-47.25, -0.33, -2.22), // 94
  new THREE.Vector3(-46.19, -0.33, 0.44), // 95
  new THREE.Vector3(-44.35, -0.33, 2.46), // 96
  new THREE.Vector3(-42.36, -0.33, 4.11), // 97
  new THREE.Vector3(-40.04, -0.33, 5.14), // 98
  new THREE.Vector3(-37.40, -0.33, 5.22), // 99
  new THREE.Vector3(-34.71, -0.33, 4.37), // 100
  new THREE.Vector3(-31.91, -0.33, 3.45), // 101
  new THREE.Vector3(-28.93, -0.33, 3.23), // 102
  new THREE.Vector3(-26.02, -0.33, 4.00), // 103
  new THREE.Vector3(-23.28, -0.33, 5.19), // 104
  new THREE.Vector3(-20.93, -0.33, 7.01), // 105
  new THREE.Vector3(-18.61, -0.33, 8.84), // 106
  new THREE.Vector3(-15.97, -0.33, 10.16), // 107
  new THREE.Vector3(-13.11, -0.33, 10.83), // 108
  new THREE.Vector3(-10.17, -0.33, 10.86), // 109
];

// Reversed 110-Waypoint Centerline for Reverse Track Circuit
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
  public finishedRacers: { id: string; name: string; position: number; finishTime: number }[] = [];
  public playerFinished: boolean = false;
  public playerFinishRank: number | null = null;
  private playerHasPassedMidpoint: boolean = false;
  public raceActiveTime = 0;
  private lastCollisionSoundTime = 0;

  // Zero-allocation scratch vectors
  private scratchPlayerPt = new THREE.Vector3();
  private scratchSphereA0 = new THREE.Vector3();
  private scratchSphereA1 = new THREE.Vector3();
  private scratchSphereB0 = new THREE.Vector3();
  private scratchSphereB1 = new THREE.Vector3();
  private scratchNormVec = new THREE.Vector3();
  private scratchContactPos = new THREE.Vector3();
  private scratchImpulseA = new THREE.Vector3();
  private scratchImpulseB = new THREE.Vector3();

  // AI Competitor configurations: balanced racing lanes + fierce competitive skill tiers
  private configs: AICarConfig[] = [
    {
      id: 'ai-viper',
      name: 'Viper',
      modelType: 'iridium',
      colorHex: 0x00d4ff, // Electric Cyan
      laneOffset: 0.36,
      skillMultiplier: 1.08,
      gridSlot: 1,
    },
    {
      id: 'ai-ignis',
      name: 'Ignis',
      modelType: 'rd09',
      colorHex: 0xff5500, // Inferno Orange
      laneOffset: -0.36,
      skillMultiplier: 1.04,
      gridSlot: 2,
    },
    {
      id: 'ai-shadow',
      name: 'Shadow',
      modelType: 'mazda',
      colorHex: 0x8800ff, // Midnight Violet
      laneOffset: 0.0,
      skillMultiplier: 1.00,
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
    this.lastPlayerU = 0;
    this.lastReportedRank = 4; // Player starts in 4th position behind the 3 AI leaders
    this.playerHasPassedMidpoint = false;
    this.playerFinished = false;
    this.playerFinishRank = null;
    this.finishedRacers = [];
    this.raceActiveTime = 0;
    this.lastCollisionSoundTime = 0;
    for (const car of this.aiCars) {
      car.setSpawn(car.config.gridSlot, direction);
    }
    useGameStore.getState().updateTelemetry({
      racePosition: 4,
      totalRacers: 4,
    });
  }

  recordPlayerFinish(finishTime: number): number {
    if (this.playerFinished && this.playerFinishRank !== null) {
      return this.playerFinishRank;
    }
    this.playerFinished = true;
    const rank = this.finishedRacers.length + 1;
    this.playerFinishRank = rank;
    this.finishedRacers.push({
      id: 'player',
      name: 'Player',
      position: rank,
      finishTime,
    });
    this.lastReportedRank = rank;
    useGameStore.getState().updateTelemetry({
      racePosition: rank,
    });
    return rank;
  }

  private getPlayerProgressU(): number {
    const playerPos = this.playerVehicle.position;
    let bestU = this.lastPlayerU;
    let minDist = Infinity;

    // Fast localized search window around previous frame's progress for 60 FPS performance (zero allocation)
    if (this.hasInitialPlayerU) {
      for (let du = -0.025; du <= 0.045; du += 0.005) {
        const u = (this.lastPlayerU + du + 1.0) % 1.0;
        this.trackSpline.getPointAt(u, this.scratchPlayerPt);
        const d = Math.hypot(this.scratchPlayerPt.x - playerPos.x, this.scratchPlayerPt.z - playerPos.z);
        if (d < minDist) {
          minDist = d;
          bestU = u;
        }
      }

      // If within normal track boundaries, refine locally
      if (minDist < 8.0) {
        for (let du = -0.003; du <= 0.003; du += 0.0006) {
          const testU = (bestU + du + 1.0) % 1.0;
          this.trackSpline.getPointAt(testU, this.scratchPlayerPt);
          const d = Math.hypot(this.scratchPlayerPt.x - playerPos.x, this.scratchPlayerPt.z - playerPos.z);
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
    const coarseSamples = 72;
    for (let i = 0; i < coarseSamples; i++) {
      const u = i / coarseSamples;
      this.trackSpline.getPointAt(u, this.scratchPlayerPt);
      const d = Math.hypot(this.scratchPlayerPt.x - playerPos.x, this.scratchPlayerPt.z - playerPos.z);
      if (d < minDist) {
        minDist = d;
        bestU = u;
      }
    }

    // Fine local search for sub-meter progress precision
    for (let du = -0.012; du <= 0.012; du += 0.002) {
      const testU = (bestU + du + 1.0) % 1.0;
      this.trackSpline.getPointAt(testU, this.scratchPlayerPt);
      const d = Math.hypot(this.scratchPlayerPt.x - playerPos.x, this.scratchPlayerPt.z - playerPos.z);
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
    if (playerProgressU > 0.40 && playerProgressU < 0.60) {
      this.playerHasPassedMidpoint = true;
    }

    const normalizedPlayerProgress = (!this.playerHasPassedMidpoint && playerLap === 1 && playerProgressU > 0.85)
      ? playerProgressU - 1.0
      : playerProgressU;

    const playerTotalProgress = this.playerFinished
      ? 4.0 + playerProgressU
      : playerLap + normalizedPlayerProgress;

    // Check if any AI car completed all 3 laps
    for (const car of this.aiCars) {
      if (car.currentLap > 3 && !this.finishedRacers.some((f) => f.id === car.id)) {
        const aiRank = this.finishedRacers.length + 1;
        this.finishedRacers.push({
          id: car.id,
          name: car.name,
          position: aiRank,
          finishTime: 0,
        });
      }
    }

    // Gather live racer obstacle list for clean overtaking awareness
    const allRacers = [
      { id: 'player', position: this.playerVehicle.position, speedKmH: this.playerVehicle.speedKmH },
      ...this.aiCars.map((c) => ({ id: c.id, position: c.position, speedKmH: c.speedKmH })),
    ];

    // 2. Update AI Cars with player progress & sibling racer overtaking context
    for (const car of this.aiCars) {
      car.update(delta, colliders, this.playerVehicle.position, playerTotalProgress, allRacers);
    }

    // 3. High-Impact Multi-Car Physical Collision Engine (Active only during race)
    const gState = useGameStore.getState().gameState;
    if (gState === 'racing') {
      this.raceActiveTime += delta;
      this.resolveCarCollisions(onPlayerCollision);
    } else {
      this.raceActiveTime = 0;
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

    // Sort descending by total race progress, with finished racers locked at top by finish order
    entries.sort((a, b) => {
      const aFin = this.finishedRacers.find((f) => f.id === a.id);
      const bFin = this.finishedRacers.find((f) => f.id === b.id);
      if (aFin && bFin) {
        return aFin.position - bFin.position;
      }
      if (aFin) return -1;
      if (bFin) return 1;
      return b.progress - a.progress;
    });

    // Assign positions 1st, 2nd, 3rd, 4th
    let playerRank = 1;
    entries.forEach((entry, idx) => {
      const fin = this.finishedRacers.find((f) => f.id === entry.id);
      if (fin) {
        entry.position = fin.position;
      } else {
        entry.position = idx + 1;
      }
      if (entry.isPlayer) {
        playerRank = this.playerFinishRank !== null ? this.playerFinishRank : entry.position;
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

    const isLaunchPhase = this.raceActiveTime < 1.6;

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

        this.scratchSphereA0.copy(vA.position).addScaledVector(vA.forwardVec, dAxleA);
        this.scratchSphereA1.copy(vA.position).addScaledVector(vA.forwardVec, -dAxleA);

        this.scratchSphereB0.copy(vB.position).addScaledVector(vB.forwardVec, dAxleB);
        this.scratchSphereB1.copy(vB.position).addScaledVector(vB.forwardVec, -dAxleB);

        const spheresA = [this.scratchSphereA0, this.scratchSphereA1];
        const spheresB = [this.scratchSphereB0, this.scratchSphereB1];

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
          this.scratchNormVec.set(nx, 0, nz);

          // Contact position
          this.scratchContactPos.set(
            (bestPair.sA.x + bestPair.sB.x) * 0.5,
            Math.max(vA.position.y, vB.position.y) + 0.06,
            (bestPair.sA.z + bestPair.sB.z) * 0.5
          );

          // 1. Soft Physical Depenetration (capped so cars never teleport)
          const maxPush = isLaunchPhase ? 0.022 : 0.038;
          const push = Math.min(maxPush, penetration * 0.45);
          vA.position.x += nx * push;
          vA.position.z += nz * push;
          vB.position.x -= nx * push;
          vB.position.z -= nz * push;

          // In launch phase, only separate softly without explosive collision impulses
          if (isLaunchPhase) continue;

          // 2. Relative Velocity & Impulse
          const relVelX = vA.velocity.x - vB.velocity.x;
          const relVelZ = vA.velocity.z - vB.velocity.z;
          const normalVel = relVelX * nx + relVelZ * nz;

          // Only apply impulse if cars are moving toward each other
          if (normalVel < -0.1) {
            const restitution = 0.32;
            const approachSpeed = -normalVel;
            const impulseMag = Math.min(4.8, (1.0 + restitution) * approachSpeed * 0.45);

            const nImpX = nx * impulseMag;
            const nImpZ = nz * impulseMag;

            // Damped tangential friction
            const tangVelX = relVelX - normalVel * nx;
            const tangVelZ = relVelZ - normalVel * nz;
            const tImpX = tangVelX * 0.2;
            const tImpZ = tangVelZ * 0.2;

            this.scratchImpulseA.set(nImpX - tImpX, 0, nImpZ - tImpZ);
            this.scratchImpulseB.set(-nImpX + tImpX, 0, -nImpZ + tImpZ);

            vA.applyCollisionImpulse(this.scratchImpulseA, this.scratchContactPos);
            vB.applyCollisionImpulse(this.scratchImpulseB, this.scratchContactPos);

            // Rate-limited audio, VFX, and camera shake
            const now = performance.now();
            if (impulseMag > 1.2 && now - this.lastCollisionSoundTime > 140) {
              this.lastCollisionSoundTime = now;
              const intensity = THREE.MathUtils.clamp(impulseMag / 4.0, 0.3, 1.0);
              this.particleManager.spawnCollisionSparks(this.scratchContactPos, this.scratchNormVec, intensity);
              soundEffects.playCollision(intensity);

              if ((vA.isPlayer || vB.isPlayer) && onPlayerCollision) {
                onPlayerCollision(intensity, this.scratchContactPos);
              }
            }
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
