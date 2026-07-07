import { useState, useEffect } from 'react';
import { GraduationCap, ChevronDown, ChevronUp, Check, Award } from 'lucide-react';

interface Tractate {
  he: string;
  en: string;
}

const DONE_KEY = 'havruta_masechtot_done';
const DATES_KEY = 'havruta_masechtot_dates';

function loadDone(): Set<string> {
  try {
    const raw = localStorage.getItem(DONE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function saveDone(done: Set<string>) {
  localStorage.setItem(DONE_KEY, JSON.stringify(Array.from(done)));
}

function loadDates(): Record<string, number> {
  try {
    const raw = localStorage.getItem(DATES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveDates(dates: Record<string, number>) {
  localStorage.setItem(DATES_KEY, JSON.stringify(dates));
}

const MesechetTracker = () => {
  const [tractates, setTractates] = useState<Tractate[]>([]);
  const [done, setDone] = useState<Set<string>>(() => loadDone());
  const [dates, setDates] = useState<Record<string, number>>(() => loadDates());
  const [expanded, setExpanded] = useState(false);
  const [certTractate, setCertTractate] = useState<Tractate | null>(null);

  useEffect(() => {
    fetch('/api/tractates')
      .then((res) => res.json())
      .then((data) => setTractates(data.tractates || []))
      .catch((e) => console.error('[מסכתות] שגיאה בטעינת רשימת המסכתות:', e));
  }, []);

  useEffect(() => {
    if (certTractate) {
      const timer = setTimeout(() => window.print(), 60);
      return () => clearTimeout(timer);
    }
  }, [certTractate]);

  const toggleTractate = (en: string) => {
    const nextDone = new Set(done);
    const nextDates = { ...dates };
    if (nextDone.has(en)) {
      nextDone.delete(en);
      delete nextDates[en];
    } else {
      nextDone.add(en);
      nextDates[en] = Date.now();
    }
    setDone(nextDone);
    saveDone(nextDone);
    setDates(nextDates);
    saveDates(nextDates);
  };

  const total = tractates.length;
  const completed = tractates.filter((t) => done.has(t.en)).length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="bg-white rounded-2xl border border-hairline mb-8 overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-3 p-4 text-right hover:bg-parchment-50/50 transition-colors"
        aria-expanded={expanded}
        aria-label="הצג/הסתר רשימת מסכתות"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <GraduationCap size={20} className="text-brass shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="font-bold text-cover text-sm">התקדמות לקראת סיום הש"ס</span>
              <span className="text-xs text-ink/50 shrink-0">{completed}/{total} מסכתות</span>
            </div>
            <div className="h-2 bg-parchment-100 rounded-full overflow-hidden">
              <div className="h-full bg-brass transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
        {expanded ? (
          <ChevronUp size={18} className="text-ink/40 shrink-0" />
        ) : (
          <ChevronDown size={18} className="text-ink/40 shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 flex flex-wrap gap-2 border-t border-hairline pt-4">
          {tractates.map((t) => {
            const isDone = done.has(t.en);
            return (
              <div
                key={t.en}
                className={`flex items-center gap-1 pr-1 pl-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                  isDone
                    ? 'bg-brass/15 border-brass text-brass-dark'
                    : 'bg-parchment-50 border-hairline text-ink/60'
                }`}
              >
                {isDone && (
                  <button
                    onClick={() => setCertTractate(t)}
                    className="p-1 rounded-full hover:bg-brass/20 transition-colors"
                    title="הפק תעודת סיום"
                    aria-label={`הפק תעודת סיום למסכת ${t.he}`}
                  >
                    <Award size={14} />
                  </button>
                )}
                <button
                  onClick={() => toggleTractate(t.en)}
                  className="flex items-center gap-1.5"
                  aria-pressed={isDone}
                  aria-label={isDone ? `סמן את מסכת ${t.he} כלא הושלמה` : `סמן את מסכת ${t.he} כהושלמה`}
                >
                  {isDone && <Check size={13} />}
                  {t.he}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* אזור הדפסה בלבד - תעודת סיום מסכת */}
      {certTractate && (
        <div id="print-area" className="hidden print:flex flex-col items-center justify-center p-16 text-center" dir="rtl">
          <div className="border-4 border-double border-cover rounded-2xl p-16 max-w-2xl">
            <GraduationCap size={48} className="mx-auto text-brass mb-6" />
            <p className="text-sm text-ink/60 mb-2 tracking-widest">תעודת סיום</p>
            <h1 className="text-4xl font-classic font-bold text-cover mb-6">מסכת {certTractate.he}</h1>
            <p className="text-lg text-ink/70 mb-1 font-classic">בהצלחה ובברכה על סיום הלימוד</p>
            <p className="text-sm text-ink/50 mt-8">
              הושלם בתאריך{' '}
              {new Date(dates[certTractate.en] || Date.now()).toLocaleDateString('he-IL', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
            <p className="text-xs text-ink/30 mt-6">חברותא דיגיטלית</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MesechetTracker;
