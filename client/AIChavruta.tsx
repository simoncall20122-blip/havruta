import { useState, useEffect } from 'react';
import { BookOpen, Sparkles, MessageSquarePlus, GraduationCap, X } from 'lucide-react';

const STEPS = [
  {
    icon: BookOpen,
    title: 'ברוכים הבאים לחברותא דיגיטלית',
    text: 'בית מדרש וירטואלי - לומדים גמרא ביחד, בזמן אמת, מכל מקום. בואו נכיר בקצרה כמה דברים מרכזיים.',
  },
  {
    icon: MessageSquarePlus,
    title: 'פתיחת לימוד',
    text: 'תוכלו לפתוח חדר לימוד עם ראה מקום ספציפי, לפרסם בקשה בלוח מחפשי חברותא, או פשוט ללחוץ "תפתיע אותי" לגילוי.',
  },
  {
    icon: Sparkles,
    title: 'חברותא AI',
    text: 'אם אין לכם עם מי ללמוד כרגע, אפשר ללמוד עם חברותא AI - שותף לימוד וירטואלי שמכיר את הדף שאתם עליו.',
  },
  {
    icon: GraduationCap,
    title: 'מעקב התקדמות',
    text: 'האפליקציה עוקבת אוטומטית אחרי הדפים שלמדתם, שומרת סטטיסטיקות, ומראה איזו מסכת כבר סיימתם.',
  },
];

const ONBOARDING_KEY = 'havruta_onboarding_seen';

const OnboardingTour = () => {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!localStorage.getItem(ONBOARDING_KEY)) {
      setVisible(true);
    }
  }, []);

  const close = () => {
    localStorage.setItem(ONBOARDING_KEY, '1');
    setVisible(false);
  };

  if (!visible) return null;

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 bg-ink/50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-parchment-50 rounded-2xl shadow-2xl border border-hairline max-w-sm w-full p-6 relative">
        <button onClick={close} className="absolute top-3 left-3 text-ink/30 hover:text-ribbon transition-colors" aria-label="סגור סיור">
          <X size={18} />
        </button>

        <div className="w-14 h-14 bg-cover rounded-full flex items-center justify-center mx-auto mb-4">
          <Icon size={26} className="text-brass-light" />
        </div>
        <h2 className="text-lg font-bold text-cover text-center mb-2">{current.title}</h2>
        <p className="text-sm text-ink/70 text-center leading-relaxed mb-6">{current.text}</p>

        <div className="flex items-center justify-center gap-1.5 mb-4">
          {STEPS.map((_, i) => (
            <span key={i} className={`w-2 h-2 rounded-full transition-colors ${i === step ? 'bg-brass' : 'bg-hairline'}`} />
          ))}
        </div>

        <div className="flex gap-2">
          <button onClick={close} className="flex-1 px-4 py-2 text-sm font-semibold text-ink/50 hover:text-ink transition-colors">
            דלג
          </button>
          <button
            onClick={() => (isLast ? close() : setStep((s) => s + 1))}
            className="flex-1 px-4 py-2 bg-cover hover:bg-cover-dark text-parchment-50 text-sm font-semibold rounded-lg transition-colors"
          >
            {isLast ? 'בואו נתחיל' : 'הבא'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingTour;
