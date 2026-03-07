const express = require('express');
const { Pool } = require('pg');
const authenticateToken = require('../middleware/auth');
// Auth middleware optional for viewing courses, required for creating?
// Assuming admin or open for now, let's just make it public to view.

const router = express.Router();
const db = require('../db');


// Get all courses
router.get('/', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT courses.*, users.name as instructor_name 
            FROM courses 
            LEFT JOIN users ON courses.instructor_id = users.id 
            ORDER BY courses.created_at DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get courses created by the current user
router.get('/my-courses', authenticateToken, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM courses WHERE instructor_id = $1 ORDER BY created_at DESC', [req.user.id]);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get courses enrolled by current user
router.get('/enrolled', authenticateToken, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT c.*, u.name AS instructor_name, e.enrolled_at
             FROM enrollments e
             INNER JOIN courses c ON c.id = e.course_id
             LEFT JOIN users u ON c.instructor_id = u.id
             WHERE e.user_id = $1
             ORDER BY e.enrolled_at DESC`,
            [req.user.id]
        );
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Check if current user is enrolled in a course
router.get('/:id/enrollment', authenticateToken, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2',
            [req.user.id, req.params.id]
        );
        res.json({ enrolled: result.rows.length > 0 });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get course by ID
router.get('/:id', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM courses WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'Course not found' });
        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Create a new course
router.post('/', authenticateToken, async (req, res) => {
    const { title, description, price, category, video_url, thumbnail } = req.body;
    const instructor_id = req.user.id; // From auth middleware

    try {
        console.log('Creating course with data:', { title, price, category, instructor_id });
        const result = await db.query(
            'INSERT INTO courses (title, description, price, category, instructor_id, video_url, thumbnail) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [title, description, price, category, instructor_id, video_url, thumbnail]
        );
        await db.query(
            `UPDATE users
             SET role = 'tutor'
             WHERE id = $1 AND role != 'admin'`,
            [instructor_id]
        );
        console.log('Course created successfully:', result.rows[0].id);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating course:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

module.exports = router;
