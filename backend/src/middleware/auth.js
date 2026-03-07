const jwt = require('jsonwebtoken');

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

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            console.error('JWT Verification Error:', err.message);
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ message: 'Token expired. Please login again.' });
            }
            return res.status(403).json({ message: 'Invalid auth token. Please login again.' });
        }
        req.user = user;
        next();
    });
};

module.exports = authenticateToken;
