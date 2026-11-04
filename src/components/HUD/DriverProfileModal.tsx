import React, { useEffect } from 'react';
import {
  Trophy,
  Award,
  Star,
  Zap,
  Flame,
  X,
  Shield,
  Medal,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { soundEffects } from '../../audio/SoundEffects';

export const DriverProfileModal: React.FC = () => {
  const isCareerModalOpen = useGameStore((state) => state.isCareerModalOpen);
  const setCareerModalOpen = useGameStore((state) => state.setCareerModalOpen);
  const driverProfile = useGameStore((state) => state.driverProfile);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.code === 'Escape' || e.code === 'KeyP') && isCareerModalOpen) {
        setCareerModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCareerModalOpen, setCareerModalOpen]);

  if (!isCareerModalOpen) return null;

  const xpInCurrentLevel = driverProfile.xp % 1000;
  const xpProgress = Math.min(100, Math.round((xpInCurrentLevel / 1000) * 100));
  const totalStars = driverProfile.starsClassic + driverProfile.starsReverse;
  const winRate = driverProfile.careerRaces > 0
    ? Math.round((driverProfile.careerWins / driverProfile.careerRaces) * 100)
    : 0;

  const achievements = [
    {
      id: 'first_race',
      title: 'FIRST IGNITION',
      desc: 'Complete your first race on Volcano Speedway',
      unlocked: driverProfile.careerRaces >= 1,
      icon: Flame,
    },
    {
      id: 'volcano_king',
      title: 'VOLCANO CONQUEROR',
      desc: 'Finish 1st Place in the Grand Prix fleet',
      unlocked: driverProfile.careerWins >= 1,
      icon: Trophy,
    },
    {
      id: 'stunt_master',
      title: 'STUNT VIRTUOSO',
      desc: 'Collect 10+ coins along the volcanic circuit',
      unlocked: driverProfile.careerCoins >= 10,
      icon: Zap,
    },
    {
      id: 'podium_pro',
      title: 'STAR COLLECTOR',
      desc: 'Earn 3 or more circuit mastery stars',
      unlocked: totalStars >= 3,
      icon: Medal,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 select-none pointer-events-auto">
      <div className="relative w-full max-w-xl bg-[#121418]/95 border border-white/15 rounded-3xl shadow-[0_0_60px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col pointer-events-auto">
        {/* Header Strip with Glowing Badge */}
        <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between bg-black/40">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-400 flex items-center justify-center text-black font-black text-lg shadow-[0_0_20px_rgba(249,115,22,0.4)]">
              L{driverProfile.level}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-black text-white uppercase tracking-wider font-sans">
                  DRIVER PASSPORT
                </h2>
                <span className="text-[10px] font-mono font-bold bg-orange-500/20 text-orange-400 px-2.5 py-0.5 rounded-full border border-orange-500/40">
                  {driverProfile.title}
                </span>
              </div>
              <p className="text-xs text-gray-400 font-medium">
                Official Volcano Speedway Motorsports Registry
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              soundEffects.playClick();
              setCareerModalOpen(false);
            }}
            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/15 text-gray-400 hover:text-white flex items-center justify-center transition-all border border-white/10 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Level & XP Progression Bar */}
        <div className="px-6 py-4 bg-gradient-to-r from-orange-950/30 via-black/40 to-black/30 border-b border-white/5">
          <div className="flex justify-between items-center text-xs font-bold mb-1.5">
            <span className="text-gray-300 flex items-center space-x-1.5">
              <Shield className="w-3.5 h-3.5 text-orange-400" />
              <span>DRIVER PROGRESSION (LEVEL {driverProfile.level})</span>
            </span>
            <span className="font-mono text-orange-400">
              {xpInCurrentLevel} / 1000 XP ({xpProgress}%)
            </span>
          </div>
          <div className="w-full h-2.5 bg-black/70 rounded-full overflow-hidden border border-white/10">
            <div
              className="h-full bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-300 rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(249,115,22,0.6)]"
              style={{ width: `${xpProgress}%` }}
            />
          </div>
        </div>

        {/* Career Statistics Grid */}
        <div className="p-6 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-black/20">
          <div className="bg-[#181a1f] p-3 rounded-2xl border border-white/5 text-center">
            <span className="text-[10px] text-gray-400 font-bold block mb-1">RACES ENTERED</span>
            <span className="text-xl font-mono font-black text-white">{driverProfile.careerRaces}</span>
          </div>
          <div className="bg-[#181a1f] p-3 rounded-2xl border border-white/5 text-center">
            <span className="text-[10px] text-gray-400 font-bold block mb-1">WINS (1ST)</span>
            <span className="text-xl font-mono font-black text-amber-400">{driverProfile.careerWins}</span>
          </div>
          <div className="bg-[#181a1f] p-3 rounded-2xl border border-white/5 text-center">
            <span className="text-[10px] text-gray-400 font-bold block mb-1">WIN RATE</span>
            <span className="text-xl font-mono font-black text-emerald-400">{winRate}%</span>
          </div>
          <div className="bg-[#181a1f] p-3 rounded-2xl border border-white/5 text-center">
            <span className="text-[10px] text-gray-400 font-bold block mb-1 flex items-center justify-center space-x-1">
              <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
              <span>STARS</span>
            </span>
            <span className="text-xl font-mono font-black text-yellow-300">{totalStars}</span>
          </div>
        </div>

        {/* Achievements Showcase */}
        <div className="px-6 py-4 border-t border-white/5 bg-black/40">
          <h3 className="text-xs font-mono font-bold tracking-wider uppercase text-gray-400 mb-3 flex items-center space-x-1.5">
            <Trophy className="w-3.5 h-3.5 text-orange-400" />
            <span>HALL OF FAME HONORS</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {achievements.map((ach) => {
              const Icon = ach.icon;
              return (
                <div
                  key={ach.id}
                  className={`p-3 rounded-xl border flex items-center space-x-3 transition-all ${
                    ach.unlocked
                      ? 'bg-gradient-to-r from-orange-500/10 to-transparent border-orange-500/30'
                      : 'bg-white/5 border-white/5 opacity-50'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                      ach.unlocked ? 'bg-orange-500/20 text-orange-400' : 'bg-black/50 text-gray-500'
                    }`}
                  >
                    {ach.unlocked ? <Icon className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <span className="text-xs font-black text-white">{ach.title}</span>
                      {ach.unlocked && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                    </div>
                    <p className="text-[10px] text-gray-400 font-medium">{ach.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/10 bg-black/60 flex items-center justify-between text-xs text-gray-400">
          <span>Career saved locally in browser storage</span>
          <button
            onClick={() => setCareerModalOpen(false)}
            className="px-4 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg font-bold text-xs transition-colors cursor-pointer"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
};
