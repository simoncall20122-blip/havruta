import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
app.use(cors());
app.use(express.json());

// --- הוספת נתיב Healthcheck לזיהוי תקינות על ידי Railway ---
app.get('/', (_req, res) => {
  res.status(200).send('Chavruta Digital Server is Online and Healthy');
});

// --- Interfaces & State ---
interface RoomInfo { ref: string; label: string; group: boolean; dedication?: string; }
const roomTopics = new Map<string, RoomInfo>();

interface BoardPost { id: string; name: string; topic: string; when: string; posterSocketId: string; ts: number; }
const boardPosts = new Map<string, BoardPost>();

interface ChatMessage { id: string; name: string; text: string; ts: number; senderId: string; }
const roomChats = new Map<string, ChatMessage[]>();

interface Point { x: number; y: number; }
interface DrawEvent { prevPoint: Point | null; currentPoint: Point; color: string; }
const roomBoards = new Map<string, DrawEvent[]>();

interface ScheduledSession { when: number; note: string; }
const roomSchedule = new Map<string, ScheduledSession>();

interface AiTurn { role: 'user' | 'assistant'; content: string; name?: string; }
const roomAiChats = new Map<string, AiTurn[]>();

// --- Helper Functions ---
function broadcastBoard(io: Server) {
  const posts = Array.from(boardPosts.values()).sort((a, b) => b.ts - a.ts);
  io.emit('board_list', posts);
}

function broadcastRoomsList(io: Server) {
  const rooms = Array.from(roomTopics.entries())
    .map(([id, room]) => ({
      id, topic: room.label, group: room.group,
      occupancy: io.sockets.adapter.rooms.get(id)?.size || 0,
    }))
    .filter((r) => r.occupancy > 0);
  io.emit('rooms_list', rooms);
}

// --- Socket.io Setup ---
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);
  broadcastRoomsList(io);
  broadcastBoard(io);

  // הטיפול באירועים נשאר כפי שהיה במבנה הקוד הקודם...
  // (וודא שכל ה-socket.on שמימשת קודם נמצאים כאן)
  
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    broadcastRoomsList(io);
  });
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 5000;
httpServer.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));