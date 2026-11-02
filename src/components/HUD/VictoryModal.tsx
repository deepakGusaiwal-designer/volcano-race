import React from 'react';
import { Trophy, RotateCcw, Award, Star } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';

interface VictoryModalProps {
  onRestart: () => void;
}

export const VictoryModal: React.FC<VictoryModalProps> = ({ onRestart }) => {
  const finished = useGameStore((state) => state.finished);
  const racePosition = useGameStore((state) => state.racePosition || 1);
  const totalTime = useGameStore((state) => state.totalTime);
  const bestLapTime = useGameStore((state) => state.bestLapTime);
  const coinsCollected = useGameStore((state) => state.coinsCollected);

  if (!finished) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(2);
    return `${mins}:${secs.padStart(5, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="racing-panel rounded-3xl p-6 sm:p-8 max-w-md w-full border-2 border-orange-500 shadow-[0_0_50px_rgba(255,94,19,0.5)] flex flex-col items-center text-center">
        {/* Trophy Icon */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-yellow-600 to-yellow-300 flex items-center justify-center mb-4 shadow-[0_0_25px_#ffbb00]">
          <Trophy className="w-9 h-9 text-black fill-black" />
        </div>

        <h2 className="text-2xl sm:text-3xl font-black text-white glow-orange tracking-wider uppercase mb-1">
          {racePosition === 1
            ? '1ST PLACE VICTORY! 🏆'
            : racePosition === 2
            ? '2ND PLACE PODIUM! 🥈'
            : racePosition === 3
            ? '3RD PLACE PODIUM! 🥉'
            : 'RACE FINISHED! 🏁'}
        </h2>
        <p className="text-orange-300/80 text-sm mb-6 font-semibold">
          {racePosition === 1
            ? 'You conquered the Volcano Circuit Grand Prix!'
            : `Finished in Position #${racePosition} against the fleet!`}
        </p>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 w-full mb-6">
          <div className="bg-black/50 border border-white/10 rounded-xl p-3 flex flex-col items-center">
            <span className="text-[11px] text-gray-400 font-semibold mb-0.5">TOTAL TIME</span>
            <span className="text-xl font-mono font-bold text-yellow-400">
              {formatTime(totalTime)}
            </span>
          </div>

          <div className="bg-black/50 border border-white/10 rounded-xl p-3 flex flex-col items-center">
            <span className="text-[11px] text-gray-400 font-semibold mb-0.5 flex items-center space-x-1">
              <Award className="w-3.5 h-3.5 text-green-400" />
              <span>BEST LAP</span>
            </span>
            <span className="text-xl font-mono font-bold text-green-400">
              {bestLapTime ? formatTime(bestLapTime) : '--:--'}
            </span>
          </div>

          <div className="col-span-2 bg-black/50 border border-white/10 rounded-xl p-3 flex items-center justify-between px-6">
            <span className="text-xs text-gray-400 font-semibold flex items-center space-x-1.5">
              <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              <span>COINS COLLECTED</span>
            </span>
            <span className="text-lg font-mono font-black text-yellow-300">
              {coinsCollected}
            </span>
          </div>
        </div>

        {/* Play Again Button */}
        <button
          onClick={onRestart}
          className="w-full py-3.5 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-black tracking-wider text-base rounded-2xl shadow-[0_0_20px_#ff5e13] flex items-center justify-center space-x-2 transition-transform active:scale-95 mb-4"
        >
          <RotateCcw className="w-5 h-5" />
          <span>RACE AGAIN</span>
        </button>

        {/* Official Sponsor Footer */}
        <div className="flex items-center justify-center space-x-2 pt-2 border-t border-white/10 w-full">
          <img src="/images/logo.svg" alt="DG Logo" className="h-4 w-auto object-contain" />
          <span className="text-[10px] uppercase tracking-widest text-gray-400 font-mono">
            Presented by Deepak Gusaiwal Motorsports
          </span>
        </div>
      </div>
    </div>
  );
};
