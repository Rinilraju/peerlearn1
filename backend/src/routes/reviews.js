const express = require('express');
const authenticateToken = require('../middleware/auth');
const db = require('../db');

const router = express.Router();

function validateRating(rating) {
    const numeric = Number(rating);
    if (!Number.isInteger(numeric) || numeric < 1 || numeric > 5) {
        return null;
    }
    return numeric;
}

router.post('/courses/:id', authenticateToken, async (req, res) => {
    const reviewerId = req.user.id;
    const courseId = Number(req.params.id);
    const rating = validateRating(req.body?.rating);
    const comment = String(req.body?.comment || '').trim() || null;

    if (!rating) {
        return res.status(400).json({ message: 'Rating must be an integer between 1 and 5.' });
    }

    try {
        const enrolled = await db.query(
            'SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2 LIMIT 1',
            [reviewerId, courseId]
        );
        if (enrolled.rows.length === 0) {
            return res.status(403).json({ message: 'Only enrolled learners can review this course.' });
        }

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
    const courseId = Number(req.params.id);
    try {
        const [reviews, summary] = await Promise.all([
            db.query(
                `SELECT cr.id, cr.rating, cr.comment, cr.created_at, u.name AS reviewer_name, u.username AS reviewer_username
                 FROM course_reviews cr
                 INNER JOIN users u ON u.id = cr.reviewer_id
                 WHERE cr.course_id = $1
                 ORDER BY cr.created_at DESC
                 LIMIT 50`,
                [courseId]
            ),
            db.query(
                `SELECT COALESCE(AVG(rating), 0)::float AS avg_rating, COUNT(*)::int AS review_count
                 FROM course_reviews
                 WHERE course_id = $1`,
                [courseId]
            ),
        ]);

        return res.json({
            avg_rating: Number(summary.rows[0]?.avg_rating || 0),
            review_count: Number(summary.rows[0]?.review_count || 0),
            items: reviews.rows,
        });
    } catch (error) {
        console.error('Failed to fetch course reviews:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

router.post('/tutors/:id', authenticateToken, async (req, res) => {
    const reviewerId = req.user.id;
    const tutorId = Number(req.params.id);
    const rating = validateRating(req.body?.rating);
    const comment = String(req.body?.comment || '').trim() || null;

    if (!rating) {
        return res.status(400).json({ message: 'Rating must be an integer between 1 and 5.' });
    }
    if (Number(reviewerId) === tutorId) {
        return res.status(400).json({ message: 'You cannot review yourself.' });
    }

    try {
        const eligible = await db.query(
            `SELECT 1
             FROM courses c
             INNER JOIN enrollments e ON e.course_id = c.id
             WHERE c.instructor_id = $1 AND e.user_id = $2
             LIMIT 1`,
            [tutorId, reviewerId]
        );
        if (eligible.rows.length === 0) {
            return res.status(403).json({ message: 'Review allowed only after learning with this tutor.' });
        }

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

router.get('/tutors/:id', async (req, res) => {
    const tutorId = Number(req.params.id);
    try {
        const [reviews, summary] = await Promise.all([
            db.query(
                `SELECT tr.id, tr.rating, tr.comment, tr.created_at, u.name AS reviewer_name, u.username AS reviewer_username
                 FROM tutor_reviews tr
                 INNER JOIN users u ON u.id = tr.reviewer_id
                 WHERE tr.tutor_id = $1
                 ORDER BY tr.created_at DESC
                 LIMIT 50`,
                [tutorId]
            ),
            db.query(
                `SELECT COALESCE(AVG(rating), 0)::float AS avg_rating, COUNT(*)::int AS review_count
                 FROM tutor_reviews
                 WHERE tutor_id = $1`,
                [tutorId]
            ),
        ]);

        return res.json({
            avg_rating: Number(summary.rows[0]?.avg_rating || 0),
            review_count: Number(summary.rows[0]?.review_count || 0),
            items: reviews.rows,
        });
    } catch (error) {
        console.error('Failed to fetch tutor reviews:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
