import React, { useEffect, useRef } from 'react';
import { GameEngine } from './game/GameEngine';
import { useGameStore } from './store/useGameStore';
import { Speedometer } from './components/HUD/Speedometer';
import { LapCounter } from './components/HUD/LapCounter';
import { NotificationToast } from './components/HUD/NotificationToast';
import { VictoryModal } from './components/HUD/VictoryModal';
import { CarSelectModal } from './components/HUD/CarSelectModal';
import { RoadHint } from './components/HUD/RoadHint';

export const App: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const isLoading = useGameStore((state) => state.isLoading);
  const loadingProgress = useGameStore((state) => state.loadingProgress);
  const loadingMessage = useGameStore((state) => state.loadingMessage);
  const cameraMode = useGameStore((state) => state.cameraMode);

  useEffect(() => {
    if (!containerRef.current) return;

    const engine = new GameEngine(containerRef.current);
    engineRef.current = engine;
    engine.init();

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleReset = () => {
    engineRef.current?.resetRace();
  };

  const handleToggleCamera = () => {
    engineRef.current?.cycleCamera();
  };

  const handleZoomIn = () => {
    engineRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    engineRef.current?.zoomOut();
  };

  const handleToggleTrackDirection = () => {
    engineRef.current?.toggleTrackDirection();
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#18191c] select-none font-sans">
      {/* 3D WebGL Canvas Viewport */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full z-0 cursor-grab active:cursor-grabbing" />

      {/* Atmospheric Filmic Vignette */}
      <div className="cinematic-vignette absolute inset-0 z-[5] pointer-events-none" />

      {/* Cinematic 2.39:1 Letterbox Bars & Director Badge */}
      {cameraMode === 'cinematic' && (
        <>
          <div className="fixed top-0 left-0 right-0 h-[7.5vh] bg-black pointer-events-none z-30 transition-all duration-700 border-b border-white/5 cinematic-letterbox" />
          <div className="fixed bottom-0 left-0 right-0 h-[7.5vh] bg-black pointer-events-none z-30 transition-all duration-700 border-t border-white/5 cinematic-letterbox" />
          <div className="fixed top-[8.5vh] right-6 z-30 pointer-events-none flex items-center space-x-2.5 bg-black/75 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-red-500/40 text-[11px] font-mono text-white tracking-widest uppercase shadow-2xl animate-fade-in">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
            <span className="font-bold text-red-400">REC</span>
            <span className="text-gray-500">•</span>
            <span className="text-amber-400 font-semibold tracking-wider">2.39:1 CINEMATIC</span>
          </div>
        </>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#18191c] text-white p-6 select-none">
          <div className="text-xl sm:text-2xl font-bold tracking-wide mb-2 text-white">
            Volcano Speedway
          </div>
          <p className="text-xs text-gray-400 mb-6 font-medium">
            {loadingMessage || 'Loading Mazda LM Vision & Volcano Circuit...'}
          </p>

          <div className="bg-[#1e2024] rounded-xl p-5 max-w-xs w-full border border-white/10 shadow-2xl">
            <div className="flex justify-between text-xs text-gray-300 mb-2">
              <span>Loading Assets</span>
              <span className="font-mono text-gray-400">{loadingProgress}%</span>
            </div>
            <div className="w-full h-2 bg-black/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-orange-500 to-yellow-400 rounded-full transition-all duration-150"
                style={{ width: `${Math.max(5, loadingProgress)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* In-Game HUD Elements */}
      {!isLoading && (
        <div className="absolute inset-0 pointer-events-none p-4 sm:p-6 flex flex-col justify-between z-10">
          {/* Top Row: Lap Counter & Dynamic Road Hint */}
          <div className="flex items-start justify-between w-full pointer-events-auto">
            <LapCounter />
            <div className="flex-1 flex justify-center px-4">
              <RoadHint />
            </div>
            <div className="hidden sm:block w-28" />
          </div>

          {/* Center Notifications */}
          <NotificationToast />

          {/* Bottom Area: Speedometer */}
          <div className="flex flex-col space-y-3 w-full">
            <div className="self-end pointer-events-auto">
              <Speedometer />
            </div>
          </div>
        </div>
      )}

      {/* Victory Modal on 3 Laps Finished (Full Interactive Overlay) */}
      <VictoryModal onRestart={handleReset} />

      {/* Garage / Vehicle Selection Modal (Full Interactive Overlay) */}
      <CarSelectModal onSelectCar={(id) => engineRef.current?.switchCar(id)} />
    </div>
  );
};

export default App;
