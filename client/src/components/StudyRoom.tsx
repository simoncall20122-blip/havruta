import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { socket } from '../socket';
import {
  BookOpen,
  ArrowRight,
  Link2,
  Check,
  PenSquare,
  Library,
  Loader2,
  ScrollText,
  MessageCircle,
  Send,
  MousePointerClick,
  X,
  ChevronRight,
  ChevronLeft,
  Video,
  Sparkles,
  NotebookPen,
  Search,
  ChevronUp,
  ChevronDown,
  Printer,
  HelpCircle,
  QrCode,
  Heart,
  CalendarPlus,
} from 'lucide-react';
import QRCode from 'qrcode';
import Whiteboard from './Whiteboard';
import type { WhiteboardHandle } from './Whiteboard';
import VideoCall from './VideoCall';
import AIChavruta from './AIChavruta';

interface CommentaryLink {
  he: string;
  en: string;
  ref: string;
  anchorRef: string;
}

interface ParallelSource {
  ref: string;
  anchorRef: string;
  category: string;
  displayRef: string;
}

interface CommentaryState {
  loading: boolean;
  lines: string[];
  error: boolean;
}

interface ChatMessage {
  id: string;
  name: string;
  text: string;
  ts: number;
  senderId: string;
}

// מנרמל ref לפורמט אחיד (ספריא מחזירה לפעמים "Berakhot 2a:4" ולפעמים "Berakhot.2a.4")
const normalizeRef = (ref: string) => ref.trim().replace(/[:\s]+/g, '.');

// מפרק ref לקידומת (עד הנקודה האחרונה) ולמספר הסופי, למשל "Nazir.2a.4" -> {prefix:"Nazir.2a", num:4}
const parseSegmentRef = (ref: string) => {
  const m = ref.match(/^(.*)\.(\d+)$/);
  if (!m) return null;
  return { prefix: m[1], num: parseInt(m[2], 10) };
};

// בודק אם anchorRef של מפרש שייך לשורה מסוימת - כולל טווחים (למשל "Nazir.2a.1-3" מכסה גם שורה 2)
const anchorMatchesLine = (anchorRef: string, lineRef: string) => {
  const a = normalizeRef(anchorRef);
  const l = normalizeRef(lineRef);

  if (a === l) return true;
  if (a.startsWith(l + '.')) return true; // מפרש על תת-מקטע של השורה (כמו דיבור המתחיל)

  if (a.includes('-')) {
    const [startPart, endPart] = a.split('-');
    const startSeg = parseSegmentRef(startPart);
    const lineSeg = parseSegmentRef(l);
    if (startSeg && lineSeg) {
      // הצד השני של הטווח יכול להיות מספר בלבד ("1-3") או ref מלא ("Nazir.2a.1-Nazir.2b.2")
      const endSeg = /^\d+$/.test(endPart)
        ? { prefix: startSeg.prefix, num: parseInt(endPart, 10) }
        : parseSegmentRef(endPart);
      if (
        endSeg &&
        lineSeg.prefix === startSeg.prefix &&
        lineSeg.prefix === endSeg.prefix &&
        lineSeg.num >= startSeg.num &&
        lineSeg.num <= endSeg.num
      ) {
        return true;
      }
    }
  }

  return false;
};

// פירוק ref של דף גמרא (למשל "Shabbat.2a") למעבר לדף הקודם/הבא
const parseDafRef = (ref: string) => {
  const m = ref.match(/^(.+)\.(\d+)([ab])$/);
  if (!m) return null;
  return { tractate: m[1], daf: parseInt(m[2], 10), side: m[3] as 'a' | 'b' };
};

// הערות אישיות - נשמרות במכשיר לפי מראה המקום (ref), כדי שיישארו זמינות בכל חדר עתידי על אותה סוגיה
const NOTES_KEY = 'havruta_notes';

function loadNote(ref: string): string {
  if (!ref) return '';
  try {
    const all = JSON.parse(localStorage.getItem(NOTES_KEY) || '{}');
    return all[ref] || '';
  } catch {
    return '';
  }
}

function saveNote(ref: string, text: string) {
  if (!ref) return;
  try {
    const all = JSON.parse(localStorage.getItem(NOTES_KEY) || '{}');
    if (text.trim()) all[ref] = text;
    else delete all[ref];
    localStorage.setItem(NOTES_KEY, JSON.stringify(all));
  } catch {
    // localStorage לא זמין - ההערה פשוט לא תישמר, לא קריטי
  }
}

const stripTags = (html: string) => html.replace(/<[^>]*>/g, '');

