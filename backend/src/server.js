const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
    const fs = require('fs');
    const logMessage = `${new Date().toISOString()} - ${req.method} ${req.url}\n`;
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

app.use('/auth', authRoutes);
app.use('/doubts', doubtRoutes);
app.use('/courses', courseRoutes);
app.use('/recommendations', recommendationRoutes);
app.use('/payments', paymentRoutes);
app.use('/sessions', sessionRoutes);
app.use('/chat', chatRoutes);

app.get('/', (req, res) => {
    res.send('PeerLearn Backend Running');
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

io.on('connection', (socket) => {
    console.log('New client connected', socket.id);

    socket.on('join-room', (roomId) => {
        const normalizedRoomId = String(roomId || '');
        if (!normalizedRoomId) {
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

    socket.on('disconnect', () => {
        const roomId = socket.data.roomId;
        if (roomId) {
            socket.to(roomId).emit('user-left', socket.id);
        }
        console.log('Client disconnected', socket.id);
    });
});
