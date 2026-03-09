const express = require('express');
const authenticateToken = require('../middleware/auth');
const db = require('../db');

const router = express.Router();

async function getCourseById(courseId) {
    const result = await db.query('SELECT id, instructor_id, title FROM courses WHERE id = $1 LIMIT 1', [courseId]);
    return result.rows[0] || null;
}

async function isEnrolled(userId, courseId) {
    const result = await db.query('SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2 LIMIT 1', [userId, courseId]);
    return result.rows.length > 0;
}

router.get('/course/:courseId', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const courseId = Number(req.params.courseId);
    try {
        const course = await getCourseById(courseId);
        if (!course) return res.status(404).json({ message: 'Course not found.' });
        const canView = Number(course.instructor_id) === Number(userId) || await isEnrolled(userId, courseId);
        if (!canView) return res.status(403).json({ message: 'Not allowed to view assignments for this course.' });

        const result = await db.query(
            `SELECT a.*, s.id AS submission_id, s.status AS submission_status, s.score AS submission_score
             FROM course_assignments a
             LEFT JOIN assignment_submissions s ON s.assignment_id = a.id AND s.student_id = $2
             WHERE a.course_id = $1
             ORDER BY a.created_at DESC`,
            [courseId, userId]
        );
        return res.json(result.rows);
    } catch (error) {
        console.error('Failed to fetch assignments:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

router.post('/course/:courseId', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const courseId = Number(req.params.courseId);
    const { title, description, assignmentType, dueAt, maxScore } = req.body || {};
    if (!title) return res.status(400).json({ message: 'title is required.' });
    try {
        const course = await getCourseById(courseId);
        if (!course) return res.status(404).json({ message: 'Course not found.' });
        if (Number(course.instructor_id) !== Number(userId)) {
            return res.status(403).json({ message: 'Only tutor can create assignments.' });
        }

        const result = await db.query(
            `INSERT INTO course_assignments (course_id, instructor_id, title, description, assignment_type, due_at, max_score)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [
                courseId,
                userId,
                String(title).trim(),
                description || null,
                assignmentType || 'homework',
                dueAt ? new Date(dueAt).toISOString() : null,
                Number(maxScore || 100),
            ]
        );
        return res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Failed to create assignment:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

router.post('/:assignmentId/submit', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const assignmentId = Number(req.params.assignmentId);
    const { content } = req.body || {};
    try {
        const aResult = await db.query(
            `SELECT id, course_id FROM course_assignments WHERE id = $1 LIMIT 1`,
            [assignmentId]
        );
        if (aResult.rows.length === 0) return res.status(404).json({ message: 'Assignment not found.' });
        const assignment = aResult.rows[0];
        if (!(await isEnrolled(userId, assignment.course_id))) {
            return res.status(403).json({ message: 'Only enrolled students can submit.' });
        }

        const result = await db.query(
            `INSERT INTO assignment_submissions (assignment_id, student_id, content, status)
             VALUES ($1, $2, $3, 'submitted')
             ON CONFLICT (assignment_id, student_id)
             DO UPDATE SET content = EXCLUDED.content, status = 'submitted', submitted_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [assignmentId, userId, content || '']
        );
        return res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Failed to submit assignment:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

router.patch('/submissions/:submissionId/grade', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const submissionId = Number(req.params.submissionId);
    const score = Number(req.body?.score);
    if (!Number.isFinite(score)) return res.status(400).json({ message: 'score is required.' });
    try {
        const sResult = await db.query(
            `SELECT s.id, s.assignment_id, a.course_id, a.instructor_id, a.max_score
             FROM assignment_submissions s
             INNER JOIN course_assignments a ON a.id = s.assignment_id
             WHERE s.id = $1`,
            [submissionId]
        );
        if (sResult.rows.length === 0) return res.status(404).json({ message: 'Submission not found.' });
        const row = sResult.rows[0];
        if (Number(row.instructor_id) !== Number(userId)) {
            return res.status(403).json({ message: 'Only tutor can grade submissions.' });
        }
        if (score < 0 || score > Number(row.max_score || 100)) {
            return res.status(400).json({ message: 'Score out of range.' });
        }

        const result = await db.query(
            `UPDATE assignment_submissions
             SET score = $1, status = 'graded', graded_at = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING *`,
            [score, submissionId]
        );
        return res.json(result.rows[0]);
    } catch (error) {
        console.error('Failed to grade submission:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
