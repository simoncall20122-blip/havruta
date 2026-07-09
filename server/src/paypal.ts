import type { Express } from 'express';
import { pool } from './db.js';
import { attachUser, requireAuth } from './auth.js';

const PAYPAL_MODE = process.env.PAYPAL_MODE === 'live' ? 'live' : 'sandbox';
const PAYPAL_BASE = PAYPAL_MODE === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || '';
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || '';
const PAYPAL_PLAN_ID = process.env.PAYPAL_PLAN_ID || '';

async function getPaypalAccessToken(): Promise<string | null> {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) return null;
  try {
    const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
    const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    if (!res.ok) {
      console.error('[paypal] נכשל לקבל access token, סטטוס:', res.status);
      return null;
    }
    const data: any = await res.json();
    return data.access_token || null;
  } catch (e) {
    console.error('[paypal] שגיאה בקבלת access token:', e);
    return null;
  }
}

async function setSubscriptionStatus(userId: number, status: string, paypalSubId?: string) {
  if (!pool) return;
  if (paypalSubId) {
    await pool.query('UPDATE users SET subscription_status = $1, paypal_subscription_id = $2 WHERE id = $3', [status, paypalSubId, userId]);
  } else {
    await pool.query('UPDATE users SET subscription_status = $1 WHERE id = $2', [status, userId]);
  }
}

export function attachPaypalRoutes(app: Express) {
  // הגדרות ל-SDK של PayPal בצד הלקוח (client_id + plan_id הם ציבוריים בכוונה, לא סודיים)
  app.get('/api/paypal/config', (_req, res) => {
    res.json({
      clientId: PAYPAL_CLIENT_ID,
      planId: PAYPAL_PLAN_ID,
      configured: !!(PAYPAL_CLIENT_ID && PAYPAL_PLAN_ID),
      donationConfigured: !!(PAYPAL_CLIENT_ID && PAYPAL_CLIENT_SECRET),
    });
  });

  // אחרי שהמשתמש מאשר מנוי בכפתור של PayPal בצד הלקוח, מוודאים מול PayPal שהמנוי באמת פעיל
  app.post('/api/paypal/confirm-subscription', attachUser, requireAuth, async (req, res) => {
    try {
      const { subscriptionId } = req.body as { subscriptionId?: string };
      const user = (req as any).user;
      if (!subscriptionId) return res.status(400).json({ error: 'missing_subscription_id' });

      const accessToken = await getPaypalAccessToken();
      if (!accessToken) return res.status(502).json({ error: 'paypal_unavailable' });

      const subRes = await fetch(`${PAYPAL_BASE}/v1/billing/subscriptions/${subscriptionId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!subRes.ok) return res.status(502).json({ error: 'paypal_verify_failed' });
      const sub: any = await subRes.json();

      if (sub.status === 'ACTIVE') {
        await setSubscriptionStatus(user.id, 'active', subscriptionId);
        return res.json({ ok: true, status: 'active' });
      }
      res.json({ ok: false, status: sub.status });
    } catch (e) {
      console.error('[paypal] שגיאה באישור מנוי:', e);
      res.status(500).json({ error: 'server_error' });
    }
  });

  // תרומה חד-פעמית (לא מנוי) - יוצר הזמנת תשלום ב-PayPal לסכום חופשי
  app.post('/api/paypal/create-order', async (req, res) => {
    try {
      const amount = Number(req.body?.amount);
      if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'invalid_amount' });

      const accessToken = await getPaypalAccessToken();
      if (!accessToken) return res.status(502).json({ error: 'paypal_unavailable' });

      const orderRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: [{ amount: { currency_code: 'USD', value: amount.toFixed(2) }, description: 'תרומה לחברותא דיגיטלית' }],
        }),
      });
      if (!orderRes.ok) return res.status(502).json({ error: 'paypal_order_failed' });
      const order: any = await orderRes.json();
      res.json({ orderId: order.id });
    } catch (e) {
      console.error('[paypal] שגיאה ביצירת הזמנת תרומה:', e);
      res.status(500).json({ error: 'server_error' });
    }
  });

  app.post('/api/paypal/capture-order', async (req, res) => {
    try {
      const { orderId } = req.body as { orderId?: string };
      if (!orderId) return res.status(400).json({ error: 'missing_order_id' });

      const accessToken = await getPaypalAccessToken();
      if (!accessToken) return res.status(502).json({ error: 'paypal_unavailable' });

      const captureRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderId}/capture`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      });
      if (!captureRes.ok) return res.status(502).json({ error: 'paypal_capture_failed' });
      const result: any = await captureRes.json();
      res.json({ ok: result.status === 'COMPLETED', status: result.status });
    } catch (e) {
      console.error('[paypal] שגיאה באישור תרומה:', e);
      res.status(500).json({ error: 'server_error' });
    }
  });

  // Webhook - PayPal שולח לכאן עדכוני מצב מנוי (חידוש, ביטול, השעיה וכו')
  app.post('/api/paypal/webhook', async (req, res) => {
    try {
      const event = req.body as { event_type?: string; resource?: any };
      console.log('[paypal-webhook] אירוע:', event.event_type);

      const paypalSubId = event.resource?.id || event.resource?.billing_agreement_id;
      if (!paypalSubId || !pool) return res.status(200).send('ok'); // תמיד מחזירים 200 ל-PayPal גם אם אין מה לעשות

      const userResult = await pool.query('SELECT id FROM users WHERE paypal_subscription_id = $1', [paypalSubId]);
      const userId = userResult.rows[0]?.id;
      if (!userId) return res.status(200).send('ok');

      switch (event.event_type) {
        case 'BILLING.SUBSCRIPTION.ACTIVATED':
        case 'PAYMENT.SALE.COMPLETED':
          await setSubscriptionStatus(userId, 'active');
          break;
        case 'BILLING.SUBSCRIPTION.CANCELLED':
        case 'BILLING.SUBSCRIPTION.EXPIRED':
        case 'BILLING.SUBSCRIPTION.SUSPENDED':
        case 'PAYMENT.SALE.DENIED':
          await setSubscriptionStatus(userId, 'inactive');
          break;
      }
      res.status(200).send('ok');
    } catch (e) {
      console.error('[paypal-webhook] שגיאה:', e);
      res.status(200).send('ok'); // עדיין 200, אחרת PayPal ינסה שוב ושוב
    }
  });
}
