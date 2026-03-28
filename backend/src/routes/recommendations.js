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

function normalizeMap(values) {
    const arr = Array.from(values.values());
    if (arr.length === 0) {
        return new Map();
    }
    const min = Math.min(...arr);
    const max = Math.max(...arr);
    const range = max - min;
    const out = new Map();
    for (const [key, value] of values.entries()) {
        out.set(key, range === 0 ? 0.5 : (value - min) / range);
    }
    return out;
}

function safeDate(input) {
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) {
        return null;
    }
    return d;
}

function normalizeWhitespace(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function isPlaceholderText(value) {
    const v = normalizeWhitespace(value).toLowerCase();
    if (!v) return true;
    return ['nothing', 'none', 'n/a', 'na', 'test', 'tbd', 'null', 'undefined'].includes(v);
}

function isMeaningfulText(value, minLen = 4) {
    const cleaned = normalizeWhitespace(value);
    if (cleaned.length < minLen) return false;
    return !isPlaceholderText(cleaned);
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

router.post('/track-search', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const queryText = String(req.body?.queryText || '').trim();

    if (queryText.length < 2) {
        return res.status(400).json({ message: 'queryText must be at least 2 characters.' });
    }
    if (queryText.length > 255) {
        return res.status(400).json({ message: 'queryText is too long.' });
    }

    try {
        await db.query(
            `INSERT INTO course_search_events (user_id, query_text)
             VALUES ($1, $2)`,
            [userId, queryText]
        );
        return res.status(201).json({ ok: true });
    } catch (error) {
        console.error('Failed to track search query:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

router.get('/courses', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const limit = Math.min(Number(req.query.limit) || 4, 20);

    try {
        const [coursesResult, userInteractionsResult, globalInteractionsResult, enrollmentsResult, userEnrollmentsResult, userSearchEventsResult] = await Promise.all([
            db.query(
                `SELECT c.id, c.title, c.description, c.category, c.price, c.thumbnail, c.created_at, c.instructor_id,
                        u.name AS instructor_name,
                        COALESCE(cr.avg_rating, 0) AS avg_rating,
                        COALESCE(cr.review_count, 0) AS review_count,
                        COALESCE(e.enroll_count, 0) AS enroll_count,
                        tr.top_review_comment,
                        tr.top_review_rating,
                        tr.top_review_reviewer
                 FROM courses c
                 LEFT JOIN users u ON u.id = c.instructor_id
                 LEFT JOIN (
                    SELECT course_id,
                           COALESCE(AVG(rating), 0)::float AS avg_rating,
                           COUNT(*)::int AS review_count
                    FROM course_reviews
                    GROUP BY course_id
                 ) cr ON cr.course_id = c.id
                 LEFT JOIN (
                    SELECT course_id, COUNT(*)::int AS enroll_count
                    FROM enrollments
                    GROUP BY course_id
                 ) e ON e.course_id = c.id
                 LEFT JOIN LATERAL (
                    SELECT cr.rating AS top_review_rating,
                           cr.comment AS top_review_comment,
                           u2.name AS top_review_reviewer
                    FROM course_reviews cr
                    LEFT JOIN users u2 ON u2.id = cr.reviewer_id
                    WHERE cr.course_id = c.id
                      AND cr.comment IS NOT NULL
                      AND LENGTH(TRIM(cr.comment)) > 0
                    ORDER BY cr.created_at DESC
                    LIMIT 1
                 ) tr ON TRUE`
            ),
            db.query(
                `SELECT ci.course_id, ci.interaction_type, COUNT(*)::int AS score
                 FROM course_interactions ci
                 WHERE ci.user_id = $1
                 GROUP BY ci.course_id, ci.interaction_type`,
                [userId]
            ),
            db.query(
                `SELECT ci.course_id, ci.interaction_type, COUNT(*)::int AS score
                 FROM course_interactions ci
                 GROUP BY ci.course_id, ci.interaction_type`
            ),
            db.query(
                `SELECT course_id, COUNT(*)::int AS enroll_count
                 FROM enrollments
                 GROUP BY course_id`
            ),
            db.query(
                `SELECT course_id
                 FROM enrollments
                 WHERE user_id = $1`,
                [userId]
            ),
            db.query(
                `SELECT query_text
                 FROM course_search_events
                 WHERE user_id = $1
                 ORDER BY created_at DESC
                 LIMIT 40`,
                [userId]
            ),
        ]);

        const rawCourses = coursesResult.rows;
        const courses = rawCourses.filter((course) => (
            isMeaningfulText(course.title, 3)
            && isMeaningfulText(course.description, 12)
        ));
        if (courses.length === 0) {
            return res.json([]);
        }

        const interactionWeights = {
            view: 1,
            click: 2,
            wishlist: 3,
            enroll: 6,
        };

        const userScoresByCourseId = new Map();
        for (const row of userInteractionsResult.rows) {
            const baseWeight = interactionWeights[row.interaction_type] || 1;
            const score = Number(row.score) * baseWeight;
            userScoresByCourseId.set(
                Number(row.course_id),
                (userScoresByCourseId.get(Number(row.course_id)) || 0) + score
            );
        }

        // Enrollments are strong intent signals even without explicit interaction tracking.
        for (const row of userEnrollmentsResult.rows) {
            const courseId = Number(row.course_id);
            userScoresByCourseId.set(courseId, (userScoresByCourseId.get(courseId) || 0) + 8);
        }

        const globalScoresByCourseId = new Map();
        for (const row of globalInteractionsResult.rows) {
            const baseWeight = interactionWeights[row.interaction_type] || 1;
            const score = Number(row.score) * baseWeight;
            globalScoresByCourseId.set(
                Number(row.course_id),
                (globalScoresByCourseId.get(Number(row.course_id)) || 0) + score
            );
        }

        const enrollmentsByCourseId = new Map();
        for (const row of enrollmentsResult.rows) {
            enrollmentsByCourseId.set(Number(row.course_id), Number(row.enroll_count) || 0);
        }

        const interactedIds = new Set(Array.from(userScoresByCourseId.keys()));
        const enrolledIds = new Set(userEnrollmentsResult.rows.map((row) => Number(row.course_id)));

        const profileCourses = courses.filter((course) => interactedIds.has(Number(course.id)) || enrolledIds.has(Number(course.id)));
        const candidateCourses = courses.filter((course) => (
            Number(course.instructor_id) !== Number(userId)
            && !enrolledIds.has(Number(course.id))
        ));

        const searchText = userSearchEventsResult.rows
            .map((row) => row.query_text || '')
            .join(' ');
        const searchVector = toVector(tokenize(searchText));

        const profileText = [
            profileCourses
            .map((course) => `${course.title || ''} ${course.description || ''} ${course.category || ''}`)
            .join(' '),
            searchText,
        ].join(' ');
        const profileVector = toVector(tokenize(profileText));

        const categoryAffinityRaw = new Map();
        for (const course of profileCourses) {
            const category = String(course.category || 'general').toLowerCase();
            const weight = Number(userScoresByCourseId.get(Number(course.id)) || 1);
            categoryAffinityRaw.set(category, (categoryAffinityRaw.get(category) || 0) + weight);
        }
        const maxCategoryAffinity = Math.max(1, ...Array.from(categoryAffinityRaw.values()));

        const contentRaw = new Map();
        const searchRaw = new Map();
        const popularityRaw = new Map();
        const freshnessRaw = new Map();
        const interestRaw = new Map();
        const categoryRaw = new Map();

        for (const course of candidateCourses) {
            const tokenVector = toVector(tokenize(`${course.title || ''} ${course.description || ''} ${course.category || ''}`));
            const contentSimilarity = cosineSimilarity(profileVector, tokenVector);
            contentRaw.set(Number(course.id), contentSimilarity);
            const searchSimilarity = searchVector.size > 0 ? cosineSimilarity(searchVector, tokenVector) : 0;
            searchRaw.set(Number(course.id), searchSimilarity);

            const globalInteractions = Number(globalScoresByCourseId.get(Number(course.id)) || 0);
            const globalEnrollments = Number(enrollmentsByCourseId.get(Number(course.id)) || 0);
            popularityRaw.set(Number(course.id), Math.log10(1 + globalInteractions + (globalEnrollments * 2)));

            const createdAt = safeDate(course.created_at);
            const ageDays = createdAt ? Math.max(0, (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24)) : 365;
            freshnessRaw.set(Number(course.id), Math.exp(-ageDays / 60));

            interestRaw.set(Number(course.id), Math.log10(1 + Number(userScoresByCourseId.get(Number(course.id)) || 0)));
            const category = String(course.category || 'general').toLowerCase();
            categoryRaw.set(Number(course.id), (categoryAffinityRaw.get(category) || 0) / maxCategoryAffinity);
        }

        const content = normalizeMap(contentRaw);
        const search = normalizeMap(searchRaw);
        const popularity = normalizeMap(popularityRaw);
        const freshness = normalizeMap(freshnessRaw);
        const interest = normalizeMap(interestRaw);
        const category = normalizeMap(categoryRaw);

        const hasProfile = profileVector.size > 0 || profileCourses.length > 0;
        const scored = candidateCourses.map((course) => {
            const id = Number(course.id);
            const contentScore = Number(content.get(id) || 0);
            const searchScore = Number(search.get(id) || 0);
            const popularityScore = Number(popularity.get(id) || 0);
            const freshnessScore = Number(freshness.get(id) || 0);
            const interestScore = Number(interest.get(id) || 0);
            const categoryScore = Number(category.get(id) || 0);

            const score = hasProfile
                ? (contentScore * 0.38) + (searchScore * 0.20) + (categoryScore * 0.18) + (interestScore * 0.10) + (popularityScore * 0.10) + (freshnessScore * 0.04)
                : (popularityScore * 0.60) + (freshnessScore * 0.40);

            const reasonCandidates = [
                { key: 'content', label: 'Matches your searches and learning interests', value: contentScore },
                { key: 'search', label: 'Matches topics you searched', value: searchScore },
                { key: 'category', label: 'Based on categories you prefer', value: categoryScore },
                { key: 'interest', label: 'Because you engaged/enrolled in similar courses', value: interestScore },
                { key: 'popularity', label: 'Popular among learners', value: popularityScore },
                { key: 'freshness', label: 'Freshly added content', value: freshnessScore },
            ].sort((a, b) => b.value - a.value);

            const confidence = Math.round(Math.max(0, Math.min(100, score * 100)));
            return {
                ...course,
                recommendation_score: score,
                recommendation_confidence: confidence,
                recommendation_reason: reasonCandidates[0]?.label || 'Recommended for you',
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
