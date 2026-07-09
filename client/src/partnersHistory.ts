const KEY = 'havruta_partners_history';

export interface PartnerEntry {
  name: string;
  topic: string;
  ts: number;
  favorite?: boolean;
  contactNote?: string; // פרטי קשר חופשיים (טלפון/אימייל/הערה) לשמירה על קשר מחוץ ללימוד
}

function load(): PartnerEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(list: PartnerEntry[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

// שומר עד 20 חברותאות אחרונות, הכי עדכני קודם, כל שם מופיע פעם אחת בלבד.
// אם כבר סימנת מישהו כמועדף / הוספת הערת קשר, זה נשמר גם כשנפגשים איתו שוב
export function recordPartner(name: string, topic: string) {
  const clean = String(name || '').trim();
  if (!clean || clean === 'לומד') return; // שם ברירת מחדל לא שימושי לתיעוד
  const list = load();
  const existing = list.find((p) => p.name === clean);
  const rest = list.filter((p) => p.name !== clean);
  rest.unshift({
    name: clean,
    topic,
    ts: Date.now(),
    favorite: existing?.favorite,
    contactNote: existing?.contactNote,
  });
  save(rest.slice(0, 20));
}

export function loadPartnersHistory(): PartnerEntry[] {
  return load();
}

export function toggleFavorite(name: string) {
  const list = load();
  const entry = list.find((p) => p.name === name);
  if (entry) entry.favorite = !entry.favorite;
  save(list);
}

export function updateContactNote(name: string, note: string) {
  const list = load();
  const entry = list.find((p) => p.name === name);
  if (entry) entry.contactNote = note;
  save(list);
}

// הוספת חברותא ידנית (לא דרך שידוך בלוח) - ישר כמועדף, לשמירה על קשר
export function addManualFavorite(name: string, contactNote: string) {
  const clean = String(name || '').trim();
  if (!clean) return;
  const list = load().filter((p) => p.name !== clean);
  list.unshift({ name: clean, topic: '', ts: Date.now(), favorite: true, contactNote });
  save(list);
}

export function loadFavorites(): PartnerEntry[] {
  return load().filter((p) => p.favorite);
}

