import React from 'react';
import { Zap } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';

export const NitroBar: React.FC = () => {
  const nitro = useGameStore((state) => state.nitro);
  const isBoosting = useGameStore((state) => state.isBoosting);

  return (
    <div className="racing-panel rounded-2xl p-3 flex flex-col select-none shadow-xl border border-cyan-500/30 w-52 sm:w-60">
      <div className="flex items-center justify-between text-xs font-bold mb-1.5">
        <span className="flex items-center space-x-1 text-cyan-400">
          <Zap className={`w-3.5 h-3.5 ${isBoosting ? 'animate-bounce text-cyan-300' : ''}`} />
          <span>NITRO TANK</span>
        </span>
        <span className="text-cyan-300 font-mono">{nitro}%</span>
      </div>

      {/* Meter Bar */}
      <div className="w-full h-3 bg-gray-950 rounded-full overflow-hidden p-0.5 border border-cyan-900/60 flex">
        <div
          className={`h-full rounded-full transition-all duration-100 ${
            isBoosting
              ? 'bg-gradient-to-r from-cyan-400 to-white shadow-[0_0_12px_#00f0ff]'
              : 'bg-gradient-to-r from-cyan-600 to-cyan-400'
          }`}
          style={{ width: `${nitro}%` }}
        />
      </div>

      <div className="text-[9px] text-gray-400 text-center mt-1">
        Collect <span className="text-cyan-300 font-semibold">⚡ Nitro Tanks</span> on track to trigger Hyper Boost • Drift to recharge!
      </div>
    </div>
  );
};
