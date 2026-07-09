import { useState, useEffect } from 'react';
import { LayoutDashboard, Loader2, Lock } from 'lucide-react';
import { API_URL } from '../apiBase';

interface AdminStats {
  totalRoomsCreated: number;
  totalAiMessages: number;
  currentActiveRooms: number;
  totalUsers: number;
  activeSubscriptions: number;
  dbConfigured: boolean;
}

const AdminDashboard = () => {
  const [secret, setSecret] = useState(() => sessionStorage.getItem('havruta_admin_secret') || '');
  const [inputSecret, setInputSecret] = useState('');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchStats = async (s: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/admin/stats?secret=${encodeURIComponent(s)}`);
      if (!res.ok) {
        setError('סוד שגוי, או שהשרת עדיין לא מוגדר עם ADMIN_SECRET.');
        setStats(null);
        return;
      }
      const data = await res.json();
      setStats(data);
      sessionStorage.setItem('havruta_admin_secret', s);
      setSecret(s);
    } catch {
      setError('שגיאה בחיבור לשרת.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (secret) fetchStats(secret);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!secret || error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-parchment-100 p-4" dir="rtl">
        <div className="bg-white rounded-2xl border border-hairline shadow-xl p-6 max-w-sm w-full">
          <h1 className="flex items-center gap-2 font-bold text-cover text-lg mb-4">
            <Lock size={20} className="text-brass" />
            דשבורד ניהול
          </h1>
          <input
            type="password"
            value={inputSecret}
            onChange={(e) => setInputSecret(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchStats(inputSecret)}
            placeholder="סוד ניהול (ADMIN_SECRET)"
            className="w-full px-3 py-2 border border-hairline rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-brass"
          />
          <button
            onClick={() => fetchStats(inputSecret)}
            disabled={loading || !inputSecret}
            className="w-full px-4 py-2 bg-cover hover:bg-cover-dark disabled:opacity-50 text-parchment-50 font-semibold rounded-lg transition-colors"
          >
            {loading ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'כניסה'}
          </button>
          {error && <p className="text-sm text-ribbon-dark mt-3">{error}</p>}
        </div>
      </div>
    );
  }

  const tiles = stats
    ? [
        { label: 'חדרים שנפתחו (סה"כ)', value: stats.totalRoomsCreated },
        { label: 'חדרים פעילים כרגע', value: stats.currentActiveRooms },
        { label: 'הודעות AI (סה"כ)', value: stats.totalAiMessages },
        { label: 'משתמשים רשומים', value: stats.dbConfigured ? stats.totalUsers : 'אין DB' },
        { label: 'מנויים פעילים', value: stats.dbConfigured ? stats.activeSubscriptions : 'אין DB' },
      ]
    : [];

  return (
    <div className="min-h-screen bg-parchment-100 p-6" dir="rtl">
      <div className="max-w-3xl mx-auto">
        <h1 className="flex items-center gap-2 font-bold text-cover text-2xl mb-6">
          <LayoutDashboard size={26} className="text-brass" />
          דשבורד ניהול
        </h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {tiles.map((t) => (
            <div key={t.label} className="bg-white rounded-2xl border border-hairline p-5 text-center">
              <div className="text-3xl font-bold text-cover mb-1">{t.value}</div>
              <div className="text-sm text-ink/50">{t.label}</div>
            </div>
          ))}
        </div>
        <button
          onClick={() => fetchStats(secret)}
          className="mt-6 text-sm font-semibold text-brass-dark hover:text-brass transition-colors"
        >
          רענן נתונים
        </button>
      </div>
    </div>
  );
};

export default AdminDashboard;
