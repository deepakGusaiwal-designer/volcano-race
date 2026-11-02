import React from 'react';
import { Volume2, VolumeX, Camera, RotateCcw, ZoomIn, ZoomOut, Activity, Compass, Car } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { soundEffects } from '../../audio/SoundEffects';

interface ControlsHelpProps {
  onReset: () => void;
  onToggleCamera: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onCycleCarScale?: () => void;
  onToggleTrackDirection?: () => void;
}

export const ControlsHelp: React.FC<ControlsHelpProps> = ({
  onReset,
  onToggleCamera,
  onZoomIn,
  onZoomOut,
  onCycleCarScale,
  onToggleTrackDirection,
}) => {
  const soundEnabled = useGameStore((state) => state.soundEnabled);
  const toggleSound = useGameStore((state) => state.toggleSound);
  const cameraMode = useGameStore((state) => state.cameraMode);
  const trackDirection = useGameStore((state) => state.trackDirection || 'reverse');
  const carScale = useGameStore((state) => state.carScale || 0.14);
  const fps = useGameStore((state) => state.fps);
  const carId = useGameStore((state) => state.carId || 'mazda');
  const toggleCarSelect = useGameStore((state) => state.toggleCarSelect);

  const handleSoundToggle = () => {
    soundEffects.init();
    soundEffects.resume();
    toggleSound();
    soundEffects.setEnabled(!soundEnabled);
  };

  const getCameraLabel = () => {
    if (cameraMode === 'hood') return 'COCKPIT';
    if (cameraMode === 'far') return 'FREE ORBIT';
    if (cameraMode === 'cinematic') return 'CINEMATIC';
    return 'CHASE';
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 select-none pointer-events-auto w-full">
      {/* Keyboard Controls Guide */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="bg-[#1e2024]/90 backdrop-blur-md rounded-xl px-3.5 py-2 flex items-center space-x-3 text-xs text-gray-300 border border-white/10 shadow-lg">
          <div className="flex items-center space-x-1">
            <kbd className="bg-black/60 px-1.5 py-0.5 rounded border border-gray-700 text-white font-mono text-[10px]">W</kbd>
            <kbd className="bg-black/60 px-1.5 py-0.5 rounded border border-gray-700 text-white font-mono text-[10px]">S</kbd>
            <span className="text-gray-400">Drive / Brake</span>
          </div>
          <span className="text-gray-600 hidden sm:inline">•</span>
          <div className="flex items-center space-x-1">
            <kbd className="bg-black/60 px-1.5 py-0.5 rounded border border-gray-700 text-white font-mono text-[10px]">A</kbd>
            <kbd className="bg-black/60 px-1.5 py-0.5 rounded border border-gray-700 text-white font-mono text-[10px]">D</kbd>
            <span className="text-gray-400">Steer</span>
          </div>
          <span className="text-gray-600 hidden sm:inline">•</span>
          <div className="flex items-center space-x-1">
            <kbd className="bg-black/60 px-1.5 py-0.5 rounded border border-yellow-500/40 text-yellow-400 font-mono text-[10px]">SPACE</kbd>
            <span className="text-yellow-400 font-medium">Drift</span>
          </div>
          <span className="text-gray-600 hidden sm:inline">•</span>
          <div className="flex items-center space-x-1">
            <kbd className="bg-black/60 px-1.5 py-0.5 rounded border border-cyan-500/40 text-cyan-400 font-mono text-[10px]">SHIFT</kbd>
            <span className="text-cyan-400 font-medium">Nitro</span>
          </div>
          <span className="text-gray-600 hidden sm:inline">•</span>
          <div className="flex items-center space-x-1">
            <kbd className="bg-black/60 px-1.5 py-0.5 rounded border border-gray-700 text-white font-mono text-[10px]">R</kbd>
            <span className="text-gray-400">Reset</span>
          </div>
          <span className="text-gray-600 hidden sm:inline">•</span>
          <div className="flex items-center space-x-1">
            <kbd className="bg-black/60 px-1.5 py-0.5 rounded border border-gray-700 text-white font-mono text-[10px]">T</kbd>
            <span className="text-gray-400">Scale</span>
          </div>
          <span className="text-gray-600 hidden sm:inline">•</span>
          <div className="flex items-center space-x-1">
            <kbd className="bg-black/60 px-1.5 py-0.5 rounded border border-emerald-500/40 text-emerald-400 font-mono text-[10px]">M</kbd>
            <span className="text-emerald-400 font-medium">Mode</span>
          </div>
          <span className="text-gray-600 hidden sm:inline">•</span>
          <div className="flex items-center space-x-1">
            <kbd className="bg-black/60 px-1.5 py-0.5 rounded border border-orange-500/40 text-orange-400 font-mono text-[10px]">V</kbd>
            <span className="text-orange-400 font-medium">Cars</span>
          </div>
          <span className="text-gray-600 hidden sm:inline">•</span>
          <div className="flex items-center space-x-1">
            <kbd className="bg-black/60 px-1.5 py-0.5 rounded border border-amber-500/40 text-amber-400 font-mono text-[10px]">C</kbd>
            <span className="text-amber-400 font-medium">Cinematic</span>
          </div>
        </div>

        {/* Performance Badge */}
        <div className="bg-[#1e2024]/90 backdrop-blur-md rounded-xl px-2.5 py-2 flex items-center space-x-1.5 text-[11px] font-mono border border-white/10 text-green-400 shadow-lg hidden md:flex">
          <Activity className="w-3.5 h-3.5 text-green-400 animate-pulse" />
          <span>{fps} FPS</span>
        </div>
      </div>

      {/* Quick Action Control Dock */}
      <div className="flex items-center space-x-2">
        {/* Deepak Gusaiwal Title Sponsor Badge */}
        <div className="hidden xl:flex items-center space-x-1.5 bg-black/70 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-white/10 shadow-lg">
          <img src="/images/logo.svg" alt="DG Logo" className="h-3.5 w-auto object-contain" />
          <span className="text-[10px] font-black text-gray-300 font-mono tracking-wider">DEEPAK GUSAIWAL</span>
        </div>

        {/* Zoom In Button */}
        <button
          onClick={onZoomIn}
          className="bg-[#1e2024]/90 hover:bg-[#282b30] text-white p-2.5 rounded-xl border border-white/10 shadow-lg transition-all active:scale-95 flex items-center space-x-1 text-xs"
          title="Zoom In (Key: + or Z)"
        >
          <ZoomIn className="w-4 h-4 text-gray-200" />
        </button>

        {/* Zoom Out Button */}
        <button
          onClick={onZoomOut}
          className="bg-[#1e2024]/90 hover:bg-[#282b30] text-white p-2.5 rounded-xl border border-white/10 shadow-lg transition-all active:scale-95 flex items-center space-x-1 text-xs"
          title="Zoom Out (Key: - or X)"
        >
          <ZoomOut className="w-4 h-4 text-gray-200" />
        </button>

        {/* Camera Toggle Button */}
        <button
          onClick={onToggleCamera}
          className={`${
            cameraMode === 'cinematic'
              ? 'bg-red-950/70 border-red-500/50 hover:bg-red-900/80 shadow-[0_0_15px_rgba(239,68,68,0.3)]'
              : 'bg-[#1e2024]/90 hover:bg-[#282b30] border-white/10'
          } text-white px-3 py-2 rounded-xl border shadow-lg transition-all active:scale-95 flex items-center space-x-1.5 text-xs font-medium`}
          title="Switch Camera View: Chase, Cockpit, Free Orbit, Cinematic Director (Key: C)"
        >
          <Camera
            className={`w-4 h-4 ${
              cameraMode === 'cinematic' ? 'text-red-400 animate-pulse' : 'text-cyan-400'
            }`}
          />
          <span
            className={`uppercase text-[10px] font-bold ${
              cameraMode === 'cinematic' ? 'text-amber-400 font-mono tracking-wider' : 'text-gray-300'
            }`}
          >
            {getCameraLabel()}
          </span>
        </button>

        {/* Vehicle Select / Garage Button */}
        <button
          onClick={toggleCarSelect}
          className="bg-[#1e2024]/90 hover:bg-[#282b30] text-white px-3 py-2 rounded-xl border border-orange-500/30 hover:border-orange-500/60 shadow-lg transition-all active:scale-95 flex items-center space-x-1.5 text-xs font-medium"
          title="Choose Car / Open Garage (Key: V or G)"
        >
          <Car className="w-4 h-4 text-orange-400" />
          <span className="text-orange-400 font-bold text-[10px]">CAR</span>
          <span className="text-[10px] text-gray-300 font-mono font-bold uppercase">
            {carId === 'mazda' ? 'MAZDA' : (carId === 'iridium' ? 'IRIDIUM' : 'RD-09')}
          </span>
        </button>

        {/* Car Scale Toggle Button */}
        {onCycleCarScale && (
          <button
            onClick={onCycleCarScale}
            className="bg-[#1e2024]/90 hover:bg-[#282b30] text-white px-3 py-2 rounded-xl border border-white/10 shadow-lg transition-all active:scale-95 flex items-center space-x-1.5 text-xs font-medium"
            title="Cycle Car Scale (Key: T)"
          >
            <span className="text-orange-400 font-bold text-[10px]">SCALE</span>
            <span className="text-[10px] text-gray-300 font-mono font-bold">{carScale.toFixed(2)}x</span>
          </button>
        )}

        {/* Track Mode (Direction) Toggle Button */}
        {onToggleTrackDirection && (
          <button
            onClick={onToggleTrackDirection}
            className="bg-[#1e2024]/90 hover:bg-[#282b30] text-white px-3 py-2 rounded-xl border border-white/10 shadow-lg transition-all active:scale-95 flex items-center space-x-1.5 text-xs font-medium"
            title="Toggle Track Direction: Reverse vs Normal (Key: M)"
          >
            <Compass className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-emerald-400 font-bold text-[10px]">DIR</span>
            <span className="text-[10px] text-gray-300 font-mono font-bold uppercase">{trackDirection === 'reverse' ? 'REV' : 'FWD'}</span>
          </button>
        )}

        {/* Audio Toggle */}
        <button
          onClick={handleSoundToggle}
          className="bg-[#1e2024]/90 hover:bg-[#282b30] text-white p-2.5 rounded-xl border border-white/10 shadow-lg transition-all active:scale-95"
          title={soundEnabled ? 'Mute Sound' : 'Enable Sound'}
        >
          {soundEnabled ? (
            <Volume2 className="w-4 h-4 text-green-400" />
          ) : (
            <VolumeX className="w-4 h-4 text-red-400" />
          )}
        </button>

        {/* Reset Car to Start Button */}
        <button
          onClick={onReset}
          className="bg-[#1e2024]/90 hover:bg-red-950/40 text-white p-2.5 rounded-xl border border-white/10 shadow-lg transition-all active:scale-95"
          title="Reset to Start Line (Key: R)"
        >
          <RotateCcw className="w-4 h-4 text-yellow-400" />
        </button>
      </div>
    </div>
  );
};
