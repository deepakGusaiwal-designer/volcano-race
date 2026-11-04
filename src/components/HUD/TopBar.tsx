import React, { useState } from 'react';
import {
  Pause,
  Play,
  Camera,
  Car,
  RotateCcw,
  Volume2,
  VolumeX,
  Compass,
  Trophy,
} from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { soundEffects } from '../../audio/SoundEffects';

interface TopBarProps {
  onToggleCamera: () => void;
  onReset: () => void;
  onToggleTrackDirection: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  onToggleCamera,
  onReset,
  onToggleTrackDirection,
}) => {
  const gameState = useGameStore((state) => state.gameState);
  const paused = useGameStore((state) => state.paused);
  const togglePause = useGameStore((state) => state.togglePause);
  const cameraMode = useGameStore((state) => state.cameraMode);
  const trackDirection = useGameStore((state) => state.trackDirection);
  const toggleCarSelect = useGameStore((state) => state.toggleCarSelect);
  const setCareerModalOpen = useGameStore((state) => state.setCareerModalOpen);
  const [isMuted, setIsMuted] = useState(false);

  if (gameState !== 'racing' && gameState !== 'paused') return null;

  const handleAudioToggle = () => {
    soundEffects.init();
    if (isMuted) {
      soundEffects.resume();
      soundEffects.setEnabled(true);
      setIsMuted(false);
      useGameStore.getState().setNotification('Audio Unmuted 🔊');
    } else {
      soundEffects.setEnabled(false);
      setIsMuted(true);
      useGameStore.getState().setNotification('Audio Muted 🔇');
    }
  };

  return (
    <div className="flex items-center space-x-2 pointer-events-auto select-none">
      {/* Pause Pill */}
      <button
        onClick={() => {
          soundEffects.playClick();
          togglePause();
        }}
        className="flex items-center space-x-1.5 bg-[#14161a]/85 hover:bg-[#20232a] backdrop-blur-md px-2.5 py-1 rounded-xl border border-white/10 hover:border-orange-500/50 text-[10.5px] font-bold text-gray-200 transition-all cursor-pointer shadow-lg active:scale-95"
        title="Pause (Esc / P)"
      >
        {paused ? <Play className="w-3 h-3 text-emerald-400" /> : <Pause className="w-3 h-3 text-orange-400" />}
        <span className="hidden sm:inline">{paused ? 'RESUME' : 'PAUSE'}</span>
      </button>

      {/* Camera Pill */}
      <button
        onClick={() => {
          soundEffects.playClick();
          onToggleCamera();
        }}
        className="flex items-center space-x-1.5 bg-[#14161a]/85 hover:bg-[#20232a] backdrop-blur-md px-2.5 py-1 rounded-xl border border-white/10 hover:border-orange-500/50 text-[10.5px] font-bold text-gray-200 transition-all cursor-pointer shadow-lg active:scale-95"
        title="Change Camera (C)"
      >
        <Camera className="w-3 h-3 text-cyan-400" />
        <span className="hidden sm:inline font-mono text-[10px] uppercase">{cameraMode}</span>
      </button>

      {/* Track Mode Pill */}
      <button
        onClick={() => {
          soundEffects.playClick();
          onToggleTrackDirection();
        }}
        className="flex items-center space-x-1.5 bg-[#14161a]/85 hover:bg-[#20232a] backdrop-blur-md px-2.5 py-1 rounded-xl border border-white/10 hover:border-orange-500/50 text-[10.5px] font-bold text-gray-200 transition-all cursor-pointer shadow-lg active:scale-95"
        title="Switch Circuit Direction (M)"
      >
        <Compass className="w-3 h-3 text-amber-400" />
        <span className="hidden md:inline font-mono text-[10px] uppercase">{trackDirection}</span>
      </button>

      {/* Garage Pill */}
      <button
        onClick={() => {
          soundEffects.playClick();
          toggleCarSelect();
        }}
        className="flex items-center space-x-1.5 bg-[#14161a]/85 hover:bg-[#20232a] backdrop-blur-md px-2.5 py-1 rounded-xl border border-white/10 hover:border-orange-500/50 text-[10.5px] font-bold text-gray-200 transition-all cursor-pointer shadow-lg active:scale-95"
        title="Garage (G)"
      >
        <Car className="w-3 h-3 text-orange-400" />
        <span className="hidden md:inline">GARAGE</span>
      </button>

      {/* Career Passport Pill */}
      <button
        onClick={() => {
          soundEffects.playClick();
          setCareerModalOpen(true);
        }}
        className="flex items-center space-x-1.5 bg-[#14161a]/85 hover:bg-[#20232a] backdrop-blur-md px-2.5 py-1 rounded-xl border border-white/10 hover:border-orange-500/50 text-[10.5px] font-bold text-gray-200 transition-all cursor-pointer shadow-lg active:scale-95"
        title="Driver Career Passport"
      >
        <Trophy className="w-3 h-3 text-yellow-400" />
      </button>

      {/* Audio Mute Pill */}
      <button
        onClick={handleAudioToggle}
        className="p-1.5 bg-[#14161a]/85 hover:bg-[#20232a] backdrop-blur-md rounded-xl border border-white/10 hover:border-white/20 text-gray-300 transition-all cursor-pointer shadow-lg active:scale-95"
        title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
      >
        {isMuted ? <VolumeX className="w-3 h-3 text-red-400" /> : <Volume2 className="w-3 h-3 text-gray-300" />}
      </button>

      {/* Reset Pill */}
      <button
        onClick={() => {
          soundEffects.playClick();
          onReset();
        }}
        className="p-1.5 bg-[#14161a]/85 hover:bg-[#20232a] backdrop-blur-md rounded-xl border border-white/10 hover:border-white/20 text-gray-300 transition-all cursor-pointer shadow-lg active:scale-95"
        title="Reset Race (R)"
      >
        <RotateCcw className="w-3 h-3 text-gray-400 hover:text-white" />
      </button>
    </div>
  );
};
