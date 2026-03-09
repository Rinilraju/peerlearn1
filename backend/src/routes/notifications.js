const express = require('express');
const authenticateToken = require('../middleware/auth');
const db = require('../db');

const router = express.Router();

router.get('/mine', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const result = await db.query(
            `SELECT id, title, body, type, related_session_id, is_read, created_at
             FROM notifications
             WHERE user_id = $1
             ORDER BY created_at DESC
             LIMIT 200`,
            [userId]
        );
        return res.json(result.rows);
    } catch (error) {
        console.error('Failed to fetch notifications:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

router.patch('/:id/read', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const result = await db.query(
            `UPDATE notifications
             SET is_read = TRUE
             WHERE id = $1 AND user_id = $2
             RETURNING id`,
            [req.params.id, userId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Notification not found.' });
        }
        return res.json({ ok: true });
    } catch (error) {
        console.error('Failed to mark notification read:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
