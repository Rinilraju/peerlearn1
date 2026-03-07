import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Users } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import io, { Socket } from 'socket.io-client';
import Peer, { SignalData } from 'simple-peer';
import api from '../api';

type PeerItem = {
    peerID: string;
    peer: Peer.Instance;
};

const SIGNAL_SERVER_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function getIceServers(): RTCIceServer[] {
    // Primary path: JSON array from env (recommended for production).
    // Example:
    // VITE_WEBRTC_ICE_SERVERS=[{"urls":"stun:stun.l.google.com:19302"},{"urls":"turn:turn.example.com:3478","username":"u","credential":"p"}]
    const raw = import.meta.env.VITE_WEBRTC_ICE_SERVERS;
    if (raw) {
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed;
            }
        } catch (error) {
            console.error('Invalid VITE_WEBRTC_ICE_SERVERS JSON:', error);
        }
    }

    // Fallback STUN-only config. Works for some networks, not all.
    return [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ];
}

export function VideoCallPage() {
    const { id: roomId } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [stream, setStream] = useState<MediaStream>();
    const [peers, setPeers] = useState<PeerItem[]>([]);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [accessError, setAccessError] = useState('');
    const [callStatus, setCallStatus] = useState('Checking room access...');

    const userVideo = useRef<HTMLVideoElement>(null);
    const peersRef = useRef<PeerItem[]>([]);
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        if (!roomId) {
            return;
        }

        let mounted = true;

        const removePeer = (peerId: string) => {
            const peerObj = peersRef.current.find((p) => p.peerID === peerId);
            if (peerObj) {
                peerObj.peer.destroy();
            }
            peersRef.current = peersRef.current.filter((p) => p.peerID !== peerId);
            setPeers([...peersRef.current]);
        };

        const bootstrap = async () => {
            try {
                await api.get(`/sessions/room/${roomId}/access`);
                setCallStatus('Room access granted. Initializing media...');
            } catch (error: any) {
                setAccessError(error?.response?.data?.message || 'You are not allowed to join this live class.');
                return;
            }

            const token = localStorage.getItem('token');
            const socket = io(SIGNAL_SERVER_URL, {
                auth: { token },
            });
            socketRef.current = socket;

            navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((currentStream) => {
                if (!mounted) {
                    return;
                }

                setStream(currentStream);
                setCallStatus('Connecting to live room...');
                if (userVideo.current) {
                    userVideo.current.srcObject = currentStream;
                }

                socket.emit('join-room', roomId);

                socket.on('room-users', (users: string[]) => {
                    users.forEach((userToSignal) => {
                        if (peersRef.current.some((p) => p.peerID === userToSignal)) {
                            return;
                        }
                        const peer = createPeer(userToSignal, currentStream, socket);
                        const peerItem = { peerID: userToSignal, peer };
                        peersRef.current.push(peerItem);
                    });
                    setPeers([...peersRef.current]);
                    setCallStatus(users.length > 0 ? 'Connected to room.' : 'Waiting for participant...');
                });

                socket.on('user-joined-room', (userId: string) => {
                    if (peersRef.current.some((p) => p.peerID === userId)) {
                        return;
                    }
                    const peer = createPeer(userId, currentStream, socket);
                    const peerItem = { peerID: userId, peer };
                    peersRef.current.push(peerItem);
                    setPeers([...peersRef.current]);
                    setCallStatus('Participant joined.');
                });

                socket.on('user-joined', ({ signal, callerID }: { signal: SignalData; callerID: string }) => {
                    if (peersRef.current.some((p) => p.peerID === callerID)) {
                        return;
                    }
                    const peer = addPeer(signal, callerID, currentStream, socket);
                    const peerItem = { peerID: callerID, peer };
                    peersRef.current.push(peerItem);
                    setPeers([...peersRef.current]);
                });

                socket.on('receiving-returned-signal', ({ signal, id }: { signal: SignalData; id: string }) => {
                    const peerItem = peersRef.current.find((p) => p.peerID === id);
                    if (peerItem) {
                        peerItem.peer.signal(signal);
                    }
                });

                socket.on('user-left', (socketId: string) => {
                    removePeer(socketId);
                    setCallStatus('Participant left. Waiting...');
                });

                socket.on('room-access-denied', (payload: { message?: string }) => {
                    setAccessError(payload?.message || 'Room access denied.');
                    setCallStatus('Access denied.');
                });
            }).catch((error) => {
                console.error('Failed to access camera/microphone:', error);
                setAccessError('Camera or microphone permission denied.');
                setCallStatus('Media access failed.');
            });
        };

        bootstrap();

        return () => {
            mounted = false;
            const socket = socketRef.current;
            socket?.removeAllListeners();
            socket?.disconnect();
            socketRef.current = null;
            peersRef.current.forEach((peerObj) => peerObj.peer.destroy());
            peersRef.current = [];
            setPeers([]);
            setStream((currentStream) => {
                currentStream?.getTracks().forEach((track) => track.stop());
                return undefined;
            });
        };
    }, [roomId]);

    const toggleMute = () => {
        const audioTrack = stream?.getAudioTracks()[0];
        if (!audioTrack) {
            return;
        }
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
    };

    const toggleVideo = () => {
        const videoTrack = stream?.getVideoTracks()[0];
        if (!videoTrack) {
            return;
        }
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
    };

    return (
        <div className="h-[calc(100vh-64px)] flex flex-col bg-slate-950 text-white">
            <div className="h-14 px-4 border-b border-slate-800 flex justify-between items-center bg-slate-900">
                <span className="font-semibold">Room: {roomId}</span>
                <div className="flex items-center space-x-2 text-sm text-slate-400">
                    <Users className="h-4 w-4" />
                    <span>{peers.length + 1} Participants</span>
                </div>
            </div>

            <div className="px-4 py-2 text-xs text-slate-300 bg-slate-900/50 border-b border-slate-800">
                {callStatus}
            </div>

            {accessError && (
                <div className="p-4 bg-red-500/20 text-red-200 border-b border-red-500/30 text-sm">
                    {accessError}
                </div>
            )}

            <div className="flex-1 p-4 grid grid-cols-2 md:grid-cols-3 gap-4 overflow-y-auto">
                <div className="relative bg-slate-800 rounded-lg overflow-hidden aspect-video">
                    <video ref={userVideo} autoPlay muted playsInline className="w-full h-full object-cover" />
                    <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded text-xs">You</div>
                </div>

                {peers.map((peerObj) => (
                    <VideoCard key={peerObj.peerID} peer={peerObj.peer} />
                ))}
            </div>

            <div className="h-16 bg-slate-900 flex items-center justify-center space-x-4">
                <button onClick={toggleMute} className={`p-3 rounded-full ${isMuted ? 'bg-red-500' : 'bg-slate-700'}`}>
                    {isMuted ? <MicOff /> : <Mic />}
                </button>
                <button onClick={toggleVideo} className={`p-3 rounded-full ${isVideoOff ? 'bg-red-500' : 'bg-slate-700'}`}>
                    {isVideoOff ? <VideoOff /> : <Video />}
                </button>
                <button onClick={() => navigate('/dashboard')} className="p-3 rounded-full bg-red-600 px-8">
                    <PhoneOff />
                </button>
            </div>
        </div>
    );
}

