import React, { memo } from 'react';
import { useGameStore } from '../../store/useGameStore';

export const Speedometer: React.FC = memo(() => {
  const speed = useGameStore((state) => state.speed);
  const gear = useGameStore((state) => state.gear);
  const rpm = useGameStore((state) => state.rpm);
  const nitro = useGameStore((state) => state.nitro);
  const isDrifting = useGameStore((state) => state.isDrifting);
  const isBoosting = useGameStore((state) => state.isBoosting);
  const isBraking = useGameStore((state) => state.isBraking);

  // Main Tachometer Gauge Geometry
  const cx = 195;
  const cy = 115;
  const rMain = 88;

  // Boost Sub-Dial Geometry
  const bx = 82;
  const by = 162;
  const rBoost = 38;

  // Tachometer Needle Angle:
  // 1000 RPM (idle) starts at 130°, sweeps clockwise 265° to 9000 RPM (395° / 35°)
  const minRpm = 1000;
  const maxRpm = 9000;
  const rpmClamped = Math.min(maxRpm, Math.max(minRpm, rpm));
  const rpmRatio = (rpmClamped - minRpm) / (maxRpm - minRpm);
  const tachAngle = 130 + rpmRatio * 265;

  // Redline / Shift Warning (flashes at 7800+ RPM)
  const isRedline = rpm >= 7800;

  // Turbo Boost / Vacuum Simulation (-30 to +30 PSI, pure reactive computation)
  let targetBoost = -18;
  if (isBoosting) {
    targetBoost = 30; // Max PSI under Nitrous Hyper-Boost
  } else if (isBraking) {
    targetBoost = -28; // Vacuum under heavy braking
  } else if (speed > 3) {
    const rpmFactor = Math.max(0, (rpm - 2200) / 6800);
    targetBoost = -6 + rpmFactor * 26; // Builds up to +20 PSI
    if (isDrifting) targetBoost += 5;
  }
  const clampedBoost = Math.min(30, Math.max(-30, targetBoost));
  const boostAngle = 180 + (clampedBoost / 30) * 90;

  // N2O Arc: 12 Segmented LED blocks from 232° to 326° around (cx, cy)
  const n2oBlocksCount = 12;
  const activeN2oBlocks = Math.round((nitro / 100) * n2oBlocksCount);

  // Helper: Polar to Cartesian (0° = 12 o'clock, clockwise)
  const polar = (x: number, y: number, deg: number, r: number) => {
    const rad = ((deg - 90) * Math.PI) / 180.0;
    return {
      x: x + r * Math.cos(rad),
      y: y + r * Math.sin(rad),
    };
  };

  // Helper: Annular Segment for N2O LED blocks
  const describeAnnularSector = (
    x: number,
    y: number,
    rIn: number,
    rOut: number,
    startDeg: number,
    endDeg: number
  ) => {
    const p1 = polar(x, y, startDeg, rOut);
    const p2 = polar(x, y, endDeg, rOut);
    const p3 = polar(x, y, endDeg, rIn);
    const p4 = polar(x, y, startDeg, rIn);
    const largeArc = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} A ${rOut} ${rOut} 0 ${largeArc} 1 ${p2.x.toFixed(1)} ${p2.y.toFixed(1)} L ${p3.x.toFixed(1)} ${p3.y.toFixed(1)} A ${rIn} ${rIn} 0 ${largeArc} 0 ${p4.x.toFixed(1)} ${p4.y.toFixed(1)} Z`;
  };

  // Precomputed RPM numbers (0 to 9)
  const rpmLabels = [
    { num: 0, deg: 130.0 },
    { num: 1, deg: 159.5 },
    { num: 2, deg: 189.0 },
    { num: 3, deg: 218.5 },
    { num: 4, deg: 248.0 },
    { num: 5, deg: 277.5 },
    { num: 6, deg: 307.0 },
    { num: 7, deg: 336.5 },
    { num: 8, deg: 366.0 },
    { num: 9, deg: 395.5 },
  ];

  return (
    <div className="relative select-none pointer-events-none flex flex-col items-end">
      {/* NFS Underground Arcade Badges */}
      <div className="flex flex-col items-end space-y-1 mb-1 mr-4">
        {isDrifting && (
          <div className="flex items-center space-x-1.5 bg-yellow-500/20 backdrop-blur-md px-3 py-1 rounded-sm border border-yellow-400/50 shadow-[0_0_12px_rgba(250,204,21,0.4)] animate-pulse">
            <span className="text-[10px] text-yellow-300 font-extrabold tracking-wider uppercase">
              DRIFT BONUS
            </span>
            <span className="text-sm font-black text-white italic tracking-tight font-mono">
              +100
            </span>
          </div>
        )}
        {isBoosting && (
          <div className="flex items-center space-x-1.5 bg-cyan-500/25 backdrop-blur-md px-3 py-1 rounded-sm border border-cyan-400/60 shadow-[0_0_16px_rgba(0,240,255,0.6)] animate-pulse">
            <span className="text-[10px] text-cyan-200 font-extrabold tracking-wider uppercase">
              HYPER BOOST
            </span>
            <span className="text-sm font-black text-cyan-300 italic tracking-tight font-mono">
              N2O
            </span>
          </div>
        )}
      </div>

      {/* Main NFS Underground Dual-Gauge Cluster SVG */}
      <div className="relative w-[300px] sm:w-[340px] transition-transform duration-150">
        <svg
          viewBox="30 8 266 212"
          className="w-full h-auto overflow-visible filter drop-shadow-[0_12px_24px_rgba(0,0,0,0.9)]"
        >
          <defs>
            {/* Authentic Carbon Fiber Weave Twill Pattern */}
            <pattern
              id="nfs-carbon"
              width="6"
              height="6"
              patternUnits="userSpaceOnUse"
            >
              <rect width="6" height="6" fill="#131518" />
              <polygon points="0,0 3,0 0,3" fill="#22262d" />
              <polygon points="3,3 6,3 3,6" fill="#22262d" />
              <polygon points="3,0 6,0 6,3" fill="#181b20" />
              <polygon points="0,3 3,3 0,6" fill="#181b20" />
            </pattern>

            {/* Brushed Titanium Bezel Gradient */}
            <linearGradient id="bezel-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4a525d" />
              <stop offset="35%" stopColor="#252a32" />
              <stop offset="70%" stopColor="#5d6674" />
              <stop offset="100%" stopColor="#1a1d22" />
            </linearGradient>

            {/* Metallic Inner Rim Gradient */}
            <linearGradient id="rim-grad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#8e9ba8" />
              <stop offset="50%" stopColor="#3c434d" />
              <stop offset="100%" stopColor="#1a1c20" />
            </linearGradient>
          </defs>

          {/* 1. Carbon Fiber Silhouette Backing Plate */}
          <path
            d="M 82 215
               L 242 215
               A 97 97 0 0 0 248 28
               L 172 14
               A 115 115 0 0 0 92 140
               A 47 47 0 0 0 34 162
               A 47 47 0 0 0 82 215
               Z"
            fill="url(#nfs-carbon)"
            stroke="#3a424d"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />

          {/* Subtle Bevel Highlight on Carbon Plate */}
          <path
            d="M 82 213
               L 240 213
               A 95 95 0 0 0 246 30
               L 172 16
               A 113 113 0 0 0 94 140"
            fill="none"
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="1"
          />

          {/* 2. N2O Curved LED Bar (Upper Left Shoulder) */}
          <g style={{ filter: isBoosting ? 'drop-shadow(0 0 5px #00f0ff)' : undefined }}>
            {/* Background Track Groove */}
            <path
              d="M 124.9 201.5 A 108 108 0 0 1 155.5 53.6"
              fill="none"
              stroke="#071720"
              strokeWidth="11"
              strokeLinecap="round"
            />

            {/* Segmented LED Blocks */}
            {Array.from({ length: n2oBlocksCount }).map((_, i) => {
              const startAngle = 232 + i * 8.0;
              const endAngle = startAngle + 6.2;
              const isActive = i < activeN2oBlocks;
              return (
                <path
                  key={`n2o-seg-${i}`}
                  d={describeAnnularSector(cx, cy, 97, 107, startAngle, endAngle)}
                  fill={
                    isActive
                      ? isBoosting
                        ? '#e6ffff'
                        : '#00e5ff'
                      : '#0a1a24'
                  }
                  stroke={isActive ? (isBoosting ? '#ffffff' : '#4df3ff') : '#082533'}
                  strokeWidth="0.6"
                  className={isActive && isBoosting ? 'animate-pulse' : ''}
                />
              );
            })}

            {/* N2O Slanted Neon Label */}
            <text
              x="172"
              y="46"
              fill={isBoosting ? '#ffffff' : '#00f0ff'}
              fontSize="12"
              fontFamily="'DM Sans', system-ui, sans-serif"
              fontWeight="900"
              fontStyle="italic"
              letterSpacing="0.05em"
              textAnchor="middle"
              style={{ filter: isBoosting ? 'drop-shadow(0 0 5px #00f0ff)' : undefined }}
            >
              N2O
            </text>
          </g>

          {/* 3. Turbo Boost Sub-Dial (Bottom Left) */}
          <g id="boost-dial">
            {/* Bezel */}
            <circle
              cx={bx}
              cy={by}
              r={rBoost}
              fill="#101316"
              stroke="url(#bezel-grad)"
              strokeWidth="3.5"
            />
            {/* Inner Carbon Face */}
            <circle cx={bx} cy={by} r={rBoost - 3.5} fill="url(#nfs-carbon)" />

            {/* Green Arc (Left/Lower Side: -30 to +30 PSI) */}
            <path
              d="M 50.0 162.0 A 32 32 0 0 0 114.0 162.0"
              fill="none"
              stroke="#76c828"
              strokeWidth="4"
              strokeLinecap="round"
            />

            {/* Inner Silver Ring */}
            <circle
              cx={bx}
              cy={by}
              r="22"
              fill="none"
              stroke="#404953"
              strokeWidth="1.2"
              strokeDasharray="2 3"
            />

            {/* Markings */}
            <text
              x={bx}
              y={by - 22}
              fill="#e2e8f0"
              fontSize="9"
              fontFamily="'DM Sans', system-ui, sans-serif"
              fontWeight="900"
              fontStyle="italic"
              textAnchor="middle"
            >
              30
            </text>
            <text
              x={bx - 22}
              y={by + 3}
              fill="#e2e8f0"
              fontSize="9"
              fontFamily="'DM Sans', system-ui, sans-serif"
              fontWeight="900"
              fontStyle="italic"
              textAnchor="middle"
            >
              0
            </text>
            <text
              x={bx}
              y={by + 27}
              fill="#e2e8f0"
              fontSize="9"
              fontFamily="'DM Sans', system-ui, sans-serif"
              fontWeight="900"
              fontStyle="italic"
              textAnchor="middle"
            >
              -30
            </text>

            {/* Boost Needle (Neon Red) */}
            <g
              style={{
                transform: `rotate(${boostAngle}deg)`,
                transformOrigin: `${bx}px ${by}px`,
                transition: 'transform 85ms cubic-bezier(0.1, 0.9, 0.2, 1.0)',
                filter: 'drop-shadow(0 0 2.5px #ff1744)',
              }}
            >
              {/* Counter-weight */}
              <line
                x1={bx}
                y1={by}
                x2={bx}
                y2={by + 8}
                stroke="#d11732"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              {/* Pointer */}
              <polygon
                points={`${bx - 2},${by} ${bx + 2},${by} ${bx},${by - 28}`}
                fill="#ff2238"
              />
              <line
                x1={bx}
                y1={by}
                x2={bx}
                y2={by - 27}
                stroke="#ff7043"
                strokeWidth="0.8"
              />
            </g>

            {/* Metallic Center Hub */}
            <circle cx={bx} cy={by} r="5.5" fill="url(#rim-grad)" stroke="#22262d" strokeWidth="1" />
            <circle cx={bx} cy={by} r="2.2" fill="#14171a" />
          </g>

          {/* 4. Main Tachometer & Speedometer Dial (Right/Center) */}
          <g id="main-dial">
            {/* Outer Heavy Bezel */}
            <circle
              cx={cx}
              cy={cy}
              r={rMain}
              fill="#0e1114"
              stroke="url(#bezel-grad)"
              strokeWidth="5"
            />
            {/* Inner Carbon Fiber Face */}
            <circle cx={cx} cy={cy} r={rMain - 4} fill="url(#nfs-carbon)" />

            {/* Shift Light Redline Flash Halo */}
            {isRedline && (
              <circle
                cx={cx}
                cy={cy}
                r={rMain - 6}
                fill="none"
                stroke="#ff1744"
                strokeWidth="4"
                className="animate-pulse"
                style={{ filter: 'drop-shadow(0 0 6px #ff1744)' }}
              />
            )}

            {/* Outer Colored RPM Scale Track */}
            {/* Green Safe/Power Zone (0 through 6 RPM, 130° to 305°) */}
            <path
              d="M 129.5 69.1 A 80 80 0 0 0 256.3 166.4"
              fill="none"
              stroke="#73c726"
              strokeWidth="9"
              strokeLinecap="butt"
            />
            {/* Golden Champagne High-RPM Zone (6 through 9 RPM, 305° to 395°) */}
            <path
              d="M 240.9 49.5 A 80 80 0 0 0 129.5 69.1"
              fill="none"
              stroke="#dfba6a"
              strokeWidth="9"
              strokeLinecap="butt"
            />
            {/* Redline Edge Accent (7.5 to 9 RPM, 350° to 395°) */}
            <path
              d="M 240.9 49.5 A 80 80 0 0 0 181.1 36.6"
              fill="none"
              stroke="#ff2035"
              strokeWidth="2.5"
            />

            {/* Concentric Silver Dial Ring */}
            <circle
              cx={cx}
              cy={cy}
              r="52"
              fill="none"
              stroke="rgba(200, 215, 230, 0.35)"
              strokeWidth="1.2"
            />

            {/* RPM Radial Tick Marks & Numbers (0 through 9) */}
            {rpmLabels.map(({ num, deg }) => {
              const tickOuter = polar(cx, cy, deg, 84);
              const tickInner = polar(cx, cy, deg, 75);
              const textPos = polar(cx, cy, deg, 64);
              const isHighRpm = num >= 6;

              return (
                <g key={`rpm-${num}`}>
                  {/* Tick Mark */}
                  <line
                    x1={tickInner.x}
                    y1={tickInner.y}
                    x2={tickOuter.x}
                    y2={tickOuter.y}
                    stroke="#14181c"
                    strokeWidth={num % 2 === 0 ? '2' : '1.2'}
                  />
                  {/* Number Label */}
                  <text
                    x={textPos.x}
                    y={textPos.y + 4}
                    fill={isHighRpm ? '#181c20' : '#14181c'}
                    fontSize="13"
                    fontFamily="'DM Sans', system-ui, sans-serif"
                    fontWeight="900"
                    fontStyle="italic"
                    textAnchor="middle"
                  >
                    {num}
                  </text>
                </g>
              );
            })}

            {/* Half-unit Minor Ticks (0.5 to 8.5) */}
            {Array.from({ length: 9 }).map((_, i) => {
              const deg = 130 + (i + 0.5) * 29.5;
              const tickOuter = polar(cx, cy, deg, 82);
              const tickInner = polar(cx, cy, deg, 77);
              return (
                <line
                  key={`minor-tick-${i}`}
                  x1={tickInner.x}
                  y1={tickInner.y}
                  x2={tickOuter.x}
                  y2={tickOuter.y}
                  stroke="rgba(20, 25, 30, 0.7)"
                  strokeWidth="1"
                />
              );
            })}

            {/* Digital Readout Area (Right Half of Dial) */}
            {/* Gear Number (Top Right) */}
            <text
              x="236"
              y="92"
              fill="#ffffff"
              fontSize="28"
              fontFamily="'DM Sans', system-ui, sans-serif"
              fontWeight="900"
              fontStyle="italic"
              textAnchor="middle"
              className="filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
            >
              {gear}
            </text>

            {/* Speed Digits (Middle Right) */}
            <text
              x="242"
              y="126"
              fill="#ffffff"
              fontSize="38"
              fontFamily="'DM Sans', system-ui, sans-serif"
              fontWeight="900"
              fontStyle="italic"
              letterSpacing="-0.03em"
              textAnchor="middle"
              className="filter drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]"
            >
              {speed}
            </text>

            {/* KM/H Unit (Underneath Speed) */}
            <text
              x="242"
              y="142"
              fill="#b0bcc8"
              fontSize="10"
              fontFamily="'DM Sans', system-ui, sans-serif"
              fontWeight="800"
              fontStyle="italic"
              letterSpacing="0.08em"
              textAnchor="middle"
            >
              KM/H
            </text>

            {/* Tachometer Needle (Long Vivid Neon Red Pointer) */}
            <g
              style={{
                transform: `rotate(${tachAngle}deg)`,
                transformOrigin: `${cx}px ${cy}px`,
                transition: 'transform 65ms cubic-bezier(0.1, 0.9, 0.2, 1.0)',
                filter: isRedline ? 'drop-shadow(0 0 6px #ff1744)' : 'drop-shadow(0 0 3px #ff1744)',
              }}
            >
              {/* Rear Counter-weight */}
              <line
                x1={cx}
                y1={cy}
                x2={cx}
                y2={cy + 16}
                stroke="#c4142d"
                strokeWidth="4"
                strokeLinecap="round"
              />
              {/* Tapered Needle Blade */}
              <polygon
                points={`${cx - 3.2},${cy} ${cx + 3.2},${cy} ${cx},${cy - 74}`}
                fill="#ff1e35"
              />
              {/* Highlight Core Stripe */}
              <line
                x1={cx}
                y1={cy}
                x2={cx}
                y2={cy - 72}
                stroke="#ff7350"
                strokeWidth="1.2"
              />
            </g>

            {/* Center Metallic Hub & Bolt */}
            <circle
              cx={cx}
              cy={cy}
              r="13"
              fill="url(#rim-grad)"
              stroke="#242930"
              strokeWidth="1.5"
            />
            <circle cx={cx} cy={cy} r="8" fill="#15171b" stroke="#3d444d" strokeWidth="1" />
            <circle cx={cx} cy={cy} r="3.5" fill="url(#rim-grad)" />
          </g>
        </svg>
      </div>
    </div>
  );
});
