import { useState, useEffect } from 'react';
import { RotateCcw } from 'lucide-react';
import { getDueForReview, numberToHebrew, type DueEntry } from '../studyLog';

interface DueForReviewProps {
  tractateEnToHe: Record<string, string>;
  onReview: (entry: DueEntry) => void;
}

const DueForReview = ({ tractateEnToHe, onReview }: DueForReviewProps) => {
  const [dueEntries, setDueEntries] = useState<DueEntry[]>([]);

  useEffect(() => {
    setDueEntries(getDueForReview());
  }, []);

  if (dueEntries.length === 0) return null; // אין כרגע מה להזכיר

  return (
    <div className="bg-white rounded-2xl border border-hairline mb-8 p-4">
      <h3 className="flex items-center gap-2 font-bold text-cover text-sm mb-4">
        <RotateCcw size={18} className="text-brass" />
        כדאי לחזור על זה
      </h3>
      <div className="space-y-2">
        {dueEntries.map((entry) => (
          <div
            key={`${entry.tractateEn}.${entry.daf}${entry.side}`}
            className="flex items-center justify-between gap-3 p-3 bg-parchment-50 rounded-xl border border-hairline"
          >
            <div className="min-w-0">
              <strong className="font-classic text-ink">
                {tractateEnToHe[entry.tractateEn] || entry.tractateEn} דף {numberToHebrew(entry.daf)}{' '}
                עמוד {entry.side === 'a' ? 'א' : 'ב'}
              </strong>
              <span className="block text-xs text-ink/40">לפני {entry.daysSince} ימים</span>
            </div>
            <button
              onClick={() => onReview(entry)}
              className="px-3 py-1.5 bg-cover hover:bg-cover-dark text-parchment-50 text-sm font-semibold rounded-lg shrink-0 transition-colors"
            >
              לחזור
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DueForReview;
