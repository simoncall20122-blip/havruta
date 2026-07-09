import { useState, useEffect } from 'react';
import { User, Star, X, LogOut, Plus, Mail, Lock } from 'lucide-react';
import { useAuth } from '../authContext';
import {
  loadPartnersHistory,
  toggleFavorite,
  updateContactNote,
  addManualFavorite,
  type PartnerEntry,
} from '../partnersHistory';

interface UserProfileProps {
  onClose: () => void;
}

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

const UserProfile = ({ onClose }: UserProfileProps) => {
  const { user, loading, login, register, logout } = useAuth();
  const [tab, setTab] = useState<'profile' | 'favorites'>('profile');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [authError, setAuthError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [partners, setPartners] = useState<PartnerEntry[]>([]);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newNote, setNewNote] = useState('');

  useEffect(() => {
    setPartners(loadPartnersHistory());
  }, []);

  const handleAuthSubmit = async () => {
    setAuthError('');
    if (!email.trim() || !password.trim() || (mode === 'register' && !name.trim())) {
      setAuthError('נא למלא את כל השדות');
      return;
    }
    setSubmitting(true);
    const result = mode === 'login' ? await login(email.trim(), password) : await register(email.trim(), password, name.trim());
    setSubmitting(false);
    if (!result.ok) setAuthError(result.message || 'שגיאה');
  };

  const handleToggleFavorite = (partnerName: string) => {
    toggleFavorite(partnerName);
    setPartners(loadPartnersHistory());
  };

  const handleSaveNote = (partnerName: string) => {
    updateContactNote(partnerName, noteDraft.trim());
    setPartners(loadPartnersHistory());
    setEditingNote(null);
  };

  const handleAddManual = () => {
    if (!newName.trim()) return;
    addManualFavorite(newName.trim(), newNote.trim());
    setPartners(loadPartnersHistory());
    setNewName('');
    setNewNote('');
    setShowAddForm(false);
  };

  const favorites = partners.filter((p) => p.favorite);
  const others = partners.filter((p) => !p.favorite);

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-parchment-50 rounded-2xl shadow-2xl border border-hairline max-w-md w-full max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-hairline shrink-0">
          <h2 className="flex items-center gap-2 font-bold text-cover text-lg">
            <User size={20} className="text-brass" />
            הפרופיל שלי
          </h2>
          <button onClick={onClose} aria-label="סגור פרופיל" className="text-ink/40 hover:text-ribbon transition-colors">
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-ink/40 text-sm">טוען...</div>
        ) : !user ? (
          <div className="p-6 flex flex-col gap-3">
            <div className="flex bg-parchment-100 rounded-lg p-1 text-sm w-fit mx-auto">
              <button
                onClick={() => setMode('login')}
                className={`px-4 py-1.5 rounded-md font-semibold transition-colors ${mode === 'login' ? 'bg-white text-cover shadow-sm' : 'text-ink/50'}`}
              >
                התחברות
              </button>
              <button
                onClick={() => setMode('register')}
                className={`px-4 py-1.5 rounded-md font-semibold transition-colors ${mode === 'register' ? 'bg-white text-cover shadow-sm' : 'text-ink/50'}`}
              >
                הרשמה
              </button>
            </div>
            {mode === 'register' && (
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="שם מלא"
                className="px-3 py-2 border border-hairline rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brass"
              />
            )}
            <div className="relative">
              <Mail size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/30" />
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="אימייל"
                className="w-full pr-9 pl-3 py-2 border border-hairline rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brass"
              />
            </div>
            <div className="relative">
              <Lock size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/30" />
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="סיסמה"
                onKeyDown={(e) => e.key === 'Enter' && handleAuthSubmit()}
                className="w-full pr-9 pl-3 py-2 border border-hairline rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brass"
              />
            </div>
            {authError && <p className="text-xs text-ribbon-dark">{authError}</p>}
            <button
              onClick={handleAuthSubmit}
              disabled={submitting}
              className="px-4 py-2 bg-cover hover:bg-cover-dark disabled:opacity-50 text-parchment-50 text-sm font-semibold rounded-lg transition-colors"
            >
              {mode === 'login' ? 'התחבר' : 'הירשם'}
            </button>
          </div>
        ) : (
          <>
            <div className="flex border-b border-hairline shrink-0">
              <button
                onClick={() => setTab('profile')}
                className={`flex-1 py-3 text-sm font-semibold transition-colors ${tab === 'profile' ? 'text-cover border-b-2 border-brass' : 'text-ink/40'}`}
              >
                הפרופיל שלי
              </button>
              <button
                onClick={() => setTab('favorites')}
                className={`flex-1 py-3 text-sm font-semibold transition-colors ${tab === 'favorites' ? 'text-cover border-b-2 border-brass' : 'text-ink/40'}`}
              >
                חברותאות מועדפות
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {tab === 'profile' ? (
                <div className="flex flex-col gap-4">
                  <div>
                    <span className="block text-xs text-ink/40 mb-1">שם</span>
                    <strong className="text-ink">{user.name}</strong>
                  </div>
                  {user.email && (
                    <div>
                      <span className="block text-xs text-ink/40 mb-1">אימייל</span>
                      <strong className="text-ink">{user.email}</strong>
                    </div>
                  )}
                  <div>
                    <span className="block text-xs text-ink/40 mb-1">סטטוס מנוי</span>
                    <span
                      className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${
                        user.subscriptionStatus === 'active' ? 'bg-cover/10 text-cover' : 'bg-hairline text-ink/50'
                      }`}
                    >
                      {user.subscriptionStatus === 'active' ? 'מנוי פעיל' : 'ללא מנוי פעיל'}
                    </span>
                  </div>
                  <button
                    onClick={logout}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-ribbon-dark hover:text-ribbon transition-colors w-fit"
                  >
                    <LogOut size={15} />
                    התנתק
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-5">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-brass-dark">מועדפים</span>
                      <button
                        onClick={() => setShowAddForm((v) => !v)}
                        className="flex items-center gap-1 text-xs font-semibold text-cover hover:text-cover-dark"
                      >
                        <Plus size={13} />
                        הוסף ידנית
                      </button>
                    </div>

                    {showAddForm && (
                      <div className="flex flex-col gap-2 mb-3 p-3 bg-white rounded-xl border border-hairline">
                        <input
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          placeholder="שם"
                          className="px-3 py-1.5 text-sm border border-hairline rounded-lg focus:outline-none focus:ring-2 focus:ring-brass"
                        />
                        <input
                          value={newNote}
                          onChange={(e) => setNewNote(e.target.value)}
                          placeholder="פרטי קשר (טלפון/אימייל, אופציונלי)"
                          className="px-3 py-1.5 text-sm border border-hairline rounded-lg focus:outline-none focus:ring-2 focus:ring-brass"
                        />
                        <button
                          onClick={handleAddManual}
                          className="px-3 py-1.5 bg-cover hover:bg-cover-dark text-parchment-50 text-xs font-semibold rounded-lg self-start"
                        >
                          הוסף למועדפים
                        </button>
                      </div>
                    )}

                    {favorites.length === 0 ? (
                      <p className="text-xs text-ink/40">אין עדיין חברותאות מועדפות. סמן כוכב על מישהו מהרשימה למטה, או הוסף ידנית.</p>
                    ) : (
                      <div className="space-y-2">
                        {favorites.map((p) => (
                          <div key={p.name} className="p-3 bg-white rounded-xl border border-brass/30">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <strong className="text-ink text-sm">{p.name}</strong>
                              <button onClick={() => handleToggleFavorite(p.name)} aria-label={`הסר ${p.name} מהמועדפים`}>
                                <Star size={16} className="text-brass fill-brass" />
                              </button>
                            </div>
                            {editingNote === p.name ? (
                              <div className="flex gap-1.5">
                                <input
                                  value={noteDraft}
                                  onChange={(e) => setNoteDraft(e.target.value)}
                                  onKeyDown={(e) => e.key === 'Enter' && handleSaveNote(p.name)}
                                  placeholder="טלפון / אימייל / הערה"
                                  className="flex-1 px-2 py-1 text-xs border border-hairline rounded-lg focus:outline-none focus:ring-2 focus:ring-brass"
                                  autoFocus
                                />
                                <button onClick={() => handleSaveNote(p.name)} className="text-xs font-semibold text-cover">
                                  שמור
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setEditingNote(p.name);
                                  setNoteDraft(p.contactNote || '');
                                }}
                                className="text-xs text-ink/50 hover:text-brass-dark text-right w-full"
                              >
                                {p.contactNote || 'הוסף פרטי קשר...'}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {others.length > 0 && (
                    <div>
                      <span className="block text-xs font-semibold text-ink/50 mb-2">חברותאות אחרונות</span>
                      <div className="space-y-1.5">
                        {others.map((p) => (
                          <div key={p.name} className="flex items-center justify-between gap-2 p-2.5 bg-white rounded-xl border border-hairline">
                            <div className="min-w-0">
                              <strong className="text-ink text-sm">{p.name}</strong>
                              <span className="text-xs text-ink/40 mr-2">{formatRelativeTime(p.ts)}</span>
                            </div>
                            <button onClick={() => handleToggleFavorite(p.name)} aria-label={`הוסף ${p.name} למועדפים`}>
                              <Star size={16} className="text-ink/25 hover:text-brass transition-colors" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default UserProfile;
