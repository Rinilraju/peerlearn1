const express = require('express');
const authenticateToken = require('../middleware/auth');
const db = require('../db');

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
    const q = String(req.query.q || '').trim();
    const topic = String(req.query.topic || '').trim();
    try {
        const result = await db.query(
            `SELECT u.id, u.name, u.username, u.profile_picture, u.profession,
                    COUNT(DISTINCT c.id)::int AS courses_count,
                    COALESCE(AVG(tr.rating), 0)::float AS avg_rating
             FROM users u
             LEFT JOIN courses c ON c.instructor_id = u.id
             LEFT JOIN tutor_reviews tr ON tr.tutor_id = u.id
             WHERE u.role IN ('tutor', 'admin')
               AND ($1 = '' OR LOWER(COALESCE(u.username, u.name)) LIKE LOWER($2))
               AND ($3 = '' OR EXISTS (
                    SELECT 1 FROM courses c2
                    WHERE c2.instructor_id = u.id
                      AND (LOWER(c2.title) LIKE LOWER($4)
                           OR LOWER(COALESCE(c2.description, '')) LIKE LOWER($4)
                           OR LOWER(COALESCE(c2.category, '')) LIKE LOWER($4))
               ))
             GROUP BY u.id
             ORDER BY avg_rating DESC, courses_count DESC, u.created_at DESC
             LIMIT 50`,
            [q, `%${q}%`, topic, `%${topic}%`]
        );
        return res.json(result.rows);
    } catch (error) {
        console.error('Failed to list tutors:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

router.get('/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        const [profileResult, coursesResult, reviewsResult] = await Promise.all([
            db.query(
                `SELECT u.id, u.name, u.email, u.username, u.profile_picture, u.profession, u.education_qualification, u.role,
                        COALESCE(AVG(tr.rating), 0)::float AS avg_rating,
                        COUNT(tr.id)::int AS review_count
                 FROM users u
                 LEFT JOIN tutor_reviews tr ON tr.tutor_id = u.id
                 WHERE u.id = $1
                 GROUP BY u.id`,
                [id]
            ),
            db.query(
                `SELECT id, title, description, category, price, thumbnail, created_at
                 FROM courses
                 WHERE instructor_id = $1
                 ORDER BY created_at DESC`,
                [id]
            ),
            db.query(
                `SELECT tr.id, tr.rating, tr.comment, tr.created_at, u.name AS reviewer_name, u.username AS reviewer_username
                 FROM tutor_reviews tr
                 INNER JOIN users u ON u.id = tr.reviewer_id
                 WHERE tr.tutor_id = $1
                 ORDER BY tr.created_at DESC
                 LIMIT 20`,
                [id]
            ),
        ]);

        if (profileResult.rows.length === 0) {
            return res.status(404).json({ message: 'Tutor not found.' });
        }

        return res.json({
            ...profileResult.rows[0],
            courses: coursesResult.rows,
            reviews: reviewsResult.rows,
        });
    } catch (error) {
        console.error('Failed to fetch tutor profile:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
