import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// בפריסה עם שירות Railway אחד, ה-build הראשי בונה גם client וגם server -
// השרת חייב להגיש בעצמו את קבצי ה-client הבנויים (זה מה שהיה חסר לגמרי עד עכשיו)
const clientDistPath = path.join(__dirname, '../../client/dist');

const app = express();
app.use(cors());
app.use(express.json());

interface RoomInfo {
  ref: string; // ref בפורמט ספריא (שימוש פנימי בלבד, לא מוצג למשתמש)
  label: string; // מה שהמשתמש הקליד בפועל (עברית) - זה מה שמוצג בלובי
  group: boolean; // true = חדר קבוצה/שיעור (יותר משניים), false = חברותא זוגית רגילה
  dedication?: string; // הקדשת לימוד אופציונלית ("לעילוי נשמת..."), מוצגת לשני הצדדים
}
const roomTopics = new Map<string, RoomInfo>(); // שמירת המצב של כל חדר

interface BoardPost {
  id: string;
  name: string;
  topic: string;
  when: string;
  posterSocketId: string;
  ts: number;
}
const boardPosts = new Map<string, BoardPost>(); // לוח "מחפש חברותא" - בקשות פתוחות שממתינות להצטרפות

function broadcastBoard(io: Server) {
  const posts = Array.from(boardPosts.values()).sort((a, b) => b.ts - a.ts);
  io.emit('board_list', posts);
}

interface ChatMessage {
  id: string;
  name: string;
  text: string;
  ts: number;
  senderId: string;
}
const roomChats = new Map<string, ChatMessage[]>(); // היסטוריית צ'אט לכל חדר

interface Point {
  x: number;
  y: number;
}
interface DrawEvent {
  prevPoint: Point | null;
  currentPoint: Point;
  color: string;
}
const roomBoards = new Map<string, DrawEvent[]>(); // היסטוריית שרטוט ללוח של כל חדר

interface ScheduledSession {
  when: number; // timestamp
  note: string;
}
const roomSchedule = new Map<string, ScheduledSession>(); // הלימוד הבא הקבוע לכל חדר (משותף לשני הצדדים)

interface AiTurn {
  role: 'user' | 'assistant';
  content: string;
  name?: string; // רק להודעות user - איזה לומד שאל
}
const roomAiChats = new Map<string, AiTurn[]>(); // היסטוריית שיחה עם חברותא ה-AI, לכל חדר

function broadcastRoomsList(io: Server) {
  // כמה סוקטים מחוברים כרגע בכל חדר (ניהול native של Socket.io) - זה נותן לנו נוכחות בזמן אמת בחינם
  const rooms = Array.from(roomTopics.entries())
    .map(([id, room]) => ({
      id,
      topic: room.label,
      group: room.group,
      occupancy: io.sockets.adapter.rooms.get(id)?.size || 0,
    }))
    .filter((r) => r.occupancy > 0); // חדרים ריקים/נטושים לא מוצגים בלובי
  io.emit('rooms_list', rooms);
}

// ממיר אותיות גימטריה עבריות למספר (למשל "קעו" -> 176)
function hebrewToNumber(str: string): number {
  const values: Record<string, number> = {
    'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9,
    'י': 10, 'כ': 20, 'ל': 30, 'מ': 40, 'נ': 50, 'ס': 60, 'ע': 70, 'פ': 80, 'צ': 90,
    'ק': 100, 'ר': 200, 'ש': 300, 'ת': 400,
  };
  let total = 0;
  for (const ch of str) total += values[ch] || 0;
  return total;
}

