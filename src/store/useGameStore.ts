import { create } from 'zustand';
import { CarModelId, TelemetryData, RoadHintData, GameState, StuntEvent, DriverProfile, LeaderboardRacer } from '../types/game';

const DRIVER_PROFILE_KEY = 'volcano_race_driver_profile_v2';

const getInitialDriverProfile = (): DriverProfile => {
  try {
    const raw = localStorage.getItem(DRIVER_PROFILE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.level === 'number') {
        return parsed;
      }
    }
  } catch {
    // fallback
  }
  return {
    name: 'Apex Champion',
    level: 1,
    xp: 250,
    title: 'ROOKIE SPEEDSTER',
    careerWins: 0,
    careerRaces: 0,
    careerCoins: 0,
    starsClassic: 0,
    starsReverse: 0,
  };
};

const getTitleForLevel = (lvl: number): string => {
  if (lvl >= 15) return 'HALL OF FAME LEGEND';
  if (lvl >= 10) return 'VOLCANO CHAMPION';
  if (lvl >= 7) return 'APEX PREDATOR';
  if (lvl >= 5) return 'SPEED DEMON';
  if (lvl >= 4) return 'CIRCUIT CONTENDER';
  if (lvl >= 3) return 'MAGMA DRIFTER';
  if (lvl >= 2) return 'HOT WHEELS NOVICE';
  return 'ROOKIE SPEEDSTER';
};

interface GameStore extends TelemetryData {
  isLoading: boolean;
  loadingMessage: string;
  loadingProgress: number;
  gameStarted: boolean;
  paused: boolean;
  notification: string | null;
  isCarSelectOpen: boolean;
  isPauseOpen: boolean;
  isCareerModalOpen: boolean;
  roadHint: RoadHintData | null;

  // AAA Game State
  gameState: GameState;
  countdownValue: number | null;
  isPerfectLaunch: boolean;
  stuntScore: number;
  stuntFeed: StuntEvent[];
  comboMultiplier: number;
  driverProfile: DriverProfile;
  leaderboard: LeaderboardRacer[];
  carPaint: string;

  // Actions
  updateTelemetry: (data: Partial<TelemetryData>) => void;
  setRoadHint: (hint: RoadHintData | null) => void;
  setLoading: (isLoading: boolean, message?: string, progress?: number) => void;
  startGame: () => void;
  setGameState: (state: GameState) => void;
  setCountdownValue: (val: number | null) => void;
  setIsPerfectLaunch: (val: boolean) => void;
  setPaused: (paused: boolean) => void;
  setCarId: (id: CarModelId) => void;
  setCarPaint: (color: string) => void;
  setCarSelectOpen: (open: boolean) => void;
  toggleCarSelect: () => void;
  setPauseOpen: (open: boolean) => void;
  togglePause: () => void;
  setCareerModalOpen: (open: boolean) => void;
  toggleSound: () => void;
  toggleCamera: () => void;
  setNotification: (text: string | null) => void;
  resetRace: () => void;
  setCarScale: (scale: number) => void;
  setTrackDirection: (dir: 'normal' | 'reverse') => void;
  triggerStunt: (text: string, points: number, type: StuntEvent['type']) => void;
  clearStuntFeed: () => void;
  updateLeaderboard: (leaderboard: LeaderboardRacer[]) => void;
  addDriverXp: (amount: number, coins?: number, isWin?: boolean) => { leveledUp: boolean; newLevel: number };
  awardStars: (stars: number, circuit: 'normal' | 'reverse') => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  // Telemetry Defaults
  speed: 0,
  rpm: 1000,
  gear: 'N',
  nitro: 100,
  isBoosting: false,
  isDrifting: false,
  isBraking: false,
  isOnLava: false,
  lap: 1,
  totalLaps: 3,
  racePosition: 1,
  totalRacers: 4,
  lapTime: 0,
  bestLapTime: null,
  totalTime: 0,
  checkpointIndex: 0,
  totalCheckpoints: 4,
  coinsCollected: 0,
  finished: false,
  cameraMode: 'chase',
  trackDirection: 'reverse',
  soundEnabled: true,
  carId: 'mazda',
  carScale: 0.14,
  fps: 60,
  drawCalls: 0,
  triangles: 0,

  // UI state
  isLoading: true,
  loadingMessage: 'Igniting Volcano Engine...',
  loadingProgress: 0,
  gameStarted: false,
  paused: false,
  notification: null,
  isCarSelectOpen: false,
  isPauseOpen: false,
  isCareerModalOpen: false,
  roadHint: null,

  // AAA Game State
  gameState: 'welcome',
  countdownValue: null,
  isPerfectLaunch: false,
  stuntScore: 0,
  stuntFeed: [],
  comboMultiplier: 1.0,
  driverProfile: getInitialDriverProfile(),
  leaderboard: [],
  carPaint: '#ffffff',

