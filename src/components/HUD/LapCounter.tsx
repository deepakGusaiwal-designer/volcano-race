import React from 'react';
import { Flag, Timer, Award, Trophy } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';

export const LapCounter: React.FC = () => {
  const lap = useGameStore((state) => state.lap);
  const totalLaps = useGameStore((state) => state.totalLaps);
  const racePosition = useGameStore((state) => state.racePosition || 1);
  const totalRacers = useGameStore((state) => state.totalRacers || 4);
  const lapTime = useGameStore((state) => state.lapTime);
  const bestLapTime = useGameStore((state) => state.bestLapTime);
  const checkpointIndex = useGameStore((state) => state.checkpointIndex);
  const totalCheckpoints = useGameStore((state) => state.totalCheckpoints);
  const coinsCollected = useGameStore((state) => state.coinsCollected);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return `${mins}:${secs.padStart(4, '0')}`;
  };

  const getRankBadge = (pos: number) => {
    switch (pos) {
      case 1:
        return { text: '1ST', color: 'text-yellow-400 glow-orange bg-yellow-950/40 border-yellow-500/50' };
      case 2:
        return { text: '2ND', color: 'text-cyan-300 bg-cyan-950/40 border-cyan-500/40' };
      case 3:
        return { text: '3RD', color: 'text-orange-400 bg-orange-950/40 border-orange-500/40' };
      default:
        return { text: `${pos}TH`, color: 'text-gray-300 bg-gray-900/50 border-gray-600/30' };
    }
  };

  const rank = getRankBadge(racePosition);

  return (
    <div className="racing-panel rounded-2xl p-3 flex flex-col space-y-1.5 select-none shadow-xl border border-orange-500/30 min-w-44 sm:min-w-48">
      {/* Live Race Position */}
      <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
        <div className="flex items-center space-x-1.5 text-cyan-400 font-bold text-xs">
          <Trophy className="w-3.5 h-3.5" />
          <span>POSITION</span>
        </div>
        <div className="flex items-baseline space-x-1">
          <span className={`text-base font-black px-1.5 py-0.5 rounded border ${rank.color}`}>
            {rank.text}
          </span>
          <span className="text-gray-500 text-[10px] font-semibold"> / {totalRacers}</span>
        </div>
      </div>

      {/* Current Lap */}
      <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
        <div className="flex items-center space-x-1.5 text-orange-400 font-bold text-xs">
          <Flag className="w-3.5 h-3.5" />
          <span>LAP</span>
        </div>
        <div className="text-base font-black tracking-tight text-white">
          <span className="text-orange-400 glow-orange">{lap}</span>
          <span className="text-gray-500 text-xs font-semibold"> / {totalLaps}</span>
        </div>
      </div>

      {/* Lap Timer */}
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-gray-400 flex items-center space-x-1">
          <Timer className="w-3 h-3" />
          <span>CURRENT</span>
        </span>
        <span className="font-mono text-xs font-bold text-yellow-300">
          {formatTime(lapTime)}
        </span>
      </div>

      {/* Best Lap */}
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-gray-400 flex items-center space-x-1">
          <Award className="w-3 h-3 text-yellow-400" />
          <span>BEST</span>
        </span>
        <span className="font-mono text-xs font-bold text-green-400">
          {bestLapTime ? formatTime(bestLapTime) : '--:--.-'}
        </span>
      </div>

      {/* Checkpoints & Coins */}
      <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[10px] text-gray-300">
        <div>
          <span>GATE: </span>
          <span className="text-cyan-400 font-bold">
            {checkpointIndex} / {totalCheckpoints}
          </span>
        </div>
        <div>
          <span>COINS: </span>
          <span className="text-yellow-400 font-bold font-mono">
            ⭐ {coinsCollected}
          </span>
        </div>
      </div>
    </div>
  );
};