const tractateMapping: Record<string, string> = {
  "ברכות": "Berakhot", "שבת": "Shabbat", "עירובין": "Eruvin", "פסחים": "Pesachim",
  "שקלים": "Shekalim", "יומא": "Yoma", "סוכה": "Sukkah", "ביצה": "Beitzah",
  "ראש השנה": "Rosh Hashanah", "תענית": "Taanit", "מגילה": "Megillah",
  "מועד קטן": "Moed Katan", "חגיגה": "Chagigah", "יבמות": "Yevamot", "כתובות": "Ketubot",
  "נדרים": "Nedarim", "נזיר": "Nazir", "סוטה": "Sotah", "גיטין": "Gittin",
  "קידושין": "Kiddushin", "בבא קמא": "Bava Kamma", "בבא מציעא": "Bava Metzia",
  "בבא בתרא": "Bava Batra", "סנהדרין": "Sanhedrin", "מכות": "Makkot",
  "שבועות": "Shevuot", "עבודה זרה": "Avodah Zarah", "הוריות": "Horayot",
  "זבחים": "Zevachim", "מנחות": "Menachot", "חולין": "Chullin", "בכורות": "Bekhorot",
  "ערכין": "Arakhin", "תמורה": "Temurah", "כריתות": "Keritot", "מעילה": "Meilah",
  "תמיד": "Tamid", "נדה": "Niddah",
};

// רשימת המסכתות (לפי סדר הש"ס) - נשלפת מאותה מיפוי כדי שהמונה במעקב ההתקדמות תמיד יהיה מדויק
app.get('/api/tractates', (_req, res) => {
  const tractates = Object.entries(tractateMapping).map(([he, en]) => ({ he, en }));
  res.json({ tractates });
});

