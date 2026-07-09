import { useState, useEffect } from 'react';
import { ScrollText, ChevronDown, ChevronUp, Search, Clock3, LayoutList } from 'lucide-react';
import { API_URL } from '../apiBase';
import { loadStudyLog, formatStudiedRanges, countStudiedDapim, numberToHebrew } from '../studyLog';

interface Tractate {
  he: string;
  en: string;
}

interface StudyLogViewProps {
  onOpenPage?: (entry: { tractateEn: string; daf: number; side: 'a' | 'b' }) => void;
}

function formatRelativeTime(ts: number): string {
  const diffMs = Date.now() - ts;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'הרגע';
  if (minutes < 60) return `לפני ${minutes} דקות`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `לפני ${hours} שעות`;
  const days = Math.floor(hours / 24);
  return `לפני ${days} ימים`;
}

const StudyLogView = ({ onOpenPage }: StudyLogViewProps) => {
  const [tractates, setTractates] = useState<Tractate[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [log, setLog] = useState(() => loadStudyLog());
  const [mode, setMode] = useState<'byTractate' | 'recent'>('byTractate');
  const [filter, setFilter] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/api/tractates`)
      .then((res) => res.json())
      .then((data) => setTractates(data.tractates || []))
      .catch((e) => console.error('[תיעוד לימוד] שגיאה בטעינת רשימת המסכתות:', e));
  }, []);

  // מתעדכן כשחוזרים ללובי (אחרי לימוד בחדר) - קורא מחדש מה-localStorage
  useEffect(() => {
    if (expanded) setLog(loadStudyLog());
  }, [expanded]);

  const studiedTractates = tractates
    .map((t) => ({ ...t, entries: log[t.en] || [] }))
    .filter((t) => t.entries.length > 0);

  const totalDapim = studiedTractates.reduce((sum, t) => sum + countStudiedDapim(t.entries), 0);

  // ממוין לפי ביקור אחרון (המסכת עם הביקור העדכני ביותר עולה ראשונה) - יעיל יותר לבדוק "מה למדתי לאחרונה"
  const sortedByRecency = [...studiedTractates].sort((a, b) => {
    const aLatest = Math.max(...a.entries.map((e) => e.ts));
    const bLatest = Math.max(...b.entries.map((e) => e.ts));
    return bLatest - aLatest;
  });

  const filtered = sortedByRecency.filter((t) => !filter.trim() || t.he.includes(filter.trim()));

  // רשימה שטוחה של כל הביקורים הבודדים, מהעדכני ביותר - למי שרוצה לראות "מה קראתי לאחרונה" בלי קיבוץ למסכת
  const recentFlat = studiedTractates
    .flatMap((t) => t.entries.map((e) => ({ tractateHe: t.he, tractateEn: t.en, daf: e.daf, side: e.side, ts: e.ts })))
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 20);

  if (tractates.length > 0 && studiedTractates.length === 0) return null; // אין עדיין מה להראות

  return (
    <div className="bg-white rounded-2xl border border-hairline mb-8 overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-3 p-4 text-right hover:bg-parchment-50/50 transition-colors"
        aria-expanded={expanded}
        aria-label="הצג/הסתר תיעוד לימוד מפורט"
      >
        <div className="flex items-center gap-3">
          <ScrollText size={20} className="text-brass shrink-0" />
          <div>
            <div className="font-bold text-cover text-sm">תיעוד לימוד מפורט</div>
            <div className="text-xs text-ink/50">{totalDapim} דפים נלמדו, נרשם אוטומטית לפי מה שנפתח בחדרים</div>
          </div>
        </div>
        {expanded ? <ChevronUp size={18} className="text-ink/40 shrink-0" /> : <ChevronDown size={18} className="text-ink/40 shrink-0" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-hairline pt-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex bg-parchment-100 rounded-lg p-1 text-xs">
              <button
                onClick={() => setMode('byTractate')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md font-semibold transition-colors ${
                  mode === 'byTractate' ? 'bg-white text-cover shadow-sm' : 'text-ink/50'
                }`}
              >
                <LayoutList size={13} />
                לפי מסכת
              </button>
              <button
                onClick={() => setMode('recent')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md font-semibold transition-colors ${
                  mode === 'recent' ? 'bg-white text-cover shadow-sm' : 'text-ink/50'
                }`}
              >
                <Clock3 size={13} />
                ביקורים אחרונים
              </button>
            </div>
            {mode === 'byTractate' && (
              <div className="relative flex-1">
                <Search size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink/30" />
                <input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="סנן מסכת..."
                  className="w-full pr-8 pl-2 py-1.5 text-xs bg-parchment-50 border border-hairline rounded-lg focus:outline-none focus:ring-2 focus:ring-brass"
                />
              </div>
            )}
          </div>

          {mode === 'byTractate' ? (
            <div className="space-y-2.5">
              {filtered.map((t) => (
                <div key={t.en} className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 text-sm">
                  <strong className="text-ink shrink-0 sm:w-24">{t.he}</strong>
                  <span className="text-ink/60 font-classic">{formatStudiedRanges(t.entries)}</span>
                </div>
              ))}
              {filtered.length === 0 && <p className="text-xs text-ink/40 text-center py-3">אין מסכת תואמת לסינון.</p>}
            </div>
          ) : (
            <div className="space-y-1.5">
              {recentFlat.map((v) => (
                <button
                  key={`${v.tractateEn}.${v.daf}${v.side}.${v.ts}`}
                  onClick={() => onOpenPage?.({ tractateEn: v.tractateEn, daf: v.daf, side: v.side })}
                  disabled={!onOpenPage}
                  className="w-full flex items-center justify-between gap-2 p-2.5 bg-parchment-50 rounded-xl border border-hairline text-sm hover:border-brass/40 transition-colors disabled:cursor-default"
                >
                  <span className="font-classic text-ink">
                    {v.tractateHe} דף {numberToHebrew(v.daf)} עמוד {v.side === 'a' ? 'א' : 'ב'}
                  </span>
                  <span className="text-xs text-ink/40 shrink-0">{formatRelativeTime(v.ts)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StudyLogView;

