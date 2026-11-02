import React from 'react';
import { Flame } from 'lucide-react';
import { useGameStore } from '../store/useGameStore';

export const LoadingScreen: React.FC = () => {
  const isLoading = useGameStore((state) => state.isLoading);
  const loadingMessage = useGameStore((state) => state.loadingMessage);
  const loadingProgress = useGameStore((state) => state.loadingProgress);

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0d0706] text-white p-6 select-none">
      {/* Background Volcanic Glow */}
      <div className="absolute inset-0 bg-radial from-orange-950/40 via-transparent to-black pointer-events-none" />

      {/* Title */}
      <div className="flex items-center space-x-3 mb-2 relative">
        <Flame className="w-10 h-10 sm:w-12 sm:h-12 text-orange-500 animate-pulse" />
        <h1 className="text-3xl sm:text-5xl font-black tracking-widest uppercase glow-orange">
          VOLCANO RACE
        </h1>
      </div>
      <p className="text-xs sm:text-sm text-orange-400 font-bold tracking-widest uppercase mb-8">
        Hot Wheels Turbo Driver Experience
      </p>

      {/* Loading Bar Card */}
      <div className="racing-panel rounded-2xl p-6 max-w-md w-full border border-orange-500/40 shadow-[0_0_30px_rgba(255,94,19,0.3)]">
        <div className="flex justify-between text-xs font-semibold mb-2 text-gray-300">
          <span>{loadingMessage}</span>
          <span className="text-orange-400 font-mono">{loadingProgress}%</span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-3 bg-black/60 rounded-full overflow-hidden p-0.5 border border-orange-900/60">
          <div
            className="h-full bg-gradient-to-r from-red-600 via-orange-500 to-yellow-400 rounded-full transition-all duration-200 shadow-[0_0_15px_#ff5e13]"
            style={{ width: `${Math.max(5, loadingProgress)}%` }}
          />
        </div>

        {/* Tips */}
        <div className="mt-4 pt-3 border-t border-white/5 text-[11px] text-gray-400 text-center">
          Pro-Tip: Hit <kbd className="text-yellow-400 font-bold bg-black/50 px-1 py-0.5 rounded">SPACE</kbd> around sharp bends to drift and refill your Nitro gauge!
        </div>
      </div>
    </div>
  );
};
