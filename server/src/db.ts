import pg from 'pg';

const { Pool } = pg;

// DATABASE_URL מוזרק אוטומטית על ידי Railway כשמצרפים שירות PostgreSQL לפרויקט
export const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : null;

export async function initDb() {
  if (!pool) {
    console.warn('[db] DATABASE_URL לא מוגדר - חשבונות משתמשים/תשלומים לא יעבדו עד שיתווסף DB');
    return;
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE,
      password_hash TEXT,
      google_id TEXT UNIQUE,
      name TEXT NOT NULL,
      subscription_status TEXT NOT NULL DEFAULT 'none',
      paypal_subscription_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  console.log('[db] מחובר ל-PostgreSQL, טבלאות מוכנות');
}
