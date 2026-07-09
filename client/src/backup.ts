// כל מפתחות ה-localStorage שהאפליקציה שומרת בהם נתוני משתמש (לא כולל havruta_token,
// שהוא אישור התחברות זמני ולא "נתונים" במובן הזה - לא רוצים לשחזר טוקן ישן/פג תוקף)
const BACKUP_KEYS = [
  'havruta_chat_name',
  'havruta_font_size',
  'havruta_marker_color',
  'havruta_masechtot_dates',
  'havruta_masechtot_done',
  'havruta_my_rooms',
  'havruta_notes',
  'havruta_partners_history',
  'havruta_profile_level',
  'havruta_session_count',
  'havruta_study_log',
  'havruta_text_night_mode',
  'havruta_time_by_day',
];

const BACKUP_VERSION = 1;

export function exportAllData() {
  const data: Record<string, string> = {};
  for (const key of BACKUP_KEYS) {
    const value = localStorage.getItem(key);
    if (value !== null) data[key] = value;
  }

  const payload = {
    app: 'חברותא דיגיטלית',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `havruta-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface ImportResult {
  ok: boolean;
  message: string;
  restoredCount?: number;
}

// מחליף את הנתונים הקיימים באלה מתוך קובץ הגיבוי - פעולה הרסנית, יש לאשר מול המשתמש לפני קריאה לזה
export function importAllData(jsonText: string): ImportResult {
  let parsed: any;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { ok: false, message: 'הקובץ שנבחר אינו קובץ JSON תקין.' };
  }

  if (!parsed || typeof parsed !== 'object' || !parsed.data || typeof parsed.data !== 'object') {
    return { ok: false, message: 'הקובץ אינו קובץ גיבוי תקין של חברותא דיגיטלית.' };
  }

  let count = 0;
  for (const key of BACKUP_KEYS) {
    const value = parsed.data[key];
    if (typeof value === 'string') {
      localStorage.setItem(key, value);
      count += 1;
    }
  }

  if (count === 0) {
    return { ok: false, message: 'לא נמצאו נתונים מוכרים בקובץ הזה.' };
  }

  return { ok: true, message: `שוחזרו ${count} פריטי נתונים בהצלחה.`, restoredCount: count };
}
