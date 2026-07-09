const KEY = 'havruta_partners_history';

export interface PartnerEntry {
  name: string;
  topic: string;
  ts: number;
}

function load(): PartnerEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// שומר עד 20 חברותאות אחרונות, הכי עדכני קודם, כל שם מופיע פעם אחת בלבד (מתעדכן לאינטראקציה האחרונה)
export function recordPartner(name: string, topic: string) {
  const clean = String(name || '').trim();
  if (!clean || clean === 'לומד') return; // שם ברירת מחדל לא שימושי לתיעוד
  const list = load().filter((p) => p.name !== clean);
  list.unshift({ name: clean, topic, ts: Date.now() });
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 20)));
}

export function loadPartnersHistory(): PartnerEntry[] {
  return load();
}
