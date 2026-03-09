const express = require('express');
const authenticateToken = require('../middleware/auth');
const db = require('../db');

const router = express.Router();

router.get('/notes/:sessionId', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const sessionId = Number(req.params.sessionId);
    try {
        const result = await db.query(
            `SELECT id, notes, updated_at
             FROM session_notes
             WHERE session_id = $1 AND user_id = $2
             LIMIT 1`,
            [sessionId, userId]
        );
        if (result.rows.length === 0) return res.json({ notes: '' });
        return res.json(result.rows[0]);
    } catch (error) {
        console.error('Failed to fetch session notes:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

router.put('/notes/:sessionId', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const sessionId = Number(req.params.sessionId);
    const notes = String(req.body?.notes || '');
    try {
        const result = await db.query(
            `INSERT INTO session_notes (session_id, user_id, notes)
             VALUES ($1, $2, $3)
             ON CONFLICT (session_id, user_id)
             DO UPDATE SET notes = EXCLUDED.notes, updated_at = CURRENT_TIMESTAMP
             RETURNING id, notes, updated_at`,
            [sessionId, userId, notes]
        );
        return res.json(result.rows[0]);
    } catch (error) {
        console.error('Failed to save session notes:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
