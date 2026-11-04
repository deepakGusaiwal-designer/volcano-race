import React, { useEffect } from 'react';
import {
  Play,
  RotateCcw,
  Car,
  Compass,
  Volume2,
  VolumeX,
  X,
  Keyboard,
  Gauge,
  Flame,
} from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { soundEffects } from '../../audio/SoundEffects';

interface PauseModalProps {
  onResume: () => void;
  onRestart: () => void;
  onToggleTrackDirection: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  onResume,
  onRestart,
  onToggleTrackDirection,
}) => {
  const paused = useGameStore((state) => state.paused);
  const isPauseOpen = useGameStore((state) => state.isPauseOpen);
  const togglePause = useGameStore((state) => state.togglePause);
  const toggleCarSelect = useGameStore((state) => state.toggleCarSelect);
  const lap = useGameStore((state) => state.lap);
  const totalLaps = useGameStore((state) => state.totalLaps);
  const racePosition = useGameStore((state) => state.racePosition || 1);
  const speed = useGameStore((state) => state.speed);
  const totalTime = useGameStore((state) => state.totalTime);
  const trackDirection = useGameStore((state) => state.trackDirection);

  const shouldShow = paused || isPauseOpen;

  // Close on Escape or P
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.code === 'Escape' || e.code === 'KeyP') && shouldShow) {
        onResume();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shouldShow, onResume]);

  if (!shouldShow) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return `${mins}:${secs.padStart(4, '0')}`;
  };

  const handleResume = () => {
    soundEffects.playClick();
    onResume();
  };

  const handleRestart = () => {
    soundEffects.playClick();
    onRestart();
  };

  const handleGarage = () => {
    soundEffects.playClick();
    togglePause();
    toggleCarSelect();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 select-none pointer-events-auto">
      <div className="relative w-full max-w-lg bg-[#121418]/95 border border-white/15 rounded-3xl shadow-[0_0_60px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col pointer-events-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-black/40">
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 rounded-full bg-orange-500 animate-pulse" />
            <h2 className="text-xl font-black tracking-wider uppercase text-white font-sans">
              RACE PAUSED
            </h2>
          </div>
          <button
            onClick={handleResume}
            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/15 text-gray-400 hover:text-white flex items-center justify-center transition-all border border-white/10 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Telemetry Snapshot Strip */}
        <div className="p-6 bg-black/30 border-b border-white/5 grid grid-cols-4 gap-3 text-center">
          <div className="bg-[#181a1f] p-2.5 rounded-xl border border-white/5">
            <span className="text-[10px] text-gray-400 block font-bold mb-0.5">POSITION</span>
            <span className="text-lg font-mono font-black text-cyan-400">P{racePosition}</span>
          </div>
          <div className="bg-[#181a1f] p-2.5 rounded-xl border border-white/5">
            <span className="text-[10px] text-gray-400 block font-bold mb-0.5">LAP</span>
            <span className="text-lg font-mono font-black text-white">{lap} / {totalLaps}</span>
          </div>
          <div className="bg-[#181a1f] p-2.5 rounded-xl border border-white/5">
            <span className="text-[10px] text-gray-400 block font-bold mb-0.5">TIME</span>
            <span className="text-lg font-mono font-black text-amber-400">{formatTime(totalTime)}</span>
          </div>
          <div className="bg-[#181a1f] p-2.5 rounded-xl border border-white/5">
            <span className="text-[10px] text-gray-400 block font-bold mb-0.5">SPEED</span>
            <span className="text-lg font-mono font-black text-emerald-400">{speed} <span className="text-[10px]">KM/H</span></span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-6 space-y-3">
          {/* Resume */}
          <button
            onClick={handleResume}
            className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-black font-black uppercase tracking-wider text-sm rounded-xl shadow-[0_0_25px_rgba(249,115,22,0.4)] flex items-center justify-center space-x-2 transition-transform active:scale-95 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-black stroke-black" />
            <span>RESUME RACE (ESC)</span>
          </button>

          {/* Restart */}
          <button
            onClick={handleRestart}
            className="w-full py-3 bg-[#1e2026] hover:bg-[#272b33] text-white font-bold uppercase tracking-wider text-xs rounded-xl border border-white/10 flex items-center justify-center space-x-2 transition-all cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 text-orange-400" />
            <span>RESTART FROM GRID (R)</span>
          </button>

          {/* Change Vehicle */}
          <button
            onClick={handleGarage}
            className="w-full py-3 bg-[#1e2026] hover:bg-[#272b33] text-white font-bold uppercase tracking-wider text-xs rounded-xl border border-white/10 flex items-center justify-center space-x-2 transition-all cursor-pointer"
          >
            <Car className="w-4 h-4 text-cyan-400" />
            <span>OPEN GARAGE & TUNING (G)</span>
          </button>

          {/* Switch Track Direction */}
          <button
            onClick={() => {
              soundEffects.playClick();
              onToggleTrackDirection();
            }}
            className="w-full py-3 bg-[#1e2026] hover:bg-[#272b33] text-white font-bold uppercase tracking-wider text-xs rounded-xl border border-white/10 flex items-center justify-center space-x-2 transition-all cursor-pointer"
          >
            <Compass className="w-4 h-4 text-amber-400" />
            <span>TRACK DIRECTION: {trackDirection.toUpperCase()}</span>
          </button>
        </div>

        {/* Controls Reference Guide */}
        <div className="px-6 py-4 bg-black/50 border-t border-white/10 text-xs text-gray-400">
          <div className="flex items-center space-x-2 font-bold text-gray-300 mb-2.5">
            <Keyboard className="w-4 h-4 text-orange-400" />
            <span className="uppercase tracking-wider text-[11px]">CONTROLS REFERENCE</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="flex justify-between items-center bg-white/5 p-2 rounded-lg">
              <span className="text-gray-400">Accelerate / Brake</span>
              <kbd className="font-mono text-white bg-black/60 px-1.5 py-0.5 rounded text-[10px]">W / S / ⬆ ⬇</kbd>
            </div>
            <div className="flex justify-between items-center bg-white/5 p-2 rounded-lg">
              <span className="text-gray-400">Steer Left / Right</span>
              <kbd className="font-mono text-white bg-black/60 px-1.5 py-0.5 rounded text-[10px]">A / D / ⬅ ➡</kbd>
            </div>
            <div className="flex justify-between items-center bg-white/5 p-2 rounded-lg">
              <span className="text-gray-400">Drift Power-Slide</span>
              <kbd className="font-mono text-white bg-black/60 px-1.5 py-0.5 rounded text-[10px]">SPACE</kbd>
            </div>
            <div className="flex justify-between items-center bg-white/5 p-2 rounded-lg">
              <span className="text-gray-400">Hyper Nitro Boost</span>
              <kbd className="font-mono text-white bg-black/60 px-1.5 py-0.5 rounded text-[10px]">SHIFT</kbd>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
