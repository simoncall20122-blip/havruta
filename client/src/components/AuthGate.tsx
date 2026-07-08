import { useState, useEffect, useRef, type ReactNode } from 'react';
import { useAuth } from '../authContext';
import { API_URL } from '../apiBase';
import { Loader2, Mail, Lock, User as UserIcon } from 'lucide-react';

declare global {
  interface Window {
    google?: any;
    paypal?: any;
  }
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

const AuthGate = ({ children }: { children: ReactNode }) => {
  const { user, token, loading, register, login, loginWithGoogle, refreshMe } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  const [paypalConfig, setPaypalConfig] = useState<{ clientId: string; planId: string; configured: boolean } | null>(null);
  const [subLoading, setSubLoading] = useState(false);
  const paypalBtnRef = useRef<HTMLDivElement>(null);

  // התחברות עם Google (Google Identity Services)
  useEffect(() => {
    if (user || !GOOGLE_CLIENT_ID) return;
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      if (!window.google || !googleBtnRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response: { credential: string }) => {
          const result = await loginWithGoogle(response.credential);
          if (!result.ok) setError(result.message || 'שגיאה בהתחברות עם Google');
        },
      });
      window.google.accounts.id.renderButton(googleBtnRef.current, { theme: 'outline', size: 'large', width: 260 });
    };
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, [user, loginWithGoogle]);

  // טעינת הגדרות PayPal + כפתור המנוי, רק אחרי שיש משתמש מחובר שעדיין לא במנוי
  useEffect(() => {
    if (!user || user.subscriptionStatus === 'active') return;
    fetch(`${API_URL}/api/paypal/config`)
      .then((res) => res.json())
      .then(setPaypalConfig)
      .catch((e) => console.error('[paypal] שגיאה בטעינת הגדרות:', e));
  }, [user]);

  useEffect(() => {
    if (!paypalConfig?.configured || !paypalBtnRef.current || !user || user.subscriptionStatus === 'active') return;
    const script = document.createElement('script');
    script.src = `https://www.paypal.com/sdk/js?client-id=${paypalConfig.clientId}&vault=true&intent=subscription`;
    script.onload = () => {
      if (!window.paypal || !paypalBtnRef.current) return;
      window.paypal
        .Buttons({
          style: { shape: 'pill', color: 'gold', layout: 'vertical', label: 'subscribe' },
          createSubscription: (_data: any, actions: any) =>
            actions.subscription.create({ plan_id: paypalConfig.planId }),
          onApprove: async (data: any) => {
            setSubLoading(true);
            try {
              const res = await fetch(`${API_URL}/api/paypal/confirm-subscription`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                credentials: 'include',
                body: JSON.stringify({ subscriptionId: data.subscriptionID }),
              });
              const result = await res.json();
              if (result.ok) await refreshMe();
              else setError('המנוי טרם אושר במלואו - נסה לרענן בעוד רגע.');
            } finally {
              setSubLoading(false);
            }
          },
        })
        .render(paypalBtnRef.current);
    };
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, [paypalConfig, user, token, refreshMe]);

  const handleSubmit = async () => {
    setError('');
    if (!email.trim() || !password.trim() || (mode === 'register' && !name.trim())) {
      setError('נא למלא את כל השדות');
      return;
    }
    setSubmitting(true);
    const result = mode === 'login' ? await login(email.trim(), password) : await register(email.trim(), password, name.trim());
    setSubmitting(false);
    if (!result.ok) setError(result.message || 'שגיאה');
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-ink/40 gap-2">
        <Loader2 size={20} className="animate-spin" />
        טוען...
      </div>
    );
  }

  // שלב 1 - לא מחובר בכלל
  if (!user) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-sm text-ink/60">כדי לדבר עם חברותא ה-AI, צריך להתחבר קודם</p>

        <div className="flex bg-parchment-100 rounded-lg p-1 text-sm">
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

        <div className="w-full max-w-xs flex flex-col gap-2">
          {mode === 'register' && (
            <div className="relative">
              <UserIcon size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/30" />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="שם מלא"
                className="w-full pr-9 pl-3 py-2 border border-hairline rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brass"
              />
            </div>
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
              placeholder="סיסמה (לפחות 6 תווים)"
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              className="w-full pr-9 pl-3 py-2 border border-hairline rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brass"
            />
          </div>
          {error && <p className="text-xs text-ribbon-dark">{error}</p>}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-2 bg-cover hover:bg-cover-dark disabled:opacity-50 text-parchment-50 text-sm font-semibold rounded-lg transition-colors"
          >
            {mode === 'login' ? 'התחבר' : 'הירשם'}
          </button>
        </div>

        {GOOGLE_CLIENT_ID && (
          <>
            <span className="text-xs text-ink/30">או</span>
            <div ref={googleBtnRef} />
          </>
        )}
      </div>
    );
  }

  // שלב 2 - מחובר אבל אין מנוי פעיל
  if (user.subscriptionStatus !== 'active') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-sm text-ink/70">שלום {user.name}! חברותא ה-AI זמינה במנוי חודשי.</p>
        {subLoading ? (
          <div className="flex items-center gap-2 text-ink/40 text-sm">
            <Loader2 size={16} className="animate-spin" />
            מאשר מנוי...
          </div>
        ) : paypalConfig?.configured ? (
          <div ref={paypalBtnRef} className="w-full max-w-xs" />
        ) : (
          <p className="text-xs text-ink/40">תשלום עדיין לא הוגדר במערכת.</p>
        )}
        {error && <p className="text-xs text-ribbon-dark">{error}</p>}
      </div>
    );
  }

  // שלב 3 - מחובר ובמנוי פעיל
  return <>{children}</>;
};

export default AuthGate;
