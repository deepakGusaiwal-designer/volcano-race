import React, { useEffect } from 'react';
import { useGameStore } from '../../store/useGameStore';
import {
  Play,
  Car,
  Trophy,
  Sparkles,
  Compass,
  Flame,
  ChevronLeft,
  ChevronRight,
  Gauge,
  Zap,
  Palette,
  Shield,
} from 'lucide-react';
import { soundEffects } from '../../audio/SoundEffects';
import { CAR_PRESETS, CarModelId } from '../../types/game';

interface WelcomeScreenProps {
  onStartRace: () => void;
  onToggleTrackDirection: () => void;
  onSelectCar?: (carId: CarModelId) => void;
  onSelectPaint?: (hexColor: string) => void;
}

const CAR_IDS: CarModelId[] = ['mazda', 'iridium', 'rd09'];

const PAINT_LIVERIES = [
  { name: 'Apex White', hex: '#ffffff' },
  { name: 'Volcanic Crimson', hex: '#dc2626' },
  { name: 'Cyber Cyan', hex: '#06b6d4' },
  { name: 'Midnight Shadow', hex: '#111827' },
  { name: 'Sunset Gold', hex: '#f59e0b' },
  { name: 'Acid Emerald', hex: '#10b981' },
];

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onStartRace,
  onToggleTrackDirection,
  onSelectCar,
  onSelectPaint,
}) => {
  const gameState = useGameStore((state) => state.gameState);
  const driverProfile = useGameStore((state) => state.driverProfile);
  const trackDirection = useGameStore((state) => state.trackDirection);
  const toggleCarSelect = useGameStore((state) => state.toggleCarSelect);
  const setCareerModalOpen = useGameStore((state) => state.setCareerModalOpen);
  const carId = useGameStore((state) => state.carId);
  const setCarId = useGameStore((state) => state.setCarId);
  const carPaint = useGameStore((state) => state.carPaint);
  const setCarPaint = useGameStore((state) => state.setCarPaint);
  const isCarSelectOpen = useGameStore((state) => state.isCarSelectOpen);
  const isCareerModalOpen = useGameStore((state) => state.isCareerModalOpen);

  const activeCar = CAR_PRESETS[carId] || CAR_PRESETS.mazda;
  const currentCarIndex = CAR_IDS.indexOf(carId);

  // Keyboard navigation for authentic arcade feel (Enter / Space / Arrow keys)
  useEffect(() => {
    if (gameState !== 'welcome' || isCarSelectOpen || isCareerModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        soundEffects.playRevEngine();
        onStartRace();
      } else if (e.code === 'ArrowLeft' || e.code === 'KeyQ') {
        e.preventDefault();
        const prevIdx = (currentCarIndex - 1 + CAR_IDS.length) % CAR_IDS.length;
        handleSwitchCar(CAR_IDS[prevIdx]);
      } else if (e.code === 'ArrowRight' || e.code === 'KeyE') {
        e.preventDefault();
        const nextIdx = (currentCarIndex + 1) % CAR_IDS.length;
        handleSwitchCar(CAR_IDS[nextIdx]);
      } else if (e.code === 'KeyG') {
        e.preventDefault();
        soundEffects.playClick();
        toggleCarSelect();
      } else if (e.code === 'KeyT') {
        e.preventDefault();
        soundEffects.playClick();
        onToggleTrackDirection();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, isCarSelectOpen, isCareerModalOpen, currentCarIndex, onStartRace, onToggleTrackDirection]);

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

  const handleSwitchCar = (newCarId: CarModelId) => {
    soundEffects.playCoin();
    setCarId(newCarId);
    if (onSelectCar) {
      onSelectCar(newCarId);
    }
  };

  const handleSelectPaintColor = (hex: string) => {
    soundEffects.playClick();
    setCarPaint(hex);
    if (onSelectPaint) {
      onSelectPaint(hex);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-between p-4 sm:p-8 pointer-events-none select-none font-sans overflow-hidden">
      {/* Cinematic NFS Underground Vignette & Street Grunge Overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/70 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/20 to-black/75 pointer-events-none" />

      {/* Top Header Row */}
      <div className="relative z-10 flex items-center justify-between w-full pointer-events-auto">
        {/* Brand & Series Emblem */}
        <div className="flex items-center space-x-3 bg-black/75 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.8)]">
          <img src="/images/logo.svg" alt="DG Logo" className="h-6 sm:h-7 w-auto object-contain" />
          <div className="border-l border-white/15 pl-3">
            <div className="flex items-center space-x-1.5">
              <span className="text-xs font-black tracking-widest text-white uppercase italic">
                VOLCANO UNDERGROUND
              </span>
              <span className="text-[9px] bg-red-600/80 text-white font-mono font-black px-1.5 py-0.2 rounded-xs uppercase tracking-tighter">
                APEX
              </span>
            </div>
            <span className="text-[9.5px] text-orange-400 font-mono tracking-wider font-bold block">
              UNDERGROUND STREET RACING LEAGUE
            </span>
          </div>
        </div>

        {/* Driver Career Passport Pill */}
        <button
          onClick={handleCareerClick}
          className="group flex items-center space-x-3 bg-black/75 hover:bg-[#1a1d22]/90 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 hover:border-orange-500/50 transition-all duration-200 shadow-xl cursor-pointer"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center font-black text-xs text-black shadow-md">
            L{driverProfile.level}
          </div>
          <div className="text-left">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-black italic tracking-wide text-white group-hover:text-orange-400 transition-colors uppercase">
                {driverProfile.title}
              </span>
              <span className="text-[10px] text-amber-400 font-bold flex items-center">
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

      {/* Main Center Stage: Left-Docked Underground Street Menu & Right-Docked Tuner Showcase */}
      <div className="relative z-10 flex flex-col lg:flex-row items-stretch justify-between w-full pointer-events-auto my-auto gap-6 sm:gap-10">
        
        {/* LEFT COLUMN: Slanted Street Racer Menu */}
        <div className="flex flex-col justify-center max-w-xl text-left">
          {/* Underground League Badge */}
          <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-red-600/30 via-orange-600/30 to-amber-600/30 border-l-4 border-orange-500 px-3.5 py-1.5 backdrop-blur-md mb-3 -skew-x-6 w-fit shadow-lg">
            <Flame className="w-4 h-4 text-orange-400 animate-pulse" />
            <span className="text-[11px] font-mono font-black tracking-widest text-orange-300 uppercase">
              CALDERA APEX • NIGHT STREET CIRCUIT
            </span>
          </div>

          {/* NFS Underground Slanted Title */}
          <div className="mb-4 overflow-visible">
            <h1 className="text-5xl sm:text-7xl font-black italic tracking-tight uppercase drop-shadow-[0_8px_35px_rgba(0,0,0,0.95)] font-sans leading-none overflow-visible">
              <span className="inline-block text-white drop-shadow-[0_2px_15px_rgba(255,255,255,0.3)] pr-4">VOLCANO</span>
              <br />
              <span className="inline-block pr-6 sm:pr-8 py-1 text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-amber-400 to-red-500">
                UNDERGROUND
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-gray-300 font-semibold tracking-wide mt-2 max-w-md drop-shadow-md">
              Sanctioned illegal street racing across volcanic ridges, hairpin chicanes, and active magma drop-offs.
            </p>
          </div>

          {/* Action Menu Buttons Stack */}
          <div className="flex flex-col space-y-3 w-full sm:w-[380px]">
            {/* Primary Start Race Button */}
            <button
              onClick={handleStartClick}
              className="relative group px-6 py-4 bg-gradient-to-r from-orange-500 via-amber-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-black font-black text-sm uppercase italic tracking-wider rounded-xl shadow-[0_0_35px_rgba(249,115,22,0.6)] flex items-center justify-between transition-all active:scale-95 cursor-pointer border border-yellow-300/40 hover:shadow-[0_0_50px_rgba(249,115,22,0.85)] -skew-x-6"
            >
              <div className="flex items-center space-x-3">
                <Play className="w-5 h-5 fill-black stroke-black group-hover:scale-125 transition-transform" />
                <span className="text-base tracking-tight font-black">IGNITE ENGINE • START RACE</span>
              </div>
              <span className="text-[10px] bg-black/85 text-yellow-300 font-mono px-2 py-0.5 rounded font-black tracking-normal not-italic">
                ENTER
              </span>
            </button>

            {/* Garage & Livery Button */}
            <button
              onClick={handleGarageClick}
              className="px-5 py-3.5 bg-[#121418]/90 hover:bg-[#1a1d24] text-white font-bold text-xs uppercase tracking-wider rounded-xl border border-white/15 hover:border-orange-500/60 flex items-center justify-between transition-all shadow-xl active:scale-95 cursor-pointer -skew-x-6 hover:shadow-[0_0_20px_rgba(249,115,22,0.3)]"
            >
              <div className="flex items-center space-x-2.5">
                <Car className="w-4 h-4 text-orange-400" />
                <span className="italic font-black text-sm">GARAGE & TUNING LIVERY</span>
              </div>
              <span className="text-[10px] bg-white/10 text-gray-300 font-mono px-2 py-0.5 rounded font-bold not-italic">
                G
              </span>
            </button>

            {/* Circuit Direction Toggle Button */}
            <button
              onClick={handleTrackToggle}
              className="px-5 py-3.5 bg-[#121418]/90 hover:bg-[#1a1d24] text-white font-bold text-xs uppercase tracking-wider rounded-xl border border-white/15 hover:border-cyan-500/60 flex items-center justify-between transition-all shadow-xl active:scale-95 cursor-pointer -skew-x-6 hover:shadow-[0_0_20px_rgba(0,240,255,0.3)]"
            >
              <div className="flex items-center space-x-2.5">
                <Compass className="w-4 h-4 text-cyan-400" />
                <span className="italic font-black text-sm">
                  CIRCUIT: {trackDirection === 'reverse' ? 'REVERSE (DEFAULT)' : 'CLASSIC'}
                </span>
              </div>
              <span className="text-[10px] bg-white/10 text-gray-300 font-mono px-2 py-0.5 rounded font-bold not-italic">
                T
              </span>
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: NFS Underground Tuner Machine Showcase */}
        <div className="flex flex-col justify-center items-end">
          <div className="w-full sm:w-[360px] bg-black/80 backdrop-blur-xl p-5 rounded-2xl border border-white/15 shadow-[0_12px_45px_rgba(0,0,0,0.9)] relative overflow-hidden -skew-x-3">
            {/* Top Accent Stripe */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 via-amber-400 to-cyan-400" />

            {/* Machine Header & Quick Switcher */}
            <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2.5">
              <div>
                <span className="text-[9.5px] font-mono font-extrabold uppercase tracking-widest text-orange-400 block">
                  SELECTED MACHINE
                </span>
                <h3 className="text-xl sm:text-2xl font-black italic text-white uppercase tracking-tight pr-2">
                  {activeCar.name}
                </h3>
                <span className="text-[10.5px] font-medium text-gray-400 block">
                  {activeCar.subtitle}
                </span>
              </div>

              {/* Prev / Next Car Selector Arrows */}
              <div className="flex items-center space-x-1.5 ml-2">
                <button
                  onClick={() => {
                    const prevIdx = (currentCarIndex - 1 + CAR_IDS.length) % CAR_IDS.length;
                    handleSwitchCar(CAR_IDS[prevIdx]);
                  }}
                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-orange-500 hover:text-black text-white flex items-center justify-center transition-all cursor-pointer border border-white/10"
                  title="Previous Car (Left Arrow / Q)"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    const nextIdx = (currentCarIndex + 1) % CAR_IDS.length;
                    handleSwitchCar(CAR_IDS[nextIdx]);
                  }}
                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-orange-500 hover:text-black text-white flex items-center justify-center transition-all cursor-pointer border border-white/10"
                  title="Next Car (Right Arrow / E)"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Performance Tuner Specs Bars */}
            <div className="space-y-2.5 mb-4">
              {/* Top Speed */}
              <div>
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-gray-400 font-bold uppercase tracking-wider flex items-center space-x-1">
                    <Gauge className="w-3 h-3 text-cyan-400" />
                    <span>TOP SPEED</span>
                  </span>
                  <span className="text-white font-mono font-black italic">{activeCar.topSpeed} KM/H</span>
                </div>
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, (activeCar.topSpeed / 260) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Acceleration */}
              <div>
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-gray-400 font-bold uppercase tracking-wider flex items-center space-x-1">
                    <Zap className="w-3 h-3 text-yellow-400" />
                    <span>ACCELERATION</span>
                  </span>
                  <span className="text-white font-mono font-black italic">{activeCar.acceleration} / 10</span>
                </div>
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-yellow-500 to-amber-400 rounded-full transition-all duration-300"
                    style={{ width: `${activeCar.acceleration * 10}%` }}
                  />
                </div>
              </div>

              {/* Handling */}
              <div>
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-gray-400 font-bold uppercase tracking-wider flex items-center space-x-1">
                    <Shield className="w-3 h-3 text-emerald-400" />
                    <span>CORNERING AGILITY</span>
                  </span>
                  <span className="text-white font-mono font-black italic">{activeCar.handling} / 10</span>
                </div>
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-300"
                    style={{ width: `${activeCar.handling * 10}%` }}
                  />
                </div>
              </div>

              {/* Drift Multiplier */}
              <div>
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-gray-400 font-bold uppercase tracking-wider flex items-center space-x-1">
                    <Flame className="w-3 h-3 text-orange-400" />
                    <span>POWER DRIFT MULTIPLIER</span>
                  </span>
                  <span className="text-orange-400 font-mono font-black italic">{activeCar.driftMultiplier}×</span>
                </div>
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, (activeCar.driftMultiplier / 4.2) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Quick Paint Livery Swatches */}
            <div className="border-t border-white/10 pt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center space-x-1">
                  <Palette className="w-3 h-3 text-orange-400" />
                  <span>STREET LIVERY COLOR</span>
                </span>
                <span className="text-[9.5px] font-mono text-gray-400 uppercase">
                  {PAINT_LIVERIES.find((l) => l.hex.toLowerCase() === carPaint.toLowerCase())?.name || 'Custom'}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                {PAINT_LIVERIES.map((livery) => {
                  const isSelected = carPaint.toLowerCase() === livery.hex.toLowerCase();
                  return (
                    <button
                      key={livery.name}
                      onClick={() => handleSelectPaintColor(livery.hex)}
                      className={`w-6 h-6 rounded-full border transition-all cursor-pointer ${
                        isSelected
                          ? 'scale-125 border-white ring-2 ring-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.8)]'
                          : 'border-white/30 hover:scale-110 opacity-75 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: livery.hex }}
                      title={livery.name}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Controls / Marquee Bar */}
      <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between w-full text-xs text-gray-400 pointer-events-auto border-t border-white/10 pt-3 bg-black/60 backdrop-blur-md px-6 py-2.5 rounded-xl">
        <div className="flex items-center space-x-4 mb-2 sm:mb-0">
          <div className="flex items-center space-x-1.5">
            <kbd className="bg-white/10 px-2 py-0.5 rounded text-white font-mono text-[11px] border border-white/10">W A S D</kbd>
            <span className="text-gray-300 font-semibold text-[11px]">Drive</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <kbd className="bg-white/10 px-2 py-0.5 rounded text-white font-mono text-[11px] border border-white/10">SPACE</kbd>
            <span className="text-gray-300 font-semibold text-[11px]">Drift</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <kbd className="bg-white/10 px-2 py-0.5 rounded text-white font-mono text-[11px] border border-white/10">SHIFT</kbd>
            <span className="text-gray-300 font-semibold text-[11px]">Nitro</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <kbd className="bg-white/10 px-2 py-0.5 rounded text-white font-mono text-[11px] border border-white/10">C</kbd>
            <span className="text-gray-300 font-semibold text-[11px]">Camera</span>
          </div>
        </div>

        {/* Pulsating Callout */}
        <div className="flex items-center space-x-2 text-[11.5px] text-amber-400 font-black italic tracking-wide animate-pulse">
          <Sparkles className="w-4 h-4 text-orange-400" />
          <span>PRESS [ENTER] OR [SPACE] TO IGNITE ENGINE & RACE</span>
        </div>
      </div>
    </div>
  );
};
