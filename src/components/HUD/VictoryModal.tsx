import React, { useEffect } from 'react';
import {
  Trophy,
  RotateCcw,
  Award,
  Star,
  Car,
  Flame,
  Shield,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { soundEffects } from '../../audio/SoundEffects';

interface VictoryModalProps {
  onRestart: () => void;
}

export const VictoryModal: React.FC<VictoryModalProps> = ({ onRestart }) => {
  const gameState = useGameStore((state) => state.gameState);
  const finished = useGameStore((state) => state.finished);
  const racePosition = useGameStore((state) => state.racePosition || 1);
  const totalTime = useGameStore((state) => state.totalTime);
  const bestLapTime = useGameStore((state) => state.bestLapTime);
  const coinsCollected = useGameStore((state) => state.coinsCollected);
  const stuntScore = useGameStore((state) => state.stuntScore);
  const driverProfile = useGameStore((state) => state.driverProfile);
  const toggleCarSelect = useGameStore((state) => state.toggleCarSelect);
  const setCareerModalOpen = useGameStore((state) => state.setCareerModalOpen);
  const setGameState = useGameStore((state) => state.setGameState);

  // Close / Restart on Enter, Space, or R
  useEffect(() => {
    if (gameState !== 'victory' && !finished) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        soundEffects.playCoin();
        onRestart();
        setGameState('welcome');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, finished, onRestart, setGameState]);

  if (gameState !== 'victory' && !finished) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(2);
    return `${mins}:${secs.padStart(5, '0')}`;
  };

  const handleRestartClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    soundEffects.playCoin();
    onRestart();
    setGameState('countdown');
  };

  const handleReturnToGrid = (e: React.MouseEvent) => {
    e.stopPropagation();
    soundEffects.playClick();
    onRestart();
    setGameState('welcome');
  };

  const handleGarageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    soundEffects.playClick();
    toggleCarSelect();
  };

  const isWin = racePosition === 1;
  const isPodium = racePosition <= 3;
  const xpEarned = isWin ? 600 : isPodium ? 400 : 250;
  const xpInCurrentLevel = driverProfile.xp % 1000;
  const xpPct = Math.min(100, Math.round((xpInCurrentLevel / 1000) * 100));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-300 pointer-events-auto select-none"
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="relative rounded-3xl p-6 sm:p-8 max-w-lg w-full bg-[#121418]/95 border-2 border-orange-500 shadow-[0_0_60px_rgba(255,94,19,0.5)] flex flex-col items-center text-center pointer-events-auto overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Volcanic Ambient Radiance */}
        <div className="absolute top-0 left-0 right-0 h-36 bg-gradient-to-b from-orange-500/20 to-transparent pointer-events-none" />

        {/* Podium Trophy Icon */}
        <div
          className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-3 shadow-2xl relative z-10 ${
            isWin
              ? 'bg-gradient-to-tr from-yellow-500 to-amber-300 shadow-[0_0_35px_#ffbb00]'
              : isPodium
              ? 'bg-gradient-to-tr from-slate-400 to-slate-200 shadow-[0_0_25px_rgba(255,255,255,0.4)]'
              : 'bg-gradient-to-tr from-orange-700 to-amber-600 shadow-[0_0_20px_rgba(234,88,12,0.4)]'
          }`}
        >
          <Trophy className="w-10 h-10 text-black fill-black" />
        </div>

        {/* Title */}
        <h2 className="text-2xl sm:text-3xl font-black text-white tracking-wider uppercase mb-1 z-10 font-sans">
          {racePosition === 1
            ? 'GRAND PRIX CHAMPION! 🏆'
            : racePosition === 2
            ? '2ND PLACE PODIUM! 🥈'
            : racePosition === 3
            ? '3RD PLACE PODIUM! 🥉'
            : `POSITION #${racePosition} FINISH! 🏁`}
        </h2>
        <p className="text-orange-300/80 text-xs sm:text-sm mb-4 font-semibold z-10">
          {isWin
            ? 'Dominant display on the Volcanic Circuit! Fleet conquered!'
            : `Completed all 3 laps across the volcano in Position #${racePosition}!`}
        </p>

        {/* 3-Star Circuit Mastery Challenge Badges */}
        <div className="w-full bg-black/40 border border-white/10 rounded-2xl p-3 mb-4 z-10 flex items-center justify-around">
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center border border-amber-400/40 text-amber-300 mb-1">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
            </div>
            <span className="text-[10px] font-bold text-white uppercase">FINISHED</span>
            <span className="text-[9px] text-emerald-400 font-mono">COMPLETE</span>
          </div>

          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center border mb-1 ${
                isPodium
                  ? 'bg-amber-500/20 border-amber-400/40 text-amber-300'
                  : 'bg-white/5 border-white/10 text-gray-500'
              }`}
            >
              <Star className={`w-4 h-4 ${isPodium ? 'fill-amber-400 text-amber-400' : 'text-gray-600'}`} />
            </div>
            <span className="text-[10px] font-bold text-white uppercase">PODIUM TOP 3</span>
            <span className={`text-[9px] font-mono ${isPodium ? 'text-emerald-400' : 'text-gray-500'}`}>
              {isPodium ? 'CLEARED' : 'MISSED'}
            </span>
          </div>

          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center border mb-1 ${
                isWin || totalTime < 185
                  ? 'bg-amber-500/20 border-amber-400/40 text-amber-300'
                  : 'bg-white/5 border-white/10 text-gray-500'
              }`}
            >
              <Star
                className={`w-4 h-4 ${
                  isWin || totalTime < 185 ? 'fill-amber-400 text-amber-400' : 'text-gray-600'
                }`}
              />
            </div>
            <span className="text-[10px] font-bold text-white uppercase">APEX RECORD</span>
            <span
              className={`text-[9px] font-mono ${
                isWin || totalTime < 185 ? 'text-emerald-400' : 'text-gray-500'
              }`}
            >
              {isWin ? '1ST PLACE' : totalTime < 185 ? '< 3:05' : 'MISSED'}
            </span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2.5 w-full mb-4 z-10">
          <div className="bg-black/50 border border-white/10 rounded-xl p-2.5 flex flex-col items-center">
            <span className="text-[10px] text-gray-400 font-bold mb-0.5">TOTAL TIME</span>
            <span className="text-base font-mono font-bold text-amber-400">
              {formatTime(totalTime)}
            </span>
          </div>

          <div className="bg-black/50 border border-white/10 rounded-xl p-2.5 flex flex-col items-center">
            <span className="text-[10px] text-gray-400 font-bold mb-0.5 flex items-center space-x-1">
              <Award className="w-3 h-3 text-emerald-400" />
              <span>BEST LAP</span>
            </span>
            <span className="text-base font-mono font-bold text-emerald-400">
              {bestLapTime ? formatTime(bestLapTime) : '--:--'}
            </span>
          </div>

          <div className="bg-black/50 border border-white/10 rounded-xl p-2.5 flex flex-col items-center">
            <span className="text-[10px] text-gray-400 font-bold mb-0.5 flex items-center space-x-1">
              <Flame className="w-3 h-3 text-orange-400" />
              <span>SKILLS</span>
            </span>
            <span className="text-base font-mono font-bold text-orange-400">
              +{stuntScore.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Driver XP Reward Progress Bar */}
        <div className="w-full bg-[#181a20] border border-white/10 rounded-xl p-3 mb-5 z-10 text-left">
          <div className="flex justify-between items-center text-xs font-bold mb-1">
            <span className="text-white flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
              <span>DRIVER LEVEL {driverProfile.level} ({driverProfile.title})</span>
            </span>
            <span className="font-mono text-emerald-400 font-bold">+{xpEarned} XP</span>
          </div>
          <div className="w-full h-2 bg-black/60 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full transition-all duration-500"
              style={{ width: `${xpPct}%` }}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col space-y-2 w-full z-10">
          {/* Race Again */}
          <button
            type="button"
            onClick={handleRestartClick}
            className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-black font-black tracking-wider text-sm rounded-xl shadow-[0_0_25px_#ff5e13] flex items-center justify-center space-x-2 transition-transform active:scale-95 cursor-pointer pointer-events-auto uppercase"
          >
            <RotateCcw className="w-4 h-4" />
            <span>RACE AGAIN (ENTER)</span>
          </button>

          {/* Return to Grid / Hero Launch */}
          <button
            type="button"
            onClick={handleReturnToGrid}
            className="w-full py-2.5 bg-white/10 hover:bg-white/20 text-gray-200 font-bold tracking-wider text-xs rounded-xl border border-white/10 flex items-center justify-center space-x-2 transition-transform active:scale-95 cursor-pointer pointer-events-auto uppercase"
          >
            <span>RETURN TO STARTING GRID</span>
          </button>

          {/* Select New Car Button */}
          <button
            type="button"
            onClick={handleGarageClick}
            className="w-full py-2.5 bg-black/40 hover:bg-black/60 text-gray-300 font-bold tracking-wider text-xs rounded-xl border border-white/5 flex items-center justify-center space-x-2 transition-transform active:scale-95 cursor-pointer pointer-events-auto uppercase"
          >
            <Car className="w-3.5 h-3.5 text-orange-400" />
            <span>CHANGE CAR & LIVERY</span>
          </button>
        </div>

        {/* Official Sponsor Footer */}
        <div className="flex items-center justify-center space-x-2 pt-3 border-t border-white/10 w-full mt-3 z-10">
          <img src="/images/logo.svg" alt="DG Logo" className="h-4 w-auto object-contain" />
          <span className="text-[10px] uppercase tracking-widest text-gray-400 font-mono">
            Deepak Gusaiwal Motorsports
          </span>
        </div>
      </div>
    </div>
  );
};
