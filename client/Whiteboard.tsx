import { useState, useEffect } from 'react';
import { ScrollText, ChevronDown, ChevronUp } from 'lucide-react';
import { API_URL } from '../apiBase';
import { loadStudyLog, formatStudiedRanges, countStudiedDapim } from '../studyLog';

interface Tractate {
  he: string;
  en: string;
}

const StudyLogView = () => {
  const [tractates, setTractates] = useState<Tractate[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [log, setLog] = useState(() => loadStudyLog());

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
        <div className="px-4 pb-4 border-t border-hairline pt-4 space-y-2.5">
          {studiedTractates.map((t) => (
            <div key={t.en} className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 text-sm">
              <strong className="text-ink shrink-0 sm:w-24">{t.he}</strong>
              <span className="text-ink/60 font-classic">
                {formatStudiedRanges(t.entries)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StudyLogView;
