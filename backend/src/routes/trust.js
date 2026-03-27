const express = require('express');
const authenticateToken = require('../middleware/auth');
const db = require('../db');

const router = express.Router();

const VALID_CATEGORIES = new Set([
    'no_show',
    'payment_fraud',
    'abuse',
    'impersonation',
    'off_platform_scam',
    'content_mismatch',
    'other',
]);

router.post('/reports', authenticateToken, async (req, res) => {
    const reporterId = req.user.id;
    const { reportedUserId, courseId, sessionId, category, details, priority } = req.body;

    const safeCategory = String(category || '').trim().toLowerCase();
    const safeDetails = String(details || '').trim();
    const safePriority = ['low', 'normal', 'high', 'critical'].includes(String(priority || '').toLowerCase())
        ? String(priority).toLowerCase()
        : 'normal';

    if (!VALID_CATEGORIES.has(safeCategory)) {
        return res.status(400).json({ message: 'Invalid report category.' });
    }
    if (!safeDetails || safeDetails.length < 10) {
        return res.status(400).json({ message: 'Please provide at least 10 characters in details.' });
    }

    try {
        if (sessionId) {
            const session = await db.query(
                'SELECT id, instructor_id, student_id, course_id FROM course_sessions WHERE id = $1 LIMIT 1',
                [sessionId]
            );
            if (session.rows.length === 0) {
                return res.status(404).json({ message: 'Session not found.' });
            }
            const row = session.rows[0];
            const participant = Number(row.instructor_id) === Number(reporterId) || Number(row.student_id) === Number(reporterId);
            if (!participant) {
                return res.status(403).json({ message: 'You can only report sessions you are part of.' });
            }
        }

        const result = await db.query(
            `INSERT INTO dispute_reports (reporter_id, reported_user_id, course_id, session_id, category, details, priority)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id, reporter_id, reported_user_id, course_id, session_id, category, details, status, priority, created_at`,
            [reporterId, reportedUserId || null, courseId || null, sessionId || null, safeCategory, safeDetails, safePriority]
        );

        return res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Failed to create dispute report:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

router.get('/my-reports', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const result = await db.query(
            `SELECT dr.id, dr.category, dr.details, dr.status, dr.priority, dr.created_at, dr.updated_at,
                    dr.session_id, dr.course_id,
                    ru.id AS reported_user_id, ru.name AS reported_user_name
             FROM dispute_reports dr
             LEFT JOIN users ru ON ru.id = dr.reported_user_id
             WHERE dr.reporter_id = $1
             ORDER BY dr.created_at DESC`,
            [userId]
        );
        return res.json(result.rows);
    } catch (error) {
        console.error('Failed to fetch my reports:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
