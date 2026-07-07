import React, { useRef, useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { socket } from '../socket';
import { Eraser, Pen, RefreshCcw } from 'lucide-react';

interface Point {
  x: number;
  y: number;
}

interface WhiteboardProps {
  roomId: string;
}

export interface WhiteboardHandle {
  getSnapshot: () => string | null;
}

const Whiteboard = forwardRef<WhiteboardHandle, WhiteboardProps>(({ roomId }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#4f46e5'); // Default Indigo color
  const [isEraser, setIsEraser] = useState(false);

  // חושף כלפי חוץ (StudyRoom) אפשרות לשלוף תמונה של הלוח, לצורך יצוא PDF
  useImperativeHandle(ref, () => ({
    getSnapshot: () => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      try {
        return canvas.toDataURL('image/png');
      } catch {
        return null;
      }
    },
  }));

  // Initialize Socket.io connection for the room
  useEffect(() => {
    if (roomId) {
      socket.emit('join_room', roomId);
      socket.emit('request_board_state', roomId); // טוען שרטוטים שכבר קיימים בחדר
    }

    const drawLineEvent = (data: { prevPoint: Point | null; currentPoint: Point; color: string }) => {
      const { prevPoint, currentPoint, color: drawColor } = data;
      drawLine(prevPoint, currentPoint, drawColor, false);
    };

    socket.on('draw_line', drawLineEvent);

    socket.on('clear_board', () => {
      clearCanvas(false);
    });

    socket.on('board_history', (history: { prevPoint: Point | null; currentPoint: Point; color: string }[]) => {
      for (const entry of history) {
        drawLine(entry.prevPoint, entry.currentPoint, entry.color, false);
      }
    });

    return () => {
      socket.off('draw_line', drawLineEvent);
      socket.off('clear_board');
      socket.off('board_history');
    };
  }, [roomId]);

  // Adjust canvas size to fit its container
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
      }
      
      // Set initial canvas styles
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }
    
    // Handle window resize
    const handleResize = () => {
      if (canvas && canvas.parentElement) {
         // Optionally save current drawing, resize, and restore
         // For simplicity here, we might lose drawing on resize unless we save to an image data
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const drawLine = useCallback(
    (prevPoint: Point | null, currentPoint: Point, drawColor: string, emit: boolean) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const currentColor = isEraser && emit ? '#ffffff' : drawColor;
      const lineWidth = isEraser && emit ? 20 : 3;

      ctx.strokeStyle = currentColor;
      ctx.lineWidth = lineWidth;

      ctx.beginPath();
      if (prevPoint) {
        ctx.moveTo(prevPoint.x, prevPoint.y);
      } else {
        ctx.moveTo(currentPoint.x, currentPoint.y);
      }
      ctx.lineTo(currentPoint.x, currentPoint.y);
      ctx.stroke();

      if (emit) {
        socket.emit('draw_line', {
          roomId,
          prevPoint,
          currentPoint,
          color: currentColor,
        });
      }
    },
    [isEraser, roomId]
  );

  const prevPointRef = useRef<Point | null>(null);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const onMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    const point = getCoordinates(e);
    prevPointRef.current = point;
  };

  const onMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const currentPoint = getCoordinates(e);
    
    // Prevent default scrolling on touch devices while drawing
    if ('touches' in e && e.cancelable) {
       e.preventDefault();
    }

    drawLine(prevPointRef.current, currentPoint, color, true);
    prevPointRef.current = currentPoint;
  };

  const onMouseUp = () => {
    setIsDrawing(false);
    prevPointRef.current = null;
  };

  const clearCanvas = (emit: boolean = true) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (emit) {
        socket.emit('clear_board', { roomId });
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden relative">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 bg-slate-50 border-b border-slate-200 z-10">
        <div className="flex items-center gap-2">
           <button
            onClick={() => setIsEraser(false)}
            className={`p-2 rounded-lg transition-colors ${!isEraser ? 'bg-brass/15 text-brass-dark' : 'text-slate-500 hover:bg-slate-200'}`}
            title="עט"
            aria-label="כלי עט"
            aria-pressed={!isEraser}
          >
            <Pen size={18} />
          </button>
          <button
            onClick={() => setIsEraser(true)}
            className={`p-2 rounded-lg transition-colors ${isEraser ? 'bg-brass/15 text-brass-dark' : 'text-slate-500 hover:bg-slate-200'}`}
            title="מחק"
            aria-label="כלי מחק"
            aria-pressed={isEraser}
          >
            <Eraser size={18} />
          </button>
          
          <div className="w-px h-6 bg-slate-300 mx-2"></div>
          
          {/* Colors */}
          <div className="flex gap-1" dir="ltr">
            {[
              { hex: '#ef4444', name: 'אדום' },
              { hex: '#f59e0b', name: 'כתום' },
              { hex: '#10b981', name: 'ירוק' },
              { hex: '#3b82f6', name: 'כחול' },
              { hex: '#4f46e5', name: 'סגול-כחול' },
              { hex: '#000000', name: 'שחור' },
            ].map((c) => (
              <button
                key={c.hex}
                onClick={() => { setColor(c.hex); setIsEraser(false); }}
                className={`w-6 h-6 rounded-full border-2 transition-transform ${color === c.hex && !isEraser ? 'scale-125 border-slate-400' : 'border-transparent'}`}
                style={{ backgroundColor: c.hex }}
                title={`צבע ${c.name}`}
                aria-label={`בחר צבע ${c.name}`}
                aria-pressed={color === c.hex && !isEraser}
              />
            ))}
          </div>
        </div>

        <button
          onClick={() => clearCanvas(true)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200"
        >
          <RefreshCcw size={16} />
          נקה לוח
        </button>
      </div>

      {/* Canvas Container */}
      <div className="flex-1 relative cursor-crosshair touch-none">
        <canvas
          ref={canvasRef}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onTouchStart={onMouseDown}
          onTouchMove={onMouseMove}
          onTouchEnd={onMouseUp}
          className="absolute inset-0 w-full h-full bg-white"
        />
        {/* Placeholder watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03]">
             <span className="font-classic text-6xl rotate-[-15deg]">שרטוט סוגיה</span>
        </div>
      </div>
    </div>
  );
});

export default Whiteboard;