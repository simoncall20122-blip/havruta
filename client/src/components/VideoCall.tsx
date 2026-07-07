import { useEffect, useRef, useState } from 'react';
import { socket } from '../socket';
import { Phone, PhoneOff, Mic, MicOff, Video as VideoIcon, VideoOff, Loader2, MonitorUp, Monitor } from 'lucide-react';

interface VideoCallProps {
  roomId: string;
}

// שרת STUN ציבורי בלבד - עובד בלוקאלי וברוב הרשתות הביתיות.
// לחיבור אמין דרך רשתות סגורות/סלולריות יש להוסיף שרת TURN.
const ICE_SERVERS: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

const VideoCall = ({ roomId }: VideoCallProps) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  const [inCall, setInCall] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [remoteJoined, setRemoteJoined] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [error, setError] = useState('');
  const [screenSharing, setScreenSharing] = useState(false);
  const startingRef = useRef(false);
  const screenStreamRef = useRef<MediaStream | null>(null);

  const flushPendingCandidates = async () => {
    const pc = pcRef.current;
    if (!pc) return;
    for (const candidate of pendingCandidatesRef.current) {
      try {
        await pc.addIceCandidate(candidate);
      } catch (e) {
        console.error('[וידאו] שגיאה בהוספת ICE candidate:', e);
      }
    }
    pendingCandidatesRef.current = [];
  };

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit('video_ice_candidate', { roomId, candidate: e.candidate });
      }
    };

    pc.ontrack = (e) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = e.streams[0];
      }
      setRemoteJoined(true);
    };

    pc.onconnectionstatechange = () => {
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        setRemoteJoined(false);
      }
    };

    return pc;
  };

  const ensureLocalCallReady = async () => {
    if (pcRef.current || startingRef.current) return; // מונע שתי בקשות מקבילות למצלמה
    startingRef.current = true;
    setError('');
    setConnecting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      const pc = createPeerConnection();
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      pcRef.current = pc;
      setInCall(true);
    } catch (e) {
      console.error('[וידאו] אין גישה למצלמה/מיקרופון:', e);
      const name = e instanceof Error ? e.name : '';
      if (name === 'AbortError') {
        setError('המצלמה לא הגיבה בזמן. אם פתוחה לשונית נוספת שמשתמשת במצלמה (כולל בדיקה עם 2 לשוניות על אותו מחשב), סגור אותה, או ודא שאף תוכנה אחרת לא תופסת את המצלמה, ונסה שוב.');
      } else if (name === 'NotAllowedError') {
        setError('הגישה למצלמה/מיקרופון נחסמה. אשר הרשאות בהגדרות הדפדפן ונסה שוב.');
      } else if (name === 'NotFoundError') {
        setError('לא נמצאה מצלמה או מיקרופון במכשיר.');
      } else {
        setError('לא ניתן לגשת למצלמה או למיקרופון. נסה שוב.');
      }
    } finally {
      setConnecting(false);
      startingRef.current = false;
    }
  };

  const startCall = async () => {
    await ensureLocalCallReady();
    const pc = pcRef.current;
    if (!pc) return;
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('video_offer', { roomId, offer });
    } catch (e) {
      console.error('[וידאו] שגיאה ביצירת שיחה:', e);
      setError('שגיאה ביצירת השיחה. נסה שוב.');
    }
  };

  const endCall = (notify: boolean) => {
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    pendingCandidatesRef.current = [];
    setInCall(false);
    setRemoteJoined(false);
    setMicOn(true);
    setCamOn(true);
    setScreenSharing(false);
    if (notify) socket.emit('video_hangup', { roomId });
  };

  const toggleMic = () => {
    localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !micOn));
    setMicOn((v) => !v);
  };

  const toggleCam = () => {
    localStreamRef.current?.getVideoTracks().forEach((t) => (t.enabled = !camOn));
    setCamOn((v) => !v);
  };

  const stopScreenShare = () => {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;

    const camTrack = localStreamRef.current?.getVideoTracks()[0];
    const sender = pcRef.current?.getSenders().find((s) => s.track && s.track.kind === 'video');
    if (camTrack && sender) sender.replaceTrack(camTrack).catch((e) => console.error('[וידאו] שגיאה בחזרה למצלמה:', e));
    if (localVideoRef.current && localStreamRef.current) localVideoRef.current.srcObject = localStreamRef.current;
    setScreenSharing(false);
  };

  const toggleScreenShare = async () => {
    if (screenSharing) {
      stopScreenShare();
      return;
    }
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = screenStream.getVideoTracks()[0];
      const sender = pcRef.current?.getSenders().find((s) => s.track && s.track.kind === 'video');
      if (sender) await sender.replaceTrack(screenTrack);
      if (localVideoRef.current) localVideoRef.current.srcObject = screenStream;
      // אם המשתמש עוצר את השיתוף מתוך חלונית הדפדפן עצמה (לא מהכפתור שלנו) - נחזור למצלמה
      screenTrack.onended = () => stopScreenShare();
      screenStreamRef.current = screenStream;
      setScreenSharing(true);
    } catch (e) {
      console.error('[וידאו] שגיאה בשיתוף מסך:', e);
    }
  };

  useEffect(() => {
    socket.emit('join_room', roomId);

    socket.on('video_offer', async (data: { offer: RTCSessionDescriptionInit }) => {
      await ensureLocalCallReady();
      const pc = pcRef.current;
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        await flushPendingCandidates();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('video_answer', { roomId, answer });
      } catch (e) {
        console.error('[וידאו] שגיאה בטיפול בהצעת שיחה:', e);
      }
    });

    socket.on('video_answer', async (data: { answer: RTCSessionDescriptionInit }) => {
      const pc = pcRef.current;
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        await flushPendingCandidates();
      } catch (e) {
        console.error('[וידאו] שגיאה באישור שיחה:', e);
      }
    });

    socket.on('video_ice_candidate', async (data: { candidate: RTCIceCandidateInit }) => {
      const pc = pcRef.current;
      if (pc && pc.remoteDescription) {
        try {
          await pc.addIceCandidate(data.candidate);
        } catch (e) {
          console.error('[וידאו] שגיאה בהוספת ICE candidate:', e);
        }
      } else {
        pendingCandidatesRef.current.push(data.candidate);
      }
    });

    socket.on('video_hangup', () => {
      endCall(false);
    });

    return () => {
      socket.off('video_offer');
      socket.off('video_answer');
      socket.off('video_ice_candidate');
      socket.off('video_hangup');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  useEffect(() => {
    return () => {
      // ניקוי בעת עזיבת הרכיב
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      pcRef.current?.close();
    };
  }, []);

  return (
    <div className="relative h-full bg-ink flex items-center justify-center overflow-hidden">
      <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover bg-ink" />

      {!remoteJoined && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-parchment-50/50 px-6 text-center">
          {error ? (
            <>
              <p className="text-sm text-ribbon-dark bg-parchment-50 rounded-lg px-3 py-2 max-w-xs">{error}</p>
              <button
                onClick={startCall}
                className="text-xs font-semibold text-parchment-50 underline underline-offset-2 hover:text-brass-light"
              >
                נסה שוב
              </button>
            </>
          ) : connecting ? (
            <>
              <Loader2 size={26} className="animate-spin" />
              <p className="text-sm">מתחבר...</p>
            </>
          ) : inCall ? (
            <p className="text-sm">ממתין שהחברותא יצטרף לשיחה...</p>
          ) : (
            <p className="text-sm">התחל שיחת וידאו כדי לראות את החברותא שלך</p>
          )}
        </div>
      )}

      {inCall && (
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="absolute bottom-3 left-3 w-20 sm:w-24 aspect-[3/4] object-cover rounded-lg border-2 border-brass shadow-md"
        />
      )}

      <div className="absolute bottom-3 right-3 flex items-center gap-2">
        {!inCall ? (
          <button
            onClick={startCall}
            disabled={connecting}
            className="flex items-center gap-1.5 px-4 py-2 bg-brass hover:bg-brass-light disabled:opacity-50 text-cover-dark text-sm font-bold rounded-full shadow-md transition-all active:scale-95"
          >
            <Phone size={15} />
            התחל שיחה
          </button>
        ) : (
          <>
            <button
              onClick={toggleMic}
              className={`p-2.5 rounded-full transition-colors ${micOn ? 'bg-white/15 text-parchment-50 hover:bg-white/20' : 'bg-ribbon text-parchment-50'}`}
              title={micOn ? 'השתק' : 'בטל השתקה'}
              aria-label={micOn ? 'השתק מיקרופון' : 'בטל השתקת מיקרופון'}
            >
              {micOn ? <Mic size={16} /> : <MicOff size={16} />}
            </button>
            <button
              onClick={toggleCam}
              className={`p-2.5 rounded-full transition-colors ${camOn ? 'bg-white/15 text-parchment-50 hover:bg-white/20' : 'bg-ribbon text-parchment-50'}`}
              title={camOn ? 'כבה מצלמה' : 'הפעל מצלמה'}
              aria-label={camOn ? 'כבה מצלמה' : 'הפעל מצלמה'}
            >
              {camOn ? <VideoIcon size={16} /> : <VideoOff size={16} />}
            </button>
            <button
              onClick={toggleScreenShare}
              className={`p-2.5 rounded-full transition-colors ${screenSharing ? 'bg-brass text-cover-dark' : 'bg-white/15 text-parchment-50 hover:bg-white/20'}`}
              title={screenSharing ? 'עצור שיתוף מסך' : 'שתף מסך'}
              aria-label={screenSharing ? 'עצור שיתוף מסך' : 'שתף מסך'}
            >
              {screenSharing ? <Monitor size={16} /> : <MonitorUp size={16} />}
            </button>
            <button
              onClick={() => endCall(true)}
              className="p-2.5 rounded-full bg-ribbon hover:bg-ribbon-dark text-parchment-50 transition-colors"
              title="סיים שיחה"
              aria-label="סיים שיחת וידאו"
            >
              <PhoneOff size={16} />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default VideoCall;
