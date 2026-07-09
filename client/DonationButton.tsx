import { useState, useRef } from 'react';
import { DatabaseBackup, Download, Upload, Loader2 } from 'lucide-react';
import { exportAllData, importAllData } from '../backup';

const DataBackup = () => {
  const [confirming, setConfirming] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    exportAllData();
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setConfirming(true);
    e.target.value = ''; // מאפשר לבחור שוב את אותו קובץ בפעם הבאה
  };

  const handleConfirmImport = async () => {
    if (!pendingFile) return;
    setImporting(true);
    setStatus(null);
    try {
      const text = await pendingFile.text();
      const result = importAllData(text);
      setStatus(result);
      if (result.ok) {
        setTimeout(() => window.location.reload(), 1500); // רענון כדי שכל הרכיבים יטענו את הנתונים המשוחזרים
      }
    } finally {
      setImporting(false);
      setConfirming(false);
      setPendingFile(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-hairline mb-8 p-4">
      <h3 className="flex items-center gap-2 font-bold text-cover text-sm mb-1">
        <DatabaseBackup size={18} className="text-brass" />
        גיבוי ושחזור נתונים
      </h3>
      <p className="text-xs text-ink/50 mb-4">
        ההערות, ההתקדמות במסכתות, תיעוד הלימוד והסטטיסטיקות שלך נשמרים רק במכשיר הזה. גבה אותם כדי לא לאבד אותם.
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-cover hover:bg-cover-dark text-parchment-50 text-sm font-semibold rounded-lg transition-colors"
        >
          <Download size={15} />
          ייצא גיבוי
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-parchment-50 hover:bg-brass/10 border border-hairline text-ink/70 text-sm font-semibold rounded-lg transition-colors"
        >
          <Upload size={15} />
          שחזר מגיבוי
        </button>
        <input ref={fileInputRef} type="file" accept="application/json" onChange={handleFileSelected} className="hidden" />
      </div>

      {status && (
        <p className={`text-sm mt-3 ${status.ok ? 'text-cover' : 'text-ribbon-dark'}`}>
          {status.message}
          {status.ok && ' הדף ייטען מחדש כדי להציג את הנתונים המשוחזרים...'}
        </p>
      )}

      {confirming && (
        <div className="fixed inset-0 z-50 bg-ink/40 flex items-center justify-center p-4" onClick={() => setConfirming(false)}>
          <div className="bg-parchment-50 rounded-2xl shadow-2xl border border-hairline max-w-sm w-full p-5" onClick={(e) => e.stopPropagation()}>
            <h4 className="font-bold text-cover mb-2">לשחזר מהגיבוי?</h4>
            <p className="text-sm text-ink/70 mb-4">
              זה יחליף את הנתונים הקיימים במכשיר הזה (הערות, התקדמות, סטטיסטיקות) בנתונים מתוך קובץ הגיבוי. אי אפשר לבטל את זה.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirming(false)}
                className="px-4 py-2 text-sm font-semibold text-ink/50 hover:text-ink transition-colors"
              >
                ביטול
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={importing}
                className="flex items-center gap-1.5 px-4 py-2 bg-ribbon hover:bg-ribbon-dark disabled:opacity-50 text-parchment-50 text-sm font-semibold rounded-lg transition-colors"
              >
                {importing && <Loader2 size={14} className="animate-spin" />}
                כן, שחזר והחלף
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataBackup;
