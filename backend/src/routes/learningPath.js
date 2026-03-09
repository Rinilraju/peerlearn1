const express = require('express');
const authenticateToken = require('../middleware/auth');
const db = require('../db');

const router = express.Router();

const PATH_TEMPLATES = {
    development: ['Fundamentals', 'Core Concepts', 'Project Practice', 'Advanced Patterns', 'Interview Prep'],
    design: ['Principles', 'Tools', 'Portfolio Project', 'Case Studies', 'Specialization'],
    business: ['Basics', 'Applied Frameworks', 'Data-Driven Decisions', 'Execution', 'Leadership'],
    marketing: ['Foundations', 'Channels', 'Campaign Build', 'Analytics', 'Optimization'],
    general: ['Beginner', 'Intermediate', 'Hands-on', 'Advanced', 'Capstone'],
};

router.get('/my', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const result = await db.query(
            `SELECT c.id, c.title, c.category, e.enrolled_at
             FROM enrollments e
             INNER JOIN courses c ON c.id = e.course_id
             WHERE e.user_id = $1
             ORDER BY e.enrolled_at DESC`,
            [userId]
        );

        const groups = new Map();
        for (const course of result.rows) {
            const category = String(course.category || 'general').toLowerCase();
            if (!groups.has(category)) groups.set(category, []);
            groups.get(category).push(course);
        }

        const paths = Array.from(groups.entries()).map(([category, courses]) => {
            const template = PATH_TEMPLATES[category] || PATH_TEMPLATES.general;
            const progress = Math.min(template.length, Math.max(1, Math.floor(courses.length / 1)));
            return {
                category,
                enrolled_courses: courses,
                steps: template.map((name, idx) => ({
                    title: name,
                    status: idx < progress ? 'completed' : idx === progress ? 'current' : 'upcoming',
                })),
                recommended_next: template[Math.min(progress, template.length - 1)],
            };
        });

        return res.json(paths);
    } catch (error) {
        console.error('Failed to build learning paths:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
