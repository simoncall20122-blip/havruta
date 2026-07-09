import { useState, useEffect } from 'react';
import Lobby from './components/Lobby';
import StudyRoom from './components/StudyRoom';
import AdminDashboard from './components/AdminDashboard';
import { AuthProvider } from './authContext';

function App() {
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);
  const [isAdminView, setIsAdminView] = useState(false);

  useEffect(() => {
    // בדיקה האם המשתמש הגיע דרך לינק ישיר לחדר, או לדשבורד הניהול
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
      setCurrentRoom(roomParam);
    }
    if (urlParams.get('admin') === '1') {
      setIsAdminView(true);
    }
  }, []);

  const handleJoinRoom = (roomId: string, opts?: { ai?: boolean }) => {
    // עדכון ה-URL בדפדפן ומעבר לחדר הלימוד
    const suffix = opts?.ai ? '&ai=1' : '';
    window.history.pushState(null, '', `?room=${roomId}${suffix}`);
    setCurrentRoom(roomId);
  };

  if (isAdminView) {
    return <AdminDashboard />;
  }

  return (
    <AuthProvider>
      <div className="App">
        {currentRoom ? (
          <StudyRoom />
        ) : (
          <Lobby onJoinRoom={handleJoinRoom} />
        )}
      </div>
    </AuthProvider>
  );
}

export default App;