import React from 'react';
import { Compass } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';

export const MiniMap: React.FC = () => {
  const checkpointIndex = useGameStore((state) => state.checkpointIndex);

  // SVG representation of the volcano circuit loop
  return (
    <div className="racing-panel rounded-2xl p-3 flex flex-col items-center select-none shadow-xl border border-orange-500/30 w-36 sm:w-44">
      <div className="flex items-center justify-between w-full text-[10px] text-gray-400 font-bold mb-1 border-b border-white/5 pb-1">
        <span className="flex items-center space-x-1 text-orange-400">
          <Compass className="w-3 h-3" />
          <span>RADAR</span>
        </span>
        <span className="text-xs text-red-500 font-black animate-pulse">● LIVE</span>
      </div>

      <div className="relative w-28 h-28 flex items-center justify-center">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          {/* Volcanic Crater background */}
          <circle cx="50" cy="50" r="16" fill="#3b0f0a" stroke="#ff3b00" strokeWidth="1.5" strokeDasharray="3 2" opacity="0.6" />
          <text x="50" y="52" fill="#ff5e13" fontSize="6" fontWeight="bold" textAnchor="middle" opacity="0.7">CRATER</text>

          {/* Circuit track outline */}
          <path
            d="M 28 80 C 70 85, 88 75, 88 45 C 88 20, 65 15, 45 20 C 18 26, 12 55, 28 80 Z"
            fill="none"
            stroke="#261613"
            strokeWidth="10"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M 28 80 C 70 85, 88 75, 88 45 C 88 20, 65 15, 45 20 C 18 26, 12 55, 28 80 Z"
            fill="none"
            stroke="#ff5e13"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.85"
          />

          {/* Checkpoint Gates */}
          {/* CP 0: Start / Finish */}
          <rect x="25" y="76" width="6" height="8" fill="#ffffff" stroke="#ff5e13" strokeWidth="1" rx="1" />

          {/* CP 1: East entrance */}
          <circle cx="85" cy="55" r="3" fill={checkpointIndex >= 1 ? '#00f0ff' : '#444'} stroke="#fff" strokeWidth="0.8" />

          {/* CP 2: Dyke hairpin */}
          <circle cx="65" cy="18" r="3" fill={checkpointIndex >= 2 ? '#00f0ff' : '#444'} stroke="#fff" strokeWidth="0.8" />

          {/* CP 3: Crater West */}
          <circle cx="16" cy="45" r="3" fill={checkpointIndex >= 3 ? '#00f0ff' : '#444'} stroke="#fff" strokeWidth="0.8" />

          {/* Player Car indicator (animated pulse) */}
          <circle cx="28" cy="80" r="4" fill="#00f0ff" stroke="#fff" strokeWidth="1.5" className="animate-ping opacity-75" />
          <circle cx="28" cy="80" r="3" fill="#00f0ff" stroke="#fff" strokeWidth="1" />
        </svg>
      </div>
    </div>
  );
};
