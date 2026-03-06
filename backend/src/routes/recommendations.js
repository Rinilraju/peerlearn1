const express = require('express');
const authenticateToken = require('../middleware/auth');
const db = require('../db');

const router = express.Router();

const STOP_WORDS = new Set([
    'the', 'and', 'for', 'with', 'from', 'this', 'that', 'your', 'you', 'are', 'into', 'how', 'what', 'will',
    'can', 'our', 'have', 'has', 'not', 'but', 'all', 'any', 'about', 'over', 'under', 'its', 'they', 'their',
    'them', 'been', 'being', 'was', 'were', 'then', 'than', 'also', 'too', 'very', 'more', 'less', 'just',
]);

function tokenize(input) {
    return String(input || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function toVector(tokens) {
    const map = new Map();
    for (const token of tokens) {
        map.set(token, (map.get(token) || 0) + 1);
    }
    return map;
}

function cosineSimilarity(left, right) {
    let dot = 0;
    let leftNorm = 0;
    let rightNorm = 0;

    for (const value of left.values()) {
        leftNorm += value * value;
    }
    for (const value of right.values()) {
        rightNorm += value * value;
    }
    for (const [key, leftValue] of left.entries()) {
        const rightValue = right.get(key);
        if (rightValue) {
            dot += leftValue * rightValue;
        }
    }

    if (!leftNorm || !rightNorm) {
        return 0;
    }
    return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

router.post('/track', authenticateToken, async (req, res) => {
    const { courseId, interactionType } = req.body;
    const userId = req.user.id;

    if (!courseId || !interactionType) {
        return res.status(400).json({ message: 'courseId and interactionType are required.' });
    }

    try {
        await db.query(
            'INSERT INTO course_interactions (user_id, course_id, interaction_type) VALUES ($1, $2, $3)',
            [userId, courseId, interactionType]
        );
        return res.status(201).json({ ok: true });
    } catch (error) {
        console.error('Failed to track interaction:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

router.get('/courses', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const limit = Math.min(Number(req.query.limit) || 4, 20);

    try {
        const [coursesResult, interactionsResult] = await Promise.all([
            db.query('SELECT id, title, description, category, price, thumbnail FROM courses'),
            db.query(
                `SELECT ci.course_id, ci.interaction_type, COUNT(*)::int AS score
                 FROM course_interactions ci
                 WHERE ci.user_id = $1
                 GROUP BY ci.course_id, ci.interaction_type`,
                [userId]
            ),
        ]);

        const courses = coursesResult.rows;
        if (courses.length === 0) {
            return res.json([]);
        }

        const interactionWeights = {
            view: 1,
            click: 2,
            wishlist: 3,
            enroll: 5,
        };

        const interestScoresByCourseId = new Map();
        for (const row of interactionsResult.rows) {
            const baseWeight = interactionWeights[row.interaction_type] || 1;
            const score = Number(row.score) * baseWeight;
            interestScoresByCourseId.set(
                Number(row.course_id),
                (interestScoresByCourseId.get(Number(row.course_id)) || 0) + score
            );
        }

        const interactedIds = new Set(Array.from(interestScoresByCourseId.keys()));
        const profileCourses = courses.filter((course) => interactedIds.has(Number(course.id)));
        const candidateCourses = courses.filter((course) => !interactedIds.has(Number(course.id)));

        const profileText = profileCourses
            .map((course) => `${course.title || ''} ${course.description || ''} ${course.category || ''}`)
            .join(' ');

        const profileVector = toVector(tokenize(profileText));

        const scored = candidateCourses.map((course) => {
            const tokenVector = toVector(tokenize(`${course.title || ''} ${course.description || ''} ${course.category || ''}`));
            const contentSimilarity = cosineSimilarity(profileVector, tokenVector);
            const popularityBoost = Math.log10(1 + (Number(interestScoresByCourseId.get(Number(course.id))) || 0));

            // If user has no history, fall back to popularity/newness ordering using a base score.
            const hasProfile = profileVector.size > 0;
            const score = hasProfile ? contentSimilarity * 0.85 + popularityBoost * 0.15 : 0.01 + popularityBoost;

            return {
                ...course,
                recommendation_score: score,
            };
        });

        scored.sort((a, b) => b.recommendation_score - a.recommendation_score);
        return res.json(scored.slice(0, limit));
    } catch (error) {
        console.error('Failed to fetch recommendations:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
