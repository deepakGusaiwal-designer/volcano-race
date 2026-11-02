import React, { useState } from 'react';
import { Flame, X, Trophy, Zap, Shield, HelpCircle, Car, Compass } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { CarModelId } from '../../types/game';

interface VolcanoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCar: (id: CarModelId) => void;
}

export const VolcanoModal: React.FC<VolcanoModalProps> = ({ isOpen, onClose, onSelectCar }) => {
  const [activeTab, setActiveTab] = useState<'track' | 'cars' | 'tips'>('track');
  const carId = useGameStore((state) => state.carId);
  const bestLapTime = useGameStore((state) => state.bestLapTime);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200 select-none">
      <div className="racing-panel rounded-3xl max-w-2xl w-full border-2 border-orange-500/50 shadow-[0_0_60px_rgba(255,94,19,0.4)] flex flex-col overflow-hidden text-white">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 bg-gradient-to-r from-orange-950/60 to-transparent">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-orange-600 rounded-xl shadow-[0_0_15px_#ff5e13]">
              <Flame className="w-6 h-6 text-yellow-300" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wider glow-orange">
                VOLCANO SPEEDWAY
              </h2>
              <p className="text-xs text-orange-400 font-semibold">
                Hot Wheels Turbo Driver Circuit Guide
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-gray-300 hover:text-white transition-all"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/10 px-5 pt-3 gap-2 bg-black/30">
          <button
            onClick={() => setActiveTab('track')}
            className={`flex items-center space-x-2 px-4 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
              activeTab === 'track'
                ? 'border-orange-500 text-orange-400 bg-orange-950/40'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>TRACK SPECS</span>
          </button>
          <button
            onClick={() => setActiveTab('cars')}
            className={`flex items-center space-x-2 px-4 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
              activeTab === 'cars'
                ? 'border-orange-500 text-orange-400 bg-orange-950/40'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <Car className="w-4 h-4" />
            <span>VEHICLE GARAGE</span>
          </button>
          <button
            onClick={() => setActiveTab('tips')}
            className={`flex items-center space-x-2 px-4 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
              activeTab === 'tips'
                ? 'border-orange-500 text-orange-400 bg-orange-950/40'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>DRIFT GUIDE</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-4">
          {activeTab === 'track' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-black/50 p-3 rounded-xl border border-white/10 text-center">
                  <span className="text-[10px] text-gray-400 font-bold block uppercase">Length</span>
                  <span className="text-base font-black text-yellow-400 font-mono">~480 M</span>
                </div>
                <div className="bg-black/50 p-3 rounded-xl border border-white/10 text-center">
                  <span className="text-[10px] text-gray-400 font-bold block uppercase">Laps</span>
                  <span className="text-base font-black text-orange-400 font-mono">3 Laps</span>
                </div>
                <div className="bg-black/50 p-3 rounded-xl border border-white/10 text-center">
                  <span className="text-[10px] text-gray-400 font-bold block uppercase">Gates</span>
                  <span className="text-base font-black text-cyan-400 font-mono">4 Sectors</span>
                </div>
                <div className="bg-black/50 p-3 rounded-xl border border-white/10 text-center">
                  <span className="text-[10px] text-gray-400 font-bold block uppercase">Record</span>
                  <span className="text-base font-black text-green-400 font-mono">
                    {bestLapTime ? `${bestLapTime}s` : '--'}
                  </span>
                </div>
              </div>

              <div className="bg-orange-950/30 border border-orange-500/30 rounded-2xl p-4 space-y-2">
                <h4 className="text-sm font-black text-orange-400 uppercase flex items-center space-x-1.5">
                  <Flame className="w-4 h-4 text-orange-500" />
                  <span>Caldera Sector Breakdown</span>
                </h4>
                <ul className="text-xs text-gray-300 space-y-1.5 list-disc list-inside">
                  <li><strong>Sector 1 (Start/Finish):</strong> High-speed straight crossing the glowing primary checkpoint arch.</li>
                  <li><strong>Sector 2 (East Gorge):</strong> Gentle right curve flanked by smoking fumaroles and the first gold coin.</li>
                  <li><strong>Sector 3 (The Dyke Hairpin):</strong> Steep 180° hairpin turn over volcanic rock dykes. Prime drift territory!</li>
                  <li><strong>Sector 4 (Caldera Return):</strong> Fast back-stretch alongside bubbling molten magma pools and scorched palms.</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'cars' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Iridium Card */}
                <div
                  onClick={() => onSelectCar('iridium')}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                    carId === 'iridium'
                      ? 'border-orange-500 bg-orange-950/40 shadow-[0_0_20px_rgba(255,94,19,0.3)]'
                      : 'border-white/10 bg-black/40 hover:border-white/30'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-black text-lg text-white">IRIDIUM</h3>
                      <p className="text-[11px] text-orange-400 font-bold">Silencerz Aerodynamic Spec</p>
                    </div>
                    {carId === 'iridium' && (
                      <span className="text-[10px] font-black bg-orange-600 text-white px-2 py-0.5 rounded">
                        SELECTED
                      </span>
                    )}
                  </div>
                  <div className="space-y-1.5 text-xs text-gray-300">
                    <div className="flex justify-between">
                      <span>Top Speed:</span>
                      <span className="font-mono font-bold text-yellow-400">210 KM/H (Nitro)</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Handling:</span>
                      <span className="font-mono font-bold text-cyan-400">Precision Grip</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Drift Stability:</span>
                      <span className="font-mono font-bold text-green-400">High Balance</span>
                    </div>
                  </div>
                </div>

                {/* RD-09 Card */}
                <div
                  onClick={() => onSelectCar('rd09')}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                    carId === 'rd09'
                      ? 'border-orange-500 bg-orange-950/40 shadow-[0_0_20px_rgba(255,94,19,0.3)]'
                      : 'border-white/10 bg-black/40 hover:border-white/30'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-black text-lg text-white">RD-09</h3>
                      <p className="text-[11px] text-orange-400 font-bold">Racing Drones Heavy Armor</p>
                    </div>
                    {carId === 'rd09' && (
                      <span className="text-[10px] font-black bg-orange-600 text-white px-2 py-0.5 rounded">
                        SELECTED
                      </span>
                    )}
                  </div>
                  <div className="space-y-1.5 text-xs text-gray-300">
                    <div className="flex justify-between">
                      <span>Top Speed:</span>
                      <span className="font-mono font-bold text-yellow-400">215 KM/H (Nitro)</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Handling:</span>
                      <span className="font-mono font-bold text-cyan-400">Aggressive Torque</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Drift Multiplier:</span>
                      <span className="font-mono font-bold text-green-400">Rapid Nitro Build</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'tips' && (
            <div className="space-y-3 text-xs text-gray-300">
              <div className="bg-black/50 p-4 rounded-2xl border border-white/10 space-y-2">
                <h4 className="font-black text-sm text-yellow-400 flex items-center space-x-1.5">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  <span>Drifting & Boost Chain</span>
                </h4>
                <p>
                  1. Approaching a bend, hold <kbd className="text-white bg-black/60 px-1 rounded">A</kbd> or <kbd className="text-white bg-black/60 px-1 rounded">D</kbd> and tap <kbd className="text-yellow-400 bg-black/60 px-1.5 py-0.5 rounded border border-yellow-500/40">SPACE</kbd>.
                </p>
                <p>
                  2. As the car breaks traction, smoke billows and your <strong>Nitro Tank charges rapidly</strong>.
                </p>
                <p>
                  3. Straighten out and slam <kbd className="text-cyan-400 bg-black/60 px-1.5 py-0.5 rounded border border-cyan-500/40">SHIFT</kbd> for an explosive exit rocket!
                </p>
              </div>

              <div className="bg-black/50 p-4 rounded-2xl border border-white/10 space-y-1.5">
                <h4 className="font-black text-sm text-cyan-400 flex items-center space-x-1.5">
                  <Shield className="w-4 h-4 text-cyan-400" />
                  <span>Quick Keys</span>
                </h4>
                <p>• <kbd className="bg-black/60 px-1 rounded text-white font-mono">C</kbd> toggles between <strong>Chase</strong>, <strong>Hood/Cockpit</strong>, and <strong>Far Helicopter</strong> cameras.</p>
                <p>• <kbd className="bg-black/60 px-1 rounded text-white font-mono">R</kbd> instantly resets your car at the last cleared checkpoint if you fly off the track.</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-black/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-[0_0_15px_#ff5e13] transition-transform active:scale-95"
          >
            Return to Race
          </button>
        </div>
      </div>
    </div>
  );
};
