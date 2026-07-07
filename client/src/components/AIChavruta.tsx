import { useEffect, useRef, useState } from 'react';
import { socket } from '../socket';
import { Sparkles, Send, Loader2, FileText, HelpCircle } from 'lucide-react';

interface AIChavrutaProps {
  roomId: string;
  chatName: string;
}

interface AiTurn {
  role: 'user' | 'assistant';
  content: string;
  name?: string;
}

const SUMMARY_PROMPT =
  'תמצת לי את הסוגיה הזו בצורה מובנית: רקע קצר, מחלוקת (אם יש - אחרת דלג על החלק הזה), ומסקנה. בקצרה, לא הרצאה.';
const QUIZ_PROMPT = 'תן לי 2-3 שאלות הבנה קצרות על הסוגיה הזו, בלי התשובות - אני אנסה לענות ואתה תגיד לי אם צדקתי.';

const AIChavruta = ({ roomId, chatName }: AIChavrutaProps) => {
  const [messages, setMessages] = useState<AiTurn[]>([]);
  const [draft, setDraft] = useState('');
  const [waiting, setWaiting] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    socket.emit('join_room', roomId);
    socket.emit('request_room_status', roomId); // ה-ai_history מגיע כחלק ממצב החדר

    socket.on('ai_history', (history: AiTurn[]) => {
      setMessages(history);
    });

    socket.on('ai_chat_message', (turn: AiTurn) => {
      setMessages((prev) => [...prev, turn]);
      if (turn.role === 'assistant') setWaiting(false);
    });

    return () => {
      socket.off('ai_history');
      socket.off('ai_chat_message');
    };
  }, [roomId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, waiting]);

  const sendMessage = (message: string) => {
    socket.emit('ai_message', { roomId, name: chatName || 'לומד', message });
    setWaiting(true);
  };

  const handleSend = () => {
    if (!draft.trim()) return;
    sendMessage(draft.trim());
    setDraft('');
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-hairline shrink-0 overflow-x-auto">
        <button
          onClick={() => sendMessage(SUMMARY_PROMPT)}
          disabled={waiting}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold bg-parchment-100 text-brass-dark hover:bg-brass/15 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0 whitespace-nowrap"
        >
          <FileText size={13} />
          תמצת את הסוגיה
        </button>
        <button
          onClick={() => sendMessage(QUIZ_PROMPT)}
          disabled={waiting}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold bg-parchment-100 text-brass-dark hover:bg-brass/15 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0 whitespace-nowrap"
        >
          <HelpCircle size={13} />
          בחן אותי
        </button>
      </div>
      <div
        className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-0"
        role="log"
        aria-live="polite"
        aria-label="שיחה עם חברותא AI"
      >
        {messages.length === 0 ? (
          <div className="text-center text-ink/40 text-sm py-10 px-6 flex flex-col items-center gap-2">
            <Sparkles size={22} className="text-brass/60" />
            שאל את חברותא ה-AI על הסוגיה, בקש הסבר על מפרש, או תן לו לאתגר אותך עם שאלה.
          </div>
        ) : (
          messages.map((m, i) => {
            const isAssistant = m.role === 'assistant';
            return (
              <div
                key={i}
                className={`max-w-[85%] px-3.5 py-2 rounded-xl text-sm leading-relaxed ${
                  isAssistant
                    ? 'bg-parchment-100 text-ink ml-auto rounded-bl-sm border border-brass/20'
                    : 'bg-cover text-parchment-50 mr-auto rounded-br-sm'
                }`}
              >
                {isAssistant ? (
                  <div className="flex items-center gap-1 text-xs font-bold text-brass-dark mb-0.5">
                    <Sparkles size={12} />
                    חברותא AI
                  </div>
                ) : (
                  m.name && m.name !== chatName && (
                    <div className="text-xs font-bold text-parchment-50/70 mb-0.5">{m.name}</div>
                  )
                )}
                <div className="whitespace-pre-wrap break-words">{m.content}</div>
              </div>
            );
          })
        )}
        {waiting && (
          <div className="flex items-center gap-2 text-ink/40 text-xs px-1">
            <Loader2 size={13} className="animate-spin" />
            חברותא ה-AI חושב...
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="p-2.5 border-t border-hairline flex gap-2 shrink-0">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="שאל משהו על הסוגיה..."
          aria-label="שאל את חברותא ה-AI"
          className="flex-1 px-3 py-2.5 border border-hairline rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brass"
        />
        <button
          onClick={handleSend}
          className="px-3 py-2.5 bg-cover hover:bg-cover-dark text-parchment-50 rounded-lg shrink-0 transition-colors"
          title="שלח"
          aria-label="שלח הודעה לחברותא AI"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
};

export default AIChavruta;
