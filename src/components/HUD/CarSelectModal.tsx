import React, { useEffect } from 'react';
import { X, Car, Gauge, Zap, Flame, CheckCircle2, ChevronRight, Trophy } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { CAR_PRESETS, CarModelId } from '../../types/game';
import { soundEffects } from '../../audio/SoundEffects';

interface CarSelectModalProps {
  onSelectCar: (carId: CarModelId) => void;
}

export const CarSelectModal: React.FC<CarSelectModalProps> = ({ onSelectCar }) => {
  const isCarSelectOpen = useGameStore((state) => state.isCarSelectOpen);
  const toggleCarSelect = useGameStore((state) => state.toggleCarSelect);
  const currentCarId = useGameStore((state) => state.carId);
  const setCarId = useGameStore((state) => state.setCarId);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isCarSelectOpen) {
        toggleCarSelect();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCarSelectOpen, toggleCarSelect]);

  if (!isCarSelectOpen) return null;

  const cars = Object.values(CAR_PRESETS);

  const handleCarClick = (carId: CarModelId) => {
    soundEffects.playCoin();
    setCarId(carId);
    onSelectCar(carId);
    toggleCarSelect();
  };

  const getCarBadge = (id: CarModelId) => {
    if (id === 'mazda') return { tag: 'LE MANS PROTOTYPE', badgeClass: 'bg-red-500/20 text-red-400 border-red-500/40' };
    if (id === 'iridium') return { tag: 'SUPERCHARGED HYPER-SPEED', badgeClass: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40' };
    return { tag: 'VOLCANIC DRIFT BEAST', badgeClass: 'bg-orange-500/20 text-orange-400 border-orange-500/40' };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in select-none pointer-events-auto">
      {/* Background Volcanic Radial Lighting */}
      <div className="absolute inset-0 bg-radial from-orange-600/10 via-transparent to-black pointer-events-none" />

      {/* Main Garage Card */}
      <div className="relative w-full max-w-4xl bg-[#131518]/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] pointer-events-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-black/40">
          <div className="flex items-center space-x-3.5">
            <div className="h-11 px-2.5 rounded-xl bg-gradient-to-br from-black/90 to-[#1e2025] flex items-center justify-center border border-white/10 shadow-lg shadow-black/60">
              <img src="/images/logo.svg" alt="Deepak Gusaiwal Logo" className="h-7 w-auto object-contain" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-black tracking-wider uppercase text-white font-sans">
                  VOLCANO GARAGE
                </h2>
                <span className="text-[10px] bg-red-500/20 text-red-400 px-2.5 py-0.5 rounded-full border border-red-500/40 font-mono font-semibold tracking-wider">
                  DEEPAK GUSAIWAL MOTORSPORTS
                </span>
              </div>
              <p className="text-xs text-gray-400 font-medium">
                High-performance fleet curated by Deepak Gusaiwal for the magma circuit
              </p>
            </div>
          </div>

          <button
            onClick={toggleCarSelect}
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/15 text-gray-400 hover:text-white flex items-center justify-center transition-all border border-white/10 cursor-pointer pointer-events-auto"
            title="Close Garage (Esc / V)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cars Showcase Grid */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-5 overflow-y-auto pointer-events-auto">
          {cars.map((car) => {
            const isSelected = car.id === currentCarId;
            const badge = getCarBadge(car.id);

            return (
              <div
                key={car.id}
                onClick={() => handleCarClick(car.id)}
                className={`group relative rounded-2xl p-5 border transition-all duration-200 cursor-pointer pointer-events-auto flex flex-col justify-between ${
                  isSelected
                    ? 'bg-gradient-to-b from-[#22262d] to-[#181a1f] border-orange-500 shadow-[0_0_25px_rgba(249,115,22,0.25)] ring-1 ring-orange-500/50'
                    : 'bg-[#181a1f]/80 hover:bg-[#202329] border-white/10 hover:border-white/20'
                }`}
              >
                {/* Active Indicator Pin */}
                {isSelected && (
                  <div className="absolute -top-3 right-4 bg-gradient-to-r from-orange-500 to-amber-500 text-black text-[10px] font-black tracking-wider uppercase px-2.5 py-0.5 rounded-full shadow-lg flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3 text-black stroke-[3]" />
                    <span>ACTIVE</span>
                  </div>
                )}

                <div>
                  {/* Category Tag */}
                  <div className="mb-2.5">
                    <span className={`text-[10px] font-mono font-bold tracking-wider px-2 py-0.5 rounded border uppercase ${badge.badgeClass}`}>
                      {badge.tag}
                    </span>
                  </div>

                  {/* Car Name & Subtitle */}
                  <h3 className="text-lg font-black text-white tracking-wide group-hover:text-orange-400 transition-colors">
                    {car.name}
                  </h3>
                  <p className="text-xs text-gray-400 mb-4 line-clamp-1 font-medium">
                    {car.subtitle}
                  </p>

                  {/* Stat Meters */}
                  <div className="space-y-2.5 my-4 bg-black/40 p-3.5 rounded-xl border border-white/5">
                    {/* Top Speed */}
                    <div>
                      <div className="flex justify-between text-[11px] mb-1 font-medium">
                        <span className="flex items-center space-x-1.5 text-gray-400">
                          <Gauge className="w-3.5 h-3.5 text-orange-400" />
                          <span>TOP SPEED</span>
                        </span>
                        <span className="font-mono font-bold text-white">{car.topSpeed} KM/H</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full"
                          style={{ width: `${(car.topSpeed / 260) * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* Acceleration */}
                    <div>
                      <div className="flex justify-between text-[11px] mb-1 font-medium">
                        <span className="flex items-center space-x-1.5 text-gray-400">
                          <Zap className="w-3.5 h-3.5 text-yellow-400" />
                          <span>ACCELERATION</span>
                        </span>
                        <span className="font-mono font-bold text-white">{car.acceleration}/10</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-yellow-500 to-amber-300 rounded-full"
                          style={{ width: `${(car.acceleration / 10) * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* Handling */}
                    <div>
                      <div className="flex justify-between text-[11px] mb-1 font-medium">
                        <span className="flex items-center space-x-1.5 text-gray-400">
                          <Trophy className="w-3.5 h-3.5 text-emerald-400" />
                          <span>HANDLING</span>
                        </span>
                        <span className="font-mono font-bold text-white">{car.handling}/10</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                          style={{ width: `${(car.handling / 10) * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* Drift Rating */}
                    <div>
                      <div className="flex justify-between text-[11px] mb-1 font-medium">
                        <span className="flex items-center space-x-1.5 text-gray-400">
                          <Flame className="w-3.5 h-3.5 text-red-400" />
                          <span>DRIFT RATING</span>
                        </span>
                        <span className="font-mono font-bold text-white">{car.driftMultiplier >= 3.8 ? 'MAX' : 'HIGH'}</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-red-500 to-orange-400 rounded-full"
                          style={{ width: `${Math.min(100, (car.driftMultiplier / 3.85) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Selection Action Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCarClick(car.id);
                  }}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-1.5 transition-all shadow-md active:scale-95 cursor-pointer pointer-events-auto ${
                    isSelected
                      ? 'bg-orange-500 text-black hover:bg-orange-400 font-black'
                      : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
                  }`}
                >
                  <span>{isSelected ? 'CURRENTLY DRIVING' : 'SELECT & DRIVE'}</span>
                  {!isSelected && <ChevronRight className="w-4 h-4 text-orange-400 group-hover:translate-x-0.5 transition-transform" />}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer info bar */}
        <div className="px-6 py-3 border-t border-white/10 bg-black/40 flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center space-x-2">
            <kbd className="bg-black/60 px-1.5 py-0.5 rounded border border-gray-700 text-white font-mono text-[10px]">V</kbd>
            <span>or</span>
            <kbd className="bg-black/60 px-1.5 py-0.5 rounded border border-gray-700 text-white font-mono text-[10px]">ESC</kbd>
            <span className="text-gray-500">to close garage</span>
          </div>
          <div className="text-[11px] text-orange-400/90 font-medium hidden sm:inline">
            Each car features custom downforce, gear ratios, and wheel physics!
          </div>
        </div>
      </div>
    </div>
  );
};
