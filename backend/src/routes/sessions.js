const express = require('express');
const authenticateToken = require('../middleware/auth');
const db = require('../db');

const router = express.Router();

async function isStudentEnrolled(studentId, courseId) {
    const enrolled = await db.query(
        'SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2',
        [studentId, courseId]
    );
    return enrolled.rows.length > 0;
}

function getWindowBounds(session) {
    const scheduled = new Date(session.scheduled_at).getTime();
    const durationMs = Number(session.duration_minutes || 60) * 60 * 1000;
    const startWindow = scheduled - 15 * 60 * 1000;
    const endWindow = scheduled + durationMs + 30 * 60 * 1000;
    return { startWindow, endWindow };
}

function attachSessionAccessFlags(session, userId) {
    const now = Date.now();
    const { startWindow, endWindow } = getWindowBounds(session);
    const isInstructor = Number(session.instructor_id) === Number(userId);
    const isStudent = Number(session.student_id) === Number(userId);
    const isLive = session.status === 'live';

    const canStart = isInstructor && session.status === 'scheduled' && now >= startWindow && now <= endWindow;
    const canJoinAsInstructor = isInstructor && isLive;
    const canJoinAsStudent = isStudent && isLive && now >= startWindow && now <= endWindow;

    return {
        ...session,
        can_start: canStart,
        can_join: canJoinAsInstructor || canJoinAsStudent,
        join_enabled_for_student: canJoinAsStudent,
        join_enabled_for_instructor: canJoinAsInstructor,
    };
}

router.get('/course/:courseId/students', authenticateToken, async (req, res) => {
    const instructorId = req.user.id;
    const { courseId } = req.params;

    try {
        const owner = await db.query('SELECT id FROM courses WHERE id = $1 AND instructor_id = $2', [courseId, instructorId]);
        if (owner.rows.length === 0) {
            return res.status(403).json({ message: 'Only course instructor can view enrolled students.' });
        }

        const result = await db.query(
            `SELECT u.id, u.name, u.email, e.enrolled_at
             FROM enrollments e
             INNER JOIN users u ON u.id = e.user_id
             WHERE e.course_id = $1
             ORDER BY e.enrolled_at DESC`,
            [courseId]
        );
        return res.json(result.rows);
    } catch (error) {
        console.error('Failed to fetch enrolled students:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

router.post('/', authenticateToken, async (req, res) => {
    const instructorId = req.user.id;
    const { courseId, studentId, scheduledAt, durationMinutes } = req.body;

    if (!courseId || !studentId || !scheduledAt) {
        return res.status(400).json({ message: 'courseId, studentId and scheduledAt are required.' });
    }

    try {
        const owner = await db.query('SELECT id, title FROM courses WHERE id = $1 AND instructor_id = $2', [courseId, instructorId]);
        if (owner.rows.length === 0) {
            return res.status(403).json({ message: 'Only course instructor can schedule sessions.' });
        }

        const enrolled = await isStudentEnrolled(studentId, courseId);
        if (!enrolled) {
            return res.status(400).json({ message: 'Student is not enrolled in this course.' });
        }

        const roomId = `course-${courseId}-student-${studentId}-${Date.now()}`;
        const result = await db.query(
            `INSERT INTO course_sessions (course_id, instructor_id, student_id, scheduled_at, duration_minutes, meeting_room_id)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [courseId, instructorId, studentId, scheduledAt, durationMinutes || 60, roomId]
        );

        const session = result.rows[0];
        await db.query(
            `INSERT INTO notifications (user_id, title, body, type, related_session_id)
             VALUES ($1, $2, $3, 'session_scheduled', $4)`,
            [
                studentId,
                'New 1:1 Session Scheduled',
                `Your tutor scheduled a session for ${new Date(session.scheduled_at).toLocaleString()}.`,
                session.id,
            ]
        );

        return res.status(201).json(session);
    } catch (error) {
        console.error('Failed to create session:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

router.get('/mine', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const result = await db.query(
            `SELECT s.*, c.title AS course_title, i.name AS instructor_name, st.name AS student_name
             FROM course_sessions s
             INNER JOIN courses c ON c.id = s.course_id
             INNER JOIN users i ON i.id = s.instructor_id
             INNER JOIN users st ON st.id = s.student_id
             WHERE s.instructor_id = $1 OR s.student_id = $1
             ORDER BY s.scheduled_at ASC`,
            [userId]
        );
        return res.json(result.rows.map((row) => attachSessionAccessFlags(row, userId)));
    } catch (error) {
        console.error('Failed to fetch sessions:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

router.post('/:id/start', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;

    try {
        const result = await db.query('SELECT * FROM course_sessions WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Session not found.' });
        }

        const session = result.rows[0];
        const state = attachSessionAccessFlags(session, userId);
        if (!state.can_start) {
            return res.status(403).json({ message: 'You are not allowed to start this session now.' });
        }

        const updated = await db.query(
            `UPDATE course_sessions
             SET status = 'live', started_at = CURRENT_TIMESTAMP
             WHERE id = $1
             RETURNING *`,
            [id]
        );

        await db.query(
            `INSERT INTO notifications (user_id, title, body, type, related_session_id)
             VALUES ($1, 'Live Session Started', 'Your tutor started the session. You can join now.', 'session_live', $2)`,
            [session.student_id, id]
        );

        const liveSession = attachSessionAccessFlags(updated.rows[0], userId);
        return res.json({
            session: liveSession,
            roomId: liveSession.meeting_room_id,
            joinUrl: `/session/${liveSession.meeting_room_id}`,
        });
    } catch (error) {
        console.error('Failed to start session:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

router.post('/:id/end', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;

    try {
        const result = await db.query('SELECT * FROM course_sessions WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Session not found.' });
        }
        const session = result.rows[0];
        if (Number(session.instructor_id) !== Number(userId)) {
            return res.status(403).json({ message: 'Only tutor can end this session.' });
        }

        await db.query(
            `UPDATE course_sessions
             SET status = 'completed', ended_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [id]
        );

        return res.json({ ok: true });
    } catch (error) {
        console.error('Failed to end session:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

router.get('/room/:roomId/access', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const { roomId } = req.params;

    try {
        const result = await db.query(
            `SELECT s.*, c.title AS course_title
             FROM course_sessions s
             INNER JOIN courses c ON c.id = s.course_id
             WHERE s.meeting_room_id = $1
             LIMIT 1`,
            [roomId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Session room not found.' });
        }

        const session = attachSessionAccessFlags(result.rows[0], userId);
        if (!session.can_join) {
            return res.status(403).json({ message: 'You are not allowed to join this room right now.' });
        }

        return res.json({
            allowed: true,
            sessionId: session.id,
            roomId: session.meeting_room_id,
            courseTitle: session.course_title,
        });
    } catch (error) {
        console.error('Failed to validate room access:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

router.get('/notifications', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const result = await db.query(
            `SELECT id, title, body, type, related_session_id, is_read, created_at
             FROM notifications
             WHERE user_id = $1
             ORDER BY created_at DESC`,
            [userId]
        );
        return res.json(result.rows);
    } catch (error) {
        console.error('Failed to fetch notifications:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

router.patch('/notifications/:id/read', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    try {
        const result = await db.query(
            `UPDATE notifications
             SET is_read = TRUE
             WHERE id = $1 AND user_id = $2
             RETURNING id`,
            [id, userId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Notification not found.' });
        }
        return res.json({ ok: true });
    } catch (error) {
        console.error('Failed to mark notification as read:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
