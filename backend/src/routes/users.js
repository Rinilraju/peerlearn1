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

router.get('/me/earnings', authenticateToken, async (req, res) => {
    const instructorId = req.user.id;
    const commissionRate = 0.02;
    try {
        const result = await db.query(
            `SELECT
                COALESCE(SUM(CASE WHEN p.status IN ('paid', 'completed') THEN p.amount ELSE 0 END), 0) AS earned_gross,
                COALESCE(SUM(CASE WHEN p.status = 'pending' THEN p.amount ELSE 0 END), 0) AS pending_amount,
                COALESCE(SUM(CASE WHEN p.status = 'refunded' THEN p.amount ELSE 0 END), 0) AS refunded_amount
             FROM payments p
             INNER JOIN courses c ON c.id = p.course_id
             WHERE c.instructor_id = $1`,
            [instructorId]
        );
        const earnedGross = Number(result.rows[0]?.earned_gross || 0);
        const pendingAmount = Number(result.rows[0]?.pending_amount || 0);
        const refundedAmount = Number(result.rows[0]?.refunded_amount || 0);
        const commissionAmount = earnedGross * commissionRate;
        const netEarnings = Math.max(0, earnedGross - commissionAmount);

        return res.json({
            currency: 'INR',
            commissionRate,
            earnedGross,
            pendingAmount,
            refundedAmount,
            commissionAmount,
            netEarnings,
        });
    } catch (error) {
        console.error('Failed to fetch tutor earnings:', error);
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