const StudyRoom = () => {
  const [roomId] = useState(new URLSearchParams(window.location.search).get('room') || 'default');
  const [input, setInput] = useState('שבת דף ב עמוד א');
  const [currentRef, setCurrentRef] = useState('');
  const [text, setText] = useState<string[]>([]);
  const [loadingText, setLoadingText] = useState(false);
  const [activeTab, setActiveTab] = useState<'commentaries' | 'whiteboard'>('commentaries');
  const [leftTab, setLeftTab] = useState<'chat' | 'ai' | 'video'>(() =>
    new URLSearchParams(window.location.search).get('ai') === '1' ? 'ai' : 'chat'
  );
  const [isGroupRoom, setIsGroupRoom] = useState(false);
  const [dedication, setDedication] = useState<string | null>(null);
  const [nextSession, setNextSession] = useState<{ when: number; note: string } | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleWhen, setScheduleWhen] = useState('');
  const [scheduleNote, setScheduleNote] = useState('');
  const [copied, setCopied] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentMatch, setCurrentMatch] = useState(0);
  const lineElsRef = useRef<(HTMLParagraphElement | null)[]>([]);
  const whiteboardRef = useRef<WhiteboardHandle>(null);
  const [boardSnapshot, setBoardSnapshot] = useState<string | null>(null);
  const [wordPopup, setWordPopup] = useState<{ text: string; top: number; left: number } | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  // מפרשים
  const [allLinks, setAllLinks] = useState<CommentaryLink[]>([]);
  const [allParallels, setAllParallels] = useState<ParallelSource[]>([]);
  const [selectedRange, setSelectedRange] = useState<{ start: number; end: number } | null>(null);
  const [openCommentaries, setOpenCommentaries] = useState<Record<string, CommentaryState>>({});
  const [openParallel, setOpenParallel] = useState<{
    displayRef: string;
    loading: boolean;
    lines: string[];
    error: boolean;
  } | null>(null);

  // צ'אט
  const [chatName, setChatName] = useState<string>(() => localStorage.getItem('havruta_chat_name') || '');
  const [nameDraft, setNameDraft] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatDraft, setChatDraft] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textScrollRef = useRef<HTMLDivElement>(null);

  const loadText = useCallback(async (ref: string) => {
    setLoadingText(true);
    try {
      const res = await fetch(`http://localhost:5000/api/text/${encodeURIComponent(ref)}`);
      const data = await res.json();
      setText(data.hebrewText || []);
      setCurrentRef(ref);
      setSelectedRange(null);
      setOpenCommentaries({});
    } catch (e) {
      console.error('שגיאה בטעינת הטקסט:', e);
    } finally {
      setLoadingText(false);
    }
  }, []);

  const loadLinks = useCallback(async (ref: string) => {
    try {
      const res = await fetch(`http://localhost:5000/api/links/${encodeURIComponent(ref)}`);
      if (!res.ok) {
        console.error('[מפרשים] השרת המקומי החזיר סטטוס', res.status);
        setAllLinks([]);
        setAllParallels([]);
        return;
      }
      const data = await res.json();
      console.log(`[מפרשים] התקבלו ${(data.links || []).length} מפרשים ו-${(data.parallels || []).length} מקורות מקבילים עבור ${ref}`);
      setAllLinks(data.links || []);
      setAllParallels(data.parallels || []);
    } catch (e) {
      console.error('[מפרשים] שגיאה בטעינת מפרשים מהשרת המקומי:', e);
      setAllLinks([]);
      setAllParallels([]);
    }
  }, []);

  const handleOpenPage = async () => {
    if (!input.trim()) return;
    try {
      const res = await fetch(`http://localhost:5000/api/resolve-ref/${encodeURIComponent(input)}`);
      const { ref } = await res.json();
      await loadText(ref);
      loadLinks(ref);
      socket.emit('change_page', { roomId, ref });
    } catch (e) {
      console.error('שגיאה בביצוע הפעולה:', e);
    }
  };

  // מעבר לדף הבא/הקודם (למשל 2a -> 2b -> 3a)
  const handleNavigateDaf = async (direction: 1 | -1) => {
    const parsed = parseDafRef(currentRef);
    if (!parsed) {
      console.warn('[נווט דף] לא ניתן לפרש את מראה המקום הנוכחי לניווט:', currentRef);
      return;
    }
    let { daf, side } = parsed;
    const { tractate } = parsed;

    if (direction === 1) {
      if (side === 'a') side = 'b';
      else {
        side = 'a';
        daf += 1;
      }
    } else {
      if (side === 'b') side = 'a';
      else {
        if (daf <= 2) return; // אין דף לפני 2a בש"ס
        daf -= 1;
        side = 'b';
      }
    }

    const ref = `${tractate}.${daf}${side}`;
    console.log(`[נווט דף] ${currentRef} -> ${ref}`);
    await loadText(ref);
    loadLinks(ref);
    socket.emit('change_page', { roomId, ref });
  };

  const parsedCurrent = parseDafRef(currentRef);
  const canGoPrev = !!parsedCurrent && !(parsedCurrent.side === 'a' && parsedCurrent.daf <= 2);
  const canGoNext = !!parsedCurrent;

  // סימון/ביטול סימון שורה (או טווח שורות עם Shift) לניתוח מפרשים
  const handleSelectLine = (index: number, shiftKey: boolean) => {
    setActiveTab('commentaries');
    setOpenCommentaries({});
    setSelectedRange((prev) => {
      if (shiftKey && prev) {
        return { start: Math.min(prev.start, index), end: Math.max(prev.end, index) };
      }
      if (prev && prev.start === index && prev.end === index) return null; // קליק חוזר על אותה שורה בודדת - ביטול
      return { start: index, end: index };
    });
  };

  const lineCommentators = !selectedRange || !currentRef
    ? []
    : (() => {
        const grouped = new Map<string, { he: string; en: string; refs: string[] }>();
        for (let i = selectedRange.start; i <= selectedRange.end; i++) {
          const lineRef = `${currentRef}.${i + 1}`;
          const matches = allLinks.filter((l) => anchorMatchesLine(l.anchorRef, lineRef));
          for (const m of matches) {
            const existing = grouped.get(m.en);
            if (existing) {
              if (!existing.refs.includes(m.ref)) existing.refs.push(m.ref);
            } else {
              grouped.set(m.en, { he: m.he, en: m.en, refs: [m.ref] });
            }
          }
        }
        return Array.from(grouped.values());
      })();

  const lineParallels = !selectedRange || !currentRef
    ? []
    : (() => {
        const seen = new Set<string>();
        const result: ParallelSource[] = [];
        for (let i = selectedRange.start; i <= selectedRange.end; i++) {
          const lineRef = `${currentRef}.${i + 1}`;
          const matches = allParallels.filter((p) => anchorMatchesLine(p.anchorRef, lineRef));
          for (const m of matches) {
            if (!seen.has(m.ref)) {
              seen.add(m.ref);
              result.push(m);
            }
          }
        }
        return result;
      })();

  // מקור מקביל נפתח בחלון נפרד (מודל), לא בתוך הפאנל - כדי לא לרמוס את מה שלומדים בטקסט הראשי
  const openParallelSource = async (p: ParallelSource) => {
    setOpenParallel({ displayRef: p.displayRef, loading: true, lines: [], error: false });
    try {
      const res = await fetch(`http://localhost:5000/api/text/${encodeURIComponent(p.ref)}`);
      const data = await res.json();
      const lines: string[] = Array.isArray(data.hebrewText) ? data.hebrewText : [];
      setOpenParallel({ displayRef: p.displayRef, loading: false, lines, error: lines.length === 0 });
    } catch (e) {
      console.error('[מקורות מקבילים] שגיאה בטעינת המקור:', e);
      setOpenParallel({ displayRef: p.displayRef, loading: false, lines: [], error: true });
    }
  };

  const toggleCommentator = async (c: { en: string; refs: string[] }) => {
    const alreadyOpen = !!openCommentaries[c.en];

    setOpenCommentaries((prev) => {
      if (alreadyOpen) {
        const next = { ...prev };
        delete next[c.en];
        return next;
      }
      return { ...prev, [c.en]: { loading: true, lines: [], error: false } };
    });

    if (alreadyOpen) return;

    try {
      const results = await Promise.all(
        c.refs.map((ref) =>
          fetch(`http://localhost:5000/api/text/${encodeURIComponent(ref)}`).then((r) => r.json())
        )
      );
      const lines = results.flatMap((d) => (Array.isArray(d.hebrewText) ? d.hebrewText : [d.hebrewText]).filter(Boolean));
      setOpenCommentaries((prev) => ({
        ...prev,
        [c.en]: { loading: false, lines, error: lines.length === 0 },
      }));
    } catch (e) {
      setOpenCommentaries((prev) => ({ ...prev, [c.en]: { loading: false, lines: [], error: true } }));
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  const handleToggleQr = async () => {
    if (qrDataUrl) {
      setQrDataUrl(null);
      return;
    }
    try {
      const dataUrl = await QRCode.toDataURL(window.location.href, {
        width: 220,
        margin: 1,
        color: { dark: '#1E3A2B', light: '#FBF6EA' },
      });
      setQrDataUrl(dataUrl);
    } catch (e) {
      console.error('[QR] שגיאה ביצירת קוד QR:', e);
    }
  };

  const handleScheduleSubmit = () => {
    if (!scheduleWhen) return;
    const when = new Date(scheduleWhen).getTime();
    if (!Number.isFinite(when)) return;
    socket.emit('schedule_next', { roomId, when, note: scheduleNote.trim() });
    setShowSchedule(false);
    setScheduleWhen('');
    setScheduleNote('');
  };

  const handleScheduleCancel = () => {
    socket.emit('schedule_cancel', roomId);
  };

  // בונה קישור "הוסף ליומן" של Google Calendar (שעה אחת כברירת מחדל)
  const buildGCalLink = (when: number, note: string) => {
    const toGCalDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const start = new Date(when);
    const end = new Date(when + 60 * 60 * 1000);
    const title = `חברותא דיגיטלית - ${currentRef || 'לימוד'}`;
    const details = note || 'לימוד חברותא';
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${toGCalDate(start)}/${toGCalDate(end)}&details=${encodeURIComponent(details)}`;
  };

  // תיאור יחסי ל"מתי" הלימוד הבא - "בעוד יומיים", "מחר", וכו'
  const formatUntil = (when: number) => {
    const diffMs = when - Date.now();
    if (diffMs <= 0) return 'עכשיו';
    const hours = Math.round(diffMs / 3600000);
    if (hours < 1) return 'בעוד פחות משעה';
    if (hours < 24) return `בעוד ${hours} שעות`;
    const days = Math.round(hours / 24);
    return days === 1 ? 'מחר' : `בעוד ${days} ימים`;
  };

  // יצוא PDF - דרך דיאלוג ההדפסה של הדפדפן (תומך בעברית/RTL בצורה מושלמת, בלי צורך בספריית PDF כבדה)
  const handleExportPdf = () => {
    setBoardSnapshot(activeTab === 'whiteboard' ? whiteboardRef.current?.getSnapshot() || null : null);
    setTimeout(() => window.print(), 60); // רגע קטן כדי שהתמונה תספיק להיכנס ל-DOM לפני ההדפסה
  };

  // סימון מילה/ביטוי בטקסט הגמרא -> מציג כפתור "הסבר" צף
  const handleTextSelection = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !textScrollRef.current) {
      setWordPopup(null);
      return;
    }
    const selectedText = sel.toString().trim();
    if (!selectedText || selectedText.length > 60 || !sel.anchorNode || !textScrollRef.current.contains(sel.anchorNode)) {
      setWordPopup(null);
      return;
    }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    setWordPopup({ text: selectedText, top: rect.top - 40, left: rect.left });
  };

  const handleExplainSelection = () => {
    if (!wordPopup) return;
    socket.emit('ai_message', {
      roomId,
      name: chatName || 'לומד',
      message: `מה פירוש "${wordPopup.text}" בהקשר של הסוגיה?`,
    });
    setLeftTab('ai');
    setWordPopup(null);
    window.getSelection()?.removeAllRanges();
  };

  const handleSetName = () => {
    if (!nameDraft.trim()) return;
    localStorage.setItem('havruta_chat_name', nameDraft.trim());
    setChatName(nameDraft.trim());
  };

  const handleSendChat = () => {
    if (!chatDraft.trim() || !chatName) return;
    socket.emit('chat_message', { roomId, name: chatName, text: chatDraft.trim() });
    setChatDraft('');
  };

  useEffect(() => {
    socket.emit('join_room', roomId);
    socket.emit('request_room_status', roomId);

    socket.on('page_changed', (data: { ref: string }) => {
      loadText(data.ref);
      loadLinks(data.ref);
    });

    socket.on('room_meta', (meta: { group: boolean; dedication?: string | null }) => {
      setIsGroupRoom(meta.group);
      setDedication(meta.dedication || null);
      setLeftTab((prev) => (meta.group && prev === 'video' ? 'chat' : prev)); // וידאו לא נתמך בחדר קבוצה
    });

    socket.on('chat_history', (history: ChatMessage[]) => {
      setMessages(history);
    });

    socket.on('chat_message', (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on('schedule_updated', (session: { when: number; note: string } | null) => {
      setNextSession(session);
    });

    return () => {
      socket.off('page_changed');
      socket.off('room_meta');
      socket.off('schedule_updated');
      socket.off('chat_history');
      socket.off('chat_message');
    };
  }, [roomId, loadText, loadLinks]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // איפוס גלילה לראש הטקסט בכל מעבר דף - אחרת נראה כאילו כלום לא זז
  useEffect(() => {
    textScrollRef.current?.scrollTo({ top: 0 });
  }, [currentRef]);

  // טעינת הערה אישית שמורה עבור הדף הנוכחי (לפי ref, כדי שתישאר זמינה גם בחדר אחר על אותה סוגיה)
  useEffect(() => {
    setNoteText(loadNote(currentRef));
  }, [currentRef]);

  const handleNoteChange = (value: string) => {
    setNoteText(value);
    saveNote(currentRef, value);
  };

  // איפוס חיפוש בכל מעבר דף - החיפוש רלוונטי לדף הנוכחי בלבד
  useEffect(() => {
    setSearchQuery('');
    setSearchOpen(false);
    setCurrentMatch(0);
  }, [currentRef]);

  const searchMatches = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return [];
    return text.reduce<number[]>((acc, line, i) => {
      if (stripTags(line).includes(q)) acc.push(i);
      return acc;
    }, []);
  }, [searchQuery, text]);

  useEffect(() => {
    setCurrentMatch(0);
  }, [searchQuery]);

  const goToMatch = (index: number) => {
    if (searchMatches.length === 0) return;
    const wrapped = ((index % searchMatches.length) + searchMatches.length) % searchMatches.length;
    setCurrentMatch(wrapped);
    lineElsRef.current[searchMatches[wrapped]]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  useEffect(() => {
    if (searchMatches.length > 0) goToMatch(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchMatches.length]);

  return (
    // lg ומעלה: הכל בגובה מסך אחד, כל אזור גולל רק בתוך עצמו
    <div className="min-h-screen lg:h-screen bg-[#EFE9D8] font-sans text-ink flex flex-col lg:overflow-hidden" dir="rtl">
      {/* הדר בהשראת כריכת ספר לימוד */}
      <header className="relative bg-cover shrink-0 shadow-md z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center gap-3">
          <button
            onClick={() => (window.location.href = window.location.pathname)}
            className="p-2 rounded-lg text-parchment-50/80 hover:text-parchment-50 hover:bg-white/10 transition-colors shrink-0"
            aria-label="חזרה ללובי"
            title="חזרה ללובי"
          >
            <ArrowRight size={19} />
          </button>

          <div className="flex items-center gap-2 shrink-0 pl-3 border-l border-white/10">
            <BookOpen size={20} className="text-brass-light" />
            <div className="font-classic text-lg font-bold text-parchment-50" dir="ltr">
              {currentRef || '...'}
            </div>
          </div>

          <div className="flex-1 min-w-[220px] flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleOpenPage()}
              placeholder='מראה מקום, למשל "שבת דף ב עמוד א"'
              className="flex-1 px-3.5 py-2 bg-white/10 placeholder-parchment-50/40 text-parchment-50 border border-white/15 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brass-light transition-all"
            />
            <button
              onClick={handleOpenPage}
              className="px-4 py-2 bg-brass hover:bg-brass-light text-cover-dark text-sm font-bold rounded-lg shadow transition-all active:scale-95 shrink-0"
            >
              פתח דף
            </button>
          </div>

          <button
            onClick={() => setShowSchedule((v) => !v)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white/10 hover:bg-white/15 text-parchment-50 rounded-lg text-sm font-medium transition-colors shrink-0"
            title="קבע את הלימוד הבא עם החברותא"
            aria-label="קבע את הלימוד הבא עם החברותא"
          >
            <CalendarPlus size={15} className="text-brass-light" />
            לימוד הבא
          </button>
          <button
            onClick={handleExportPdf}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white/10 hover:bg-white/15 text-parchment-50 rounded-lg text-sm font-medium transition-colors shrink-0"
            title="ייצוא הדף, המפרשים, ההערות והלוח לקובץ PDF"
          >
            <Printer size={15} className="text-brass-light" />
            ייצוא PDF
          </button>
          <button
            onClick={handleToggleQr}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white/10 hover:bg-white/15 text-parchment-50 rounded-lg text-sm font-medium transition-colors shrink-0"
            title="קוד QR להצטרפות מהירה"
            aria-label="קוד QR להצטרפות מהירה"
          >
            <QrCode size={15} className="text-brass-light" />
            QR
          </button>
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white/10 hover:bg-white/15 text-parchment-50 rounded-lg text-sm font-medium transition-colors shrink-0"
          >
            {copied ? <Check size={15} className="text-emerald-400" /> : <Link2 size={15} className="text-brass-light" />}
            {copied ? 'הועתק!' : 'שתף'}
          </button>
        </div>
        {/* קו פליז דק, כמו זהב על שולי כריכה */}
        <div className="h-[2px] bg-gradient-to-l from-transparent via-brass/60 to-transparent" />

        {showSchedule && (
          <div className="absolute left-4 sm:left-6 top-full mt-2 z-30 bg-parchment-50 border border-hairline rounded-2xl shadow-xl p-4 w-72 flex flex-col gap-2">
            <label className="text-xs font-semibold text-cover" htmlFor="schedule-when">מתי הלימוד הבא?</label>
            <input
              id="schedule-when"
              type="datetime-local"
              value={scheduleWhen}
              onChange={(e) => setScheduleWhen(e.target.value)}
              className="px-3 py-2 text-sm border border-hairline rounded-lg focus:outline-none focus:ring-2 focus:ring-brass"
            />
            <input
              value={scheduleNote}
              onChange={(e) => setScheduleNote(e.target.value)}
              placeholder="הערה (אופציונלי)"
              aria-label="הערה ללימוד הבא"
              className="px-3 py-2 text-sm border border-hairline rounded-lg focus:outline-none focus:ring-2 focus:ring-brass"
            />
            <div className="flex gap-2 mt-1">
              <button
                onClick={handleScheduleSubmit}
                disabled={!scheduleWhen}
                className="flex-1 px-3 py-2 bg-cover hover:bg-cover-dark disabled:bg-slate-300 disabled:cursor-not-allowed text-parchment-50 text-sm font-semibold rounded-lg transition-colors"
              >
                קבע
              </button>
              <button
                onClick={() => setShowSchedule(false)}
                className="px-3 py-2 text-ink/40 hover:text-ribbon text-sm transition-colors"
              >
                ביטול
              </button>
            </div>
          </div>
        )}

        {qrDataUrl && (
          <div className="absolute left-4 sm:left-6 top-full mt-2 z-30 bg-parchment-50 border border-hairline rounded-2xl shadow-xl p-4 flex flex-col items-center gap-2">
            <img src={qrDataUrl} alt="קוד QR להצטרפות לחדר" className="rounded-lg" width={220} height={220} />
            <p className="text-xs text-ink/50 text-center max-w-[220px]">
              סרוק כדי להצטרף ישירות לחדר הזה
            </p>
            <button
              onClick={() => setQrDataUrl(null)}
              className="text-xs font-semibold text-brass-dark hover:text-brass"
            >
              סגור
            </button>
          </div>
        )}
      </header>

      {nextSession && (
        <div className="bg-cover/5 border-b border-brass/20 px-4 sm:px-6 py-2 flex items-center justify-center gap-3 text-sm text-cover shrink-0 flex-wrap">
          <CalendarPlus size={14} className="text-brass-dark shrink-0" />
          <span>
            הלימוד הבא: {new Date(nextSession.when).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })} ({formatUntil(nextSession.when)})
            {nextSession.note ? ` — ${nextSession.note}` : ''}
          </span>
          <a
            href={buildGCalLink(nextSession.when, nextSession.note)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-brass-dark hover:text-brass underline underline-offset-2"
          >
            הוסף ליומן
          </a>
          <button onClick={handleScheduleCancel} className="text-xs text-ink/40 hover:text-ribbon">
            בטל
          </button>
        </div>
      )}

      {dedication && (
        <div className="bg-brass/10 border-b border-brass/20 px-4 sm:px-6 py-2 flex items-center justify-center gap-2 text-sm text-brass-dark shrink-0">
          <Heart size={13} className="shrink-0" />
          <span className="font-classic">{dedication}</span>
        </div>
      )}

      {/* אזור הלימוד: צ'אט | טקסט | מפרשים/לוח */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-5 flex-1 min-h-0 lg:overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-full min-h-0">
          {/* צ'אט עם החברותא */}
          <div className="lg:col-span-3 order-3 lg:order-1 min-h-0 h-[380px] lg:h-full flex flex-col">
            <div className="flex bg-white rounded-t-2xl border border-hairline border-b-0 overflow-hidden shrink-0">
              <button
                onClick={() => setLeftTab('chat')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors ${
                  leftTab === 'chat'
                    ? 'bg-parchment-100/70 text-cover border-b-2 border-brass'
                    : 'text-ink/40 hover:bg-parchment-100/30'
                }`}
              >
                <MessageCircle size={16} />
                צ'אט
              </button>
              <button
                onClick={() => setLeftTab('ai')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors ${
                  leftTab === 'ai'
                    ? 'bg-parchment-100/70 text-cover border-b-2 border-brass'
                    : 'text-ink/40 hover:bg-parchment-100/30'
                }`}
              >
                <Sparkles size={16} />
                חברותא AI
              </button>
              {!isGroupRoom && (
                <button
                  onClick={() => setLeftTab('video')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors ${
                    leftTab === 'video'
                      ? 'bg-parchment-100/70 text-cover border-b-2 border-brass'
                      : 'text-ink/40 hover:bg-parchment-100/30'
                  }`}
                >
                  <Video size={16} />
                  וידאו
                </button>
              )}
            </div>

            <div className="flex-1 min-h-0 bg-white rounded-b-2xl border border-hairline overflow-hidden flex flex-col">
              {leftTab === 'video' && !isGroupRoom ? (
                <VideoCall roomId={roomId} />
              ) : leftTab === 'ai' ? (
                <AIChavruta roomId={roomId} chatName={chatName} />
              ) : (
              <>
              {!chatName ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center min-h-0">
                  <p className="text-sm text-ink/60">איך לקרוא לך בצ'אט?</p>
                  <input
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSetName()}
                    placeholder="השם שלך"
                    aria-label="השם שלך בצ'אט"
                    className="w-full px-3 py-2.5 border border-hairline rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brass"
                  />
                  <button
                    onClick={handleSetName}
                    className="px-4 py-2.5 bg-cover hover:bg-cover-dark text-parchment-50 text-sm font-semibold rounded-lg w-full transition-colors"
                  >
                    כניסה לצ'אט
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-0" role="log" aria-live="polite" aria-label="הודעות צ'אט">
                    {messages.length === 0 ? (
                      <div className="text-center text-ink/40 text-sm py-10 px-4">
                        עדיין אין הודעות כאן. כתבו לחברותא מה עולה לכם על הסוגיה.
                      </div>
                    ) : (
                      messages.map((m) => {
                        const isMine = m.name === chatName;
                        return (
                          <div
                            key={m.id}
                            className={`max-w-[85%] px-3.5 py-2 rounded-xl text-sm leading-relaxed ${
                              isMine
                                ? 'bg-cover text-parchment-50 mr-auto rounded-br-sm'
                                : 'bg-parchment-100 text-ink ml-auto rounded-bl-sm'
                            }`}
                          >
                            {!isMine && <div className="text-xs font-bold text-brass-dark mb-0.5">{m.name}</div>}
                            <div className="whitespace-pre-wrap break-words">{m.text}</div>
                          </div>
                        );
                      })
                    )}
                    <div ref={chatEndRef} />
                  </div>
                  <div className="p-2.5 border-t border-hairline flex gap-2 shrink-0">
                    <input
                      value={chatDraft}
                      onChange={(e) => setChatDraft(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                      placeholder="כתוב הודעה..."
                      aria-label="כתוב הודעת צ'אט"
                      className="flex-1 px-3 py-2.5 border border-hairline rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brass"
                    />
                    <button
                      onClick={handleSendChat}
                      className="px-3 py-2.5 bg-cover hover:bg-cover-dark text-parchment-50 rounded-lg shrink-0 transition-colors"
                      aria-label="שלח"
            title="שלח"
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </>
              )}
              </>
              )}
            </div>
          </div>

          {/* טקסט הגמרא */}
          <div className="lg:col-span-5 order-1 lg:order-2 min-h-0 h-[440px] lg:h-full">
            <div className="relative bg-parchment-50 rounded-2xl shadow-sm border border-hairline h-full min-h-0 flex flex-col">
              {/* קו שוליים דק, כמו שוליים בספר מודפס */}
              <div className="absolute top-6 bottom-6 left-6 w-px bg-hairline hidden sm:block pointer-events-none" />

              {loadingText ? (
                <div className="flex items-center justify-center flex-1 text-ink/40 gap-2">
                  <Loader2 size={22} className="animate-spin" />
                  טוען טקסט...
                </div>
              ) : text.length === 0 ? (
                <div className="flex flex-col items-center justify-center flex-1 text-ink/40 gap-3 text-center px-8">
                  <ScrollText size={40} className="text-ink/20" />
                  {currentRef
                    ? 'לא נמצא טקסט עבור מראה המקום הזה. ייתכן שהדף לא קיים במסכת (בדוק את מספר הדף).'
                    : 'הקלד מראה מקום למעלה ולחץ "פתח דף" כדי להתחיל ללמוד.'}
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-1 px-6 sm:px-8 pt-5 pb-1 shrink-0">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setNoteOpen((v) => !v)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          noteOpen || noteText
                            ? 'bg-brass/15 text-brass-dark'
                            : 'text-ink/60 hover:bg-brass/10 hover:text-brass-dark'
                        }`}
                        aria-label="הערות אישיות על הסוגיה"
            title="הערות אישיות על הסוגיה"
                      >
                        <NotebookPen size={14} />
                        הערות{noteText && !noteOpen ? ' •' : ''}
                      </button>
                      <button
                        onClick={() => setSearchOpen((v) => !v)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          searchOpen
                            ? 'bg-brass/15 text-brass-dark'
                            : 'text-ink/60 hover:bg-brass/10 hover:text-brass-dark'
                        }`}
                        aria-label="חיפוש בטקסט"
            title="חיפוש בטקסט"
                      >
                        <Search size={14} />
                        חיפוש
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleNavigateDaf(-1)}
                        disabled={!canGoPrev}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-ink/60 hover:bg-brass/10 hover:text-brass-dark disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
                        aria-label="הדף הקודם"
            title="הדף הקודם"
                      >
                        <ChevronRight size={15} />
                        הקודם
                      </button>
                      <button
                        onClick={() => handleNavigateDaf(1)}
                        disabled={!canGoNext}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-ink/60 hover:bg-brass/10 hover:text-brass-dark disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
                        aria-label="הדף הבא"
            title="הדף הבא"
                      >
                        הבא
                        <ChevronLeft size={15} />
                      </button>
                    </div>
                  </div>

                  {searchOpen && (
                    <div className="px-6 sm:px-8 pb-2 shrink-0 flex items-center gap-2">
                      <input
                        autoFocus
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') goToMatch(currentMatch + (e.shiftKey ? -1 : 1));
                          if (e.key === 'Escape') setSearchOpen(false);
                        }}
                        placeholder="חפש בטקסט הדף..."
                        aria-label="חפש בטקסט הדף"
                        className="flex-1 px-3 py-1.5 text-sm border border-hairline rounded-lg focus:outline-none focus:ring-2 focus:ring-brass"
                      />
                      {searchQuery.trim() && (
                        <span className="text-xs text-ink/50 shrink-0 whitespace-nowrap">
                          {searchMatches.length > 0 ? `${currentMatch + 1}/${searchMatches.length}` : 'אין תוצאות'}
                        </span>
                      )}
                      <button
                        onClick={() => goToMatch(currentMatch - 1)}
                        disabled={searchMatches.length === 0}
                        className="p-1.5 rounded-lg text-ink/50 hover:bg-brass/10 hover:text-brass-dark disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
                        aria-label="התוצאה הקודמת"
            title="התוצאה הקודמת"
                      >
                        <ChevronUp size={15} />
                      </button>
                      <button
                        onClick={() => goToMatch(currentMatch + 1)}
                        disabled={searchMatches.length === 0}
                        className="p-1.5 rounded-lg text-ink/50 hover:bg-brass/10 hover:text-brass-dark disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
                        aria-label="התוצאה הבאה"
            title="התוצאה הבאה"
                      >
                        <ChevronDown size={15} />
                      </button>
                      <button
                        onClick={() => setSearchOpen(false)}
                        className="p-1.5 rounded-lg text-ink/40 hover:text-ribbon transition-colors shrink-0"
                        aria-label="סגור חיפוש"
            title="סגור חיפוש"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  )}


                  {noteOpen && (
                    <div className="px-6 sm:px-8 pb-2 shrink-0">
                      <textarea
                        value={noteText}
                        onChange={(e) => handleNoteChange(e.target.value)}
                        placeholder="הערות אישיות על הסוגיה הזו (נשמר במכשיר שלך, לא משותף)"
                        aria-label="הערות אישיות על הסוגיה"
                        rows={3}
                        className="w-full px-3 py-2 text-sm font-sans border border-brass/30 bg-brass/[0.04] rounded-lg focus:outline-none focus:ring-2 focus:ring-brass resize-y text-ink placeholder:text-ink/35"
                      />
                    </div>
                  )}

                  <div
                    ref={textScrollRef}
                    onMouseUp={handleTextSelection}
                    className="flex-1 overflow-y-auto scroll-parchment min-h-0 px-6 sm:px-8 pb-6 pt-2 font-classic text-xl leading-loose space-y-1 text-ink"
                  >
                    {text.map((line, i) => {
                      const isMatch = searchMatches.includes(i);
                      const isCurrentMatch = isMatch && searchMatches[currentMatch] === i;
                      const isInRange = !!selectedRange && i >= selectedRange.start && i <= selectedRange.end;
                      return (
                        <p
                          key={i}
                          ref={(el) => { lineElsRef.current[i] = el; }}
                          onClick={(e) => handleSelectLine(i, e.shiftKey)}
                          className={`relative px-3 py-2 rounded-lg cursor-pointer transition-colors border-r-[3px] ${
                            isCurrentMatch
                              ? 'bg-brass/20 border-brass'
                              : isMatch
                              ? 'bg-brass/10 border-brass/40'
                              : isInRange
                              ? 'bg-ribbon/[0.07] border-ribbon'
                              : 'border-transparent hover:bg-brass/5 hover:border-brass/30'
                          }`}
                          dangerouslySetInnerHTML={{ __html: line }}
                        />
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* פאנל צד: מפרשים / לוח שרטוט */}
          <div className="lg:col-span-4 order-2 lg:order-3 min-h-0 h-[440px] lg:h-full flex flex-col">
            <div className="flex bg-white rounded-t-2xl border border-hairline border-b-0 overflow-hidden shrink-0">
              <button
                onClick={() => setActiveTab('commentaries')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors ${
                  activeTab === 'commentaries'
                    ? 'bg-parchment-100/70 text-cover border-b-2 border-brass'
                    : 'text-ink/40 hover:bg-parchment-100/30'
                }`}
              >
                <Library size={16} />
                מפרשים
              </button>
              <button
                onClick={() => setActiveTab('whiteboard')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors ${
                  activeTab === 'whiteboard'
                    ? 'bg-parchment-100/70 text-cover border-b-2 border-brass'
                    : 'text-ink/40 hover:bg-parchment-100/30'
                }`}
              >
                <PenSquare size={16} />
                לוח שרטוט
              </button>
            </div>

            <div className="flex-1 min-h-0 bg-white rounded-b-2xl border border-hairline overflow-hidden flex flex-col">
              {activeTab === 'whiteboard' ? (
                <div className="flex-1 min-h-0">
                  <Whiteboard ref={whiteboardRef} roomId={roomId} />
                </div>
              ) : (
                <div className="flex-1 min-h-0 overflow-y-auto p-4">
                  {selectedRange === null ? (
                    <div className="text-center text-ink/40 py-16 px-4 text-sm flex flex-col items-center gap-2">
                      <MousePointerClick size={28} className="text-ink/15" />
                      {currentRef
                        ? 'סמן שורה בטקסט כדי לראות אילו מפרשים זמינים עליה (Shift+קליק לבחירת טווח שורות).'
                        : 'פתח דף כדי להתחיל ללמוד.'}
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-2 mb-3 px-1">
                        <span className="text-xs font-semibold text-brass-dark">
                          {selectedRange.start === selectedRange.end ? 'מפרשים לשורה שסימנת' : 'מפרשים לטווח השורות שסימנת'}
                        </span>
                        <button
                          onClick={() => setSelectedRange(null)}
                          className="text-ink/40 hover:text-ribbon shrink-0"
                          aria-label="בטל סימון"
            title="בטל סימון"
                        >
                          <X size={15} />
                        </button>
                      </div>

                      {lineCommentators.length === 0 ? (
                        <div className="text-center text-ink/40 py-8 text-sm px-2">
                          {allLinks.length === 0
                            ? 'לא התקבלו נתוני מפרשים מספריא עבור דף זה - ודא שמראה המקום תקין.'
                            : 'לא נמצא מפרש ישיר לשורה זו, נסה שורה סמוכה.'}
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-wrap gap-2 mb-4">
                            {lineCommentators.map((c) => (
                              <button
                                key={c.en}
                                onClick={() => toggleCommentator(c)}
                                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                                  openCommentaries[c.en]
                                    ? 'bg-brass/15 border-brass text-brass-dark'
                                    : 'bg-parchment-50 border-hairline text-ink/70 hover:border-brass hover:text-brass-dark'
                                }`}
                              >
                                {c.he}
                              </button>
                            ))}
                          </div>

                          <div className="space-y-3">
                            {Object.entries(openCommentaries).map(([en, state]) => {
                              const c = lineCommentators.find((x) => x.en === en);
                              return (
                                <div key={en} className="border border-hairline rounded-xl overflow-hidden">
                                  <div className="bg-parchment-100/60 px-4 py-2 text-sm font-bold text-cover border-b border-hairline">
                                    {c?.he || en}
                                  </div>
                                  <div className="p-4 font-classic text-lg leading-relaxed text-ink max-h-64 overflow-y-auto">
                                    {state.loading ? (
                                      <div className="flex items-center gap-2 text-ink/40 text-sm py-4 justify-center">
                                        <Loader2 size={16} className="animate-spin" />
                                        טוען...
                                      </div>
                                    ) : state.error || state.lines.length === 0 ? (
                                      <div className="text-ink/40 text-sm text-center py-4 font-sans">
                                        לא נמצא טקסט זמין עבור מפרש זה.
                                      </div>
                                    ) : (
                                      <div className="space-y-2">
                                        {state.lines.map((line, i) => (
                                          <p key={i} dangerouslySetInnerHTML={{ __html: line }} />
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {lineParallels.length > 0 && (
                            <div className="mt-5 pt-4 border-t border-hairline">
                              <span className="block text-xs font-semibold text-brass-dark mb-2">מקורות מקבילים</span>
                              <div className="flex flex-wrap gap-2">
                                {lineParallels.map((p) => (
                                  <button
                                    key={p.ref}
                                    onClick={() => openParallelSource(p)}
                                    className="px-3 py-1.5 rounded-full text-sm font-medium border bg-parchment-50 border-hairline text-ink/70 hover:border-brass hover:text-brass-dark transition-colors"
                                    title="נפתח בחלון נפרד, בלי לגעת בטקסט שאתה לומד כרגע"
                                  >
                                    {p.displayRef}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* כפתור "הסבר" צף שמופיע כשמסמנים מילה/ביטוי בטקסט הגמרא */}
      {wordPopup && (
        <button
          onClick={handleExplainSelection}
          style={{ position: 'fixed', top: wordPopup.top, left: wordPopup.left, zIndex: 50 }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-cover text-parchment-50 text-xs font-semibold rounded-full shadow-lg hover:bg-cover-dark transition-colors"
        >
          <HelpCircle size={13} className="text-brass-light" />
          הסבר עם AI
        </button>
      )}

      {/* מקור מקביל נפתח כאן, בחלון נפרד מעל הכל - הטקסט הראשי שלומדים נשאר בדיוק כמו שהיה מתחת */}
      {openParallel && (
        <div
          className="fixed inset-0 z-[60] bg-ink/40 flex items-center justify-center p-4"
          onClick={() => setOpenParallel(null)}
        >
          <div
            className="bg-parchment-50 rounded-2xl shadow-2xl border border-hairline max-w-xl w-full max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-hairline bg-parchment-100/60 rounded-t-2xl shrink-0">
              <h3 className="font-bold text-cover font-classic text-lg truncate">{openParallel.displayRef}</h3>
              <button
                onClick={() => setOpenParallel(null)}
                className="p-1.5 rounded-lg text-ink/40 hover:text-ribbon hover:bg-ribbon/10 transition-colors shrink-0"
                aria-label="סגור חלון מקור מקביל"
                title="סגור"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 overflow-y-auto font-classic text-lg leading-relaxed text-ink">
              {openParallel.loading ? (
                <div className="flex items-center gap-2 text-ink/40 text-sm py-8 justify-center font-sans">
                  <Loader2 size={18} className="animate-spin" />
                  טוען...
                </div>
              ) : openParallel.error || openParallel.lines.length === 0 ? (
                <div className="text-ink/40 text-sm text-center py-8 font-sans">לא נמצא טקסט זמין עבור מקור זה.</div>
              ) : (
                <div className="space-y-2">
                  {openParallel.lines.map((line, i) => (
                    <p key={i} dangerouslySetInnerHTML={{ __html: line }} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* אזור הדפסה בלבד - מוסתר במסך, מופיע רק בדיאלוג ההדפסה/יצוא PDF */}
      <div id="print-area" className="hidden print:block p-8 font-classic text-ink" dir="rtl">
        <h1 className="text-2xl font-bold mb-1" dir="ltr">{currentRef}</h1>
        <p className="text-sm text-ink/60 mb-6">חברותא דיגיטלית — סיכום לימוד</p>

        {text.length > 0 && (
          <>
            <h2 className="text-lg font-bold mb-2 border-b border-ink/20 pb-1">טקסט הגמרא</h2>
            <div className="space-y-2 mb-6 text-lg leading-relaxed">
              {text.map((line, i) => (
                <p key={i} dangerouslySetInnerHTML={{ __html: line }} />
              ))}
            </div>
          </>
        )}

        {Object.keys(openCommentaries).length > 0 && (
          <>
            <h2 className="text-lg font-bold mb-2 border-b border-ink/20 pb-1">מפרשים</h2>
            {Object.entries(openCommentaries).map(([en, state]) => {
              const c = lineCommentators.find((x) => x.en === en);
              if (state.loading || state.error || state.lines.length === 0) return null;
              return (
                <div key={en} className="mb-4">
                  <h3 className="font-bold text-base mb-1">{c?.he || en}</h3>
                  {state.lines.map((l, i) => (
                    <p key={i} className="mb-1" dangerouslySetInnerHTML={{ __html: l }} />
                  ))}
                </div>
              );
            })}
          </>
        )}

        {noteText && (
          <>
            <h2 className="text-lg font-bold mb-2 border-b border-ink/20 pb-1">הערות אישיות</h2>
            <p className="whitespace-pre-wrap mb-6 font-sans">{noteText}</p>
          </>
        )}

        {boardSnapshot && (
          <>
            <h2 className="text-lg font-bold mb-2 border-b border-ink/20 pb-1">לוח השרטוט</h2>
            <img src={boardSnapshot} alt="לוח שרטוט" className="max-w-full border border-ink/20" />
          </>
        )}
      </div>
    </div>
  );
};

export default StudyRoom;
