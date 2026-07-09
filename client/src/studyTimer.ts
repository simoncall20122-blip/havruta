const TIME_KEY = 'havruta_time_by_day';
const SESSION_COUNT_KEY = 'havruta_session_count';

function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function loadTimeByDay(): Record<string, number> {
  try {
    const raw = localStorage.getItem(TIME_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveTimeByDay(map: Record<string, number>) {
  localStorage.setItem(TIME_KEY, JSON.stringify(map));
}

// נקרא מדי כמה שניות מתוך חדר הלימוד - מוסיף זמן לצבירה של היום (רק כשהטאב באמת גלוי/פעיל)
export function addStudySeconds(seconds: number) {
  if (seconds <= 0) return;
  const map = loadTimeByDay();
  const key = todayKey();
  map[key] = (map[key] || 0) + seconds;
  saveTimeByDay(map);
}

export function incrementSessionCount() {
  const current = parseInt(localStorage.getItem(SESSION_COUNT_KEY) || '0', 10);
  localStorage.setItem(SESSION_COUNT_KEY, String(current + 1));
}

export function getSessionCount(): number {
  return parseInt(localStorage.getItem(SESSION_COUNT_KEY) || '0', 10);
}

export function getTotalSeconds(): number {
  const map = loadTimeByDay();
  return Object.values(map).reduce((sum, s) => sum + s, 0);
}

export function getTodaySeconds(): number {
  const map = loadTimeByDay();
  return map[todayKey()] || 0;
}

export function getWeekSeconds(): number {
  const map = loadTimeByDay();
  const now = new Date();
  let sum = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    sum += map[d.toISOString().slice(0, 10)] || 0;
  }
  return sum;
}

// רצף ימי לימוד רצופים - נספר עד היום (אם כבר למדת היום) או עד אתמול (אם עוד לא הספקת היום, כדי לא לשבור רצף באמצע היום)
export function getStreak(): number {
  const map = loadTimeByDay();
  const now = new Date();
  let streak = 0;
  let cursor = new Date(now);

  // אם עוד לא למדת היום, מתחילים לספור מאתמול (עדיין לא נחשב "שבור" עד סוף היום)
  if (!map[cursor.toISOString().slice(0, 10)]) {
    cursor.setDate(cursor.getDate() - 1);
  }

  while (map[cursor.toISOString().slice(0, 10)]) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// עיצוב זמן קצר ל"שעון" חי בחדר הלימוד - "12:34" או "1:02:34"
export function formatTimer(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

// עיצוב זמן בעברית טבעית לסטטיסטיקות - "3 שעות ו-12 דקות"
export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const hoursText = h === 1 ? 'שעה אחת' : `${h} שעות`;
  const minutesText = m === 1 ? 'דקה אחת' : `${m} דקות`;
  if (h === 0 && m === 0) return 'פחות מדקה';
  if (h === 0) return minutesText;
  if (m === 0) return hoursText;
  return `${hoursText} ו-${minutesText}`;
}
