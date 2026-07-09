import { useState, useEffect } from 'react';
import { Timer, Flame } from 'lucide-react';
import { getTodaySeconds, getWeekSeconds, getTotalSeconds, getSessionCount, getStreak, formatDuration } from '../studyTimer';

const StudyStats = () => {
  const [stats, setStats] = useState<{ today: number; week: number; total: number; sessions: number; streak: number } | null>(null);

  useEffect(() => {
    setStats({
      today: getTodaySeconds(),
      week: getWeekSeconds(),
      total: getTotalSeconds(),
      sessions: getSessionCount(),
      streak: getStreak(),
    });
  }, []);

  if (!stats || stats.total === 0) return null; // אין עדיין מה להראות

  const tiles = [
    { label: 'היום', value: formatDuration(stats.today) },
    { label: 'השבוע', value: formatDuration(stats.week) },
    { label: 'סך הכל', value: formatDuration(stats.total) },
    { label: 'מפגשי לימוד', value: String(stats.sessions) },
  ];

  return (
    <div className="bg-white rounded-2xl border border-hairline mb-8 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="flex items-center gap-2 font-bold text-cover text-sm">
          <Timer size={18} className="text-brass" />
          סטטיסטיקות לימוד
        </h3>
        {stats.streak > 0 && (
          <span className="flex items-center gap-1 text-sm font-bold text-ribbon-dark bg-ribbon/10 px-2.5 py-1 rounded-full">
            <Flame size={14} className="text-ribbon" />
            {stats.streak} {stats.streak === 1 ? 'יום רצוף' : 'ימים רצוף'}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="bg-parchment-50 rounded-xl border border-hairline p-3 text-center">
            <div className="text-lg font-bold text-cover">{t.value}</div>
            <div className="text-xs text-ink/50 mt-0.5">{t.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StudyStats;
