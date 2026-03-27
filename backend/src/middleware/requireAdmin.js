const db = require('../db');
const PRIMARY_ADMIN_EMAIL = 'madasseryraju@gmail.com';

async function requireAdmin(req, res, next) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'Missing authenticated user.' });
        }

        const result = await db.query('SELECT role, email FROM users WHERE id = $1 LIMIT 1', [userId]);
        const role = result.rows[0]?.role;
        const email = String(result.rows[0]?.email || '').toLowerCase();
        if (role !== 'admin' || email !== PRIMARY_ADMIN_EMAIL) {
            return res.status(403).json({ message: 'Admin access required.' });
        }

        next();
    } catch (error) {
        console.error('Admin middleware failed:', error.message);
        return res.status(500).json({ message: 'Failed to validate admin permissions.' });
    }
}

module.exports = requireAdmin;
