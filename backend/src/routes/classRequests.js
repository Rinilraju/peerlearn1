const express = require('express');
const authenticateToken = require('../middleware/auth');
const db = require('../db');

const router = express.Router();

router.post('/', authenticateToken, async (req, res) => {
    const requesterId = req.user.id;
    const { tutorId, topic, message, preferredTime, offeredPriceInr } = req.body || {};

    if (!tutorId || !topic) {
        return res.status(400).json({ message: 'tutorId and topic are required.' });
    }
    if (Number(tutorId) === Number(requesterId)) {
        return res.status(400).json({ message: 'You cannot send a request to yourself.' });
    }

    try {
        const offeredPriceValue = offeredPriceInr !== undefined && offeredPriceInr !== null
            ? Number(offeredPriceInr)
            : null;
        if (offeredPriceValue !== null && (!Number.isFinite(offeredPriceValue) || offeredPriceValue < 0)) {
            return res.status(400).json({ message: 'Offered price must be a positive number.' });
        }

        const tutorResult = await db.query(
            `SELECT id, role FROM users WHERE id = $1 LIMIT 1`,
            [tutorId]
        );
        if (tutorResult.rows.length === 0) {
            return res.status(404).json({ message: 'Tutor not found.' });
        }

        const duplicate = await db.query(
            `SELECT id
             FROM class_requests
             WHERE requester_id = $1
               AND tutor_id = $2
               AND status = 'pending'
             LIMIT 1`,
            [requesterId, tutorId]
        );
        if (duplicate.rows.length > 0) {
            return res.status(400).json({ message: 'You already have a pending request for this tutor.' });
        }

        const result = await db.query(
            `INSERT INTO class_requests (requester_id, tutor_id, topic, message, preferred_time, offered_price_inr)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [
                requesterId,
                tutorId,
                String(topic).trim(),
                message || null,
                preferredTime ? new Date(preferredTime).toISOString() : null,
                offeredPriceValue,
            ]
        );

        const io = req.app.get('io');
        io?.to(`user:${tutorId}`).emit('notification', {
            title: 'New Class Request',
            body: 'You have received a new class request. You can accept and schedule a session.',
            type: 'class_request',
            action: 'redirect_create_course',
            redirectToCreateCourse: true,
            relatedRequestId: result.rows[0].id,
        });

        return res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Failed to create class request:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

router.get('/incoming', authenticateToken, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT r.*, u.name AS requester_name, u.username AS requester_username, u.email AS requester_email
             FROM class_requests r
             INNER JOIN users u ON u.id = r.requester_id
             WHERE r.tutor_id = $1
             ORDER BY r.created_at DESC`,
            [req.user.id]
        );
        return res.json(result.rows);
    } catch (error) {
        console.error('Failed to fetch incoming class requests:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

router.get('/outgoing', authenticateToken, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT r.*, u.name AS tutor_name, u.username AS tutor_username, u.email AS tutor_email
             FROM class_requests r
             INNER JOIN users u ON u.id = r.tutor_id
             WHERE r.requester_id = $1
             ORDER BY r.created_at DESC`,
            [req.user.id]
        );
        return res.json(result.rows);
    } catch (error) {
        console.error('Failed to fetch outgoing class requests:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

router.patch('/:id/status', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body || {};
    if (!['accepted', 'rejected'].includes(String(status))) {
        return res.status(400).json({ message: 'Status must be accepted or rejected.' });
    }

    try {
        const result = await db.query(
            `UPDATE class_requests
             SET status = $1, responded_at = CURRENT_TIMESTAMP
             WHERE id = $2 AND tutor_id = $3 AND status = 'pending'
             RETURNING *`,
            [status, id, req.user.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Pending request not found.' });
        }

        const request = result.rows[0];
        const io = req.app.get('io');
        io?.to(`user:${request.requester_id}`).emit('notification', {
            title: `Class Request ${status === 'accepted' ? 'Accepted' : 'Rejected'}`,
            body: `Your class request has been ${status}.`,
            relatedRequestId: request.id,
        });

        return res.json(request);
    } catch (error) {
        console.error('Failed to update class request status:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

router.post('/:id/schedule', authenticateToken, async (req, res) => {
    const tutorId = req.user.id;
    const { id } = req.params;
    const { courseId, scheduledAt, durationMinutes } = req.body || {};

    if (!courseId || !scheduledAt) {
        return res.status(400).json({ message: 'courseId and scheduledAt are required.' });
    }

    try {
        const requestRes = await db.query(
            `SELECT * FROM class_requests WHERE id = $1 AND tutor_id = $2`,
            [id, tutorId]
        );
        if (requestRes.rows.length === 0) {
            return res.status(404).json({ message: 'Class request not found.' });
        }
        const request = requestRes.rows[0];
        if (request.status === 'rejected') {
            return res.status(400).json({ message: 'Cannot schedule a rejected request.' });
        }
        if (request.scheduled_session_id) {
            return res.status(400).json({ message: 'This request already has a scheduled session.' });
        }

        const scheduledAtDate = new Date(scheduledAt);
        if (Number.isNaN(scheduledAtDate.getTime())) {
            return res.status(400).json({ message: 'Invalid scheduledAt value.' });
        }
        if (scheduledAtDate.getTime() < Date.now()) {
            return res.status(400).json({ message: 'Scheduled time must be in the future.' });
        }

        const courseRes = await db.query(
            `SELECT id, title, total_sessions FROM courses WHERE id = $1 AND instructor_id = $2`,
            [courseId, tutorId]
        );
        if (courseRes.rows.length === 0) {
            return res.status(403).json({ message: 'Only course instructor can schedule sessions.' });
        }
        const totalSessions = Number(courseRes.rows[0].total_sessions || 1);

        let enrollmentRes = await db.query(
            `SELECT id, sessions_completed FROM enrollments WHERE user_id = $1 AND course_id = $2`,
            [request.requester_id, courseId]
        );
        if (enrollmentRes.rows.length === 0) {
            await db.query(
                `INSERT INTO enrollments (user_id, course_id)
                 VALUES ($1, $2)
                 ON CONFLICT (user_id, course_id) DO NOTHING`,
                [request.requester_id, courseId]
            );
            enrollmentRes = await db.query(
                `SELECT id, sessions_completed FROM enrollments WHERE user_id = $1 AND course_id = $2`,
                [request.requester_id, courseId]
            );
        }

        const completedSessions = Number(enrollmentRes.rows[0]?.sessions_completed || 0);
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
            [tutorId, request.requester_id, scheduledAtDate.toISOString(), requestedDuration]
        );
        if (overlapCheck.rows.length > 0) {
            return res.status(400).json({ message: 'Session overlaps with an existing class for tutor/student.' });
        }

        const roomId = `course-${courseId}-student-${request.requester_id}-${Date.now()}`;
        const sessionRes = await db.query(
            `INSERT INTO course_sessions (course_id, instructor_id, student_id, scheduled_at, duration_minutes, meeting_room_id)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [courseId, tutorId, request.requester_id, scheduledAtDate.toISOString(), requestedDuration, roomId]
        );
        const session = sessionRes.rows[0];

        await db.query(
            `UPDATE class_requests
             SET status = 'accepted',
                 responded_at = COALESCE(responded_at, CURRENT_TIMESTAMP),
                 scheduled_session_id = $1
             WHERE id = $2`,
            [session.id, request.id]
        );

        await db.query(
            `INSERT INTO notifications (user_id, title, body, type, related_session_id)
             VALUES ($1, $2, $3, 'session_scheduled', $4)`,
            [
                request.requester_id,
                'Class Request Scheduled',
                `Your tutor scheduled a session for ${new Date(session.scheduled_at).toLocaleString()}.`,
                session.id,
            ]
        );
        const io = req.app.get('io');
        io?.to(`user:${request.requester_id}`).emit('notification', {
            title: 'Class Request Scheduled',
            body: `Your tutor scheduled a session for ${new Date(session.scheduled_at).toLocaleString()}.`,
            relatedSessionId: session.id,
        });

        return res.status(201).json({ requestId: request.id, session });
    } catch (error) {
        console.error('Failed to schedule class request:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
