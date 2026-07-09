import { useState, useEffect, useRef } from 'react';
import { Heart, Loader2 } from 'lucide-react';
import { API_URL } from '../apiBase';

declare global {
  interface Window {
    paypal?: any;
  }
}

const AMOUNTS = [5, 18, 36, 100];

const DonationButton = () => {
  const [donationConfigured, setDonationConfigured] = useState(false);
  const [clientId, setClientId] = useState('');
  const [amount, setAmount] = useState(18);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<'idle' | 'processing' | 'done' | 'error'>('idle');
  const btnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/paypal/config`)
      .then((res) => res.json())
      .then((data) => {
        setDonationConfigured(!!data.donationConfigured);
        setClientId(data.clientId || '');
      })
      .catch(() => setDonationConfigured(false));
  }, []);

  useEffect(() => {
    if (!open || !clientId || !btnRef.current) return;
    btnRef.current.innerHTML = '';
    setStatus('idle');

    const script = document.createElement('script');
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD`;
    script.onload = () => {
      if (!window.paypal || !btnRef.current) return;
      window.paypal
        .Buttons({
          style: { shape: 'pill', color: 'gold', layout: 'horizontal', label: 'donate', height: 40 },
          createOrder: async () => {
            const res = await fetch(`${API_URL}/api/paypal/create-order`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ amount }),
            });
            const data = await res.json();
            return data.orderId;
          },
          onApprove: async (data: any) => {
            setStatus('processing');
            const res = await fetch(`${API_URL}/api/paypal/capture-order`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ orderId: data.orderID }),
            });
            const result = await res.json();
            setStatus(result.ok ? 'done' : 'error');
          },
          onError: () => setStatus('error'),
        })
        .render(btnRef.current);
    };
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clientId, amount]);

  if (!donationConfigured) return null;

  return (
    <div className="bg-white rounded-2xl border border-hairline mb-8 p-4">
      <h3 className="flex items-center gap-2 font-bold text-cover text-sm mb-1">
        <Heart size={18} className="text-ribbon" />
        לתמוך בפרויקט
      </h3>
      <p className="text-xs text-ink/50 mb-4">אם האפליקציה עוזרת לך ללמוד, תרומה חד-פעמית (לא מנוי) עוזרת להמשיך לתחזק אותה.</p>

      {status === 'done' ? (
        <p className="text-sm text-cover font-semibold">תודה רבה על התרומה! 🙏</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-3">
            {AMOUNTS.map((a) => (
              <button
                key={a}
                onClick={() => {
                  setAmount(a);
                  setOpen(true);
                }}
                className={`px-3.5 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
                  amount === a && open ? 'bg-brass/15 border-brass text-brass-dark' : 'bg-parchment-50 border-hairline text-ink/60 hover:border-brass/40'
                }`}
              >
                ${a}
              </button>
            ))}
          </div>
          {open ? (
            status === 'processing' ? (
              <div className="flex items-center gap-2 text-ink/40 text-sm">
                <Loader2 size={14} className="animate-spin" />
                מעבד תרומה...
              </div>
            ) : (
              <div ref={btnRef} className="max-w-xs" />
            )
          ) : (
            <p className="text-xs text-ink/40">בחר סכום כדי להמשיך לתשלום.</p>
          )}
          {status === 'error' && <p className="text-xs text-ribbon-dark mt-2">משהו השתבש, נסה שוב.</p>}
        </>
      )}
    </div>
  );
};

export default DonationButton;
