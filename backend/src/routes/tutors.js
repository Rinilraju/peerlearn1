const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', async (req, res) => {
    const q = String(req.query.q || '').trim();
    const topic = String(req.query.topic || '').trim();

    try {
        const result = await db.query(
            `SELECT
                u.id,
                u.name,
                u.username,
                u.profile_picture,
                u.profession,
                u.education_qualification,
                COUNT(DISTINCT c.id)::int AS courses_count,
                COUNT(DISTINCT e.id)::int AS learners_count
             FROM users u
             LEFT JOIN courses c ON c.instructor_id = u.id
             LEFT JOIN enrollments e ON e.course_id = c.id
             WHERE u.role IN ('tutor', 'admin')
               AND ($1 = '' OR LOWER(COALESCE(u.username, u.name, '')) LIKE LOWER($2) OR LOWER(COALESCE(u.profession, '')) LIKE LOWER($2))
               AND ($3 = '' OR EXISTS (
                    SELECT 1
                    FROM courses c2
                    WHERE c2.instructor_id = u.id
                      AND (
                        LOWER(COALESCE(c2.title, '')) LIKE LOWER($4)
                        OR LOWER(COALESCE(c2.description, '')) LIKE LOWER($4)
                        OR LOWER(COALESCE(c2.category, '')) LIKE LOWER($4)
                      )
               ))
             GROUP BY u.id
             ORDER BY courses_count DESC, learners_count DESC, u.created_at DESC
             LIMIT 50`,
            [q, `%${q}%`, topic, `%${topic}%`]
        );

        return res.json(result.rows);
    } catch (error) {
        console.error('Failed to fetch tutors:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

router.get('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const [profileResult, coursesResult] = await Promise.all([
            db.query(
                `SELECT
                    u.id,
                    u.name,
                    u.username,
                    u.profile_picture,
                    u.profession,
                    u.education_qualification,
                    u.role,
                    COUNT(DISTINCT c.id)::int AS courses_count,
                    COUNT(DISTINCT e.id)::int AS learners_count
                 FROM users u
                 LEFT JOIN courses c ON c.instructor_id = u.id
                 LEFT JOIN enrollments e ON e.course_id = c.id
                 WHERE u.id = $1
                   AND u.role IN ('tutor', 'admin')
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
        ]);

        if (profileResult.rows.length === 0) {
            return res.status(404).json({ message: 'Tutor not found.' });
        }

        return res.json({
            ...profileResult.rows[0],
            courses: coursesResult.rows,
        });
    } catch (error) {
        console.error('Failed to fetch tutor detail:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
