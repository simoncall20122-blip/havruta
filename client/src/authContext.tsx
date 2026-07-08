import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { API_URL } from './apiBase';

export interface AuthUser {
  id: number;
  email: string | null;
  name: string;
  subscriptionStatus: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  register: (email: string, password: string, name: string) => Promise<{ ok: boolean; message?: string }>;
  login: (email: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  loginWithGoogle: (idToken: string) => Promise<{ ok: boolean; message?: string }>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('havruta_token'));
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/me`, { credentials: 'include' });
      const data = await res.json();
      setUser(data.user || null);
    } catch (e) {
      console.error('[auth] שגיאה בבדיקת התחברות:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  const handleAuthResponse = (data: any): { ok: boolean; message?: string } => {
    if (data.user) {
      setUser(data.user);
      if (data.token) {
        localStorage.setItem('havruta_token', data.token);
        setToken(data.token);
      }
      return { ok: true };
    }
    return { ok: false, message: data.message || 'שגיאה לא ידועה' };
  };

  const register = async (email: string, password: string, name: string) => {
    const res = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password, name }),
    });
    const data = await res.json();
    return handleAuthResponse(data);
  };

  const login = async (email: string, password: string) => {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    return handleAuthResponse(data);
  };

  const loginWithGoogle = async (idToken: string) => {
    const res = await fetch(`${API_URL}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ idToken }),
    });
    const data = await res.json();
    return handleAuthResponse(data);
  };

  const logout = async () => {
    await fetch(`${API_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' });
    localStorage.removeItem('havruta_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, register, login, loginWithGoogle, logout, refreshMe }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth חייב לרוץ בתוך AuthProvider');
  return ctx;
}
