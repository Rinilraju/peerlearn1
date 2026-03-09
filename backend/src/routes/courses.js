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
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const QUIZ_REQUIRE_AI = String(process.env.QUIZ_REQUIRE_AI || 'true').toLowerCase() === 'true';

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

function getTopicProfile(title, description, category) {
    const text = normalizeText(`${title || ''} ${description || ''} ${category || ''}`);
    if (text.includes('dbms') || text.includes('database') || text.includes('sql')) {
        return 'dbms';
    }
    if (text.includes('data structure') || text.includes('algorithm') || text.includes('dsa')) {
        return 'dsa';
    }
    if (text.includes('operating system') || text.includes('os') || text.includes('process scheduling')) {
        return 'os';
    }
    if (text.includes('network') || text.includes('tcp') || text.includes('ip') || text.includes('http')) {
        return 'networking';
    }
    if (text.includes('machine learning') || text.includes('ml') || text.includes('regression')) {
        return 'ml';
    }
    if (text.includes('react') || text.includes('javascript') || text.includes('frontend') || text.includes('web development')) {
        return 'webdev';
    }
    return 'generic';
}

function buildQuestionPoolByTopic(title, description, category) {
    const profile = getTopicProfile(title, description, category);
    const topic = title || category || 'this topic';
    const baseByProfile = {
        dbms: [
            { question: 'Which SQL command is used to retrieve data from a table?', options: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'], answer: 'SELECT' },
            { question: 'What does normalization primarily reduce in a relational database?', options: ['Data redundancy', 'Index size', 'Network latency', 'Disk speed'], answer: 'Data redundancy' },
            { question: 'Which normal form removes partial dependency?', options: ['Second Normal Form (2NF)', 'First Normal Form (1NF)', 'Third Normal Form (3NF)', 'Boyce-Codd NF'], answer: 'Second Normal Form (2NF)' },
            { question: 'A foreign key is used to:', options: ['Maintain referential integrity', 'Encrypt table data', 'Sort query output', 'Create backups'], answer: 'Maintain referential integrity' },
            { question: 'Which operation combines rows from two tables based on related columns?', options: ['JOIN', 'GROUP BY', 'UNION ALL', 'DISTINCT'], answer: 'JOIN' },
            { question: 'Which index structure is most common in relational databases?', options: ['B-Tree', 'Trie', 'Graph index', 'Hash map only'], answer: 'B-Tree' },
            { question: 'Which ACID property ensures completed transactions are permanent?', options: ['Durability', 'Atomicity', 'Consistency', 'Isolation'], answer: 'Durability' },
            { question: 'What is the primary purpose of a transaction log?', options: ['Recovery and rollback', 'UI rendering', 'Schema design only', 'CSV export'], answer: 'Recovery and rollback' },
            { question: 'In SQL, which clause is used to filter grouped records?', options: ['HAVING', 'WHERE', 'ORDER BY', 'LIMIT'], answer: 'HAVING' },
            { question: 'Which isolation issue can occur at lower isolation levels?', options: ['Dirty read', 'Syntax error', 'Dead pixel', 'Compile-time failure'], answer: 'Dirty read' },
        ],
        dsa: [
            { question: 'Which data structure follows LIFO order?', options: ['Stack', 'Queue', 'Heap', 'Graph'], answer: 'Stack' },
            { question: 'Average-case time complexity of binary search is:', options: ['O(log n)', 'O(n)', 'O(n log n)', 'O(1)'], answer: 'O(log n)' },
            { question: 'Which traversal visits Left-Root-Right in a binary tree?', options: ['Inorder', 'Preorder', 'Postorder', 'Level order'], answer: 'Inorder' },
            { question: 'Which algorithm is used for shortest path with non-negative weights?', options: ["Dijkstra's algorithm", "Kruskal's algorithm", "Prim's algorithm", "Floyd's cycle detection"], answer: "Dijkstra's algorithm" },
            { question: 'A hash table typically offers average lookup time of:', options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'], answer: 'O(1)' },
            { question: 'Which sorting algorithm is stable by default?', options: ['Merge sort', 'Quick sort', 'Heap sort', 'Selection sort'], answer: 'Merge sort' },
            { question: 'What is the worst-case time complexity of quicksort?', options: ['O(n^2)', 'O(n log n)', 'O(log n)', 'O(n)'], answer: 'O(n^2)' },
            { question: 'Which structure is ideal for BFS?', options: ['Queue', 'Stack', 'Priority queue', 'Linked list only'], answer: 'Queue' },
            { question: 'Which data structure supports efficient min extraction?', options: ['Min-heap', 'Array', 'Stack', 'Trie'], answer: 'Min-heap' },
            { question: 'Dynamic programming is most useful when problems have:', options: ['Overlapping subproblems', 'No subproblems', 'Random outputs', 'Only recursion depth 1'], answer: 'Overlapping subproblems' },
        ],
        os: [
            { question: 'Which component schedules processes on CPU?', options: ['Scheduler', 'Compiler', 'Assembler', 'Linker'], answer: 'Scheduler' },
            { question: 'What is a deadlock?', options: ['Processes waiting forever for resources', 'Fast context switching', 'Memory caching technique', 'File compression'], answer: 'Processes waiting forever for resources' },
            { question: 'Which memory management approach avoids external fragmentation?', options: ['Paging', 'Contiguous allocation', 'Overlaying only', 'Static partitioning'], answer: 'Paging' },
            { question: 'Round Robin scheduling is best described as:', options: ['Time-slice based preemptive scheduling', 'Non-preemptive batch scheduling', 'Priority inversion handling only', 'Disk scheduling strategy'], answer: 'Time-slice based preemptive scheduling' },
            { question: 'A semaphore is mainly used for:', options: ['Process synchronization', 'Data encryption', 'Code compilation', 'DNS lookup'], answer: 'Process synchronization' },
            { question: 'Which condition is necessary for deadlock?', options: ['Circular wait', 'Single user mode', 'Cache hit', 'Virtual memory'], answer: 'Circular wait' },
            { question: 'Context switch refers to:', options: ['Saving and restoring process state', 'Changing keyboard layout', 'Swapping SSD drives', 'Compiling two programs'], answer: 'Saving and restoring process state' },
            { question: 'Thrashing occurs when:', options: ['Too much paging activity', 'CPU clock fails', 'Kernel panic is disabled', 'File handles are low'], answer: 'Too much paging activity' },
            { question: 'Which is a non-preemptive scheduling algorithm?', options: ['FCFS', 'Round Robin', 'SRTF', 'Multilevel feedback queue'], answer: 'FCFS' },
            { question: 'Virtual memory allows:', options: ['Execution beyond physical RAM size', 'Faster GPU rendering', 'Elimination of CPU scheduling', 'No page faults ever'], answer: 'Execution beyond physical RAM size' },
        ],
        networking: [
            { question: 'Which protocol is connection-oriented?', options: ['TCP', 'UDP', 'IP', 'ICMP'], answer: 'TCP' },
            { question: 'Port 443 is commonly used for:', options: ['HTTPS', 'HTTP', 'FTP', 'SMTP'], answer: 'HTTPS' },
            { question: 'Which OSI layer handles routing?', options: ['Network layer', 'Transport layer', 'Session layer', 'Data link layer'], answer: 'Network layer' },
            { question: 'DNS is used to:', options: ['Resolve domain names to IP addresses', 'Encrypt packets end-to-end', 'Assign MAC addresses', 'Balance CPU load'], answer: 'Resolve domain names to IP addresses' },
            { question: 'Which protocol is used to send web pages?', options: ['HTTP', 'SSH', 'SNMP', 'NTP'], answer: 'HTTP' },
            { question: 'What does NAT primarily do?', options: ['Translates private IPs to public IPs', 'Encrypts TLS traffic', 'Detects malware in packets', 'Improves database indexing'], answer: 'Translates private IPs to public IPs' },
            { question: 'A subnet mask is used to:', options: ['Identify network and host portions of an IP', 'Compress packet headers', 'Authenticate users', 'Allocate MAC address pools'], answer: 'Identify network and host portions of an IP' },
            { question: 'Which command checks path packets take to destination?', options: ['traceroute', 'ping', 'netstat', 'arp'], answer: 'traceroute' },
            { question: 'TLS mainly provides:', options: ['Encryption and integrity in transit', 'Disk partitioning', 'CPU virtualization', 'SQL query optimization'], answer: 'Encryption and integrity in transit' },
            { question: 'UDP is preferred when application needs:', options: ['Low latency and can tolerate some loss', 'Guaranteed delivery and ordering always', 'Built-in congestion logs only', 'File-system level transactions'], answer: 'Low latency and can tolerate some loss' },
        ],
        ml: [
            { question: 'Which is a supervised learning task?', options: ['Classification', 'Clustering', 'Dimensionality reduction only', 'Association rule mining'], answer: 'Classification' },
            { question: 'Overfitting means:', options: ['Model learns training noise and generalizes poorly', 'Model is too simple always', 'Data has no labels', 'Loss is undefined'], answer: 'Model learns training noise and generalizes poorly' },
            { question: 'Which metric is suitable for imbalanced binary classification?', options: ['F1-score', 'Accuracy only', 'MAE', 'RMSE'], answer: 'F1-score' },
            { question: 'A train-test split is used to:', options: ['Estimate generalization performance', 'Increase memory usage', 'Remove all bias', 'Replace feature engineering'], answer: 'Estimate generalization performance' },
            { question: 'Which algorithm is commonly used for regression?', options: ['Linear Regression', 'K-Means', 'Apriori', 'DBSCAN'], answer: 'Linear Regression' },
            { question: 'Gradient descent updates parameters by moving in direction of:', options: ['Negative gradient', 'Positive gradient', 'Random vector', 'Hessian diagonal only'], answer: 'Negative gradient' },
            { question: 'Regularization helps to:', options: ['Reduce overfitting', 'Increase model variance only', 'Remove labels', 'Guarantee 100% accuracy'], answer: 'Reduce overfitting' },
            { question: 'Confusion matrix is mainly used for:', options: ['Classification evaluation', 'Regression normalization', 'Feature scaling', 'Data encryption'], answer: 'Classification evaluation' },
            { question: 'In k-NN, k refers to:', options: ['Number of nearest neighbors', 'Number of features', 'Training epochs', 'Learning rate'], answer: 'Number of nearest neighbors' },
            { question: 'Cross-validation is used to:', options: ['Get robust performance estimates', 'Only speed up training', 'Remove outliers automatically', 'Replace test set completely'], answer: 'Get robust performance estimates' },
        ],
        webdev: [
            { question: 'In React, state updates should be treated as:', options: ['Immutable updates', 'Direct mutation always', 'Synchronous network calls', 'Global variables only'], answer: 'Immutable updates' },
            { question: 'Which hook is used for side effects?', options: ['useEffect', 'useMemo', 'useRef', 'useContext'], answer: 'useEffect' },
            { question: 'HTTP status code 404 means:', options: ['Resource not found', 'Success', 'Unauthorized', 'Server crashed'], answer: 'Resource not found' },
            { question: 'Which technique improves frontend bundle size?', options: ['Code splitting', 'Adding duplicate libraries', 'Inlining all assets', 'Disabling caching'], answer: 'Code splitting' },
            { question: 'What does CORS control?', options: ['Cross-origin request permissions', 'Database indexing order', 'GPU memory allocation', 'Font rendering quality'], answer: 'Cross-origin request permissions' },
            { question: 'In JavaScript, === checks:', options: ['Strict equality', 'Type coercion equality only', 'Reference count', 'Prototype chain depth'], answer: 'Strict equality' },
            { question: 'Which tag is semantically correct for main page content?', options: ['<main>', '<div>', '<span>', '<b>'], answer: '<main>' },
            { question: 'JWTs are commonly used for:', options: ['Stateless authentication', 'Database normalization', 'Image compression', 'Socket encryption only'], answer: 'Stateless authentication' },
            { question: 'Which HTTP method is typically idempotent?', options: ['PUT', 'POST', 'PATCH', 'CONNECT'], answer: 'PUT' },
            { question: 'Debouncing is useful to:', options: ['Limit rapid function calls', 'Increase CSS specificity', 'Encrypt API payloads', 'Create SQL joins'], answer: 'Limit rapid function calls' },
        ],
    };

    const selected = baseByProfile[profile] || [];
    if (selected.length >= QUIZ_QUESTION_COUNT) {
        return selected;
    }

    // Generic fallback still references topic + description when unknown.
    const focus = description ? `${topic} (${description.slice(0, 80)})` : topic;
    return [
        ...selected,
        { question: `Which statement best defines the core concept of "${focus}"?`, options: ['A correct conceptual definition', 'An unrelated topic', 'A hardware-only concern', 'A random fact'], answer: 'A correct conceptual definition' },
        { question: `When teaching ${topic}, what should come first?`, options: ['Fundamentals and terminology', 'Advanced edge cases only', 'Final exam immediately', 'Skip examples'], answer: 'Fundamentals and terminology' },
        { question: `A good assignment for ${topic} should primarily test:`, options: ['Practical understanding', 'Memorization only', 'Unrelated trivia', 'Typing speed'], answer: 'Practical understanding' },
        { question: `Which practice improves mastery in ${topic}?`, options: ['Incremental practice with feedback', 'No revision', 'Only theory slides', 'Avoiding assessments'], answer: 'Incremental practice with feedback' },
        { question: `For ${topic}, which is a sign of conceptual clarity?`, options: ['Ability to explain and apply', 'Only repeating definitions', 'Avoiding questions', 'Skipping exercises'], answer: 'Ability to explain and apply' },
        { question: `In ${topic}, which assessment pattern is strongest?`, options: ['Short quizzes + applied tasks', 'Single high-stakes test only', 'No assessments', 'Attendance-only grading'], answer: 'Short quizzes + applied tasks' },
        { question: `How should errors be handled while learning ${topic}?`, options: ['Use errors as feedback opportunities', 'Ignore all errors', 'Penalize all attempts', 'Remove difficult modules'], answer: 'Use errors as feedback opportunities' },
        { question: `What is the best sequence for a ${topic} lesson?`, options: ['Concept, demo, guided practice, recap', 'Recap, then stop', 'Exam first, then theory', 'No sequence needed'], answer: 'Concept, demo, guided practice, recap' },
        { question: `Which learning signal shows progress in ${topic}?`, options: ['Improved problem-solving accuracy', 'Longer video watch time only', 'Fewer notes', 'Lower participation'], answer: 'Improved problem-solving accuracy' },
        { question: `What is a tutor's role in a ${topic} live class?`, options: ['Facilitate understanding and clarify doubts', 'Only read slides', 'Avoid interaction', 'Score without feedback'], answer: 'Facilitate understanding and clarify doubts' },
    ];
}

async function generateQuestionsWithAI({ title, description, category }) {
    if (!process.env.OPENAI_API_KEY) {
        return null;
    }

    const prompt = `
Generate exactly ${QUIZ_QUESTION_COUNT} MCQ questions for tutor verification.
Topic title: "${title || ''}"
Topic description: "${description || ''}"
Category: "${category || ''}"

Rules:
- Questions must test technical knowledge of the given topic.
- Use topic and description context directly (example: DBMS should ask DBMS concepts).
- 4 options per question.
- Exactly one correct option.
- Medium difficulty.
- Output JSON only in this shape:
{
  "questions": [
    {
      "question": "string",
      "options": ["A","B","C","D"],
      "correctIndex": 0
    }
  ]
}
`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: OPENAI_MODEL,
            temperature: 0.2,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: 'You generate strict JSON quiz data.' },
                { role: 'user', content: prompt },
            ],
        }),
    });

    if (!response.ok) {
        const details = await response.text();
        throw new Error(`AI quiz generation failed: ${response.status} ${details}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
        throw new Error('AI quiz generation returned empty content.');
    }

    const parsed = JSON.parse(content);
    const items = Array.isArray(parsed?.questions) ? parsed.questions : [];
    const normalized = items.map((item) => ({
        question: String(item.question || '').trim(),
        options: Array.isArray(item.options) ? item.options.map((option) => String(option || '').trim()).slice(0, 4) : [],
        correctIndex: Number(item.correctIndex),
    })).filter((item) => item.question && item.options.length === 4 && item.correctIndex >= 0 && item.correctIndex <= 3);

    if (normalized.length < QUIZ_QUESTION_COUNT) {
        throw new Error('AI did not return enough valid questions.');
    }
    return normalized.slice(0, QUIZ_QUESTION_COUNT);
}

function createQuizAttempt(userId, selectedQuestions) {
    const selected = selectedQuestions.map((item, idx) => {
        const options = [...item.options];
        const answer = item.answer || options[item.correctIndex];
        const shuffledOptions = shuffle(options);
        const correctIndex = shuffledOptions.findIndex((option) => option === answer);
        return {
            id: idx + 1,
            question: item.question,
            options: shuffledOptions,
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
        if (!title && !description) {
            return res.status(400).json({ message: 'Please enter course title or description to generate topic quiz.' });
        }

        if (QUIZ_REQUIRE_AI && !process.env.OPENAI_API_KEY) {
            return res.status(503).json({
                message: 'AI assessment is required but OpenAI API key is not configured on backend.',
            });
        }

        let selectedQuestions = null;
        let source = 'fallback';
        try {
            selectedQuestions = await generateQuestionsWithAI({ title, description, category });
            if (selectedQuestions) {
                source = 'ai';
            }
        } catch (error) {
            console.error('AI quiz generation failed, using fallback:', error.message);
            if (QUIZ_REQUIRE_AI) {
                return res.status(503).json({
                    message: 'AI assessment is temporarily unavailable. Please try again.',
                });
            }
        }

        if (!selectedQuestions) {
            const pool = buildQuestionPoolByTopic(title, description, category);
            selectedQuestions = shuffle(pool).slice(0, QUIZ_QUESTION_COUNT);
        }

        const attempt = createQuizAttempt(req.user.id, selectedQuestions);
        return res.json({
            attemptId: attempt.attemptId,
            durationSeconds: QUIZ_DURATION_SECONDS,
            questions: attempt.questions,
            source,
            provider: source === 'ai' ? 'openai' : 'rule-based-fallback',
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
