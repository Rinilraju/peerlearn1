const express = require('express');
const authenticateToken = require('../middleware/auth');
const db = require('../db');

const router = express.Router();

async function getEnrollment(studentId, courseId) {
    const enrolled = await db.query(
        'SELECT id, sessions_completed FROM enrollments WHERE user_id = $1 AND course_id = $2',
        [studentId, courseId]
    );
    return enrolled.rows[0] || null;
}

function getWindowBounds(session) {
    const scheduled = new Date(session.scheduled_at).getTime();
    const durationMs = Number(session.duration_minutes || 60) * 60 * 1000;
    const startWindow = scheduled;
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
        total_sessions: Number(session.total_sessions || 1),
        sessions_completed: Number(session.sessions_completed || 0),
        sessions_remaining: Math.max(0, Number(session.total_sessions || 1) - Number(session.sessions_completed || 0)),
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
            `SELECT u.id, u.name, u.email, e.enrolled_at, e.sessions_completed, c.total_sessions
             FROM enrollments e
             INNER JOIN users u ON u.id = e.user_id
             INNER JOIN courses c ON c.id = e.course_id
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
        const scheduledAtDate = new Date(scheduledAt);
        if (Number.isNaN(scheduledAtDate.getTime())) {
            return res.status(400).json({ message: 'Invalid scheduledAt value.' });
        }
        if (scheduledAtDate.getTime() < Date.now()) {
            return res.status(400).json({ message: 'Scheduled time must be in the future.' });
        }

        const owner = await db.query('SELECT id, title, total_sessions FROM courses WHERE id = $1 AND instructor_id = $2', [courseId, instructorId]);
        if (owner.rows.length === 0) {
            return res.status(403).json({ message: 'Only course instructor can schedule sessions.' });
        }
        const totalSessions = Number(owner.rows[0].total_sessions || 1);

        const enrollment = await getEnrollment(studentId, courseId);
        if (!enrollment) {
            return res.status(400).json({ message: 'Student is not enrolled in this course.' });
        }
        const completedSessions = Number(enrollment.sessions_completed || 0);
        if (completedSessions >= totalSessions) {
            return res.status(400).json({ message: 'All sessions are already completed for this student in this course.' });
        }

        const requestedDuration = Number(durationMinutes || 60);
        if (requestedDuration < 15 || requestedDuration > 240) {
            return res.status(400).json({ message: 'Duration must be between 15 and 240 minutes.' });
        }

        const overlapCheck = await db.query(
            `SELECT id
             FROM course_sessions
             WHERE status IN ('scheduled', 'live')
               AND (instructor_id = $1 OR student_id = $2)
               AND scheduled_at < ($3::timestamp + ($4 * INTERVAL '1 minute'))
               AND (scheduled_at + (duration_minutes * INTERVAL '1 minute')) > $3::timestamp
             LIMIT 1`,
            [instructorId, studentId, scheduledAtDate.toISOString(), requestedDuration]
        );
        if (overlapCheck.rows.length > 0) {
            return res.status(400).json({ message: 'Session overlaps with an existing class for tutor/student.' });
        }

        const roomId = `course-${courseId}-student-${studentId}-${Date.now()}`;
        const result = await db.query(
            `INSERT INTO course_sessions (course_id, instructor_id, student_id, scheduled_at, duration_minutes, meeting_room_id)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [courseId, instructorId, studentId, scheduledAtDate.toISOString(), requestedDuration, roomId]
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
        const io = req.app.get('io');
        io?.to(`user:${studentId}`).emit('notification', {
            title: 'New 1:1 Session Scheduled',
            body: `Your tutor scheduled a session for ${new Date(session.scheduled_at).toLocaleString()}.`,
            relatedSessionId: session.id,
        });

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
            `SELECT s.*,
                    c.title AS course_title,
                    c.total_sessions,
                    e.sessions_completed,
                    i.name AS instructor_name,
                    st.name AS student_name
             FROM course_sessions s
             INNER JOIN courses c ON c.id = s.course_id
             INNER JOIN enrollments e ON e.course_id = s.course_id AND e.user_id = s.student_id
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
        const io = req.app.get('io');
        io?.to(`user:${session.student_id}`).emit('notification', {
            title: 'Live Session Started',
            body: 'Your tutor started the session. You can join now.',
            relatedSessionId: Number(id),
        });

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
        if (session.status === 'completed') {
            return res.status(400).json({ message: 'Session is already marked as completed.' });
        }

        await db.query(
            `UPDATE course_sessions
             SET status = 'completed', ended_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [id]
        );

        const progress = await db.query(
            `UPDATE enrollments e
             SET sessions_completed = LEAST(
                e.sessions_completed + 1,
                COALESCE((SELECT c.total_sessions FROM courses c WHERE c.id = e.course_id), 1)
             )
             WHERE e.course_id = $1 AND e.user_id = $2
             RETURNING e.sessions_completed`,
            [session.course_id, session.student_id]
        );

        const courseMeta = await db.query('SELECT total_sessions FROM courses WHERE id = $1', [session.course_id]);
        const totalSessions = Number(courseMeta.rows[0]?.total_sessions || 1);
        const completed = Number(progress.rows[0]?.sessions_completed || 0);
        const remaining = Math.max(0, totalSessions - completed);
        const courseCompleted = remaining === 0;

        await db.query(
            `INSERT INTO notifications (user_id, title, body, type, related_session_id)
             VALUES ($1, $2, $3, $4, $5)`,
            [
                session.student_id,
                courseCompleted ? 'Course Sessions Completed' : 'Session Completed',
                courseCompleted
                    ? 'All scheduled sessions for this course are completed.'
                    : `Session marked complete. ${remaining} session(s) remaining.`,
                courseCompleted ? 'course_completed' : 'session_completed',
                id,
            ]
        );
        const io = req.app.get('io');
        io?.to(`user:${session.student_id}`).emit('notification', {
            title: courseCompleted ? 'Course Sessions Completed' : 'Session Completed',
            body: courseCompleted
                ? 'All scheduled sessions for this course are completed.'
                : `Session marked complete. ${remaining} session(s) remaining.`,
            relatedSessionId: Number(id),
        });

        return res.json({ ok: true, sessions_completed: completed, total_sessions: totalSessions, sessions_remaining: remaining, course_completed: courseCompleted });
    } catch (error) {
        console.error('Failed to end session:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

router.delete('/:id', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;

    try {
        const result = await db.query('SELECT * FROM course_sessions WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Session not found.' });
        }

        const session = result.rows[0];
        if (Number(session.instructor_id) !== Number(userId)) {
            return res.status(403).json({ message: 'Only tutor can delete scheduled sessions.' });
        }
        if (!['scheduled', 'live'].includes(session.status)) {
            return res.status(400).json({ message: 'Only scheduled or live sessions can be deleted.' });
        }

        await db.query('DELETE FROM course_sessions WHERE id = $1', [id]);

        const cancellationBody = session.status === 'live'
            ? 'Your tutor ended and removed a live session.'
            : 'Your tutor cancelled a scheduled session.';
        await db.query(
            `INSERT INTO notifications (user_id, title, body, type)
             VALUES ($1, 'Session Cancelled', $2, 'session_cancelled')`,
            [session.student_id, cancellationBody]
        );
        const io = req.app.get('io');
        io?.to(`user:${session.student_id}`).emit('notification', {
            title: 'Session Cancelled',
            body: cancellationBody,
        });

        return res.json({ ok: true });
    } catch (error) {
        console.error('Failed to delete session:', error);
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

        const participantRole = Number(session.instructor_id) === Number(userId) ? 'instructor' : 'student';

        return res.json({
            allowed: true,
            sessionId: session.id,
            roomId: session.meeting_room_id,
            courseTitle: session.course_title,
            participantRole,
        });
    } catch (error) {
        console.error('Failed to validate room access:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

router.get('/:id/attendance', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    try {
        const sessionResult = await db.query('SELECT id, instructor_id, student_id FROM course_sessions WHERE id = $1 LIMIT 1', [id]);
        if (sessionResult.rows.length === 0) {
            return res.status(404).json({ message: 'Session not found.' });
        }
        const session = sessionResult.rows[0];
        const isParticipant = Number(session.instructor_id) === Number(userId) || Number(session.student_id) === Number(userId);
        const isAdmin = String(req.user.role || '') === 'admin';
        if (!isParticipant && !isAdmin) {
            return res.status(403).json({ message: 'Not allowed to access attendance evidence for this session.' });
        }

        const logsResult = await db.query(
            `SELECT l.id, l.user_id, u.name AS user_name, l.joined_at, l.left_at,
                    GREATEST(0, EXTRACT(EPOCH FROM (COALESCE(l.left_at, CURRENT_TIMESTAMP) - l.joined_at)))::INT AS duration_seconds
             FROM session_attendance_logs l
             INNER JOIN users u ON u.id = l.user_id
             WHERE l.session_id = $1
             ORDER BY l.joined_at ASC`,
            [id]
        );

        const summaryByUser = {};
        for (const row of logsResult.rows) {
            if (!summaryByUser[row.user_id]) {
                summaryByUser[row.user_id] = {
                    user_id: row.user_id,
                    user_name: row.user_name,
                    total_duration_seconds: 0,
                    join_count: 0,
                };
            }
            summaryByUser[row.user_id].total_duration_seconds += Number(row.duration_seconds || 0);
            summaryByUser[row.user_id].join_count += 1;
        }

        return res.json({
            session_id: Number(id),
            logs: logsResult.rows,
            summary: Object.values(summaryByUser),
        });
    } catch (error) {
        console.error('Failed to fetch attendance evidence:', error);
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

router.delete('/notifications', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        await db.query('DELETE FROM notifications WHERE user_id = $1', [userId]);
        return res.json({ ok: true });
    } catch (error) {
        console.error('Failed to clear notifications:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
