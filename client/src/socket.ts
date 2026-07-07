import { io } from 'socket.io-client';

// חיבור Socket.io יחיד ומשותף לכל הכרטיסייה - במקום שכל קומפוננטה תפתח חיבור נפרד משלה.
// זה קריטי לספירת נוכחות מדויקת בחדרים (אחרת כל טאב פתוח נספר כ"משתתף" נוסף).
export const socket = io('https://havruta.onrender.com');
