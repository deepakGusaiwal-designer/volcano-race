import React, { useState } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Play, Pause, Compass, Mountain, Flag, RefreshCw } from 'lucide-react';

interface TrackViewerHUDProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onToggleAutoRotate: () => boolean;
  onSelectPreset: (key: string) => void;
  activePreset?: string;
}

export const TrackViewerHUD: React.FC<TrackViewerHUDProps> = ({
  onZoomIn,
  onZoomOut,
  onResetView,
  onToggleAutoRotate,
  onSelectPreset,
  activePreset = 'overview',
}) => {
  const [isRotating, setIsRotating] = useState(false);

  const handleAutoRotate = () => {
    const rotating = onToggleAutoRotate();
    setIsRotating(rotating);
  };

  return (
    <div className="absolute inset-0 pointer-events-none p-4 sm:p-6 flex flex-col justify-between select-none">
      {/* Top Header & Presets Bar */}
      <div className="flex items-center justify-between w-full pointer-events-auto">
        <div className="bg-[#1e2024]/90 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/10 shadow-lg flex items-center space-x-3">
          <div>
            <h1 className="text-sm sm:text-base font-bold tracking-wide text-white">
              Volcano Track
            </h1>
            <p className="text-[11px] text-gray-400 font-medium">
              3D Inspector & Zoom
            </p>
          </div>
        </div>

        {/* View Presets Bar (Desktop) */}
        <div className="bg-[#1e2024]/90 backdrop-blur-md rounded-xl p-1 border border-white/10 flex items-center space-x-1 shadow-lg hidden md:flex">
          <button
            onClick={() => onSelectPreset('overview')}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium flex items-center space-x-1.5 transition-all ${
              activePreset === 'overview'
                ? 'bg-white/20 text-white shadow'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Overview</span>
            <span className="text-[10px] px-1 py-0.5 rounded bg-black/40 text-gray-300 font-mono">1</span>
          </button>
          <button
            onClick={() => onSelectPreset('startLine')}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium flex items-center space-x-1.5 transition-all ${
              activePreset === 'startLine'
                ? 'bg-white/20 text-white shadow'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Flag className="w-3.5 h-3.5" />
            <span>Start Grid</span>
            <span className="text-[10px] px-1 py-0.5 rounded bg-black/40 text-gray-300 font-mono">2</span>
          </button>
          <button
            onClick={() => onSelectPreset('crater')}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium flex items-center space-x-1.5 transition-all ${
              activePreset === 'crater'
                ? 'bg-white/20 text-white shadow'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Caldera</span>
            <span className="text-[10px] px-1 py-0.5 rounded bg-black/40 text-gray-300 font-mono">3</span>
          </button>
          <button
            onClick={() => onSelectPreset('hairpin')}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium flex items-center space-x-1.5 transition-all ${
              activePreset === 'hairpin'
                ? 'bg-white/20 text-white shadow'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Hairpin</span>
            <span className="text-[10px] px-1 py-0.5 rounded bg-black/40 text-gray-300 font-mono">4</span>
          </button>
          <button
            onClick={() => onSelectPreset('summit')}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium flex items-center space-x-1.5 transition-all ${
              activePreset === 'summit'
                ? 'bg-white/20 text-white shadow'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Mountain className="w-3.5 h-3.5" />
            <span>Peak</span>
            <span className="text-[10px] px-1 py-0.5 rounded bg-black/40 text-gray-300 font-mono">5</span>
          </button>
        </div>
      </div>

      {/* Floating Zoom & Camera Control Dock (Right Side) */}
      <div className="self-end pointer-events-auto flex flex-col space-y-2 mb-2">
        {/* Zoom In Button */}
        <button
          onClick={onZoomIn}
          className="bg-[#1e2024]/90 hover:bg-[#282b30] text-white p-3 rounded-xl border border-white/10 shadow-lg transition-all active:scale-95 flex flex-col items-center justify-center group"
          title="Zoom In (Key: + or Z)"
        >
          <ZoomIn className="w-5 h-5 text-gray-200 group-hover:text-white" />
          <span className="text-[9px] font-mono text-gray-400 mt-0.5">+</span>
        </button>

        {/* Zoom Out Button */}
        <button
          onClick={onZoomOut}
          className="bg-[#1e2024]/90 hover:bg-[#282b30] text-white p-3 rounded-xl border border-white/10 shadow-lg transition-all active:scale-95 flex flex-col items-center justify-center group"
          title="Zoom Out (Key: - or X)"
        >
          <ZoomOut className="w-5 h-5 text-gray-200 group-hover:text-white" />
          <span className="text-[9px] font-mono text-gray-400 mt-0.5">-</span>
        </button>

        {/* Auto Rotate 360 Toggle */}
        <button
          onClick={handleAutoRotate}
          className={`p-3 rounded-xl border transition-all active:scale-95 flex flex-col items-center justify-center ${
            isRotating
              ? 'bg-white/20 border-white/30 text-white shadow-lg'
              : 'bg-[#1e2024]/90 hover:bg-[#282b30] border-white/10 text-gray-300'
          }`}
          title={isRotating ? 'Pause 360 Rotation (Key: Space)' : 'Start 360 Rotation (Key: Space)'}
        >
          {isRotating ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          <span className="text-[9px] font-mono text-gray-400 mt-0.5">360°</span>
        </button>

        {/* Reset Camera View */}
        <button
          onClick={onResetView}
          className="bg-[#1e2024]/90 hover:bg-[#282b30] text-white p-3 rounded-xl border border-white/10 shadow-lg transition-all active:scale-95 flex flex-col items-center justify-center group"
          title="Reset Camera (Key: R)"
        >
          <RotateCcw className="w-5 h-5 text-gray-300 group-hover:text-white" />
          <span className="text-[9px] font-mono text-gray-400 mt-0.5">R</span>
        </button>
      </div>

      {/* Bottom Instructions Footer */}
      <div className="flex items-center justify-between w-full pointer-events-auto">
        <div className="bg-[#1e2024]/90 backdrop-blur-md rounded-xl px-4 py-2 flex flex-wrap items-center gap-3 text-xs text-gray-300 border border-white/10 shadow-lg">
          <div className="flex items-center space-x-1.5">
            <span className="text-white font-medium">Left Drag:</span>
            <span className="text-gray-400">Orbit 360°</span>
          </div>
          <span className="text-gray-600 hidden sm:inline">•</span>
          <div className="flex items-center space-x-1.5">
            <span className="text-white font-medium">Wheel / Pinch / [+] [-]:</span>
            <span className="text-gray-400">Zoom In & Out</span>
          </div>
          <span className="text-gray-600 hidden sm:inline">•</span>
          <div className="flex items-center space-x-1.5">
            <span className="text-white font-medium">Right Drag:</span>
            <span className="text-gray-400">Pan</span>
          </div>
          <span className="text-gray-600 hidden sm:inline">•</span>
          <div className="flex items-center space-x-1.5">
            <span className="text-white font-medium">Keys [1-5]:</span>
            <span className="text-gray-400">Presets</span>
          </div>
        </div>

        {/* Mobile View Selector */}
        <div className="flex md:hidden space-x-1">
          <button
            onClick={() => onSelectPreset('overview')}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border ${
              activePreset === 'overview'
                ? 'bg-white/20 text-white border-white/30'
                : 'bg-[#1e2024]/90 text-gray-400 border-white/10'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => onSelectPreset('startLine')}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border ${
              activePreset === 'startLine'
                ? 'bg-white/20 text-white border-white/30'
                : 'bg-[#1e2024]/90 text-gray-400 border-white/10'
            }`}
          >
            Start
          </button>
          <button
            onClick={() => onSelectPreset('crater')}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border ${
              activePreset === 'crater'
                ? 'bg-white/20 text-white border-white/30'
                : 'bg-[#1e2024]/90 text-gray-400 border-white/10'
            }`}
          >
            Caldera
          </button>
        </div>
      </div>
    </div>
  );
};
