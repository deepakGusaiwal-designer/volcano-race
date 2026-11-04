import React from 'react';
import { useGameStore } from '../../store/useGameStore';
import { Play, Car, Trophy, Sparkles, Compass, Shield, Flame } from 'lucide-react';
import { soundEffects } from '../../audio/SoundEffects';

interface WelcomeScreenProps {
  onStartRace: () => void;
  onToggleTrackDirection: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onStartRace,
  onToggleTrackDirection,
}) => {
  const gameState = useGameStore((state) => state.gameState);
  const driverProfile = useGameStore((state) => state.driverProfile);
  const trackDirection = useGameStore((state) => state.trackDirection);
  const toggleCarSelect = useGameStore((state) => state.toggleCarSelect);
  const setCareerModalOpen = useGameStore((state) => state.setCareerModalOpen);
  const carId = useGameStore((state) => state.carId);

  if (gameState !== 'welcome') return null;

  const xpInCurrentLevel = driverProfile.xp % 1000;
  const xpProgress = Math.min(100, Math.round((xpInCurrentLevel / 1000) * 100));
  const totalStars = driverProfile.starsClassic + driverProfile.starsReverse;

  const handleStartClick = () => {
    soundEffects.playRevEngine();
    onStartRace();
  };

  const handleGarageClick = () => {
    soundEffects.playClick();
    toggleCarSelect();
  };

  const handleCareerClick = () => {
    soundEffects.playClick();
    setCareerModalOpen(true);
  };

  const handleTrackToggle = () => {
    soundEffects.playClick();
    onToggleTrackDirection();
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-between p-6 sm:p-10 pointer-events-none select-none">
      {/* Background Cinematic Atmosphere */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/60 pointer-events-none" />

      {/* Top Header Row */}
      <div className="relative z-10 flex items-center justify-between w-full pointer-events-auto">
        {/* Brand & Partner Emblem */}
        <div className="flex items-center space-x-3.5 bg-black/60 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 shadow-xl">
          <img src="/images/logo.svg" alt="DG Logo" className="h-7 w-auto object-contain" />
          <div className="border-l border-white/15 pl-3">
            <span className="text-xs font-black tracking-widest text-white uppercase font-sans block">
              VOLCANO SPEEDWAY
            </span>
            <span className="text-[10px] text-orange-400 font-mono tracking-wider font-semibold block">
              GRAND PRIX • MOTORSPORTS
            </span>
          </div>
        </div>

        {/* Driver Career Passport Pill */}
        <button
          onClick={handleCareerClick}
          className="group flex items-center space-x-3 bg-black/60 hover:bg-[#1a1d22]/90 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 hover:border-orange-500/50 transition-all duration-200 shadow-xl cursor-pointer"
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center font-black text-xs text-black shadow-md">
            L{driverProfile.level}
          </div>
          <div className="text-left">
            <div className="flex items-center space-x-1.5">
              <span className="text-xs font-bold text-white group-hover:text-orange-400 transition-colors">
                {driverProfile.title}
              </span>
              <span className="text-[10px] text-amber-400 flex items-center">
                ★ {totalStars}
              </span>
            </div>
            <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden mt-1">
              <div
                className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full"
                style={{ width: `${xpProgress}%` }}
              />
            </div>
          </div>
        </button>
      </div>

      {/* Center Hero Card / Action Zone */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-xl mx-auto pointer-events-auto my-auto">
        {/* Circuit Badge */}
        <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-red-500/20 via-orange-500/20 to-amber-500/20 border border-orange-500/40 px-4 py-1.5 rounded-full mb-4 shadow-lg backdrop-blur-md">
          <Flame className="w-4 h-4 text-orange-400 animate-pulse" />
          <span className="text-xs font-mono font-bold tracking-widest text-orange-300 uppercase">
            CALDERA APEX CHAMPIONSHIP
          </span>
        </div>

        {/* Title */}
        <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white uppercase drop-shadow-[0_4px_30px_rgba(0,0,0,0.9)] mb-2 font-sans">
          VOLCANO <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-amber-400 to-red-500">SPEEDWAY</span>
        </h1>
        <p className="text-sm sm:text-base text-gray-300/90 font-medium max-w-md drop-shadow-md mb-8">
          High-velocity arcade racing over volcanic ridges, magma drops, and dynamic jumps.
        </p>

        {/* Track Mode Selector Pill */}
        <div className="flex items-center space-x-2 bg-black/70 backdrop-blur-md p-1.5 rounded-2xl border border-white/10 mb-8 shadow-2xl">
          <button
            onClick={handleTrackToggle}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-2 ${
              trackDirection === 'reverse'
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-black shadow-lg shadow-orange-500/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>REVERSE CIRCUIT (DEFAULT)</span>
          </button>
          <button
            onClick={handleTrackToggle}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-2 ${
              trackDirection === 'normal'
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-black shadow-lg shadow-orange-500/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>CLASSIC CIRCUIT</span>
          </button>
        </div>

        {/* Primary Launch Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center">
          {/* Big Start Button */}
          <button
            onClick={handleStartClick}
            className="w-full sm:w-auto whitespace-nowrap px-4 py-4 bg-gradient-to-r from-orange-500 via-amber-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-black font-black text-sm uppercase tracking-wider rounded-2xl shadow-[0_0_40px_rgba(249,115,22,0.6)] flex items-center justify-center space-x-3 transition-transform active:scale-95 cursor-pointer hover:shadow-[0_0_55px_rgba(249,115,22,0.85)] group"
          >
            <Play className="w-5 h-5 fill-black stroke-black group-hover:scale-110 transition-transform" />
            <span>IGNITE ENGINE • START RACE</span>
          </button>

          {/* Garage Showcase Button */}
          <button
            onClick={handleGarageClick}
            className="w-full sm:w-auto whitespace-nowrap px-4 py-4 bg-[#181a1f]/90 hover:bg-[#22262d] text-white font-bold text-sm uppercase tracking-wider rounded-2xl border border-white/15 hover:border-orange-500/50 flex items-center justify-center space-x-2.5 transition-all shadow-xl active:scale-95 cursor-pointer"
          >
            <Car className="w-4 h-4 text-orange-400" />
            <span>GARAGE & LIVERY</span>
          </button>
        </div>
      </div>

      {/* Bottom Controls / Tips Bar */}
      <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between w-full text-xs text-gray-400 pointer-events-auto border-t border-white/10 pt-4 bg-black/40 backdrop-blur-md px-6 py-3 rounded-2xl">
        <div className="flex items-center space-x-4 mb-2 sm:mb-0">
          <div className="flex items-center space-x-1.5">
            <kbd className="bg-white/10 px-2 py-0.5 rounded text-white font-mono text-[11px] border border-white/10">W A S D</kbd>
            <span className="text-gray-400">Drive</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <kbd className="bg-white/10 px-2 py-0.5 rounded text-white font-mono text-[11px] border border-white/10">SPACE</kbd>
            <span className="text-gray-400">Drift</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <kbd className="bg-white/10 px-2 py-0.5 rounded text-white font-mono text-[11px] border border-white/10">SHIFT</kbd>
            <span className="text-gray-400">Hyper Nitro</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <kbd className="bg-white/10 px-2 py-0.5 rounded text-white font-mono text-[11px] border border-white/10">C</kbd>
            <span className="text-gray-400">Camera</span>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-[11px] text-orange-400 font-medium">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Rev in the green zone at the countdown for a Nitro Launch!</span>
        </div>
      </div>
    </div>
  );
};
