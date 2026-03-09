const express = require('express');
const authenticateToken = require('../middleware/auth');
const db = require('../db');

const router = express.Router();

function requireAdmin(req, res, next) {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required.' });
    }
    return next();
}

router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const [users, courses, enrollments, sessions, requests, revenue] = await Promise.all([
            db.query('SELECT COUNT(*)::int AS count FROM users'),
            db.query('SELECT COUNT(*)::int AS count FROM courses'),
            db.query('SELECT COUNT(*)::int AS count FROM enrollments'),
            db.query('SELECT COUNT(*)::int AS count FROM course_sessions'),
            db.query(`SELECT COUNT(*)::int AS count FROM class_requests WHERE status = 'pending'`),
            db.query(`SELECT COALESCE(SUM(amount), 0)::float AS total FROM payments WHERE status IN ('paid', 'completed')`),
        ]);

        return res.json({
            users: users.rows[0].count,
            courses: courses.rows[0].count,
            enrollments: enrollments.rows[0].count,
            sessions: sessions.rows[0].count,
            pending_class_requests: requests.rows[0].count,
            revenue_total: revenue.rows[0].total,
        });
    } catch (error) {
        console.error('Failed to fetch admin stats:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

router.get('/audit-logs', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT id, user_id, action, path, method, ip, created_at
             FROM audit_logs
             ORDER BY created_at DESC
             LIMIT 100`
        );
        return res.json(result.rows);
    } catch (error) {
        console.error('Failed to fetch audit logs:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
