const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
    const fs = require('fs');
    const requestId = randomUUID();
    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);
    const logMessage = `${new Date().toISOString()} [${requestId}] - ${req.method} ${req.url}\n`;
    fs.appendFileSync('server_debug.log', logMessage);
    console.log(logMessage.trim());
    next();
});


// Database Connection
const db = require('./db');

console.log('Attempting to connect to DB...');

const runMigrations = require('./migrations');

db.pool.connect()
    .then(async () => {
        console.log(`Connected to PostgreSQL database`);
        await runMigrations();
        startSessionReminderWorker();
    })
    .catch(err => console.error('Database connection error', err.stack));

// Routes
const authRoutes = require('./routes/auth');
const doubtRoutes = require('./routes/doubts');
const courseRoutes = require('./routes/courses');
const recommendationRoutes = require('./routes/recommendations');
const paymentRoutes = require('./routes/payments');
const sessionRoutes = require('./routes/sessions');
const chatRoutes = require('./routes/chat');
const userRoutes = require('./routes/users');
const classRequestRoutes = require('./routes/classRequests');
const tutorRoutes = require('./routes/tutors');

app.use('/auth', authRoutes);
app.use('/doubts', doubtRoutes);
app.use('/courses', courseRoutes);
app.use('/recommendations', recommendationRoutes);
app.use('/payments', paymentRoutes);
app.use('/sessions', sessionRoutes);
app.use('/chat', chatRoutes);
app.use('/users', userRoutes);
app.use('/class-requests', classRequestRoutes);
app.use('/tutors', tutorRoutes);

app.get('/', (req, res) => {
    res.send('PeerLearn Backend Running');
});

app.get('/health', async (req, res) => {
    try {
        await db.query('SELECT 1');
        return res.json({ ok: true, service: 'peerlearn-backend' });
    } catch (error) {
        return res.status(500).json({ ok: false, message: 'DB health check failed' });
    }
});

// Start Server
const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

