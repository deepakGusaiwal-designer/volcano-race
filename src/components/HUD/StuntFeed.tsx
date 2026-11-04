import React from 'react';
import { useGameStore } from '../../store/useGameStore';
import { Flame, Sparkles, Award } from 'lucide-react';

export const StuntFeed: React.FC = () => {
  const stuntScore = useGameStore((state) => state.stuntScore);
  const stuntFeed = useGameStore((state) => state.stuntFeed);
  const comboMultiplier = useGameStore((state) => state.comboMultiplier);
  const gameState = useGameStore((state) => state.gameState);

  if (gameState !== 'racing') return null;

  return (
    <div className="fixed top-20 right-6 z-20 flex flex-col items-end pointer-events-none select-none max-w-xs">
      {/* Active Stunt Bank & Multiplier */}
      {stuntScore > 0 && (
        <div className="flex items-center space-x-2 bg-black/75 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-orange-500/40 shadow-[0_0_20px_rgba(249,115,22,0.3)] mb-1.5 animate-in fade-in slide-in-from-right-3 duration-200">
          <div className="flex items-center space-x-1 text-orange-400">
            <Flame className="w-3.5 h-3.5 fill-orange-500 animate-pulse" />
            <span className="text-[10px] font-mono font-bold tracking-wider">SKILL</span>
          </div>
          <span className="text-sm font-black font-mono text-white tracking-wider">
            {stuntScore.toLocaleString()}
          </span>
          {comboMultiplier > 1 && (
            <span className="bg-gradient-to-r from-red-500 to-orange-500 text-black text-[9px] font-black px-1.5 py-0.5 rounded font-mono shadow">
              x{comboMultiplier.toFixed(1)}
            </span>
          )}
        </div>
      )}

      {/* Floating Stunt Notifications Stack */}
      <div className="flex flex-col items-end space-y-1.5 overflow-hidden">
        {stuntFeed.slice(0, 3).map((stunt) => (
          <div
            key={stunt.id}
            className="flex items-center space-x-2 bg-gradient-to-r from-black/80 to-[#1e2025]/90 border border-white/15 px-2.5 py-1 rounded-xl shadow-lg backdrop-blur-sm animate-in slide-in-from-right-4 fade-in duration-200"
          >
            {stunt.type === 'air' && <Sparkles className="w-3 h-3 text-cyan-400" />}
            {stunt.type === 'drift' && <Flame className="w-3 h-3 text-orange-400" />}
            {stunt.type === 'overtake' && <Award className="w-3 h-3 text-amber-400" />}
            {stunt.type === 'boost' && <Sparkles className="w-3 h-3 text-emerald-400" />}

            <span className="text-[10.5px] font-black tracking-wide text-white font-sans uppercase">
              {stunt.text}
            </span>
            <span className="text-[10.5px] font-mono font-bold text-amber-400">
              +{stunt.points}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
