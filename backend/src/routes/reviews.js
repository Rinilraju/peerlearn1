const express = require('express');
const authenticateToken = require('../middleware/auth');
const db = require('../db');

const router = express.Router();

router.post('/tutors/:id', authenticateToken, async (req, res) => {
    const reviewerId = req.user.id;
    const tutorId = Number(req.params.id);
    const rating = Number(req.body?.rating);
    const comment = req.body?.comment || null;

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({ message: 'Rating must be between 1 and 5.' });
    }
    if (tutorId === Number(reviewerId)) {
        return res.status(400).json({ message: 'You cannot review yourself.' });
    }

    try {
        const result = await db.query(
            `INSERT INTO tutor_reviews (reviewer_id, tutor_id, rating, comment)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (reviewer_id, tutor_id)
             DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, created_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [reviewerId, tutorId, rating, comment]
        );
        return res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Failed to submit tutor review:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

router.post('/courses/:id', authenticateToken, async (req, res) => {
    const reviewerId = req.user.id;
    const courseId = Number(req.params.id);
    const rating = Number(req.body?.rating);
    const comment = req.body?.comment || null;
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({ message: 'Rating must be between 1 and 5.' });
    }
    try {
        const result = await db.query(
            `INSERT INTO course_reviews (reviewer_id, course_id, rating, comment)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (reviewer_id, course_id)
             DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, created_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [reviewerId, courseId, rating, comment]
        );
        return res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Failed to submit course review:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

router.get('/courses/:id', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT cr.id, cr.rating, cr.comment, cr.created_at, u.name AS reviewer_name, u.username AS reviewer_username
             FROM course_reviews cr
             INNER JOIN users u ON u.id = cr.reviewer_id
             WHERE cr.course_id = $1
             ORDER BY cr.created_at DESC
             LIMIT 50`,
            [req.params.id]
        );
        return res.json(result.rows);
    } catch (error) {
        console.error('Failed to fetch course reviews:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