function createPeer(userToSignal: string, localStream: MediaStream, socket: Socket) {
    const peer = new Peer({
        initiator: true,
        trickle: true,
        stream: localStream,
        config: { iceServers: getIceServers() },
    });

    peer.on('signal', (signal) => {
        socket.emit('sending-signal', { userToSignal, signal });
    });
    peer.on('error', (error) => {
        console.error('Peer error (initiator):', error);
    });

    return peer;
}

function addPeer(incomingSignal: SignalData, callerID: string, localStream: MediaStream, socket: Socket) {
    const peer = new Peer({
        initiator: false,
        trickle: true,
        stream: localStream,
        config: { iceServers: getIceServers() },
    });

    peer.on('signal', (signal) => {
        socket.emit('returning-signal', { signal, callerID });
    });
    peer.on('error', (error) => {
        console.error('Peer error (receiver):', error);
    });

    peer.signal(incomingSignal);
    return peer;
}

const VideoCard = ({ peer }: { peer: Peer.Instance }) => {
    const ref = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        peer.on('stream', (remoteStream: MediaStream) => {
            if (ref.current) {
                ref.current.srcObject = remoteStream;
            }
        });
    }, [peer]);

    return (
        <div className="relative bg-slate-800 rounded-lg overflow-hidden aspect-video">
            <video ref={ref} autoPlay playsInline className="w-full h-full object-cover" />
            <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded text-xs">Peer</div>
        </div>
    );
};
