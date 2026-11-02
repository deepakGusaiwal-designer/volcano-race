export type CarModelId = 'mazda' | 'iridium' | 'rd09';

export interface CarConfig {
  id: CarModelId;
  name: string;
  subtitle: string;
  file: string;
  scale: number;
  yOffset: number;
  topSpeed: number;        // km/h
  acceleration: number;
  handling: number;
  driftMultiplier: number;
  color: string;
  accentColor: string;
}

export const CAR_PRESETS: Record<CarModelId, CarConfig> = {
  mazda: {
    id: 'mazda',
    name: 'Mazda LM Vision',
    subtitle: 'Le Mans Hypercar Prototype',
    file: '/models/mazda.glb',
    scale: 1.0,
    yOffset: 0,
    topSpeed: 248,
    acceleration: 9.5,
    handling: 9.8,
    driftMultiplier: 3.45,
    color: '#ffffff',
    accentColor: '#ef4444',
  },
  iridium: {
    id: 'iridium',
    name: 'Hot Wheels Iridium',
    subtitle: 'Supercharged Concept Racer',
    file: '/models/hot_wheels_iridium.glb',
    scale: 0.009355,
    yOffset: 0,
    topSpeed: 255,
    acceleration: 9.2,
    handling: 9.0,
    driftMultiplier: 3.35,
    color: '#00d4ff',
    accentColor: '#38bdf8',
  },
  rd09: {
    id: 'rd09',
    name: 'Hot Wheels RD-09',
    subtitle: 'Volcanic Drift Heavy Beast',
    file: '/models/hotwheels_rd09.glb',
    scale: 0.01030,
    yOffset: 0,
    topSpeed: 242,
    acceleration: 8.8,
    handling: 9.4,
    driftMultiplier: 3.85,
    color: '#ff5500',
    accentColor: '#f97316',
  },
};

export interface TelemetryData {
  speed: number;           // km/h
  rpm: number;             // 1000 - 9000
  gear: number | string;   // 'R', 'N', 1..6
  nitro: number;           // 0..100
  isBoosting: boolean;
  isDrifting: boolean;
  isBraking: boolean;
  isOnLava?: boolean;
  lap: number;
  totalLaps: number;
  racePosition?: number;
  totalRacers?: number;
  lapTime: number;         // seconds
  bestLapTime: number | null;
  totalTime: number;
  checkpointIndex: number;
  totalCheckpoints: number;
  coinsCollected: number;
  finished: boolean;
  cameraMode: 'chase' | 'hood' | 'far' | 'cinematic';
  trackDirection: 'normal' | 'reverse';
  soundEnabled: boolean;
  carId: CarModelId;
  carScale: number;
  fps: number;
  drawCalls: number;
  triangles: number;
}

export interface CheckpointDef {
  index: number;
  position: [number, number, number];
  radius: number;
  passed: boolean;
}