// Socket.io Setup
const io = require('socket.io')(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
app.set('io', io);

function startSessionReminderWorker() {
    const runReminderCheck = async () => {
        try {
            const result = await db.query(
                `SELECT id, student_id, scheduled_at
                 FROM course_sessions
                 WHERE status = 'scheduled'
                   AND reminder_sent_10m = FALSE
                   AND scheduled_at > NOW()
                   AND scheduled_at <= NOW() + INTERVAL '10 minutes'`
            );

            for (const session of result.rows) {
                await db.query(
                    `INSERT INTO notifications (user_id, title, body, type, related_session_id)
                     VALUES ($1, 'Session Reminder', 'Your live session starts in less than 10 minutes.', 'session_reminder', $2)`,
                    [session.student_id, session.id]
                );
                await db.query(
                    `UPDATE course_sessions
                     SET reminder_sent_10m = TRUE
                     WHERE id = $1`,
                    [session.id]
                );
                io.to(`user:${session.student_id}`).emit('notification', {
                    title: 'Session Reminder',
                    body: 'Your live session starts in less than 10 minutes.',
                    relatedSessionId: session.id,
                });
            }
        } catch (error) {
            console.error('Session reminder worker failed:', error.message);
        }
    };

    runReminderCheck();
    setInterval(runReminderCheck, 60000);
}

async function canUserJoinLiveRoom(userId, roomId) {
    const result = await db.query(
        `SELECT id, instructor_id, student_id, status, scheduled_at, duration_minutes
         FROM course_sessions
         WHERE meeting_room_id = $1
         LIMIT 1`,
        [roomId]
    );
    if (result.rows.length === 0) {
        return false;
    }

    const session = result.rows[0];
    if (session.status !== 'live') {
        return false;
    }

    const isInstructor = Number(session.instructor_id) === Number(userId);
    const isStudent = Number(session.student_id) === Number(userId);
    if (!isInstructor && !isStudent) {
        return false;
    }

    if (isInstructor) {
        return true;
    }

    // Student can join only around scheduled time.
    const scheduled = new Date(session.scheduled_at).getTime();
    const durationMs = Number(session.duration_minutes || 60) * 60 * 1000;
    const startWindow = scheduled;
    const endWindow = scheduled + durationMs + 30 * 60 * 1000;
    const now = Date.now();
    return now >= startWindow && now <= endWindow;
}

async function canAccessCourseChat(userId, courseId, peerId) {
    const courseResult = await db.query('SELECT id, instructor_id FROM courses WHERE id = $1', [courseId]);
    if (courseResult.rows.length === 0) {
        return false;
    }
    const course = courseResult.rows[0];
    const isInstructor = Number(course.instructor_id) === Number(userId);

    if (isInstructor) {
        const enrolled = await db.query('SELECT id FROM enrollments WHERE course_id = $1 AND user_id = $2', [courseId, peerId]);
        return enrolled.rows.length > 0;
    }

    const isUserEnrolled = await db.query('SELECT id FROM enrollments WHERE course_id = $1 AND user_id = $2', [courseId, userId]);
    if (isUserEnrolled.rows.length === 0) {
        return false;
    }
    return Number(peerId) === Number(course.instructor_id);
}

io.on('connection', (socket) => {
    console.log('New client connected', socket.id);
    const token = socket.handshake?.auth?.token;
    if (!token || !process.env.JWT_SECRET) {
        socket.emit('room-access-denied', { message: 'Missing auth token for live session.' });
        socket.disconnect();
        return;
    }

    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.data.userId = decoded.id;
        socket.join(`user:${decoded.id}`);
    } catch (error) {
        socket.emit('room-access-denied', { message: 'Invalid auth token for live session.' });
        socket.disconnect();
        return;
    }

    socket.on('join-room', async (roomId) => {
        const normalizedRoomId = String(roomId || '');
        if (!normalizedRoomId) {
            return;
        }

        const allowed = await canUserJoinLiveRoom(socket.data.userId, normalizedRoomId);
        if (!allowed) {
            socket.emit('room-access-denied', { message: 'You are not allowed to join this live room now.' });
            return;
        }

        socket.join(normalizedRoomId);
        socket.data.roomId = normalizedRoomId;

        const clientsInRoom = io.sockets.adapter.rooms.get(normalizedRoomId) || new Set();
        const otherSocketIds = Array.from(clientsInRoom).filter((id) => id !== socket.id);
        socket.emit('room-users', otherSocketIds);
        socket.to(normalizedRoomId).emit('user-joined-room', socket.id);
    });

    socket.on('sending-signal', ({ userToSignal, signal }) => {
        io.to(userToSignal).emit('user-joined', { signal, callerID: socket.id });
    });

    socket.on('returning-signal', ({ callerID, signal }) => {
        io.to(callerID).emit('receiving-returned-signal', { signal, id: socket.id });
    });

    socket.on('join-chat', async ({ courseId, peerId }) => {
        const allowed = await canAccessCourseChat(socket.data.userId, Number(courseId), Number(peerId));
        if (!allowed) {
            socket.emit('chat-access-denied', { message: 'Not allowed for this chat.' });
            return;
        }
        const room = `chat:${courseId}:${Math.min(socket.data.userId, Number(peerId))}:${Math.max(socket.data.userId, Number(peerId))}`;
        socket.join(room);
        socket.data.chatRoom = room;
    });

    socket.on('send-chat-message', async ({ courseId, peerId, message }, cb) => {
        try {
            const trimmed = String(message || '').trim();
            if (!trimmed) {
                cb?.({ ok: false, message: 'Message is empty.' });
                return;
            }
            const allowed = await canAccessCourseChat(socket.data.userId, Number(courseId), Number(peerId));
            if (!allowed) {
                cb?.({ ok: false, message: 'Not allowed for this chat.' });
                return;
            }
            const result = await db.query(
                `INSERT INTO course_chat_messages (course_id, sender_id, receiver_id, message)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id, course_id, sender_id, receiver_id, message, created_at`,
                [courseId, socket.data.userId, peerId, trimmed]
            );
            const msg = result.rows[0];
            const room = `chat:${courseId}:${Math.min(socket.data.userId, Number(peerId))}:${Math.max(socket.data.userId, Number(peerId))}`;
            io.to(room).emit('chat-message', msg);
            io.to(`user:${peerId}`).emit('chat-message', msg);
            cb?.({ ok: true, message: msg });
        } catch (error) {
            cb?.({ ok: false, message: 'Failed to send message.' });
        }
    });

    socket.on('disconnect', () => {
        const roomId = socket.data.roomId;
        if (roomId) {
            socket.to(roomId).emit('user-left', socket.id);
        }
        console.log('Client disconnected', socket.id);
    });
});
