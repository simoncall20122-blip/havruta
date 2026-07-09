import { useState, useEffect, useRef } from 'react';
import { Timer, Flame, Share2 } from 'lucide-react';
import { getTodaySeconds, getWeekSeconds, getTotalSeconds, getSessionCount, getStreak, formatDuration } from '../studyTimer';

function getMesechtotDoneCount(): number {
  try {
    const raw = localStorage.getItem('havruta_masechtot_done');
    return raw ? (JSON.parse(raw) as string[]).length : 0;
  } catch {
    return 0;
  }
}

// מצייר כרטיס שיתוף (1080x1080) עם הסטטיסטיקות, בזהות הצבעים של האפליקציה
function drawJourneyImage(streak: number, totalHours: string, mesechtot: number, sessions: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d')!;

  // רקע ירוק כריכה
  ctx.fillStyle = '#1E3A2B';
  ctx.fillRect(0, 0, 1080, 1080);

  // מסגרת פליז דקורטיבית
  ctx.strokeStyle = '#A9834A';
  ctx.lineWidth = 6;
  ctx.strokeRect(40, 40, 1000, 1000);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(56, 56, 968, 968);

  ctx.direction = 'rtl';
  ctx.textAlign = 'center';

  // כותרת עליונה
  ctx.fillStyle = '#C7A467';
  ctx.font = '32px Heebo, sans-serif';
  ctx.fillText('חברותא דיגיטלית', 540, 150);

  ctx.fillStyle = '#FBF6EA';
  ctx.font = 'bold 56px "David Libre", serif';
  ctx.fillText('המסע שלי בלימוד', 540, 230);

  // רצף ימים - הכי בולט
  ctx.fillStyle = '#8B3232';
  ctx.font = 'bold 140px Heebo, sans-serif';
  ctx.fillText(String(streak), 540, 480);
  ctx.fillStyle = '#FBF6EA';
  ctx.font = '38px Heebo, sans-serif';
  ctx.fillText(streak === 1 ? 'יום רצוף של לימוד' : 'ימים רצוף של לימוד', 540, 540);

  // שורת סטטיסטיקות
  const stats = [
    { label: 'שעות לימוד', value: totalHours },
    { label: 'מסכתות', value: String(mesechtot) },
    { label: 'מפגשים', value: String(sessions) },
  ];
  const startX = 540 - ((stats.length - 1) * 280) / 2;
  stats.forEach((s, i) => {
    const x = startX + i * 280;
    ctx.fillStyle = '#A9834A';
    ctx.font = 'bold 54px Heebo, sans-serif';
    ctx.fillText(s.value, x, 700);
    ctx.fillStyle = '#FBF6EA';
    ctx.font = '26px Heebo, sans-serif';
    ctx.fillText(s.label, x, 745);
  });

  ctx.fillStyle = 'rgba(251, 246, 234, 0.5)';
  ctx.font = '24px Heebo, sans-serif';
  ctx.fillText('בית מדרש וירטואלי — לומדים ביחד, בזמן אמת', 540, 960);

  return canvas.toDataURL('image/png');
}

const StudyStats = () => {
  const [stats, setStats] = useState<{ today: number; week: number; total: number; sessions: number; streak: number } | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const anchorRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    setStats({
      today: getTodaySeconds(),
      week: getWeekSeconds(),
      total: getTotalSeconds(),
      sessions: getSessionCount(),
      streak: getStreak(),
    });
  }, []);

  const handleShareImage = async () => {
    if (!stats) return;
    const totalHoursRounded = Math.round((stats.total / 3600) * 10) / 10;
    const dataUrl = drawJourneyImage(stats.streak, String(totalHoursRounded), getMesechtotDoneCount(), stats.sessions);

    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], 'havruta-journey.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text: 'המסע שלי בלימוד - חברותא דיגיטלית' });
        return;
      }
    } catch {
      // אם השיתוף נכשל/בוטל, נופלים להצגה/הורדה
    }
    setImageUrl(dataUrl);
  };

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
        <div className="flex items-center gap-2">
          {stats.streak > 0 && (
            <span className="flex items-center gap-1 text-sm font-bold text-ribbon-dark bg-ribbon/10 px-2.5 py-1 rounded-full">
              <Flame size={14} className="text-ribbon" />
              {stats.streak} {stats.streak === 1 ? 'יום רצוף' : 'ימים רצוף'}
            </span>
          )}
          <button
            onClick={handleShareImage}
            className="flex items-center gap-1.5 text-xs font-semibold text-brass-dark hover:text-brass transition-colors"
            title="שתף תמונת סיכום"
          >
            <Share2 size={14} />
            תמונת שיתוף
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="bg-parchment-50 rounded-xl border border-hairline p-3 text-center">
            <div className="text-lg font-bold text-cover">{t.value}</div>
            <div className="text-xs text-ink/50 mt-0.5">{t.label}</div>
          </div>
        ))}
      </div>

      {imageUrl && (
        <div className="mt-4 pt-4 border-t border-hairline flex flex-col items-center gap-2">
          <img src={imageUrl} alt="תמונת מסע לימוד" className="w-48 rounded-lg border border-hairline" />
          <a
            ref={anchorRef}
            href={imageUrl}
            download="havruta-journey.png"
            className="text-xs font-semibold text-brass-dark hover:text-brass underline underline-offset-2"
          >
            הורד תמונה
          </a>
        </div>
      )}
    </div>
  );
};

export default StudyStats;
