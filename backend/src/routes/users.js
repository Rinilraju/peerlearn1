const express = require('express');
const authenticateToken = require('../middleware/auth');
const db = require('../db');

const router = express.Router();

router.get('/search', authenticateToken, async (req, res) => {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) {
        return res.json([]);
    }

    try {
        const result = await db.query(
            `SELECT id, name, username, role, profile_picture
             FROM users
             WHERE id != $1
               AND (
                 LOWER(COALESCE(username, '')) LIKE LOWER($2)
                 OR LOWER(name) LIKE LOWER($2)
               )
             ORDER BY
               CASE WHEN LOWER(COALESCE(username, '')) = LOWER($3) THEN 0 ELSE 1 END,
               created_at DESC
             LIMIT 20`,
            [req.user.id, `%${q}%`, q]
        );
        return res.json(result.rows);
    } catch (error) {
        console.error('Failed to search users:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

router.get('/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.query(
            `SELECT id, name, email, username, role, profile_picture, profession, education_qualification, created_at
             FROM users
             WHERE id = $1
             LIMIT 1`,
            [id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }
        return res.json(result.rows[0]);
    } catch (error) {
        console.error('Failed to fetch user profile:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
