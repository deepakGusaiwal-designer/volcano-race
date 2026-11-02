import React from 'react';
import { useGameStore } from '../../store/useGameStore';

export const Speedometer: React.FC = () => {
  const speed = useGameStore((state) => state.speed);
  const gear = useGameStore((state) => state.gear);
  const rpm = useGameStore((state) => state.rpm);
  const isDrifting = useGameStore((state) => state.isDrifting);
  const isBoosting = useGameStore((state) => state.isBoosting);

  // SVG Gauge calculations
  const maxSpeed = 220;
  const clampedSpeed = Math.min(Math.max(0, speed), maxSpeed);
  const angle = (clampedSpeed / maxSpeed) * 240 - 120; // -120 to +120 deg
  const rpmPercentage = Math.min(100, Math.max(0, (rpm / 8800) * 100));

  return (
    <div className="racing-panel rounded-2xl p-4 flex flex-col items-center select-none shadow-2xl relative overflow-hidden w-52 sm:w-60 border border-orange-500/30">
      {/* Drift/Boost badge */}
      {isDrifting && (
        <div className="absolute top-2 right-2 bg-yellow-500/20 text-yellow-400 text-xs px-2 py-0.5 rounded font-bold uppercase tracking-wider animate-pulse border border-yellow-500/40">
          DRIFT!
        </div>
      )}
      {isBoosting && (
        <div className="absolute top-2 left-2 bg-cyan-500/20 text-cyan-400 text-xs px-2 py-0.5 rounded font-bold uppercase tracking-wider animate-pulse border border-cyan-500/40">
          NITRO!
        </div>
      )}

      {/* Speedometer Radial Gauge */}
      <div className="relative w-36 h-36 flex items-center justify-center my-1">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          {/* Background Arc */}
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="#261613"
            strokeWidth="8"
            strokeDasharray="180 300"
            strokeDashoffset="-25"
            strokeLinecap="round"
          />
          {/* Speed Indicator Arc */}
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke={isBoosting ? '#00f0ff' : '#ff5e13'}
            strokeWidth="8"
            strokeDasharray={`${(clampedSpeed / maxSpeed) * 180} 300`}
            strokeDashoffset="-25"
            strokeLinecap="round"
            className="transition-all duration-75"
          />
        </svg>

        {/* Center Digital Speed */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-4xl sm:text-5xl font-black tracking-tight glow-orange">
            {speed}
          </span>
          <span className="text-[10px] text-orange-300/80 font-bold tracking-widest uppercase">
            KM/H
          </span>
        </div>
      </div>

      {/* RPM Tachometer Bar */}
      <div className="w-full mt-2">
        <div className="flex justify-between text-[10px] text-gray-400 font-semibold mb-1">
          <span>RPM</span>
          <span className="text-orange-400">{Math.round(rpm)}</span>
        </div>
        <div className="w-full h-1.5 bg-gray-900 rounded-full overflow-hidden border border-gray-800">
          <div
            className={`h-full transition-all duration-75 ${
              rpm > 7500 ? 'bg-red-500 shadow-red-500' : 'bg-orange-500'
            }`}
            style={{ width: `${rpmPercentage}%` }}
          />
        </div>
      </div>

      {/* Gear Badge */}
      <div className="mt-3 flex items-center justify-center space-x-2 w-full pt-2 border-t border-white/5">
        <span className="text-[11px] text-gray-400 font-medium">GEAR</span>
        <span className="text-xl font-black text-yellow-400 bg-yellow-950/40 px-3 py-0.5 rounded border border-yellow-500/30">
          {gear}
        </span>
      </div>
    </div>
  );
};
