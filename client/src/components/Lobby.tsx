import { useState, useEffect, useRef } from 'react';
import { socket } from '../socket';
import { API_URL } from '../apiBase';
import { numberToHebrew } from '../studyLog';
import { recordPartner, loadPartnersHistory } from '../partnersHistory';
import UserProfile from './UserProfile';
import {
  BookOpen,
  Users,
  PlusCircle,
  ArrowLeft,
  Sparkles,
  History,
  X,
  CalendarDays,
  Loader2,
  UsersRound,
  User as UserIcon,
  Heart,
  MessageSquarePlus,
  Send,
  Shuffle,
} from 'lucide-react';
import MesechetTracker from './MesechetTracker';
import StudyLogView from './StudyLogView';
import StudyStats from './StudyStats';
import TractatePacing from './TractatePacing';
import DueForReview from './DueForReview';
import DataBackup from './DataBackup';
import DonationButton from './DonationButton';
import AchievementBadges from './AchievementBadges';
import OnboardingTour from './OnboardingTour';

interface ActiveRoom {
  id: string;
  topic: string;
  occupancy: number;
  group: boolean;
}

interface BoardPost {
  id: string;
  name: string;
  topic: string;
  when: string;
  level?: string;
  posterSocketId: string;
  ts: number;
}

interface MyRoom {
  id: string;
  label: string;
  ts: number;
}

const MY_ROOMS_KEY = 'havruta_my_rooms';
const MAX_MY_ROOMS = 10;

