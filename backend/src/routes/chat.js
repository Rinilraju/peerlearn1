const express = require('express');
const authenticateToken = require('../middleware/auth');
const db = require('../db');

const router = express.Router();

async function getCourseAndRole(courseId, userId) {
    const courseResult = await db.query('SELECT id, instructor_id FROM courses WHERE id = $1', [courseId]);
    if (courseResult.rows.length === 0) {
        return { error: 'Course not found' };
    }

    const course = courseResult.rows[0];
    if (Number(course.instructor_id) === Number(userId)) {
        return { course, role: 'instructor' };
    }

    const enrolled = await db.query('SELECT id FROM enrollments WHERE course_id = $1 AND user_id = $2', [courseId, userId]);
    if (enrolled.rows.length > 0) {
        return { course, role: 'student' };
    }

    return { error: 'Not authorized for this course chat.' };
}

router.get('/course/:courseId/contacts', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const { courseId } = req.params;

    try {
        const access = await getCourseAndRole(courseId, userId);
        if (access.error) {
            return res.status(403).json({ message: access.error });
        }

        if (access.role === 'instructor') {
            const students = await db.query(
                `SELECT u.id, u.name, u.email
                 FROM enrollments e
                 INNER JOIN users u ON u.id = e.user_id
                 WHERE e.course_id = $1
                 ORDER BY e.enrolled_at DESC`,
                [courseId]
            );
            return res.json(students.rows);
        }

        const instructor = await db.query('SELECT id, name, email FROM users WHERE id = $1', [access.course.instructor_id]);
        return res.json(instructor.rows);
    } catch (error) {
        console.error('Failed to fetch chat contacts:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

router.get('/course/:courseId/messages/:peerId', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const { courseId, peerId } = req.params;

    try {
        const access = await getCourseAndRole(courseId, userId);
        if (access.error) {
            return res.status(403).json({ message: access.error });
        }

        const result = await db.query(
            `SELECT id, course_id, sender_id, receiver_id, message, created_at
             FROM course_chat_messages
             WHERE course_id = $1
               AND ((sender_id = $2 AND receiver_id = $3) OR (sender_id = $3 AND receiver_id = $2))
             ORDER BY created_at ASC`,
            [courseId, userId, peerId]
        );

        return res.json(result.rows);
    } catch (error) {
        console.error('Failed to fetch chat messages:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

router.post('/course/:courseId/messages/:peerId', authenticateToken, async (req, res) => {
    const senderId = req.user.id;
    const { courseId, peerId } = req.params;
    const { message } = req.body;

    if (!message || !String(message).trim()) {
        return res.status(400).json({ message: 'message is required' });
    }

    try {
        const access = await getCourseAndRole(courseId, senderId);
        if (access.error) {
            return res.status(403).json({ message: access.error });
        }

        const result = await db.query(
            `INSERT INTO course_chat_messages (course_id, sender_id, receiver_id, message)
             VALUES ($1, $2, $3, $4)
             RETURNING id, course_id, sender_id, receiver_id, message, created_at`,
            [courseId, senderId, peerId, String(message).trim()]
        );

        return res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Failed to send chat message:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
