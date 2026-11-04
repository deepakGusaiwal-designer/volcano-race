import React from 'react';
import { Compass, Users, Sparkles } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';

// Mathematical projection matching the real 54-waypoint Catmull-Rom road geometry
// World bounds: X in [-48.32, 47.42] (span: 95.74m), Z in [-28.58, 20.60] (span: 49.18m)
// Scaled uniformly into a 160x100 viewBox with balanced padding
const toSvgCoords = (x: number, z: number): [number, number] => {
  const scale = 1.36;
  const midX = -0.45;
  const midZ = -3.99;
  const sx = 80 + (x - midX) * scale;
  const sy = 50 + (z - midZ) * scale;
  return [
    Math.max(4, Math.min(156, Number(sx.toFixed(1)))),
    Math.max(4, Math.min(96, Number(sy.toFixed(1)))),
  ];
};

// Exact 140-sample Catmull-Rom spline path of the real Volcano Speedway road
const REAL_TRACK_SVG_PATH =
  'M 70.7 69.9 L 73.8 69.5 L 76.9 69.2 L 80 68.7 L 83.1 69.1 L 86.1 70.3 L 88.4 72.2 L 89.6 75.1 L 91.1 77.8 L 93.1 80.2 L 95.3 82.5 L 97.5 84.6 L 99.7 86.9 L 101.7 89.2 L 104.1 91.3 L 106.8 92.8 L 109.5 94.4 L 112.3 95.6 L 115.3 94.5 L 117.8 92.6 L 119.5 90 L 120.2 86.9 L 120.3 83.8 L 119.9 80.7 L 119 77.7 L 117.3 75.1 L 115.5 72.6 L 112.9 70.9 L 109.9 70.1 L 106.9 69.2 L 104 68.1 L 101.3 66.4 L 101.7 63.8 L 104.5 62.6 L 107.7 62.8 L 110.8 62.9 L 113.9 62.9 L 117 62.9 L 120.2 63.2 L 123.2 63 L 126.1 61.7 L 128.7 59.9 L 131.3 58.2 L 133.9 56.4 L 136.5 54.7 L 139.1 53 L 141.5 51 L 143.4 48.5 L 144.7 45.7 L 145.1 42.6 L 144.6 39.5 L 143.2 36.8 L 140.9 34.6 L 138.3 32.9 L 135.6 31.3 L 132.8 30 L 129.9 28.9 L 127 27.8 L 124.1 26.6 L 121.2 25.3 L 118.4 23.9 L 115.7 22.2 L 113.6 20 L 111.5 17.6 L 108.7 16.5 L 105.6 16.9 L 102.7 18.2 L 100.8 20.6 L 99.7 23.5 L 99.3 26.6 L 99.5 29.7 L 100.5 32.7 L 103.2 34.4 L 105.7 36.2 L 106.3 39.2 L 105.8 42.4 L 104.7 45.3 L 102.9 47.9 L 100.3 49.5 L 97.2 49.4 L 94.5 48 L 92.6 45.4 L 90.6 43.1 L 87.8 41.7 L 84.8 40.8 L 81.8 39.9 L 78.8 39 L 75.7 38.9 L 72.9 40.3 L 71 42.7 L 69.9 45.6 L 68.8 48.5 L 67.2 51.2 L 65.5 53.8 L 63.3 56 L 60.7 54.6 L 58.7 52.2 L 56.7 49.8 L 54.8 47.3 L 53.1 44.6 L 52.3 41.7 L 52 38.6 L 51.6 35.5 L 49.7 33 L 47.2 30.8 L 44.7 29.6 L 43.3 26.7 L 40.5 25.7 L 37.4 26.2 L 34.3 27 L 31.4 28 L 28.6 29.4 L 26.2 31.4 L 24.4 33.9 L 22.4 36.3 L 20.3 38.6 L 18.4 41.2 L 17.5 44.1 L 17.3 47.3 L 17.4 50.5 L 17.4 53.5 L 17.8 56.6 L 19 59.5 L 20.8 62.1 L 23.4 63.7 L 26.5 63.8 L 29.7 63.3 L 32.7 62.6 L 35.6 61.5 L 38.7 60.8 L 41.8 60.9 L 44.9 61.5 L 47.9 62.3 L 50.8 63.4 L 53.4 65 L 55.9 67 L 58.6 68.5 L 61.5 69.7 L 64.5 70.4 L 67.6 70.3 Z';

