const jwt = require('jsonwebtoken');
const db = require('../db');

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.split(' ')[1]
        : null;

    if (!token) {
        return res.status(401).json({ message: 'Missing auth token. Please login again.' });
    }

    if (!process.env.JWT_SECRET) {
        console.error('JWT_SECRET is not set on server.');
        return res.status(500).json({ message: 'Server auth is not configured.' });
    }

    jwt.verify(token, process.env.JWT_SECRET, async (err, user) => {
        if (err) {
            console.error('JWT Verification Error:', err.message);
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ message: 'Token expired. Please login again.' });
            }
            return res.status(403).json({ message: 'Invalid auth token. Please login again.' });
        }
        try {
            const result = await db.query(
                'SELECT id, role, is_suspended, suspended_until FROM users WHERE id = $1 LIMIT 1',
                [user.id]
            );
            if (result.rows.length === 0) {
                return res.status(401).json({ message: 'User does not exist anymore. Please login again.' });
            }
            const dbUser = result.rows[0];
            const isSuspended = Boolean(dbUser.is_suspended);
            const suspendedUntil = dbUser.suspended_until ? new Date(dbUser.suspended_until).getTime() : null;
            const suspensionActive = isSuspended && (!suspendedUntil || suspendedUntil > Date.now());
            if (suspensionActive) {
                return res.status(403).json({ message: 'Your account is suspended. Please contact support.' });
            }

            req.user = {
                ...user,
                role: dbUser.role || 'student',
            };
            next();
        } catch (dbError) {
            console.error('Auth user check failed:', dbError.message);
            return res.status(500).json({ message: 'Server auth check failed.' });
        }
    });
};

module.exports = authenticateToken;
