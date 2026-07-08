const LOG_KEY = 'havruta_study_log';

interface DafEntry {
  daf: number;
  side: 'a' | 'b';
  ts: number;
}

type StudyLog = Record<string, DafEntry[]>; // tractateEn -> entries

export function loadStudyLog(): StudyLog {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveStudyLog(log: StudyLog) {
  localStorage.setItem(LOG_KEY, JSON.stringify(log));
}

// נקרא בכל פעם שנטען דף בהצלחה בחדר הלימוד - רישום אוטומטי, בלי צורך בפעולה נוספת מהמשתמש
export function logDafStudied(tractateEn: string, daf: number, side: 'a' | 'b') {
  const log = loadStudyLog();
  const entries = log[tractateEn] || [];
  if (entries.some((e) => e.daf === daf && e.side === side)) return; // כבר נרשם
  entries.push({ daf, side, ts: Date.now() });
  log[tractateEn] = entries;
  saveStudyLog(log);
}

// ממיר מספר לגימטריה עברית (כולל היוצא מן הכלל טו/טז), למשל 176 -> "קעו"
export function numberToHebrew(num: number): string {
  let result = '';
  let remaining = num;
  const hundreds: [number, string][] = [[400, 'ת'], [300, 'ש'], [200, 'ר'], [100, 'ק']];
  for (const [val, letter] of hundreds) {
    while (remaining >= val) {
      result += letter;
      remaining -= val;
    }
  }
  if (remaining === 15) return result + 'טו';
  if (remaining === 16) return result + 'טז';
  const rest: [number, string][] = [
    [90, 'צ'], [80, 'פ'], [70, 'ע'], [60, 'ס'], [50, 'נ'], [40, 'מ'], [30, 'ל'], [20, 'כ'],
    [10, 'י'], [9, 'ט'], [8, 'ח'], [7, 'ז'], [6, 'ו'], [5, 'ה'], [4, 'ד'], [3, 'ג'], [2, 'ב'], [1, 'א'],
  ];
  for (const [val, letter] of rest) {
    while (remaining >= val) {
      result += letter;
      remaining -= val;
    }
  }
  return result;
}

// פורמט מקוצר מקובל: "." לעמוד א, ":" לעמוד ב (כמו בציטוט מסורתי - "ב." = דף ב עמוד א)
export function formatDaf(daf: number, side: 'a' | 'b'): string {
  return numberToHebrew(daf) + (side === 'a' ? '.' : ':');
}

// מקבץ רשימת דפים שנלמדו לטווחים רצופים לתצוגה - למשל [2a,2b,3a,5b,6a] -> "ב.-ג. , ה:-ו."
export function formatStudiedRanges(entries: DafEntry[]): string {
  const sortKey = (e: DafEntry) => e.daf * 2 + (e.side === 'b' ? 1 : 0);
  const sorted = [...entries].sort((a, b) => sortKey(a) - sortKey(b));

  const ranges: { start: DafEntry; end: DafEntry }[] = [];
  for (const entry of sorted) {
    const last = ranges[ranges.length - 1];
    if (last && sortKey(entry) === sortKey(last.end) + 1) {
      last.end = entry;
    } else {
      ranges.push({ start: entry, end: entry });
    }
  }

  return ranges
    .map((r) =>
      r.start === r.end || sortKey(r.start) === sortKey(r.end)
        ? formatDaf(r.start.daf, r.start.side)
        : `${formatDaf(r.start.daf, r.start.side)}-${formatDaf(r.end.daf, r.end.side)}`
    )
    .join(', ');
}

export function countStudiedDapim(entries: DafEntry[]): number {
  return entries.length;
}
