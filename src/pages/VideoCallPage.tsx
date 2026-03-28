import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ZegoUIKitPrebuilt } from '@zegocloud/zego-uikit-prebuilt';
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
    const containerRef = useRef<HTMLDivElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const zegoRef = useRef<any>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

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
                    autoHideFooter: true,
                    showMyCameraToggleButton: true,
                    showMyMicrophoneToggleButton: true,
                    showLeaveRoomConfirmDialog: true,
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
            zegoRef.current = null;
        };
    }, [roomId, user, navigate, canUseZego]);

    useEffect(() => {
        const handleFullscreenChange = () => {
            const isActive = Boolean(document.fullscreenElement);
            setIsFullscreen(isActive);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
        };
    }, []);

    const toggleFullscreen = async () => {
        try {
            if (!document.fullscreenElement && wrapperRef.current) {
                await wrapperRef.current.requestFullscreen();
            } else if (document.fullscreenElement) {
                await document.exitFullscreen();
            }
        } catch (error) {
            console.error('Failed to toggle fullscreen:', error);
        }
    };

    return (
        <div ref={wrapperRef} className="h-[calc(100vh-64px)] flex flex-col bg-slate-950 text-white overflow-hidden">
            <div className="h-14 px-4 border-b border-slate-800 flex justify-between items-center bg-slate-900">
                <span className="font-semibold">Live Session: {roomId}</span>
                <button
                    onClick={toggleFullscreen}
                    className="text-xs px-3 py-1 rounded-md border border-slate-700 hover:bg-slate-800"
                >
                    {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                </button>
            </div>

            <div className="px-4 py-2 text-xs text-slate-300 bg-slate-900/50 border-b border-slate-800">
                {callStatus}
            </div>

            <div className="px-4 py-2 text-[11px] text-slate-400 bg-slate-900/40 border-b border-slate-800">
                Tip: Click or tap the video to reveal the call controls (mute, camera, leave).
            </div>

            {accessError && (
                <div className="p-4 bg-red-500/20 text-red-200 border-b border-red-500/30 text-sm">
                    {accessError}
                </div>
            )}

            <div className="flex-1 bg-black">
                <div ref={containerRef} className="w-full h-full" />
            </div>
        </div>
    );
}
