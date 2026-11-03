import React, { memo } from 'react';
import { useGameStore } from '../../store/useGameStore';

export const RoadHint: React.FC = memo(() => {
  const roadHint = useGameStore((state) => state.roadHint);

  if (!roadHint) return null;

  const isBrake = roadHint.severity === 'brake';
  const isCaution = roadHint.severity === 'caution';

  const borderColor = isBrake
    ? 'border-red-500/60 shadow-[0_0_20px_rgba(239,68,68,0.35)]'
    : isCaution
    ? 'border-amber-400/50 shadow-[0_0_15px_rgba(245,158,11,0.25)]'
    : 'border-cyan-400/40 shadow-[0_0_15px_rgba(34,211,238,0.2)]';

  const textColor = isBrake ? 'text-red-400' : isCaution ? 'text-amber-300' : 'text-cyan-300';

  return (
    <div className="flex justify-center w-full pointer-events-none transition-all duration-200">
      <div
        className={`flex items-center space-x-3 px-4 py-2 rounded-2xl bg-black/85 backdrop-blur-md border ${borderColor} text-white font-sans`}
      >
        {/* Animated Directional Arrows */}
        <div className="flex items-center text-lg font-black tracking-tighter">
          {roadHint.direction === 'left' ? (
            <span className={`${textColor} animate-pulse`}>❮❮❮</span>
          ) : roadHint.direction === 'right' ? (
            <span className={`${textColor} animate-pulse`}>❯❯❯</span>
          ) : (
            <span className={`${textColor} animate-pulse`}>❮❯</span>
          )}
        </div>

        {/* Turn Name and Distance */}
        <div className="flex flex-col">
          <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400">
            ROAD GUIDANCE
          </span>
          <div className="flex items-center space-x-2">
            <span className="text-sm font-black tracking-wide text-white drop-shadow">
              {roadHint.title}
            </span>
            <span className="text-xs font-bold text-gray-300 bg-white/10 px-1.5 py-0.5 rounded">
              {roadHint.distanceMeters}m
            </span>
          </div>
        </div>

        {/* Dynamic Action / Target Speed Badge */}
        <div>
          {isBrake ? (
            <div className="flex flex-col items-center bg-red-600 text-white px-2.5 py-0.5 rounded-lg animate-pulse shadow-[0_0_12px_rgba(220,38,38,0.9)]">
              <span className="text-[11px] font-black tracking-wider leading-none">BRAKE!</span>
              <span className="text-[9px] font-bold opacity-90 leading-tight">
                {roadHint.safeSpeedKmH} KM/H
              </span>
            </div>
          ) : isCaution ? (
            <div className="flex flex-col items-center bg-amber-400 text-black px-2.5 py-0.5 rounded-lg shadow-[0_0_10px_rgba(245,158,11,0.7)]">
              <span className="text-[11px] font-black tracking-wider leading-none">SLOW</span>
              <span className="text-[9px] font-bold opacity-90 leading-tight">
                {roadHint.safeSpeedKmH} KM/H
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center bg-cyan-400 text-black px-2.5 py-0.5 rounded-lg shadow-[0_0_10px_rgba(34,211,238,0.7)]">
              <span className="text-[11px] font-black tracking-wider leading-none">CLEAR</span>
              <span className="text-[9px] font-bold opacity-90 leading-tight">
                {roadHint.safeSpeedKmH} KM/H
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
