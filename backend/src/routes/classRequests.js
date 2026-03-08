const express = require('express');
const authenticateToken = require('../middleware/auth');
const db = require('../db');

const router = express.Router();

router.post('/', authenticateToken, async (req, res) => {
    const requesterId = req.user.id;
    const { tutorId, topic, message, preferredTime } = req.body || {};

    if (!tutorId || !topic) {
        return res.status(400).json({ message: 'tutorId and topic are required.' });
    }
    if (Number(tutorId) === Number(requesterId)) {
        return res.status(400).json({ message: 'You cannot send a request to yourself.' });
    }

    try {
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
            `INSERT INTO class_requests (requester_id, tutor_id, topic, message, preferred_time)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [requesterId, tutorId, String(topic).trim(), message || null, preferredTime ? new Date(preferredTime).toISOString() : null]
        );

        const io = req.app.get('io');
        io?.to(`user:${tutorId}`).emit('notification', {
            title: 'New Class Request',
            body: 'You have received a new class request.',
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

module.exports = router;