  updateTelemetry: (data) => set((state) => ({ ...state, ...data })),
  setRoadHint: (roadHint) => set({ roadHint }),
  setLoading: (isLoading, message, progress) =>
    set((state) => ({
      isLoading,
      loadingMessage: message ?? state.loadingMessage,
      loadingProgress: progress ?? state.loadingProgress,
    })),
  startGame: () => set({ gameStarted: true, isLoading: false }),
  setGameState: (gameState) => set({ gameState }),
  setCountdownValue: (countdownValue) => set({ countdownValue }),
  setIsPerfectLaunch: (isPerfectLaunch) => set({ isPerfectLaunch }),
  setPaused: (paused) => set({ paused, isPauseOpen: paused }),
  setCarId: (carId) => set({ carId }),
  setCarPaint: (carPaint) => set({ carPaint }),
  setCarSelectOpen: (isCarSelectOpen) => set({ isCarSelectOpen }),
  toggleCarSelect: () => set((state) => ({ isCarSelectOpen: !state.isCarSelectOpen })),
  setPauseOpen: (isPauseOpen) => set({ isPauseOpen, paused: isPauseOpen }),
  togglePause: () => set((state) => ({ isPauseOpen: !state.isPauseOpen, paused: !state.isPauseOpen })),
  setCareerModalOpen: (isCareerModalOpen) => set({ isCareerModalOpen }),
  toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),
  toggleCamera: () =>
    set((state) => {
      const modes: Array<'chase' | 'hood' | 'far' | 'cinematic'> = ['chase', 'hood', 'far', 'cinematic'];
      const nextIdx = (modes.indexOf(state.cameraMode) + 1) % modes.length;
      return { cameraMode: modes[nextIdx] };
    }),
  setNotification: (notification) => set({ notification }),
  resetRace: () =>
    set({
      paused: false,
      isPauseOpen: false,
      isCarSelectOpen: false,
      isCareerModalOpen: false,
      countdownValue: null,
      isPerfectLaunch: false,
      speed: 0,
      rpm: 1000,
      gear: 1,
      nitro: 100,
      isBoosting: false,
      isDrifting: false,
      isBraking: false,
      isOnLava: false,
      lap: 1,
      racePosition: 1,
      lapTime: 0,
      bestLapTime: null,
      totalTime: 0,
      checkpointIndex: 0,
      coinsCollected: 0,
      finished: false,
      stuntScore: 0,
      stuntFeed: [],
      comboMultiplier: 1.0,
      roadHint: null,
      leaderboard: [],
      notification: null,
    }),
  setCarScale: (carScale) => set({ carScale }),
  setTrackDirection: (trackDirection) => set({ trackDirection }),

  triggerStunt: (text, points, type) => {
    const state = get();
    const newMultiplier = Math.min(4.0, +(state.comboMultiplier + 0.1).toFixed(1));
    const addedPoints = Math.round(points * state.comboMultiplier);
    const newFeed: StuntEvent = {
      id: `${Date.now()}-${Math.random()}`,
      text,
      points: addedPoints,
      type,
      timestamp: Date.now(),
    };

    set({
      stuntScore: state.stuntScore + addedPoints,
      comboMultiplier: newMultiplier,
      stuntFeed: [newFeed, ...state.stuntFeed.slice(0, 3)],
    });
  },

  clearStuntFeed: () => set({ stuntFeed: [] }),

  updateLeaderboard: (leaderboard) => set({ leaderboard }),

  addDriverXp: (amount, coins = 0, isWin = false) => {
    const profile = { ...get().driverProfile };
    profile.xp += amount;
    profile.careerCoins += coins;
    profile.careerRaces += 1;
    if (isWin) profile.careerWins += 1;

    let leveledUp = false;
    const xpPerLevel = 1000;
    const computedLevel = 1 + Math.floor(profile.xp / xpPerLevel);
    if (computedLevel > profile.level) {
      profile.level = computedLevel;
      profile.title = getTitleForLevel(computedLevel);
      leveledUp = true;
    }

    try {
      localStorage.setItem(DRIVER_PROFILE_KEY, JSON.stringify(profile));
    } catch {
      // ignore
    }

    set({ driverProfile: profile });
    return { leveledUp, newLevel: profile.level };
  },

  awardStars: (stars, circuit) => {
    const profile = { ...get().driverProfile };
    if (circuit === 'reverse') {
      profile.starsReverse = Math.max(profile.starsReverse, stars);
    } else {
      profile.starsClassic = Math.max(profile.starsClassic, stars);
    }
    try {
      localStorage.setItem(DRIVER_PROFILE_KEY, JSON.stringify(profile));
    } catch {
      // ignore
    }
    set({ driverProfile: profile });
  },
}));
