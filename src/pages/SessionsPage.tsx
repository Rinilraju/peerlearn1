import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../api';
import io, { Socket } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';

type Course = { id: number; title: string };
type Student = { id: number; name: string; email: string };

type SessionItem = {
    id: number;
    course_id: number;
    course_title: string;
    instructor_id: number;
    instructor_name: string;
    student_id: number;
    student_name: string;
    scheduled_at: string;
    duration_minutes: number;
    meeting_room_id: string;
    status: string;
    can_start: boolean;
    can_join: boolean;
    join_enabled_for_student: boolean;
    join_enabled_for_instructor: boolean;
};

type NotificationItem = {
    id: number;
    title: string;
    body: string;
    type: string;
    related_session_id?: number;
    is_read: boolean;
    created_at: string;
};

type Contact = { id: number; name: string; email: string };
type ChatMessage = { id: number; sender_id: number; receiver_id: number; message: string; created_at: string };

export function SessionsPage() {
    const { user } = useAuth();
    const [myCourses, setMyCourses] = useState<Course[]>([]);
    const [enrolledCourses, setEnrolledCourses] = useState<Course[]>([]);
    const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
    const [chatSelectedCourseId, setChatSelectedCourseId] = useState<number | null>(null);
    const [students, setStudents] = useState<Student[]>([]);
    const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
    const [scheduleDateTime, setScheduleDateTime] = useState('');
    const [sessions, setSessions] = useState<SessionItem[]>([]);
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [selectedPeerId, setSelectedPeerId] = useState<number | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [status, setStatus] = useState('');
    const socketRef = useRef<Socket | null>(null);
    const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

    const isTutor = myCourses.length > 0;
    const chatCourseId = useMemo(() => {
        if (chatSelectedCourseId) return chatSelectedCourseId;
        if (isTutor) return myCourses[0]?.id ?? null;
        return enrolledCourses[0]?.id ?? null;
    }, [chatSelectedCourseId, isTutor, myCourses, enrolledCourses]);

    const mapCourses = (rows: any[]) => rows.map((c) => ({ id: Number(c.id), title: c.title }));

    const fetchCoreData = async () => {
        try {
            const [mineRes, enrolledRes, sessionsRes, notificationsRes] = await Promise.all([
                api.get('/courses/my-courses'),
                api.get('/courses/enrolled'),
                api.get('/sessions/mine'),
                api.get('/sessions/notifications'),
            ]);
            setMyCourses(mapCourses(mineRes.data));
            setEnrolledCourses(mapCourses(enrolledRes.data));
            setSessions(sessionsRes.data);
            setNotifications(notificationsRes.data);
        } catch (error) {
            console.error('Failed to fetch session data:', error);
            setStatus('Failed to load session data.');
        }
    };

    useEffect(() => {
        fetchCoreData();
        const intervalId = window.setInterval(fetchCoreData, 30000);
        return () => window.clearInterval(intervalId);
    }, []);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return;

        const socket = io(apiBaseUrl, { auth: { token } });
        socketRef.current = socket;

        socket.on('notification', (n: { title: string; body: string; relatedSessionId?: number }) => {
            setNotifications((prev) => [
                {
                    id: Date.now(),
                    title: n.title,
                    body: n.body,
                    type: 'realtime',
                    related_session_id: n.relatedSessionId,
                    is_read: false,
                    created_at: new Date().toISOString(),
                },
                ...prev,
            ]);
        });

        socket.on('chat-message', (msg: ChatMessage & { course_id: number }) => {
            const activeCourse = chatCourseId;
            const peer = selectedPeerId;
            if (!activeCourse || !peer) return;
            const involvesPeer = Number(msg.sender_id) === Number(peer) || Number(msg.receiver_id) === Number(peer);
            if (Number(msg.course_id) === Number(activeCourse) && involvesPeer) {
                setMessages((prev) => [...prev, msg]);
            }
        });

        return () => {
            socket.disconnect();
            socketRef.current = null;
        };
    }, [apiBaseUrl, chatCourseId, selectedPeerId]);

    useEffect(() => {
        if (!chatCourseId || !selectedPeerId || !socketRef.current) return;
        socketRef.current.emit('join-chat', { courseId: chatCourseId, peerId: selectedPeerId });
    }, [chatCourseId, selectedPeerId]);

    useEffect(() => {
        if (!selectedCourseId) return;
        api.get(`/sessions/course/${selectedCourseId}/students`)
            .then((res) => setStudents(res.data))
            .catch(() => setStudents([]));
    }, [selectedCourseId]);

    useEffect(() => {
        if (!chatCourseId) return;
        api.get(`/chat/course/${chatCourseId}/contacts`)
            .then((res) => {
                setContacts(res.data);
                if (!selectedPeerId && res.data.length > 0) {
                    setSelectedPeerId(Number(res.data[0].id));
                }
            })
            .catch(() => setContacts([]));
    }, [chatCourseId, selectedPeerId]);

    useEffect(() => {
        if (!chatCourseId || !selectedPeerId) {
            setMessages([]);
            return;
        }
        api.get(`/chat/course/${chatCourseId}/messages/${selectedPeerId}`)
            .then((res) => setMessages(res.data))
            .catch(() => setMessages([]));
    }, [chatCourseId, selectedPeerId]);

    const scheduleSession = async () => {
        if (!selectedCourseId || !selectedStudentId || !scheduleDateTime) {
            setStatus('Select course, student, and schedule time.');
            return;
        }
        const scheduledDate = new Date(scheduleDateTime);
        if (Number.isNaN(scheduledDate.getTime())) {
            setStatus('Invalid schedule time.');
            return;
        }
        const scheduledAt = scheduledDate.toISOString();
        try {
            await api.post('/sessions', {
                courseId: selectedCourseId,
                studentId: selectedStudentId,
                scheduledAt,
                durationMinutes: 60,
            });
            setStatus('Session scheduled and student notified.');
            setScheduleDateTime('');
            await fetchCoreData();
        } catch (error: any) {
            setStatus(error.response?.data?.message || 'Failed to schedule session.');
        }
    };

    const deleteSession = async (sessionId: number) => {
        try {
            await api.delete(`/sessions/${sessionId}`);
            setStatus('Scheduled session deleted.');
            await fetchCoreData();
        } catch (error: any) {
            setStatus(error.response?.data?.message || 'Failed to delete scheduled session.');
        }
    };

    const parseSelectValue = (value: string): number | null => {
        if (!value) return null;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    };

    const startLiveClass = async (sessionId: number) => {
        try {
            const res = await api.post(`/sessions/${sessionId}/start`);
            await fetchCoreData();
            window.location.href = res.data.joinUrl;
        } catch (error: any) {
            setStatus(error.response?.data?.message || 'Failed to start live class.');
        }
    };

    const markNotificationRead = async (id: number) => {
        try {
            await api.patch(`/sessions/notifications/${id}/read`);
            setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
        } catch (error) {
            console.error('Failed to mark notification read:', error);
        }
    };

    const sendMessage = async () => {
        if (!chatCourseId || !selectedPeerId || !newMessage.trim()) return;
        try {
            const socket = socketRef.current;
            if (socket) {
                socket.emit('send-chat-message', { courseId: chatCourseId, peerId: selectedPeerId, message: newMessage }, (ack: any) => {
                    if (!ack?.ok) {
                        setStatus(ack?.message || 'Failed to send message.');
                        return;
                    }
                    setNewMessage('');
                });
                return;
            }
            const res = await api.post(`/chat/course/${chatCourseId}/messages/${selectedPeerId}`, { message: newMessage });
            setMessages((prev) => [...prev, res.data]);
            setNewMessage('');
        } catch (error) {
            console.error('Failed to send message:', error);
        }
    };

    const downloadCalendar = async () => {
        try {
            const res = await api.get('/calendar/my.ics', { responseType: 'blob' });
            const blob = new Blob([res.data], { type: 'text/calendar;charset=utf-8' });
            const url = window.URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = 'peerlearn-sessions.ics';
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            setStatus('Failed to download calendar.');
        }
    };

    return (
        <div className="container mx-auto px-4 py-8 space-y-8">
            <h1 className="text-3xl font-bold">Sessions, Notifications & Chat</h1>
            <div>
                <button
                    onClick={downloadCalendar}
                    className="inline-block text-sm px-3 py-2 rounded border hover:bg-muted"
                >
                    Download Calendar (.ics)
                </button>
            </div>
            {status && <div className="text-sm bg-secondary/30 border rounded p-3">{status}</div>}

            {isTutor && (
                <section className="p-4 border rounded-lg space-y-4">
                    <h2 className="text-xl font-semibold">Schedule Session For Enrolled Student</h2>
                    <p className="text-xs text-muted-foreground">Times are scheduled in your current local timezone.</p>
                    <div className="grid md:grid-cols-4 gap-3">
                        <select className="h-10 px-3 rounded-md border bg-background" value={selectedCourseId ?? ''} onChange={(e) => setSelectedCourseId(parseSelectValue(e.target.value))}>
                            <option value="">Select course</option>
                            {myCourses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
                        </select>
                        <select className="h-10 px-3 rounded-md border bg-background" value={selectedStudentId ?? ''} onChange={(e) => setSelectedStudentId(parseSelectValue(e.target.value))}>
                            <option value="">Select student</option>
                            {students.map((student) => <option key={student.id} value={student.id}>{student.name} ({student.email})</option>)}
                        </select>
                        <div className="flex gap-2">
                            <input
                                type="datetime-local"
                                min={new Date(Date.now() + 60 * 1000).toISOString().slice(0, 16)}
                                className="h-10 px-3 rounded-md border bg-background"
                                value={scheduleDateTime}
                                onChange={(e) => setScheduleDateTime(e.target.value)}
                            />
                        </div>
                        <button onClick={scheduleSession} className="h-10 px-4 rounded-md bg-primary text-primary-foreground hover:bg-primary/90">Schedule</button>
                    </div>
                </section>
            )}

            <section className="p-4 border rounded-lg space-y-4">
                <h2 className="text-xl font-semibold">My Scheduled Sessions</h2>
                {sessions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No sessions yet.</p>
                ) : (
                    <div className="space-y-3">
                        {sessions.map((session) => (
                            <div key={session.id} className="p-3 rounded border bg-card">
                                <div className="font-medium">{session.course_title}</div>
                                <div className="text-sm text-muted-foreground">
                                    {new Date(session.scheduled_at).toLocaleString()} • {session.duration_minutes} mins
                                </div>
                                <div className="text-sm">Tutor: {session.instructor_name} • Student: {session.student_name}</div>
                                <div className="mt-2 flex gap-3">
                                    {session.can_start && (
                                        <button onClick={() => startLiveClass(session.id)} className="text-sm px-3 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90">
                                            Start Live Class
                                        </button>
                                    )}
                                    {session.can_join && (
                                        <a href={`/session/${session.meeting_room_id}`} className="inline-block text-primary hover:underline text-sm">Join Now</a>
                                    )}
                                    {!session.can_start && !session.can_join && (
                                        <span className="text-xs text-muted-foreground">Waiting for live window/tutor start</span>
                                    )}
                                    {Number(session.instructor_id) === Number(user?.id) && ['scheduled', 'live'].includes(session.status) && (
                                        <button
                                            onClick={() => deleteSession(session.id)}
                                            className="text-sm px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700"
                                        >
                                            {session.status === 'live' ? 'End & Delete Session' : 'Delete Schedule'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <section className="p-4 border rounded-lg space-y-4">
                <h2 className="text-xl font-semibold">Notifications</h2>
                {notifications.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No notifications yet.</p>
                ) : (
                    <div className="space-y-2">
                        {notifications.map((n) => (
                            <div key={n.id} className={`p-3 rounded border ${n.is_read ? 'opacity-70' : ''}`}>
                                <div className="font-medium">{n.title}</div>
                                <div className="text-sm text-muted-foreground">{n.body}</div>
                                <button onClick={() => markNotificationRead(n.id)} disabled={n.is_read} className="mt-2 text-xs text-primary hover:underline disabled:opacity-60">
                                    {n.is_read ? 'Read' : 'Mark as read'}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <section className="p-4 border rounded-lg space-y-4">
                <h2 className="text-xl font-semibold">Tutor-Student Chat</h2>
                <div className="grid md:grid-cols-3 gap-3">
                    <select className="h-10 px-3 rounded-md border bg-background" value={chatCourseId ?? ''} onChange={(e) => setChatSelectedCourseId(parseSelectValue(e.target.value))}>
                        <option value="">Select course</option>
                        {(isTutor ? myCourses : enrolledCourses).map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
                    </select>
                    <select className="h-10 px-3 rounded-md border bg-background" value={selectedPeerId ?? ''} onChange={(e) => setSelectedPeerId(parseSelectValue(e.target.value))}>
                        <option value="">Select chat contact</option>
                        {contacts.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.email})</option>)}
                    </select>
                </div>

                <div className="h-64 overflow-y-auto border rounded p-3 space-y-2 bg-muted/20">
                    {messages.length === 0 ? <p className="text-sm text-muted-foreground">No messages yet.</p> : messages.map((m) => (
                        <div key={m.id} className="text-sm"><span className="font-medium">#{m.sender_id}</span>: {m.message}</div>
                    ))}
                </div>

                <div className="flex gap-2">
                    <input type="text" className="flex-1 h-10 px-3 rounded-md border bg-background" placeholder="Type a message..." value={newMessage} onChange={(e) => setNewMessage(e.target.value)} />
                    <button onClick={sendMessage} className="h-10 px-4 rounded-md bg-primary text-primary-foreground hover:bg-primary/90">Send</button>
                </div>
            </section>
        </div>
    );
}
