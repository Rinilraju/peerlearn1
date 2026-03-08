const express = require('express');
const { Pool } = require('pg');
const authenticateToken = require('../middleware/auth');
const jwt = require('jsonwebtoken');
// Auth middleware optional for viewing courses, required for creating?
// Assuming admin or open for now, let's just make it public to view.

const router = express.Router();
const db = require('../db');
const verificationAttempts = new Map();

const QUIZ_QUESTION_COUNT = 10;
const QUIZ_DURATION_SECONDS = 10 * 60;
const QUIZ_PASS_SCORE = 7;
const QUIZ_TOKEN_EXPIRY_SECONDS = 30 * 60;

function shuffle(array) {
    const items = [...array];
    for (let i = items.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
}

function normalizeText(value) {
    return String(value || '').trim().toLowerCase();
}

function buildQuestionPool(topic, category) {
    const safeTopic = topic || 'the course topic';
    const safeCategory = category || 'general';

    return [
        {
            question: `What should be the first step when teaching ${safeTopic}?`,
            options: shuffle(['Define clear learning outcomes', 'Start with final exam only', 'Skip prerequisites', 'Avoid examples']),
            answer: 'Define clear learning outcomes',
        },
        {
            question: `In a ${safeCategory} course, which assessment style is best for learning retention?`,
            options: shuffle(['Frequent low-stakes quizzes', 'Single surprise final', 'No assessment at all', 'Only attendance']),
            answer: 'Frequent low-stakes quizzes',
        },
        {
            question: `How should a tutor handle beginner mistakes in ${safeTopic}?`,
            options: shuffle(['Give corrective feedback with examples', 'Ignore mistakes', 'Publicly shame learners', 'Immediately fail learner']),
            answer: 'Give corrective feedback with examples',
        },
        {
            question: 'Which teaching practice improves learner engagement the most?',
            options: shuffle(['Interactive exercises', 'Monologue-only lectures', 'No Q&A', 'Unrelated assignments']),
            answer: 'Interactive exercises',
        },
        {
            question: 'What is the best way to structure a 60-minute live class?',
            options: shuffle(['Concept + demo + practice + recap', 'Only theory reading', 'Only attendance check', 'No structure']),
            answer: 'Concept + demo + practice + recap',
        },
        {
            question: 'Which one is an ethical requirement for online tutors?',
            options: shuffle(['Respect student privacy', 'Share student data publicly', 'Record without consent', 'Ignore harassment']),
            answer: 'Respect student privacy',
        },
        {
            question: `For ${safeTopic}, which is the most effective content progression?`,
            options: shuffle(['Basics to advanced with checkpoints', 'Advanced only from day one', 'Random order each class', 'No progression plan']),
            answer: 'Basics to advanced with checkpoints',
        },
        {
            question: 'How should tutor responses in class chat be managed?',
            options: shuffle(['Timely and constructive', 'Delayed and dismissive', 'Never respond', 'Only respond to top scorers']),
            answer: 'Timely and constructive',
        },
        {
            question: 'What reduces student drop-off in online courses?',
            options: shuffle(['Clear milestones and feedback', 'Long silent gaps', 'No schedule', 'Ignoring doubts']),
            answer: 'Clear milestones and feedback',
        },
        {
            question: `What should be included in assignments for ${safeTopic}?`,
            options: shuffle(['Practical tasks aligned to outcomes', 'Unrelated tasks', 'Only copied text', 'No rubric']),
            answer: 'Practical tasks aligned to outcomes',
        },
        {
            question: 'If a student is struggling, what is the best tutor action?',
            options: shuffle(['Provide scaffolded support', 'Remove from class immediately', 'Mock the learner', 'Skip difficult topic forever']),
            answer: 'Provide scaffolded support',
        },
        {
            question: 'What is the purpose of formative assessment?',
            options: shuffle(['Measure progress and guide teaching', 'Punish mistakes', 'Replace all teaching', 'Collect random marks']),
            answer: 'Measure progress and guide teaching',
        },
    ];
}

function createQuizAttempt(userId, payload) {
    const topic = payload.title || payload.description || 'the course topic';
    const pool = buildQuestionPool(topic, payload.category);
    const selected = shuffle(pool).slice(0, QUIZ_QUESTION_COUNT).map((item, idx) => {
        const correctIndex = item.options.findIndex((option) => option === item.answer);
        return {
            id: idx + 1,
            question: item.question,
            options: item.options,
            correctIndex,
        };
    });

    const attemptId = `${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    verificationAttempts.set(attemptId, {
        userId: Number(userId),
        createdAt: Date.now(),
        expiresAt: Date.now() + (QUIZ_DURATION_SECONDS * 1000),
        questions: selected,
    });

    return { attemptId, questions: selected.map(({ correctIndex, ...rest }) => rest) };
}

router.post('/verification-quiz/generate', authenticateToken, async (req, res) => {
    try {
        const { title, description, category } = req.body || {};
        const attempt = createQuizAttempt(req.user.id, { title, description, category });
        return res.json({
            attemptId: attempt.attemptId,
            durationSeconds: QUIZ_DURATION_SECONDS,
            questions: attempt.questions,
            rules: {
                questionCount: QUIZ_QUESTION_COUNT,
                passScore: QUIZ_PASS_SCORE,
                noTabSwitch: true,
                noCopyPaste: true,
            },
        });
    } catch (error) {
        console.error('Failed to generate tutor verification quiz:', error);
        return res.status(500).json({ message: 'Unable to start verification quiz.' });
    }
});

router.post('/verification-quiz/submit', authenticateToken, async (req, res) => {
    const { attemptId, answers = [], violations = {} } = req.body || {};
    if (!attemptId) {
        return res.status(400).json({ message: 'Missing attemptId.' });
    }

    const attempt = verificationAttempts.get(attemptId);
    if (!attempt || Number(attempt.userId) !== Number(req.user.id)) {
        return res.status(400).json({ message: 'Invalid or expired quiz attempt.' });
    }

    verificationAttempts.delete(attemptId);

    if (Date.now() > attempt.expiresAt) {
        return res.status(400).json({
            passed: false,
            message: 'Quiz time is over. Please try again.',
            score: 0,
            total: attempt.questions.length,
        });
    }

    const tabSwitchCount = Number(violations.tabSwitchCount || 0);
    const copyCount = Number(violations.copyCount || 0);
    if (tabSwitchCount > 0 || copyCount > 0) {
        return res.status(200).json({
            passed: false,
            message: 'Verification failed due to quiz rule violation.',
            score: 0,
            total: attempt.questions.length,
        });
    }

    let score = 0;
    attempt.questions.forEach((question, index) => {
        if (Number(answers[index]) === Number(question.correctIndex)) {
            score += 1;
        }
    });

    const passed = score >= QUIZ_PASS_SCORE;
    if (!passed) {
        return res.status(200).json({
            passed: false,
            message: `Score ${score}/${attempt.questions.length}. Minimum ${QUIZ_PASS_SCORE} required.`,
            score,
            total: attempt.questions.length,
        });
    }

    if (!process.env.JWT_SECRET) {
        return res.status(500).json({ message: 'Server auth is not configured.' });
    }
    const verificationToken = jwt.sign(
        {
            type: 'course_verification',
            userId: req.user.id,
            score,
            total: attempt.questions.length,
        },
        process.env.JWT_SECRET,
        { expiresIn: `${QUIZ_TOKEN_EXPIRY_SECONDS}s` }
    );

    return res.json({
        passed: true,
        score,
        total: attempt.questions.length,
        verificationToken,
    });
});


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
    const verificationToken = req.headers['x-course-verification-token'];

    try {
        if (!verificationToken) {
            return res.status(403).json({ message: 'Tutor verification quiz is required before creating a course.' });
        }

        if (!process.env.JWT_SECRET) {
            return res.status(500).json({ message: 'Server auth is not configured.' });
        }

        let verificationPayload;
        try {
            verificationPayload = jwt.verify(String(verificationToken), process.env.JWT_SECRET);
        } catch (error) {
            return res.status(403).json({ message: 'Invalid or expired course verification token.' });
        }

        if (
            verificationPayload?.type !== 'course_verification'
            || Number(verificationPayload?.userId) !== Number(instructor_id)
            || Number(verificationPayload?.score || 0) < QUIZ_PASS_SCORE
        ) {
            return res.status(403).json({ message: 'Course verification quiz not passed.' });
        }

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
