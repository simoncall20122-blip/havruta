import { useState } from 'react';
import { Calculator } from 'lucide-react';
import { numberToHebrew } from '../studyLog';

interface Tractate {
  he: string;
  en: string;
}

interface TractatePacingProps {
  tractates: Tractate[];
}

const TractatePacing = ({ tractates }: TractatePacingProps) => {
  const [selectedEn, setSelectedEn] = useState('');
  const [endDaf, setEndDaf] = useState('');
  const [endSide, setEndSide] = useState<'a' | 'b'>('b');
  const [targetDays, setTargetDays] = useState('30');

  const endDafNum = parseInt(endDaf, 10);
  const daysNum = parseInt(targetDays, 10);
  const valid = selectedEn && endDafNum >= 2 && daysNum > 0;

  // מתחילים תמיד מדף ב עמוד א (תחילת מסכת סטנדרטית) - סופרים עמודים (לא דפים) כדי שהחישוב יהיה מדויק
  const totalAmudim = valid ? endDafNum * 2 + (endSide === 'b' ? 1 : 0) - 3 : 0;
  const exactPerDay = valid && totalAmudim > 0 ? totalAmudim / daysNum : 0;
  const perDayDisplay = exactPerDay % 1 === 0 ? String(exactPerDay) : exactPerDay.toFixed(1).replace(/\.0$/, '');
  const perWeekDisplay = (exactPerDay * 7).toFixed(1).replace(/\.0$/, '');

  const selectedHe = tractates.find((t) => t.en === selectedEn)?.he || '';

  return (
    <div className="bg-white rounded-2xl border border-hairline mb-8 p-4">
      <h3 className="flex items-center gap-2 font-bold text-cover text-sm mb-4">
        <Calculator size={18} className="text-brass" />
        תכנון קצב לימוד למסכת
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-3">
        <select
          value={selectedEn}
          onChange={(e) => setSelectedEn(e.target.value)}
          className="px-3 py-2 text-sm bg-parchment-50 border border-hairline rounded-lg focus:outline-none focus:ring-2 focus:ring-brass sm:col-span-2"
        >
          <option value="">בחר מסכת...</option>
          {tractates.map((t) => (
            <option key={t.en} value={t.en}>
              {t.he}
            </option>
          ))}
        </select>
        <div className="flex gap-1">
          <input
            type="number"
            min={2}
            value={endDaf}
            onChange={(e) => setEndDaf(e.target.value)}
            placeholder="עד דף (מספר)"
            aria-label="עד דף מספר"
            className="w-full px-3 py-2 text-sm bg-parchment-50 border border-hairline rounded-lg focus:outline-none focus:ring-2 focus:ring-brass"
          />
          <select
            value={endSide}
            onChange={(e) => setEndSide(e.target.value as 'a' | 'b')}
            aria-label="עמוד א או ב"
            className="px-2 py-2 text-sm bg-parchment-50 border border-hairline rounded-lg focus:outline-none focus:ring-2 focus:ring-brass"
          >
            <option value="a">א׳</option>
            <option value="b">ב׳</option>
          </select>
        </div>
        <input
          type="number"
          min={1}
          value={targetDays}
          onChange={(e) => setTargetDays(e.target.value)}
          placeholder="תוך כמה ימים"
          aria-label="תוך כמה ימים"
          className="px-3 py-2 text-sm bg-parchment-50 border border-hairline rounded-lg focus:outline-none focus:ring-2 focus:ring-brass"
        />
      </div>

      {valid && totalAmudim > 0 ? (
        <div className="bg-parchment-50 rounded-xl border border-hairline p-3 text-sm text-ink">
          כדי לסיים את <strong className="font-classic">{selectedHe}</strong> עד דף{' '}
          <span className="font-classic">
            {numberToHebrew(endDafNum)}
            {endSide === 'a' ? '.' : ':'}
          </span>{' '}
          תוך {daysNum} ימים (מתחילים מדף ב׳ עמוד א׳, {totalAmudim} עמודים בסך הכל) — צריך ללמוד בערך{' '}
          <strong className="text-cover">{perDayDisplay} עמודים ביום</strong> (כ-{perWeekDisplay} עמודים בשבוע).
        </div>
      ) : (
        <p className="text-xs text-ink/40">בחר מסכת, עד איזה דף, ותוך כמה ימים — ותקבל את הקצב היומי הנדרש.</p>
      )}
    </div>
  );
};

export default TractatePacing;
