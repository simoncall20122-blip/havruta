import type { Express, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { pool } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || (() => {
  console.warn('[auth] JWT_SECRET לא מוגדר בסביבה - משתמש בסוד זמני (משתמשים ינותקו בכל הפעלה מחדש של השרת). חשוב להגדיר משתנה סביבה אמיתי!');
  return 'dev-only-insecure-secret-' + Math.random();
})();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

export interface AuthedUser {
  id: number;
  email: string | null;
  name: string;
  subscriptionStatus: string;
}

function signToken(userId: number): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
}

export function verifyToken(token: string): { userId: number } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: number };
  } catch {
    return null;
  }
}

async function getUserById(id: number): Promise<AuthedUser | null> {
  if (!pool) return null;
  const result = await pool.query(
    'SELECT id, email, name, subscription_status FROM users WHERE id = $1',
    [id]
  );
  const row = result.rows[0];
  if (!row) return null;
  return { id: row.id, email: row.email, name: row.name, subscriptionStatus: row.subscription_status };
}

// עוזר לשימוש מחוץ ל-Express (למשל בתוך handler של socket.io) - מוודא טוקן ומחזיר את המשתמש
export async function getUserFromToken(token: string): Promise<AuthedUser | null> {
  const decoded = verifyToken(token);
  if (!decoded) return null;
  return getUserById(decoded.userId);
}

function setAuthCookie(res: Response, token: string) {
  res.cookie('havruta_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 יום
  });
}

// Middleware - מצרף req.user אם יש טוקן תקין (בקוקי או ב-Authorization header)
export async function attachUser(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.havruta_token || req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    const user = await getUserFromToken(token);
    if (user) (req as any).user = user;
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!(req as any).user) {
    return res.status(401).json({ error: 'not_authenticated' });
  }
  next();
}

export function attachAuthRoutes(app: Express) {
  app.post('/api/auth/register', async (req, res) => {
    if (!pool) return res.status(503).json({ error: 'db_not_configured' });
    try {
      const { email, password, name } = req.body as { email?: string; password?: string; name?: string };
      if (!email || !password || password.length < 6) {
        return res.status(400).json({ error: 'invalid_input', message: 'צריך אימייל וסיסמה של לפחות 6 תווים' });
      }
      const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'email_taken', message: 'כבר קיים חשבון עם האימייל הזה' });
      }
      const passwordHash = await bcrypt.hash(password, 10);
      const result = await pool.query(
        'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id',
        [email.toLowerCase().trim(), passwordHash, String(name || email.split('@')[0]).slice(0, 60)]
      );
      const token = signToken(result.rows[0].id);
      setAuthCookie(res, token);
      const user = await getUserById(result.rows[0].id);
      res.json({ user, token });
    } catch (e) {
      console.error('[auth] שגיאה בהרשמה:', e);
      res.status(500).json({ error: 'server_error' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    if (!pool) return res.status(503).json({ error: 'db_not_configured' });
    try {
      const { email, password } = req.body as { email?: string; password?: string };
      if (!email || !password) return res.status(400).json({ error: 'invalid_input' });
      const result = await pool.query('SELECT id, password_hash FROM users WHERE email = $1', [email.toLowerCase().trim()]);
      const row = result.rows[0];
      if (!row || !row.password_hash || !(await bcrypt.compare(password, row.password_hash))) {
        return res.status(401).json({ error: 'invalid_credentials', message: 'אימייל או סיסמה שגויים' });
      }
      const token = signToken(row.id);
      setAuthCookie(res, token);
      const user = await getUserById(row.id);
      res.json({ user, token });
    } catch (e) {
      console.error('[auth] שגיאה בהתחברות:', e);
      res.status(500).json({ error: 'server_error' });
    }
  });

  // התחברות עם Google - הלקוח שולח ID token שהתקבל מ-Google Identity Services
  app.post('/api/auth/google', async (req, res) => {
    if (!pool) return res.status(503).json({ error: 'db_not_configured' });
    if (!googleClient) return res.status(503).json({ error: 'google_not_configured' });
    try {
      const { idToken } = req.body as { idToken?: string };
      if (!idToken) return res.status(400).json({ error: 'missing_id_token' });

      const ticket = await googleClient.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID });
      const payload = ticket.getPayload();
      if (!payload?.sub || !payload.email) return res.status(401).json({ error: 'invalid_google_token' });

      const existing = await pool.query('SELECT id FROM users WHERE google_id = $1 OR email = $2', [payload.sub, payload.email.toLowerCase()]);
      let userId: number;
      if (existing.rows.length > 0) {
        userId = existing.rows[0].id;
        await pool.query('UPDATE users SET google_id = $1 WHERE id = $2', [payload.sub, userId]);
      } else {
        const result = await pool.query(
          'INSERT INTO users (email, google_id, name) VALUES ($1, $2, $3) RETURNING id',
          [payload.email.toLowerCase(), payload.sub, payload.name || payload.email.split('@')[0]]
        );
        userId = result.rows[0].id;
      }
      const token = signToken(userId);
      setAuthCookie(res, token);
      const user = await getUserById(userId);
      res.json({ user, token });
    } catch (e) {
      console.error('[auth] שגיאה בהתחברות עם Google:', e);
      res.status(500).json({ error: 'server_error' });
    }
  });

  app.get('/api/auth/me', attachUser, async (req, res) => {
    const user = (req as any).user || null;
    res.json({ user });
  });

  app.post('/api/auth/logout', (_req, res) => {
    res.clearCookie('havruta_token');
    res.json({ ok: true });
  });
}
