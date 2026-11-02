import { create } from 'zustand';
import { CarModelId, TelemetryData } from '../types/game';

interface GameStore extends TelemetryData {
  isLoading: boolean;
  loadingMessage: string;
  loadingProgress: number;
  gameStarted: boolean;
  paused: boolean;
  notification: string | null;
  isCarSelectOpen: boolean;

  // Actions
  updateTelemetry: (data: Partial<TelemetryData>) => void;
  setLoading: (isLoading: boolean, message?: string, progress?: number) => void;
  startGame: () => void;
  setPaused: (paused: boolean) => void;
  setCarId: (id: CarModelId) => void;
  setCarSelectOpen: (open: boolean) => void;
  toggleCarSelect: () => void;
  toggleSound: () => void;
  toggleCamera: () => void;
  setNotification: (text: string | null) => void;
  resetRace: () => void;
  setCarScale: (scale: number) => void;
  setTrackDirection: (dir: 'normal' | 'reverse') => void;
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

  updateTelemetry: (data) => set((state) => ({ ...state, ...data })),
  setLoading: (isLoading, message, progress) =>
    set((state) => ({
      isLoading,
      loadingMessage: message ?? state.loadingMessage,
      loadingProgress: progress ?? state.loadingProgress,
    })),
  startGame: () => set({ gameStarted: true, isLoading: false }),
  setPaused: (paused) => set({ paused }),
  setCarId: (carId) => set({ carId }),
  setCarSelectOpen: (isCarSelectOpen) => set({ isCarSelectOpen }),
  toggleCarSelect: () => set((state) => ({ isCarSelectOpen: !state.isCarSelectOpen })),
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
      speed: 0,
      rpm: 1000,
      gear: 1,
      nitro: 100,
      isBoosting: false,
      isDrifting: false,
      isBraking: false,
      lap: 1,
      lapTime: 0,
      totalTime: 0,
      checkpointIndex: 0,
      coinsCollected: 0,
      finished: false,
    }),
  setCarScale: (carScale) => set({ carScale }),
  setTrackDirection: (trackDirection) => set({ trackDirection }),
}));
