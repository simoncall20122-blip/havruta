import { useState, useEffect } from 'react';
import { Award } from 'lucide-react';
import { getStreak, getTotalSeconds, getSessionCount } from '../studyTimer';
import { getTotalDapimStudiedAllTractates } from '../studyLog';

function getMesechtotDoneCount(): number {
  try {
    const raw = localStorage.getItem('havruta_masechtot_done');
    return raw ? (JSON.parse(raw) as string[]).length : 0;
  } catch {
    return 0;
  }
}

interface Badge {
  key: string;
  label: string;
  isUnlocked: (ctx: { streak: number; hours: number; sessions: number; dapim: number; mesechtot: number }) => boolean;
}

const BADGES: Badge[] = [
  { key: 'first_session', label: 'צעד ראשון', isUnlocked: (c) => c.sessions >= 1 },
  { key: 'first_mesechet', label: 'מסכת ראשונה', isUnlocked: (c) => c.mesechtot >= 1 },
  { key: 'streak_7', label: 'שבוע ברצף', isUnlocked: (c) => c.streak >= 7 },
  { key: 'streak_30', label: 'חודש ברצף', isUnlocked: (c) => c.streak >= 30 },
  { key: 'hours_10', label: '10 שעות לימוד', isUnlocked: (c) => c.hours >= 10 },
  { key: 'hours_50', label: '50 שעות לימוד', isUnlocked: (c) => c.hours >= 50 },
  { key: 'dapim_50', label: '50 דפים נלמדו', isUnlocked: (c) => c.dapim >= 50 },
  { key: 'mesechtot_5', label: '5 מסכתות', isUnlocked: (c) => c.mesechtot >= 5 },
];

const AchievementBadges = () => {
  const [ctx, setCtx] = useState<{ streak: number; hours: number; sessions: number; dapim: number; mesechtot: number } | null>(null);

  useEffect(() => {
    setCtx({
      streak: getStreak(),
      hours: getTotalSeconds() / 3600,
      sessions: getSessionCount(),
      dapim: getTotalDapimStudiedAllTractates(),
      mesechtot: getMesechtotDoneCount(),
    });
  }, []);

  if (!ctx) return null;
  const unlockedCount = BADGES.filter((b) => b.isUnlocked(ctx)).length;
  if (unlockedCount === 0) return null; // אין עדיין שום תג לפתוח, אין מה להראות

  return (
    <div className="bg-white rounded-2xl border border-hairline mb-8 p-4">
      <h3 className="flex items-center gap-2 font-bold text-cover text-sm mb-4">
        <Award size={18} className="text-brass" />
        תגי הישג ({unlockedCount}/{BADGES.length})
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {BADGES.map((badge) => {
          const unlocked = badge.isUnlocked(ctx);
          return (
            <div
              key={badge.key}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-opacity ${
                unlocked ? 'bg-brass/10 border-brass/30' : 'bg-parchment-50 border-hairline opacity-40'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  unlocked ? 'bg-brass text-cover-dark' : 'bg-hairline text-ink/30'
                }`}
              >
                <Award size={18} />
              </div>
              <span className={`text-xs font-semibold ${unlocked ? 'text-brass-dark' : 'text-ink/40'}`}>{badge.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AchievementBadges;
