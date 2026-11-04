import React, { useEffect } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { Zap, Gauge } from 'lucide-react';

export const StartingGridCountdown: React.FC = () => {
  const gameState = useGameStore((state) => state.gameState);
  const countdownValue = useGameStore((state) => state.countdownValue);
  const rpm = useGameStore((state) => state.rpm);
  const isPerfectLaunch = useGameStore((state) => state.isPerfectLaunch);
  const setCountdownValue = useGameStore((state) => state.setCountdownValue);
  const setIsPerfectLaunch = useGameStore((state) => state.setIsPerfectLaunch);

  // Self-contained safety cleanup: Guarantee disappearance after GO!
  useEffect(() => {
    if (countdownValue === 0) {
      const timer = setTimeout(() => {
        setCountdownValue(null);
        setIsPerfectLaunch(false);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [countdownValue, setCountdownValue, setIsPerfectLaunch]);

  // Strictly only show when countdown is active (3, 2, 1) or during the brief 1.2s "GO!" burst (0)
  if (gameState !== 'countdown' && countdownValue !== 0) {
    return null;
  }
  if (countdownValue === null) {
    return null;
  }

  // RPM Sweet spot percentage (zone is 5500 - 7500 RPM)
  const rpmPct = Math.min(100, Math.max(0, ((rpm - 1000) / 7500) * 100));
  const inSweetSpot = rpm >= 5400 && rpm <= 7400;
  const isGo = countdownValue === 0;

  return (
    <div
      className={`fixed inset-0 z-40 flex flex-col items-center justify-center pointer-events-none select-none transition-opacity duration-300 ${
        isGo ? 'animate-out fade-out duration-700 fill-mode-forwards' : ''
      }`}
    >
      {/* Background Subtle Vignette (Fades out immediately upon GO! so player sees road clearly) */}
      <div
        className={`absolute inset-0 bg-black/35 backdrop-blur-[2px] pointer-events-none transition-opacity duration-300 ${
          isGo ? 'opacity-0' : 'opacity-100'
        }`}
      />

      {/* Starting Gantry Display */}
      <div className="relative flex flex-col items-center z-10 animate-in fade-in zoom-in-95 duration-300">
        {/* F1 Horizon Gantry Housing */}
        <div className="bg-[#111317]/95 border-2 border-white/15 px-8 py-4 rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.85)] flex flex-col items-center backdrop-blur-md">
          {/* Header pill */}
          <div className="flex items-center space-x-2 text-[10px] font-mono tracking-widest text-gray-400 uppercase mb-3">
            <span
              className={`w-2 h-2 rounded-full ${
                isGo ? 'bg-emerald-500 animate-pulse' : 'bg-red-500 animate-ping'
              }`}
            />
            <span>{isGo ? 'RACE STARTED' : 'GRID START SEQUENCE'}</span>
          </div>

          {/* 4 Lights */}
          <div className="flex items-center space-x-4 mb-4">
            {[1, 2, 3, 4].map((i) => {
              let isActive = false;
              let isGreen = isGo;

              if (countdownValue === 3 && i === 1) isActive = true;
              if (countdownValue === 2 && (i === 1 || i === 2)) isActive = true;
              if (countdownValue === 1 && (i === 1 || i === 2 || i === 3)) isActive = true;
              if (isGo) isActive = true;

              return (
                <div
                  key={i}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-150 border-2 ${
                    isGreen
                      ? 'bg-emerald-500 border-emerald-300 shadow-[0_0_35px_rgba(16,185,129,0.9)] scale-110'
                      : isActive
                      ? 'bg-red-600 border-red-400 shadow-[0_0_30px_rgba(239,68,68,0.9)] scale-105'
                      : 'bg-[#1e2025] border-white/10 opacity-40'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full ${
                      isGreen ? 'bg-emerald-200' : isActive ? 'bg-red-300' : 'bg-black/50'
                    }`}
                  />
                </div>
              );
            })}
          </div>

          {/* Giant Countdown Text */}
          <div className="text-center font-black tracking-widest uppercase mb-1">
            {isGo ? (
              <span className="text-5xl sm:text-6xl text-emerald-400 drop-shadow-[0_0_35px_rgba(52,211,153,0.9)] animate-pulse">
                GO!
              </span>
            ) : countdownValue !== null ? (
              <span className="text-5xl sm:text-6xl text-white drop-shadow-[0_0_25px_rgba(255,255,255,0.7)] font-mono">
                {countdownValue}
              </span>
            ) : null}
          </div>
        </div>

        {/* Launch RPM Mini-game Guide (Strictly shown during 3, 2, 1 countdown; hidden on GO!) */}
        {!isGo && gameState === 'countdown' && (
          <div className="mt-6 bg-[#131518]/90 border border-white/10 px-6 py-3 rounded-2xl flex flex-col items-center max-w-sm w-full shadow-2xl backdrop-blur-md">
            <div className="flex items-center justify-between w-full text-[11px] font-bold text-gray-300 mb-1.5">
              <span className="flex items-center space-x-1.5 text-orange-400">
                <Gauge className="w-3.5 h-3.5" />
                <span>LAUNCH RPM</span>
              </span>
              <span
                className={`font-mono text-xs ${
                  inSweetSpot ? 'text-emerald-400 font-black' : 'text-gray-400'
                }`}
              >
                {rpm} RPM
              </span>
            </div>

            {/* RPM Bar with Green Sweet Spot */}
            <div className="relative w-full h-3 bg-black/60 rounded-full overflow-hidden border border-white/10">
              {/* Green Zone marker */}
              <div
                className="absolute top-0 bottom-0 bg-emerald-500/30 border-x border-emerald-400"
                style={{ left: '55%', width: '25%' }}
              />

              {/* Live RPM Fill */}
              <div
                className={`h-full transition-all duration-75 rounded-full ${
                  inSweetSpot
                    ? 'bg-gradient-to-r from-emerald-500 to-green-300 shadow-[0_0_12px_rgba(52,211,153,0.8)]'
                    : 'bg-gradient-to-r from-orange-500 to-amber-400'
                }`}
                style={{ width: `${rpmPct}%` }}
              />
            </div>

            <div className="flex items-center justify-between w-full mt-1.5 text-[10px] text-gray-400 font-medium">
              <span>Idle</span>
              <span className={inSweetSpot ? 'text-emerald-400 font-bold' : 'text-gray-400'}>
                {inSweetSpot ? 'PERFECT ZONE! HOLD!' : 'REV: HOLD [W / ⬆]'}
              </span>
              <span>Redline</span>
            </div>
          </div>
        )}

        {/* Perfect Launch Notification Banner (Brief celebration on GO!, disappears after 1.2s) */}
        {isPerfectLaunch && isGo && (
          <div className="mt-4 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 text-black font-black text-sm uppercase tracking-widest px-6 py-2 rounded-full shadow-[0_0_30px_rgba(245,158,11,0.9)] flex items-center space-x-2 animate-bounce">
            <Zap className="w-4 h-4 fill-black stroke-black" />
            <span>PERFECT NITRO LAUNCH! +250 XP</span>
          </div>
        )}
      </div>
    </div>
  );
};
