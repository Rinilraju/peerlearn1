import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ZegoUIKitPrebuilt } from '@zegocloud/zego-uikit-prebuilt';
import io, { Socket } from 'socket.io-client';
import api from '../api';
import { useAuth } from '../context/AuthContext';

const ZEGO_APP_ID = Number(import.meta.env.VITE_ZEGO_APP_ID);
const ZEGO_SERVER_SECRET = import.meta.env.VITE_ZEGO_SERVER_SECRET || '';

export function VideoCallPage() {
    const { id: roomId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [accessError, setAccessError] = useState('');
    const [callStatus, setCallStatus] = useState('Validating session...');
    const [sessionId, setSessionId] = useState<number | null>(null);
    const [notes, setNotes] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const zegoRef = useRef<any>(null);
    const socketRef = useRef<Socket | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawingRef = useRef(false);

    const canUseZego = Number.isFinite(ZEGO_APP_ID) && ZEGO_APP_ID > 0 && ZEGO_SERVER_SECRET.length > 0;

    useEffect(() => {
        if (!roomId || !user) {
            return;
        }

        let isMounted = true;

        const setupRoom = async () => {
            try {
                setCallStatus('Checking room access...');
                const accessResponse = await api.get(`/sessions/room/${roomId}/access`);
                if (!isMounted) {
                    return;
                }

                if (!canUseZego) {
                    setAccessError('Live class is not configured. Set VITE_ZEGO_APP_ID and VITE_ZEGO_SERVER_SECRET.');
                    return;
                }
                if (!containerRef.current) {
                    setAccessError('Unable to initialize live class container.');
                    return;
                }

                const { roomId: resolvedRoomId, sessionId, participantRole } = accessResponse.data;
                setSessionId(Number(sessionId));
                const userId = String(user.id || `user-${Date.now()}`);
                const userName = user.name || user.email || userId;
                const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
                    ZEGO_APP_ID,
                    ZEGO_SERVER_SECRET,
                    resolvedRoomId,
                    userId,
                    userName
                );

                const zego = ZegoUIKitPrebuilt.create(kitToken);
                zegoRef.current = zego;
                setCallStatus('Joining live class...');

                zego.joinRoom({
                    container: containerRef.current,
                    scenario: {
                        mode: ZegoUIKitPrebuilt.OneONoneCall,
                    },
                    showPreJoinView: false,
                    turnOnMicrophoneWhenJoining: true,
                    turnOnCameraWhenJoining: true,
                    onJoinRoom: () => {
                        setCallStatus('Connected.');
                    },
                    onLeaveRoom: async () => {
                        if (participantRole === 'instructor' && sessionId) {
                            try {
                                await api.post(`/sessions/${sessionId}/end`);
                            } catch (error) {
                                console.error('Failed to end session after tutor left room:', error);
                            }
                        }
                        navigate('/sessions');
                    },
                });

                const token = localStorage.getItem('token');
                const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000', { auth: { token } });
                socketRef.current = socket;
                socket.emit('join-whiteboard', { roomId: resolvedRoomId });
                socket.on('whiteboard-draw', ({ stroke }) => {
                    drawStroke(stroke);
                });
                socket.on('whiteboard-clear', () => {
                    clearCanvasLocal();
                });

                try {
                    const notesRes = await api.get(`/session-tools/notes/${sessionId}`);
                    setNotes(notesRes.data?.notes || '');
                } catch (error) {
                    // Keep call usable even if notes fetch fails.
                }
            } catch (error: any) {
                if (!isMounted) {
                    return;
                }
                setAccessError(error?.response?.data?.message || 'You are not allowed to join this live class.');
            }
        };

        setupRoom();

        return () => {
            isMounted = false;
            try {
                zegoRef.current?.destroy?.();
            } catch (error) {
                console.error('Failed to destroy ZEGOCLOUD room:', error);
            }
            socketRef.current?.disconnect();
            socketRef.current = null;
            zegoRef.current = null;
        };
    }, [roomId, user, navigate, canUseZego]);

    const resizeCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        canvas.width = Math.max(1, Math.floor(rect.width));
        canvas.height = Math.max(1, Math.floor(rect.height));
    };

    useEffect(() => {
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        return () => window.removeEventListener('resize', resizeCanvas);
    }, []);

    const drawStroke = (stroke: { x0: number; y0: number; x1: number; y1: number; color?: string; width?: number }) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.strokeStyle = stroke.color || '#22c55e';
        ctx.lineWidth = stroke.width || 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(stroke.x0 * canvas.width, stroke.y0 * canvas.height);
        ctx.lineTo(stroke.x1 * canvas.width, stroke.y1 * canvas.height);
        ctx.stroke();
    };

    const clearCanvasLocal = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    const getNormalizedPoint = (event: PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width;
        const y = (event.clientY - rect.top) / rect.height;
        return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
    };

    const lastPointRef = useRef<{ x: number; y: number } | null>(null);

    const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
        drawingRef.current = true;
        lastPointRef.current = getNormalizedPoint(event);
    };

    const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
        if (!drawingRef.current) return;
        const next = getNormalizedPoint(event);
        const prev = lastPointRef.current;
        if (!next || !prev) return;
        const stroke = { x0: prev.x, y0: prev.y, x1: next.x, y1: next.y, color: '#22c55e', width: 2 };
        drawStroke(stroke);
        socketRef.current?.emit('whiteboard-draw', { roomId, stroke });
        lastPointRef.current = next;
    };

    const onPointerUp = () => {
        drawingRef.current = false;
        lastPointRef.current = null;
    };

    const clearWhiteboard = () => {
        clearCanvasLocal();
        socketRef.current?.emit('whiteboard-clear', { roomId });
    };

    const saveNotes = async () => {
        if (!sessionId) return;
        try {
            await api.put(`/session-tools/notes/${sessionId}`, { notes });
            setCallStatus('Notes saved.');
        } catch (error) {
            setCallStatus('Failed to save notes.');
        }
    };

    return (
        <div className="h-[calc(100vh-64px)] flex flex-col bg-slate-950 text-white overflow-hidden">
            <div className="h-14 px-4 border-b border-slate-800 flex justify-between items-center bg-slate-900">
                <span className="font-semibold">Live Session: {roomId}</span>
            </div>

            <div className="px-4 py-2 text-xs text-slate-300 bg-slate-900/50 border-b border-slate-800">
                {callStatus}
            </div>

            {accessError && (
                <div className="p-4 bg-red-500/20 text-red-200 border-b border-red-500/30 text-sm">
                    {accessError}
                </div>
            )}

            <div className="flex-1 bg-black grid lg:grid-cols-[2fr_1fr]">
                <div className="min-h-0">
                    <div ref={containerRef} className="w-full h-full" />
                </div>
                <div className="border-l border-slate-800 bg-slate-900 p-3 space-y-3 overflow-y-auto">
                    <h3 className="font-semibold text-sm">Live Whiteboard</h3>
                    <div className="h-56 border border-slate-700 rounded overflow-hidden bg-white">
                        <canvas
                            ref={canvasRef}
                            className="w-full h-full touch-none"
                            onPointerDown={onPointerDown}
                            onPointerMove={onPointerMove}
                            onPointerUp={onPointerUp}
                            onPointerLeave={onPointerUp}
                        />
                    </div>
                    <button onClick={clearWhiteboard} className="text-xs px-3 py-1 rounded border border-slate-600 hover:bg-slate-800">
                        Clear Whiteboard
                    </button>

                    <h3 className="font-semibold text-sm pt-2">Session Notes</h3>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full min-h-[140px] px-3 py-2 rounded border border-slate-700 bg-slate-950 text-sm"
                        placeholder="Write your class notes..."
                    />
                    <button onClick={saveNotes} className="text-xs px-3 py-1 rounded bg-primary text-primary-foreground">
                        Save Notes
                    </button>
                </div>
            </div>
        </div>
    );
}