// Real Checkpoints coordinates
const CHECKPOINT_COORDS: [number, number][] = [
  toSvgCoords(-7.26, 10.61), // CP 0: Start / Finish Line
  toSvgCoords(8.80, 17.80),  // CP 1: Western mountain sweep
  toSvgCoords(23.50, 29.50), // CP 2: Caldera rim peak
  toSvgCoords(46.89, -6.54), // CP 3: Dyke entrance
  toSvgCoords(21.64, -28.44),// CP 4: South hairpin
  toSvgCoords(-26.13, -18.70),// CP 5: Mountain pass
  toSvgCoords(-42.8, 5.8),   // CP 6: Final straight
];

export const MiniMap: React.FC = () => {
  const checkpointIndex = useGameStore((state) => state.checkpointIndex);
  const leaderboard = useGameStore((state) => state.leaderboard);
  const gameState = useGameStore((state) => state.gameState);
  const trackDirection = useGameStore((state) => state.trackDirection);

  if (gameState !== 'racing' && gameState !== 'paused') return null;

  const playerRacer = leaderboard.find((r) => r.isPlayer);
  const playerRank = playerRacer?.position || 1;

  // Jump platform position in SVG
  const [jumpX, jumpY] = toSvgCoords(4.09, 11.49);
  // Real Caldera magma pool center
  const [calderaX, calderaY] = toSvgCoords(20.0, 14.0);
  // Start line position in SVG
  const [startX, startY] = toSvgCoords(-7.26, 10.61);

  return (
    <div className="bg-[#101216]/95 backdrop-blur-md rounded-2xl p-2.5 flex flex-col items-center select-none shadow-[0_8px_30px_rgba(0,0,0,0.85)] border border-white/10 w-40 sm:w-48 pointer-events-auto">
      {/* Radar Top Header */}
      <div className="flex items-center justify-between w-full text-[9px] text-gray-400 font-bold mb-1 border-b border-white/10 pb-1">
        <span className="flex items-center space-x-1 text-orange-400">
          <Compass className="w-3 h-3" />
          <span className="tracking-wider">GPS RADAR</span>
        </span>
        <span className="text-[7.5px] text-emerald-400 font-mono font-bold flex items-center space-x-1 bg-emerald-500/10 px-1 py-0.5 rounded border border-emerald-500/30">
          <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
          <span>REAL TRACK</span>
        </span>
      </div>

      {/* SVG Circuit Canvas (160x100 aspect ratio) */}
      <div className="relative w-full aspect-[16/10] flex items-center justify-center overflow-hidden rounded-xl bg-black/40 border border-white/5">
        <svg viewBox="0 0 160 100" className="w-full h-full filter drop-shadow-md">
          <defs>
            {/* Caldera Magma Fire Radial Glow */}
            <radialGradient id="calderaGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ff4500" stopOpacity="0.85" />
              <stop offset="60%" stopColor="#b91c1c" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#18181b" stopOpacity="0" />
            </radialGradient>

            {/* Neon Track Glow Filter */}
            <filter id="trackGlow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="0" stdDeviation="1.5" floodColor="#ff5e13" floodOpacity="0.75" />
            </filter>
          </defs>

          {/* Background Subtle Coordinate Grid */}
          <line x1="80" y1="5" x2="80" y2="95" stroke="#ffffff" strokeOpacity="0.03" strokeDasharray="2 3" />
          <line x1="10" y1="50" x2="150" y2="50" stroke="#ffffff" strokeOpacity="0.03" strokeDasharray="2 3" />

          {/* Active Caldera Magma Pit at Real World Position (20, 14) */}
          <circle
            cx={calderaX}
            cy={calderaY}
            r="11"
            fill="url(#calderaGlow)"
            className="animate-pulse"
          />
          <circle
            cx={calderaX}
            cy={calderaY}
            r="7"
            fill="#3b0f0a"
            stroke="#ff5e13"
            strokeWidth="0.8"
            strokeDasharray="2 2"
            opacity="0.8"
          />
          <text
            x={calderaX}
            y={calderaY + 1.0}
            fill="#ff7733"
            fontSize="2.4"
            fontWeight="bold"
            textAnchor="middle"
            fontFamily="monospace"
            opacity="0.8"
          >
            CALDERA
          </text>

          {/* 1. Roadbed Outer Layer (Dark Asphalt Foundation) */}
          <path
            d={REAL_TRACK_SVG_PATH}
            fill="none"
            stroke="#16181e"
            strokeWidth="11"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* 2. Asphalt Road Surface */}
          <path
            d={REAL_TRACK_SVG_PATH}
            fill="none"
            stroke="#222631"
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* 3. Glowing Neon Track Boundary Line */}
          <path
            d={REAL_TRACK_SVG_PATH}
            fill="none"
            stroke="#ff5e13"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.9"
            filter="url(#trackGlow)"
          />

          {/* 4. Dashed Racing Line / Apex Centerline */}
          <path
            d={REAL_TRACK_SVG_PATH}
            fill="none"
            stroke="#ffffff"
            strokeWidth="0.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="2.5 3.5"
            opacity="0.35"
          />

          {/* Checkpoint Gates Along the Real Circuit */}
          {CHECKPOINT_COORDS.map(([cpx, cpy], idx) => {
            if (idx === 0) return null; // Skip CP 0 (handled by start line)
            const isPassed = checkpointIndex >= idx;
            return (
              <circle
                key={idx}
                cx={cpx}
                cy={cpy}
                r="1.8"
                fill={isPassed ? '#00f0ff' : '#4b5563'}
                stroke="#111"
                strokeWidth="0.5"
                opacity={isPassed ? 0.9 : 0.4}
              />
            );
          })}

          {/* Jump Ramp Landmark Marker */}
          <g transform={`translate(${jumpX}, ${jumpY})`}>
            <circle cx="0" cy="0" r="2.8" fill="#000000" opacity="0.6" />
            <polygon points="-1.5,-1 0,-2.5 1.5,-1" fill="#00f0ff" />
          </g>

          {/* Start / Finish Line Gantry Stripe */}
          <g transform={`translate(${startX}, ${startY})`}>
            <rect
              x="-2.5"
              y="-4"
              width="5"
              height="8"
              fill="#ffffff"
              stroke="#ff5e13"
              strokeWidth="0.8"
              rx="1"
              transform="rotate(90)"
            />
            <line x1="-3" y1="0" x2="3" y2="0" stroke="#000000" strokeWidth="0.9" strokeDasharray="1 1" />
          </g>

          {/* AI Rival Competitor Blips (Numbered P1-P4 Badges) */}
          {leaderboard
            .filter((racer) => !racer.isPlayer && racer.x !== undefined && racer.z !== undefined)
            .map((ai) => {
              const [ax, ay] = toSvgCoords(ai.x!, ai.z!);
              return (
                <g key={ai.id} className="transition-all duration-75">
                  <circle
                    cx={ax}
                    cy={ay}
                    r="2.8"
                    fill="#ef4444"
                    stroke="#ffffff"
                    strokeWidth="0.8"
                    className="shadow-sm"
                  />
                  <text
                    x={ax}
                    y={ay + 0.9}
                    fill="#ffffff"
                    fontSize="2.5"
                    fontWeight="900"
                    textAnchor="middle"
                    fontFamily="monospace"
                  >
                    {ai.position}
                  </text>
                </g>
              );
            })}

          {/* Player Car Blip (Radiant Cyan with Radar Ping) */}
          {(() => {
            const player = leaderboard.find((r) => r.isPlayer);
            const px = player?.x !== undefined ? player.x : -7.26;
            const pz = player?.z !== undefined ? player.z : 10.61;
            const [svgPx, svgPy] = toSvgCoords(px, pz);

            return (
              <g className="transition-all duration-75">
                <circle
                  cx={svgPx}
                  cy={svgPy}
                  r="5"
                  fill="#00f0ff"
                  opacity="0.35"
                  className="animate-ping"
                />
                <circle
                  cx={svgPx}
                  cy={svgPy}
                  r="3.2"
                  fill="#00f0ff"
                  stroke="#ffffff"
                  strokeWidth="1.0"
                />
                <text
                  x={svgPx}
                  y={svgPy + 0.9}
                  fill="#000000"
                  fontSize="2.5"
                  fontWeight="900"
                  textAnchor="middle"
                  fontFamily="monospace"
                >
                  P
                </text>
              </g>
            );
          })()}
        </svg>
      </div>

      {/* Radar Footer: Mode & Position */}
      <div className="flex items-center justify-between w-full text-[8px] text-gray-400 font-mono mt-1 pt-1 border-t border-white/5">
        <span className="flex items-center space-x-1">
          <Users className="w-2.5 h-2.5 text-red-400" />
          <span>4 CARS</span>
        </span>
        <span className="text-[8px] text-orange-400 uppercase font-semibold">
          {trackDirection === 'reverse' ? 'REVERSE' : 'CLASSIC'}
        </span>
        <span className="text-cyan-400 font-black">POS #{playerRank}</span>
      </div>
    </div>
  );
};