function loadMyRooms(): MyRoom[] {
  try {
    const raw = localStorage.getItem(MY_ROOMS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistMyRoom(id: string, label: string): MyRoom[] {
  const existing = loadMyRooms().filter((r) => r.id !== id);
  const next = [{ id, label, ts: Date.now() }, ...existing].slice(0, MAX_MY_ROOMS);
  localStorage.setItem(MY_ROOMS_KEY, JSON.stringify(next));
  return next;
}

function removeMyRoomFromStorage(id: string): MyRoom[] {
  const next = loadMyRooms().filter((r) => r.id !== id);
  localStorage.setItem(MY_ROOMS_KEY, JSON.stringify(next));
  return next;
}

// זמן יחסי בעברית - "לפני 5 דקות" וכו'
function formatRelativeTime(ts: number): string {
  const diffMs = Date.now() - ts;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'הרגע';
  if (minutes < 60) return `לפני ${minutes} דקות`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `לפני ${hours} שעות`;
  const days = Math.floor(hours / 24);
  return `לפני ${days} ימים`;
}

interface LobbyProps {
  onJoinRoom: (roomId: string, opts?: { ai?: boolean }) => void;
}

const Lobby = ({ onJoinRoom }: LobbyProps) => {
  const [rooms, setRooms] = useState<ActiveRoom[]>([]);
  const [newTopic, setNewTopic] = useState('');
  const [myRooms, setMyRooms] = useState<MyRoom[]>(() => loadMyRooms());
  const [dafYomiLoading, setDafYomiLoading] = useState(false);
  const [dafYomiError, setDafYomiError] = useState('');
  const [tractates, setTractates] = useState<{ he: string; en: string }[]>([]);
  const [publicRoom, setPublicRoom] = useState<{ roomId: string; ref: string; label: string } | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [partnersHistory, setPartnersHistory] = useState(() => loadPartnersHistory());
  const [roomMode, setRoomMode] = useState<'pair' | 'group'>('pair');
  const [dedication, setDedication] = useState('');
  const [showDedication, setShowDedication] = useState(false);
  const [boardPosts, setBoardPosts] = useState<BoardPost[]>([]);
  const [showPostForm, setShowPostForm] = useState(false);
  const [postTopic, setPostTopic] = useState('');
  const [postWhen, setPostWhen] = useState('');
  const [postLevel, setPostLevel] = useState(() => localStorage.getItem('havruta_profile_level') || '');
  const pendingAiRef = useRef(false);
  const pendingLabelRef = useRef('');

  useEffect(() => {
    fetch(`${API_URL}/api/tractates`)
      .then((res) => res.json())
      .then((data) => setTractates(data.tractates || []))
      .catch((e) => console.error('[מסכתות] שגיאה בטעינת רשימת המסכתות:', e));
  }, []);

  // חדר "דף היומי" ציבורי - קבוע ליום הזה, פתוח לכולם בלי שידוך מראש
  useEffect(() => {
    fetch(`${API_URL}/api/public-room`)
      .then((res) => res.json())
      .then((data) => setPublicRoom(data))
      .catch((e) => console.error('[חדר ציבורי] שגיאה בטעינה:', e));
  }, []);

  useEffect(() => {
    socket.on('rooms_list', (roomsList: ActiveRoom[]) => {
      // חדרים עם לומד יחיד שממתין לחברותא עולים ראשונים ברשימה
      const sorted = [...roomsList].sort((a, b) => {
        if (a.occupancy === 1 && b.occupancy !== 1) return -1;
        if (b.occupancy === 1 && a.occupancy !== 1) return 1;
        return 0;
      });
      setRooms(sorted);
    });

    socket.on('room_created', (roomId: string) => {
      setMyRooms(persistMyRoom(roomId, pendingLabelRef.current));
      onJoinRoom(roomId, pendingAiRef.current ? { ai: true } : undefined);
      pendingAiRef.current = false;
    });

    socket.on('board_list', (posts: BoardPost[]) => {
      setBoardPosts(posts);
    });

    // מישהו לחץ "בוא נלמד" על הבקשה שאני פרסמתי - מצטרפים אליו אוטומטית
    socket.on('board_matched', (data: { roomId: string; topic: string; partnerName?: string }) => {
      setMyRooms(persistMyRoom(data.roomId, data.topic));
      if (data.partnerName) {
        recordPartner(data.partnerName, data.topic);
        setPartnersHistory(loadPartnersHistory());
      }
      onJoinRoom(data.roomId);
    });

    return () => {
      socket.off('rooms_list');
      socket.off('room_created');
      socket.off('board_list');
      socket.off('board_matched');
    };
  }, [onJoinRoom]);

  const handleCreateRoom = () => {
    if (!newTopic.trim()) return;
    pendingAiRef.current = false;
    pendingLabelRef.current = newTopic.trim();
    socket.emit('create_room', { topic: newTopic, group: roomMode === 'group', dedication });
  };

  const handleStartWithAI = () => {
    if (!newTopic.trim()) return;
    pendingAiRef.current = true;
    pendingLabelRef.current = newTopic.trim();
    socket.emit('create_room', { topic: newTopic, group: roomMode === 'group', dedication });
  };

  const handleStartDafYomi = async () => {
    setDafYomiLoading(true);
    setDafYomiError('');
    try {
      const res = await fetch(`${API_URL}/api/daf-yomi`);
      const data = await res.json();
      if (!res.ok || !data.ref) throw new Error('daf_yomi_unavailable');
      pendingAiRef.current = false;
      pendingLabelRef.current = data.label;
      socket.emit('create_room', { topic: data.label, ref: data.ref, group: roomMode === 'group', dedication });
    } catch (e) {
      console.error('[daf-יומי] שגיאה בטעינת דף היומי:', e);
      setDafYomiError('לא הצלחנו לטעון את דף היומי של היום כרגע. נסה שוב עוד רגע.');
    } finally {
      setDafYomiLoading(false);
    }
  };

  // "תפתיע אותי" - בוחר מסכת ודף אקראיים לגילוי. טווח 2-40 בטוח כמעט לכל מסכת;
  // אם במקרה נחתים על דף שלא קיים, זה כבר מטופל בהודעה ברורה בחדר הלימוד עצמו
  const handleSurpriseMe = () => {
    if (tractates.length === 0) return;
    const tractate = tractates[Math.floor(Math.random() * tractates.length)];
    const daf = 2 + Math.floor(Math.random() * 39);
    const side: 'a' | 'b' = Math.random() < 0.5 ? 'a' : 'b';
    const ref = `${tractate.en}.${daf}${side}`;
    const label = `${tractate.he} דף ${numberToHebrew(daf)} עמוד ${side === 'a' ? 'א' : 'ב'}`;
    pendingAiRef.current = false;
    pendingLabelRef.current = label;
    socket.emit('create_room', { topic: label, ref, group: roomMode === 'group', dedication });
  };

  // "כדאי לחזור על זה" - פותח חדר ישירות על דף שכבר נלמד בעבר ומגיע הזמן לחזור עליו
  const handleReviewDaf = (entry: { tractateEn: string; daf: number; side: 'a' | 'b' }) => {
    const heName = tractates.find((t) => t.en === entry.tractateEn)?.he || entry.tractateEn;
    const label = `${heName} דף ${numberToHebrew(entry.daf)} עמוד ${entry.side === 'a' ? 'א' : 'ב'}`;
    const ref = `${entry.tractateEn}.${entry.daf}${entry.side}`;
    pendingAiRef.current = false;
    pendingLabelRef.current = label;
    socket.emit('create_room', { topic: label, ref, group: false });
  };

  const handleJoinExisting = (room: ActiveRoom) => {
    setMyRooms(persistMyRoom(room.id, room.topic));
    onJoinRoom(room.id);
  };

  const handleJoinPublicRoom = () => {
    if (!publicRoom) return;
    setMyRooms(persistMyRoom(publicRoom.roomId, publicRoom.label));
    onJoinRoom(publicRoom.roomId);
  };

  const handleJoinMyRoom = (room: MyRoom) => {
    setMyRooms(persistMyRoom(room.id, room.label)); // מרענן את הזמן לראש הרשימה
    onJoinRoom(room.id);
  };

  const handleRemoveMyRoom = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setMyRooms(removeMyRoomFromStorage(id));
  };

  const handlePostRequest = () => {
    if (!postTopic.trim()) return;
    const name = localStorage.getItem('havruta_chat_name') || 'לומד';
    if (postLevel) localStorage.setItem('havruta_profile_level', postLevel);
    socket.emit('board_post', { name, topic: postTopic.trim(), when: postWhen.trim(), level: postLevel });
    setPostTopic('');
    setPostWhen('');
    setShowPostForm(false);
  };

  const handleRemovePost = (postId: string) => {
    socket.emit('board_remove', postId);
  };

  const handleClaimPost = (post: BoardPost) => {
    pendingAiRef.current = false;
    pendingLabelRef.current = post.topic;
    recordPartner(post.name, post.topic);
    setPartnersHistory(loadPartnersHistory());
    const myName = localStorage.getItem('havruta_chat_name') || 'לומד';
    socket.emit('board_claim', { postId: post.id, name: myName });
  };

  return (
    <>
      <OnboardingTour />
      <div className="min-h-screen bg-[#EFE9D8] flex flex-col items-center justify-center p-6 font-sans text-ink" dir="rtl">
      <div className="max-w-3xl w-full bg-parchment-50 rounded-2xl shadow-2xl overflow-hidden border border-hairline">

        {/* הדר בהשראת כריכת ספר לימוד: ירוק כהה, פליז, וסרט סימניה */}
        <div className="relative bg-cover px-8 pt-10 pb-8 text-center overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(255,255,255,0.06),_transparent_60%)]" />
          {/* סרט סימניה - האלמנט החתימה של העיצוב */}
          <div className="absolute top-0 right-10 w-6 h-16 bg-ribbon shadow-md" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 78%, 0 100%)' }} />

          <button
            onClick={() => setShowProfile(true)}
            className="absolute top-4 left-4 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            aria-label="הפרופיל שלי"
            title="הפרופיל שלי"
          >
            <UserIcon size={18} className="text-parchment-50" />
          </button>

          <BookOpen size={40} strokeWidth={1.5} className="mx-auto text-brass-light mb-4 relative z-10" />
          <h1 className="text-4xl font-classic font-bold text-parchment-50 mb-2 relative z-10 tracking-tight">
            חברותא דיגיטלית
          </h1>
          <p className="text-brass-light/80 text-base relative z-10">
            בית מדרש וירטואלי — לומדים ביחד, בזמן אמת, מכל מקום
          </p>
        </div>

        {showProfile && <UserProfile onClose={() => setShowProfile(false)} />}

        <div className="p-8">
          {/* המשך מאיפה שהפסקת - החדר האחרון שהיית בו, בולט בראש הלובי */}
          {myRooms.length > 0 && (
            <button
              onClick={() => handleJoinMyRoom(myRooms[0])}
              className="w-full flex items-center justify-between gap-3 mb-6 p-4 bg-cover hover:bg-cover-dark rounded-2xl text-right transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <History size={20} className="text-brass-light shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs text-parchment-50/70">המשך מאיפה שהפסקת</div>
                  <strong className="block font-classic text-lg text-parchment-50 truncate">{myRooms[0].label}</strong>
                </div>
              </div>
              <ArrowLeft size={20} className="text-brass-light shrink-0" />
            </button>
          )}

          {/* חדר "דף היומי" ציבורי - פתוח לכולם, בלי שידוך מראש */}
          {publicRoom && (
            <button
              onClick={handleJoinPublicRoom}
              className="w-full flex items-center justify-between gap-3 mb-6 p-4 bg-ribbon/5 hover:bg-ribbon/10 border border-ribbon/20 rounded-2xl text-right transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <UsersRound size={20} className="text-ribbon shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs text-ribbon-dark font-semibold">בית מדרש פתוח · דף היומי הציבורי</div>
                  <strong className="block font-classic text-lg text-ink truncate">{publicRoom.label}</strong>
                </div>
              </div>
              <span className="text-xs font-semibold text-ribbon-dark bg-white px-3 py-1.5 rounded-full shrink-0 border border-ribbon/20">
                הצטרפו עכשיו
              </span>
            </button>
          )}

          {/* פתיחת חדר חדש */}
          <div className="bg-white p-6 rounded-2xl border border-hairline mb-8">
            <h3 className="text-lg font-bold text-cover mb-4 flex items-center gap-2">
              <PlusCircle size={20} className="text-brass" />
              פתח פתיל לימוד חדש
            </h3>

            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setRoomMode('pair')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                  roomMode === 'pair'
                    ? 'bg-cover text-parchment-50 border-cover'
                    : 'bg-parchment-50 text-ink/50 border-hairline hover:border-brass/40'
                }`}
              >
                <Users size={15} />
                חברותא (שניים)
              </button>
              <button
                onClick={() => setRoomMode('group')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                  roomMode === 'group'
                    ? 'bg-cover text-parchment-50 border-cover'
                    : 'bg-parchment-50 text-ink/50 border-hairline hover:border-brass/40'
                }`}
              >
                <UsersRound size={15} />
                קבוצה / שיעור
              </button>
            </div>

            {roomMode === 'group' && (
              <p className="text-xs text-brass-dark bg-brass/10 rounded-lg px-3 py-2 mb-3">
                במצב קבוצה שיחת הוידאו לא זמינה (בנויה לזוג בלבד) - הצ'אט, הלוח וחברותא ה-AI כן משותפים לכולם.
              </p>
            )}

            {!showDedication ? (
              <button
                onClick={() => setShowDedication(true)}
                className="flex items-center gap-1.5 text-xs font-semibold text-brass-dark hover:text-brass mb-3 transition-colors"
              >
                <Heart size={13} />
                הוסף הקדשת לימוד (אופציונלי)
              </button>
            ) : (
              <div className="mb-3">
                <input
                  value={dedication}
                  onChange={(e) => setDedication(e.target.value)}
                  placeholder='לדוגמה: לעילוי נשמת ר׳ פלוני בן פלוני, לרפואת...'
                  aria-label="הקדשת לימוד"
                  className="w-full px-3 py-2 text-sm bg-parchment-50 border border-hairline rounded-lg focus:outline-none focus:ring-2 focus:ring-brass placeholder:text-ink/30"
                />
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={newTopic}
                onChange={(e) => setNewTopic(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateRoom()}
                placeholder='לדוגמה: נזיר דף ב׳ עמוד א׳'
                aria-label="מראה מקום ללימוד"
                className="flex-1 px-5 py-3 bg-parchment-50 border border-hairline rounded-xl focus:outline-none focus:ring-2 focus:ring-brass text-lg transition-all placeholder:text-ink/30"
              />
              <button
                onClick={handleCreateRoom}
                disabled={!newTopic.trim()}
                className="px-8 py-3 bg-cover hover:bg-cover-dark disabled:bg-slate-300 disabled:cursor-not-allowed text-parchment-50 font-semibold rounded-xl shadow-sm transition-all active:scale-95"
              >
                פתח חדר
              </button>
            </div>
            <p className="text-sm text-ink/50 mt-3">
              כתוב את המסכת, הדף והעמוד — למשל{' '}
              <span className="font-classic bg-parchment-100 px-1.5 py-0.5 rounded text-ink/70">בבא בתרא דף קע"ו עמוד ב׳</span>
            </p>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-3">
              <button
                onClick={handleStartDafYomi}
                disabled={dafYomiLoading}
                className="flex items-center gap-1.5 text-sm font-semibold text-brass-dark hover:text-brass disabled:opacity-50 transition-colors"
              >
                {dafYomiLoading ? <Loader2 size={15} className="animate-spin" /> : <CalendarDays size={15} />}
                פתח את דף היומי של היום
              </button>
              <span className="hidden sm:inline text-ink/20">•</span>
              <button
                onClick={handleSurpriseMe}
                disabled={tractates.length === 0}
                className="flex items-center gap-1.5 text-sm font-semibold text-brass-dark hover:text-brass disabled:opacity-50 transition-colors"
              >
                <Shuffle size={15} />
                תפתיע אותי
              </button>
              <span className="hidden sm:inline text-ink/20">•</span>
              <button
                onClick={handleStartWithAI}
                disabled={!newTopic.trim()}
                className="flex items-center gap-1.5 text-sm font-semibold text-brass-dark hover:text-brass disabled:text-ink/30 disabled:cursor-not-allowed transition-colors"
              >
                <Sparkles size={15} />
                אין לי חברותא כרגע — התחל ללמוד עם חברותא AI
              </button>
            </div>
            {dafYomiError && <p className="text-sm text-ribbon-dark mt-2">{dafYomiError}</p>}
          </div>

          <DueForReview
            tractateEnToHe={Object.fromEntries(tractates.map((t) => [t.en, t.he]))}
            onReview={handleReviewDaf}
          />
          <StudyStats />
          <AchievementBadges />
          <MesechetTracker />
          <StudyLogView onOpenPage={handleReviewDaf} />
          <TractatePacing tractates={tractates} />

          {/* לוח מחפש חברותא - במקום להפנות החוצה, מוצא לך חברותא בתוך האפליקציה עצמה */}
          <div className="bg-white rounded-2xl border border-hairline mb-8 overflow-hidden">
            <div className="flex items-center justify-between gap-3 p-4 border-b border-hairline">
              <h3 className="text-lg font-bold text-cover flex items-center gap-2">
                <MessageSquarePlus size={20} className="text-brass" />
                לוח מחפשי חברותא
              </h3>
              {!showPostForm && (
                <button
                  onClick={() => setShowPostForm(true)}
                  className="px-4 py-1.5 bg-cover hover:bg-cover-dark text-parchment-50 text-sm font-semibold rounded-lg transition-colors"
                >
                  פרסם בקשה
                </button>
              )}
            </div>

            {showPostForm && (
              <div className="p-4 bg-parchment-50/50 border-b border-hairline flex flex-col gap-2">
                <input
                  value={postTopic}
                  onChange={(e) => setPostTopic(e.target.value)}
                  placeholder="מה תרצה ללמוד? (למשל: נזיר, או פסחים דף ל)"
                  aria-label="מה תרצה ללמוד"
                  className="w-full px-3 py-2 text-sm bg-white border border-hairline rounded-lg focus:outline-none focus:ring-2 focus:ring-brass"
                />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-ink/50 shrink-0">רמה (אופציונלי):</span>
                  {['מתחיל', 'בינוני', 'מתקדם'].map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() => setPostLevel((prev) => (prev === lvl ? '' : lvl))}
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
                        postLevel === lvl
                          ? 'bg-brass/15 border-brass text-brass-dark'
                          : 'bg-white border-hairline text-ink/50 hover:border-brass/40'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={postWhen}
                    onChange={(e) => setPostWhen(e.target.value)}
                    placeholder="מתי פנוי? (למשל: היום בערב, אופציונלי)"
                    aria-label="מתי פנוי ללמוד"
                    className="flex-1 px-3 py-2 text-sm bg-white border border-hairline rounded-lg focus:outline-none focus:ring-2 focus:ring-brass"
                  />
                  <button
                    onClick={handlePostRequest}
                    disabled={!postTopic.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 bg-cover hover:bg-cover-dark disabled:bg-slate-300 disabled:cursor-not-allowed text-parchment-50 text-sm font-semibold rounded-lg transition-colors shrink-0"
                  >
                    <Send size={14} />
                    פרסם
                  </button>
                  <button
                    onClick={() => setShowPostForm(false)}
                    className="px-3 py-2 text-ink/40 hover:text-ribbon text-sm transition-colors shrink-0"
                  >
                    ביטול
                  </button>
                </div>
              </div>
            )}

            <div className="p-4">
              {boardPosts.length === 0 ? (
                <p className="text-center text-ink/40 text-sm py-6">
                  אין כרגע בקשות פתוחות. פרסם בקשה כדי שאחרים ימצאו אותך.
                </p>
              ) : (
                <div className="space-y-2">
                  {boardPosts.map((post) => {
                    const isMine = post.posterSocketId === socket.id;
                    return (
                      <div
                        key={post.id}
                        className="flex items-center justify-between gap-3 p-3 bg-parchment-50 rounded-xl border border-hairline"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <strong className="text-ink font-classic">{post.topic}</strong>
                            {post.level && (
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-brass/10 text-brass-dark">
                                {post.level}
                              </span>
                            )}
                            {post.when && <span className="text-xs text-ink/40">· {post.when}</span>}
                          </div>
                          <span className="text-xs text-ink/40">{post.name}{isMine ? ' (אתה)' : ''}</span>
                        </div>
                        {isMine ? (
                          <button
                            onClick={() => handleRemovePost(post.id)}
                            className="text-xs font-semibold text-ink/40 hover:text-ribbon shrink-0 transition-colors"
                          >
                            בטל בקשה
                          </button>
                        ) : (
                          <button
                            onClick={() => handleClaimPost(post)}
                            className="px-3 py-1.5 bg-brass hover:bg-brass-light text-cover-dark text-sm font-bold rounded-lg shrink-0 transition-colors"
                          >
                            בוא נלמד
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* חברותאות קודמות - נשמר במכשיר הזה בלבד, לפי מי שהתאמת איתו דרך הלוח */}
          {partnersHistory.length > 0 && (
            <div className="bg-white rounded-2xl border border-hairline mb-8 p-4">
              <h3 className="flex items-center gap-2 font-bold text-cover text-sm mb-4">
                <Users size={18} className="text-brass" />
                חברותאות קודמות
              </h3>
              <div className="flex flex-wrap gap-2">
                {partnersHistory.map((p) => (
                  <div
                    key={p.name}
                    className="flex items-center gap-2 px-3 py-2 bg-parchment-50 rounded-xl border border-hairline text-sm"
                    title={`${p.topic} · ${formatRelativeTime(p.ts)}`}
                  >
                    <strong className="text-ink">{p.name}</strong>
                    <span className="text-xs text-ink/40">{formatRelativeTime(p.ts)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* החדרים שלי - נשמר במכשיר הזה בלבד */}
          {myRooms.length > 0 && (
            <div className="mb-8">
              <h3 className="text-base font-bold text-ink/70 mb-4 flex items-center gap-2 border-b border-hairline pb-3">
                <History size={18} className="text-brass" />
                החדרים שלי
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {myRooms.map((room) => (
                  <div
                    key={room.id}
                    className="group flex items-center justify-between gap-3 p-3.5 bg-white rounded-xl border border-hairline hover:border-brass hover:shadow-sm transition-all"
                  >
                    <button
                      onClick={() => handleJoinMyRoom(room)}
                      className="min-w-0 flex-1 text-right"
                      aria-label={`הצטרף לחדר: ${room.label}`}
                    >
                      <strong className="block text-base font-classic text-ink truncate">{room.label}</strong>
                      <span className="text-xs text-ink/40">{formatRelativeTime(room.ts)}</span>
                    </button>
                    <button
                      onClick={(e) => handleRemoveMyRoom(e, room.id)}
                      className="p-1.5 rounded-lg text-ink/25 hover:text-ribbon hover:bg-ribbon/10 transition-colors shrink-0"
                      aria-label={`הסר את "${room.label}" מהחדרים שלי`}
                      title="הסר מהרשימה"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* רשימת החדרים הפתוחים */}
          <div>
            <h3 className="text-base font-bold text-ink/70 mb-4 flex items-center gap-2 border-b border-hairline pb-3">
              <Users size={18} className="text-brass" />
              לומדים שמחכים לחברותא כרגע
            </h3>

            {rooms.length === 0 ? (
              <div className="text-center py-12 px-6 text-ink/50 bg-white rounded-2xl border border-dashed border-hairline">
                אין חדרים פתוחים כרגע. פתח חדר למעלה כדי להתחיל ללמוד.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rooms.map((room) => {
                  const isWaiting = !room.group && room.occupancy === 1;
                  return (
                    <button
                      key={room.id}
                      onClick={() => handleJoinExisting(room)}
                      className={`group flex items-stretch text-right bg-white rounded-xl border hover:shadow-md transition-all overflow-hidden ${
                        isWaiting ? 'border-ribbon/40 hover:border-ribbon' : 'border-hairline hover:border-brass'
                      }`}
                    >
                      {/* פס "כריכה" קטן בצד הכרטיס - מהדהד את הדר הכריכה למעלה */}
                      <div className={`w-2 transition-colors shrink-0 ${isWaiting ? 'bg-ribbon' : 'bg-cover group-hover:bg-brass'}`} />
                      <div className="flex-1 flex items-center justify-between gap-3 p-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-semibold text-brass-dark">נושא הלימוד</span>
                            <span
                              className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
                                isWaiting ? 'bg-ribbon/10 text-ribbon-dark' : 'bg-parchment-100 text-ink/50'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${isWaiting ? 'bg-ribbon animate-pulse' : 'bg-ink/30'}`}
                              />
                              {room.group
                                ? `${room.occupancy} לומדים בקבוצה`
                                : isWaiting
                                ? 'ממתין לחברותא'
                                : `${room.occupancy}/2 לומדים כרגע`}
                            </span>
                            {room.group && (
                              <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-brass/10 text-brass-dark">
                                <UsersRound size={11} />
                                קבוצה
                              </span>
                            )}
                          </div>
                          <strong className="block text-xl font-classic text-ink truncate">
                            {room.topic}
                          </strong>
                        </div>
                        <ArrowLeft
                          size={20}
                          className="text-ink/30 group-hover:text-brass group-hover:-translate-x-1 transition-all shrink-0"
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <DataBackup />
          <DonationButton />
        </div>
      </div>
      </div>
    </>
  );
};

export default Lobby;