// ממיר קלט חופשי (עברית/אנגלית) ל-ref בפורמט ספריא - למשל "נזיר דף ב' עמוד א'" -> "Nazir.2a"
function resolveRefQuery(rawQuery: string): string {
  const query = rawQuery.trim();

  // תומך גם ב"דף ב" (אות עברית/גימטריה) וגם ב"דף 2" (ספרה), כולל גרש/גרשיים ("ג'", "ג׳", "קע"ו")
  const match = query.match(/^(.+?)\s+דף\s+([\u05D0-\u05EA'"\u05F3\u05F4\u2019\u201D]+|\d+)\s+עמוד\s+([\u05D0-\u05EA])['"\u05F3\u05F4\u2019\u201D]?/);

  if (!match) {
    return query.replace(/\s+/g, '.');
  }

  const [, tractateHe, dafRaw, sideHe] = match;
  const tractate = tractateMapping[tractateHe.trim()] || tractateHe.trim();
  const dafNumber = /^\d+$/.test(dafRaw) ? parseInt(dafRaw, 10) : hebrewToNumber(dafRaw);
  const side = sideHe === 'א' ? 'a' : 'b';
  return `${tractate}.${dafNumber}${side}`;
}

// שולף טקסט מספריא ומחזיר תמיד מערך שורות מנורמל (ראה הערה על he כמחרוזת/מערך למטה)
async function fetchSefariaText(ref: string): Promise<string[]> {
  try {
    const response = await fetch(`https://www.sefaria.org/api/texts/${encodeURIComponent(ref)}?context=0`);
    if (!response.ok) return [];
    const data: any = await response.json();
    return Array.isArray(data.he) ? data.he : (data.he ? [data.he] : []);
  } catch {
    return [];
  }
}

// [API Routes] - נשארים אותו דבר
app.get('/api/resolve-ref/:query', (req, res) => {
  const query = decodeURIComponent(req.params.query);
  const ref = resolveRefQuery(query);
  console.log(`[resolve-ref] "${query}" -> ${ref}`);
  res.json({ ref });
});

app.get('/api/text/:ref', async (req, res) => {
  try {
    const hebrewText = await fetchSefariaText(req.params.ref);
    if (hebrewText.length === 0) {
      console.error(`[text] ${req.params.ref}: לא התקבל טקסט מספריא`);
    }
    res.json({ title: '', hebrewText });
  } catch (e) {
    console.error(`[text] שגיאה בשליפת ${req.params.ref} מספריא:`, e);
    res.status(502).json({ title: '', hebrewText: [], error: 'sefaria_unavailable' });
  }
});

// דף היומי של היום - נשלף מלוח השנה של ספריא
app.get('/api/daf-yomi', async (_req, res) => {
  try {
    const response = await fetch('https://www.sefaria.org/api/calendars');
    if (!response.ok) {
      console.error(`[daf-yomi] ספריא החזירה סטטוס ${response.status}`);
      return res.status(502).json({ error: 'sefaria_unavailable' });
    }
    const data: any = await response.json();
    const items = Array.isArray(data.calendar_items) ? data.calendar_items : [];
    const dafYomi = items.find((it: any) => it.title?.en === 'Daf Yomi');

    if (!dafYomi) {
      console.error('[daf-yomi] לא נמצא פריט "Daf Yomi" בתגובת ספריא');
      return res.status(404).json({ error: 'not_found' });
    }

    // ה-url של ספריא לפעמים לא כולל את אות העמוד (a/b) - ברירת מחדל לעמוד א' במקרה כזה
    let ref: string = dafYomi.url || dafYomi.ref || '';
    if (ref && !/[ab]$/.test(ref)) ref = `${ref}a`;

    const label = dafYomi.displayValue?.he || dafYomi.displayValue?.en || ref;
    console.log(`[daf-yomi] היום: ${ref} (${label})`);
    res.json({ ref, label });
  } catch (e) {
    console.error('[daf-yomi] שגיאה:', e);
    res.status(502).json({ error: 'sefaria_unavailable' });
  }
});

// מפרשים (רש"י, תוספות וכו') הזמינים לדף, כולל שיוך מדויק לשורה (anchorRef)
app.get('/api/links/:ref', async (req, res) => {
  try {
    const url = `https://www.sefaria.org/api/links/${encodeURIComponent(req.params.ref)}?with_text=0`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`[links] ${req.params.ref}: ספריא החזירה סטטוס ${response.status} עבור ${url}`);
      return res.json({ links: [] });
    }

    const data: any = await response.json();

    if (!Array.isArray(data)) {
      console.error(`[links] ${req.params.ref}: תגובת ספריא לא הייתה מערך. תוכן שהתקבל:`, JSON.stringify(data).slice(0, 500));
      return res.json({ links: [] });
    }

    // לוג של רשומה גולמית ראשונה - עוזר לאבחן אם שמות השדות של ספריא השתנו
    if (data.length > 0) {
      console.log(`[links] ${req.params.ref}: דוגמת רשומה גולמית ראשונה:`, JSON.stringify(data[0]).slice(0, 400));
    }

    const links = data
      .filter((l: any) => l.category === 'Commentary') // רק מפרשים קלאסיים, לא תרגומים/מקבילות
      .map((l: any) => ({
        // שם המפרש: תלוי בגרסת ה-API של ספריא - לפעמים collectiveTitle, לפעמים commentator/heCommentator
        he: l.collectiveTitle?.he || l.heCommentator || l.collectiveTitle?.en || l.commentator,
        en: l.collectiveTitle?.en || l.commentator,
        ref: l.ref || (Array.isArray(l.refs) ? l.refs[1] : undefined) || l.sourceRef,
        anchorRef: l.anchorRef || (Array.isArray(l.anchorRefExpanded) ? l.anchorRefExpanded[0] : null),
      }))
      .filter((l: any) => l.he && l.en && l.ref && l.anchorRef);

    // מקורות מקבילים - מקומות אחרים בש"ס/מדרש/הלכה שדנים באותה סוגיה (כל קטגוריה שאינה "מפרש קלאסי")
    const parallelsRaw = data
      .filter((l: any) => l.category && l.category !== 'Commentary')
      .map((l: any) => ({
        ref: l.ref || (Array.isArray(l.refs) ? l.refs[1] : undefined) || l.sourceRef,
        anchorRef: l.anchorRef || (Array.isArray(l.anchorRefExpanded) ? l.anchorRefExpanded[0] : null),
        category: l.category,
        displayRef: l.sourceHeRef || l.heRef || l.he_ref || l.ref || l.sourceRef,
      }))
      .filter((l: any) => l.ref && l.anchorRef && l.displayRef);

    // דדופ׳ לפי ref, כדי שאותו מקור לא יופיע פעמיים
    const seenRefs = new Set<string>();
    const parallels = parallelsRaw.filter((l: any) => {
      if (seenRefs.has(l.ref)) return false;
      seenRefs.add(l.ref);
      return true;
    });

    console.log(`[links] ${req.params.ref}: ${data.length} גולמי -> ${links.length} מפרשים, ${parallels.length} מקורות מקבילים`);
    res.json({ links, parallels });
  } catch (e) {
    console.error(`[links] שגיאה בשליפת מפרשים עבור ${req.params.ref}:`, e);
    res.json({ links: [] });
  }
});

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

io.on('connection', (socket) => {
  // שולח ללקוח החדש את רשימת החדרים הפתוחים ואת לוח מחפשי החברותא ברגע ההתחברות
  broadcastRoomsList(io);
  broadcastBoard(io);

  // התיקון הקריטי: השרת לא טיפל בכלל באירוע create_room
  socket.on('create_room', (data: { topic: string; ref?: string; group?: boolean; dedication?: string }) => {
    const roomId = `room_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const label = String(data.topic || '').trim().slice(0, 100) || 'ברכות דף ב עמוד א';
    const ref = data.ref ? String(data.ref).trim() : resolveRefQuery(label); // ref מפורש (כמו דף יומי) עוקף את פענוח העברית
    const dedication = String(data.dedication || '').trim().slice(0, 150) || undefined;
    roomTopics.set(roomId, { ref, label, group: !!data.group, dedication });
    socket.join(roomId);
    socket.emit('room_created', roomId);
    broadcastRoomsList(io);
  });

  socket.on('join_room', (roomId) => {
    socket.join(roomId);
    broadcastRoomsList(io); // עדכון מיידי של מספר הנוכחים בחדר לכל מי שבלובי
  });

  socket.on('disconnect', () => {
    broadcastRoomsList(io); // מישהו עזב - לעדכן את הנוכחות בלובי

    // ניקוי בקשות שפורסמו על ידי מי שהתנתק, כדי שלא יישארו בקשות "מתות" בלוח
    let boardChanged = false;
    for (const [id, post] of boardPosts.entries()) {
      if (post.posterSocketId === socket.id) {
        boardPosts.delete(id);
        boardChanged = true;
      }
    }
    if (boardChanged) broadcastBoard(io);
  });

  // לוח "מחפש חברותא" - פרסום בקשה פתוחה
  socket.on('board_post', (data: { name: string; topic: string; when: string }) => {
    const topic = String(data.topic || '').trim().slice(0, 100);
    if (!topic) return;
    const id = `post_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    boardPosts.set(id, {
      id,
      name: String(data.name || 'לומד').trim().slice(0, 40),
      topic,
      when: String(data.when || '').trim().slice(0, 60),
      posterSocketId: socket.id,
      ts: Date.now(),
    });
    broadcastBoard(io);
  });

  socket.on('board_remove', (postId: string) => {
    const post = boardPosts.get(postId);
    if (post && post.posterSocketId === socket.id) {
      boardPosts.delete(postId);
      broadcastBoard(io);
    }
  });

  // מישהו לוחץ "בוא נלמד" על בקשה פתוחה - פותח חדר ומחבר את שני הצדדים
  socket.on('board_claim', (data: { postId: string }) => {
    const post = boardPosts.get(data.postId);
    if (!post) return; // הבקשה כבר נתפסה או הוסרה
    boardPosts.delete(data.postId);
    broadcastBoard(io);

    const roomId = `room_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const ref = resolveRefQuery(post.topic);
    roomTopics.set(roomId, { ref, label: post.topic, group: false });
    socket.join(roomId);
    socket.emit('room_created', roomId); // התופס עצמו
    io.to(post.posterSocketId).emit('board_matched', { roomId, topic: post.topic }); // המפרסם המקורי, אם עדיין מחובר
  });

  // התיקון הקריטי: השרת עונה ללקוח שמבקש את מצב החדר
  socket.on('request_room_status', (roomId) => {
    const room = roomTopics.get(roomId) || { ref: 'Berakhot.2a', label: 'ברכות דף ב עמוד א', group: false };
    socket.emit('page_changed', { ref: room.ref });
    socket.emit('room_meta', { group: room.group, dedication: room.dedication || null });
    socket.emit('chat_history', roomChats.get(roomId) || []);
    socket.emit('ai_history', roomAiChats.get(roomId) || []);
    socket.emit('schedule_updated', roomSchedule.get(roomId) || null);
  });

  // קביעת הלימוד הבא - משותף לשני הצדדים בחדר, כדי שהתיאום יהיה אמיתי ולא רק תזכורת אישית
  socket.on('schedule_next', (data: { roomId: string; when: number; note: string }) => {
    const when = Number(data.when);
    if (!Number.isFinite(when) || when <= 0) return;
    const session: ScheduledSession = { when, note: String(data.note || '').trim().slice(0, 150) };
    roomSchedule.set(data.roomId, session);
    io.to(data.roomId).emit('schedule_updated', session);
  });

  socket.on('schedule_cancel', (roomId: string) => {
    roomSchedule.delete(roomId);
    io.to(roomId).emit('schedule_updated', null);
  });

  socket.on('chat_message', (data: { roomId: string; name: string; text: string }) => {
    const text = String(data.text || '').slice(0, 2000).trim();
    if (!text) return;
    const msg: ChatMessage = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: String(data.name || 'לומד').slice(0, 40),
      text,
      ts: Date.now(),
      senderId: socket.id,
    };
    const history = roomChats.get(data.roomId) || [];
    history.push(msg);
    if (history.length > 200) history.shift();
    roomChats.set(data.roomId, history);
    io.to(data.roomId).emit('chat_message', msg);
  });

  socket.on('change_page', (data: { roomId: string; ref: string }) => {
    const existing = roomTopics.get(data.roomId);
    roomTopics.set(data.roomId, { ref: data.ref, label: existing?.label || data.ref, group: existing?.group || false }); // שמירה בזיכרון השרת, בלי לאבד את הכותרת/סוג החדר
    io.to(data.roomId).emit('page_changed', { ref: data.ref });
  });

  // סיגנלינג לשיחת וידאו (WebRTC) - השרת רק מעביר הודעות בין שני הצדדים בחדר,
  // לא נוגע בזרם המדיה עצמו (זה עובר ישירות בין הדפדפנים)
  socket.on('video_offer', (data: { roomId: string; offer: unknown }) => {
    socket.to(data.roomId).emit('video_offer', { offer: data.offer });
  });

  socket.on('video_answer', (data: { roomId: string; answer: unknown }) => {
    socket.to(data.roomId).emit('video_answer', { answer: data.answer });
  });

  socket.on('video_ice_candidate', (data: { roomId: string; candidate: unknown }) => {
    socket.to(data.roomId).emit('video_ice_candidate', { candidate: data.candidate });
  });

  socket.on('video_hangup', (data: { roomId: string }) => {
    socket.to(data.roomId).emit('video_hangup');
  });

  // לוח שרטוט - התיקון הקריטי: השרת מעולם לא טיפל באירועי draw_line/clear_board
  socket.on('draw_line', (data: { roomId: string; prevPoint: Point | null; currentPoint: Point; color: string }) => {
    const history = roomBoards.get(data.roomId) || [];
    history.push({ prevPoint: data.prevPoint, currentPoint: data.currentPoint, color: data.color });
    if (history.length > 5000) history.shift(); // הגבלת זיכרון לחדר ארוך-טווח
    roomBoards.set(data.roomId, history);
    socket.to(data.roomId).emit('draw_line', {
      prevPoint: data.prevPoint,
      currentPoint: data.currentPoint,
      color: data.color,
    });
  });

  socket.on('clear_board', (data: { roomId: string }) => {
    roomBoards.set(data.roomId, []);
    socket.to(data.roomId).emit('clear_board');
  });

  // נשלח כשהלוח נטען - כדי שמי שפותח את הטאב מאוחר יותר יראה מה שכבר צויר
  socket.on('request_board_state', (roomId: string) => {
    socket.emit('board_history', roomBoards.get(roomId) || []);
  });

  // חברותא AI - שיחה משותפת לכל מי שבחדר, עם הקשר הדף הנוכחי
  socket.on('ai_message', async (data: { roomId: string; name: string; message: string }) => {
    const message = String(data.message || '').slice(0, 2000).trim();
    if (!message) return;

    const history = roomAiChats.get(data.roomId) || [];
    const userTurn: AiTurn = { role: 'user', content: message, name: String(data.name || 'לומד').slice(0, 40) };
    history.push(userTurn);
    roomAiChats.set(data.roomId, history);
    io.to(data.roomId).emit('ai_chat_message', userTurn);

    if (!process.env.ANTHROPIC_API_KEY) {
      const errTurn: AiTurn = {
        role: 'assistant',
        content: 'לא הוגדר מפתח API של Anthropic בשרת (ANTHROPIC_API_KEY), אז אי אפשר לדבר עם חברותא ה-AI כרגע.',
      };
      history.push(errTurn);
      roomAiChats.set(data.roomId, history);
      io.to(data.roomId).emit('ai_chat_message', errTurn);
      return;
    }

    try {
      const room = roomTopics.get(data.roomId);
      const dafLines = room ? await fetchSefariaText(room.ref) : [];
      const dafContext = dafLines.map((l) => l.replace(/<[^>]*>/g, '')).join('\n');

      const systemPrompt = `אתה משמש כ"חברותא" ללימוד גמרא - שותף לימוד וירטואלי, בתוך אפליקציית לימוד בשם "חברותא דיגיטלית". אתה לומד יחד עם הלומדים את הסוגיה הבאה${room ? ` (${room.ref})` : ''}:

${dafContext || '(לא נטען טקסט לדף הנוכחי)'}

התנהג כמו חברותא אמיתי: הסבר כשמתבקש, אבל גם שאל שאלות מחדדות, אתגר את ההבנה של הלומד, והצע כיווני עיון (רש"י, תוספות וכו') כשרלוונטי. ענה בעברית בלבד, בקצרה ולעניין - לא כהרצאה.`;

      const anthropicMessages = history
        .filter((h) => h.role === 'user' || h.role === 'assistant')
        .map((h) => ({ role: h.role, content: h.content }));

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY as string,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5',
          max_tokens: 1024,
          system: systemPrompt,
          messages: anthropicMessages,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[ai-chavruta] שגיאה מ-Anthropic (${response.status}):`, errText.slice(0, 500));
        const errTurn: AiTurn = { role: 'assistant', content: 'הייתה שגיאה בפנייה ל-AI. נסו שוב עוד רגע.' };
        history.push(errTurn);
        roomAiChats.set(data.roomId, history);
        io.to(data.roomId).emit('ai_chat_message', errTurn);
        return;
      }

      const responseData: any = await response.json();
      const replyText = responseData.content?.find((c: any) => c.type === 'text')?.text || '...';
      const assistantTurn: AiTurn = { role: 'assistant', content: replyText };
      history.push(assistantTurn);
      if (history.length > 200) history.splice(0, history.length - 200);
      roomAiChats.set(data.roomId, history);
      io.to(data.roomId).emit('ai_chat_message', assistantTurn);
    } catch (e) {
      console.error('[ai-chavruta] שגיאה:', e);
      const errTurn: AiTurn = { role: 'assistant', content: 'שגיאה בשרת בזמן פנייה ל-AI.' };
      history.push(errTurn);
      roomAiChats.set(data.roomId, history);
      io.to(data.roomId).emit('ai_chat_message', errTurn);
    }
  });
});

// הגשת ה-client הבנוי (React) - חייב לבוא אחרי כל ה-API routes, כדי שהם יזכו לעדיפות
app.use(express.static(clientDistPath));

app.get('*', (req, res, next) => {
  // בקשות ל-API או ל-Socket.io לא אמורות להגיע לכאן בכלל (יש להן routes משלהן),
  // אבל ההגנה הזו מונעת מהן ליפול בטעות ל-fallback של index.html
  if (req.path.startsWith('/api/') || req.path.startsWith('/socket.io/')) return next();
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 5000;
httpServer.listen(PORT, () => console.log(`Server running on ${PORT}`));
