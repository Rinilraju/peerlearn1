const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const router = express.Router();
const db = require('../db');
const PRIMARY_ADMIN_EMAIL = 'madasseryraju@gmail.com';

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

async function authenticateUserByEmailPassword(email, password) {
    const normalizedEmail = normalizeEmail(email);
    const submittedPassword = String(password || '');

    const userResult = await db.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [normalizedEmail]);
    if (userResult.rows.length === 0) {
        return { ok: false, status: 400, message: 'Invalid credentials' };
    }

    const user = userResult.rows[0];
    if (!user.is_verified) {
        await db.query('UPDATE users SET is_verified = TRUE, verification_code = NULL WHERE id = $1', [user.id]);
    }

    let isMatch = await bcrypt.compare(submittedPassword, user.password);
    if (!isMatch && submittedPassword.trim() !== submittedPassword) {
        isMatch = await bcrypt.compare(submittedPassword.trim(), user.password);
    }
    if (!isMatch) {
        return { ok: false, status: 400, message: 'Invalid credentials' };
    }

    const isSuspended = Boolean(user.is_suspended);
    const suspendedUntil = user.suspended_until ? new Date(user.suspended_until).getTime() : null;
    const suspensionActive = isSuspended && (!suspendedUntil || suspendedUntil > Date.now());
    if (suspensionActive) {
        return { ok: false, status: 403, message: 'Your account is suspended. Please contact support.' };
    }

    return { ok: true, user };
}

function buildAuthResponse(user) {
    const tokenTtl = process.env.JWT_EXPIRES_IN || '7d';
    const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role || 'student' },
        process.env.JWT_SECRET,
        { expiresIn: tokenTtl }
    );

    return {
        token,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            username: user.username,
            profile_picture: user.profile_picture,
            date_of_birth: user.date_of_birth,
            phone_number: user.phone_number,
            education_qualification: user.education_qualification,
            profession: user.profession,
            role: user.role || 'student'
        }
    };
}

// Signup
router.post('/signup', async (req, res) => {
    const { name, email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const normalizedPassword = String(password || '').trim();
    const fs = require('fs');
    fs.appendFileSync('server_debug.log', `Signup attempt for: ${normalizedEmail}\n`);
    try {
        // Check if user exists
        const userResult = await db.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [normalizedEmail]);
        if (userResult.rows.length > 0) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(normalizedPassword, 10);
        await db.query(
            `INSERT INTO users (name, email, password, is_verified, verification_code, role)
             VALUES ($1, $2, $3, TRUE, NULL, 'student')
             RETURNING id, email`,
            [name, normalizedEmail, hashedPassword]
        );
        res.status(201).json({ message: 'User created successfully. You can now login.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Verify
router.post('/verify', async (req, res) => {
    const { email } = req.body;
    const normalizedEmail = normalizeEmail(email);
    try {
        const userResult = await db.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [normalizedEmail]);
        if (userResult.rows.length === 0) {
            return res.status(400).json({ message: 'User not found' });
        }

        const user = userResult.rows[0];
        if (user.is_verified) {
            return res.json({ message: 'User already verified.' });
        }

        await db.query('UPDATE users SET is_verified = TRUE, verification_code = NULL WHERE id = $1', [user.id]);
        res.json({ message: 'Email verified successfully. You can now login.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const auth = await authenticateUserByEmailPassword(email, password);
        if (!auth.ok) {
            return res.status(auth.status).json({ message: auth.message });
        }

        res.json(buildAuthResponse(auth.user));
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Admin-only login
router.post('/admin-login', async (req, res) => {
    const { email, password } = req.body;
    try {
        if (normalizeEmail(email) !== PRIMARY_ADMIN_EMAIL) {
            return res.status(403).json({ message: 'This account is not allowed to use admin login.' });
        }
        const auth = await authenticateUserByEmailPassword(email, password);
        if (!auth.ok) {
            return res.status(auth.status).json({ message: auth.message });
        }
        if ((auth.user.role || 'student') !== 'admin') {
            return res.status(403).json({ message: 'Admin access only. Use an admin account.' });
        }
        return res.json(buildAuthResponse(auth.user));
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server error' });
    }
});

// Check Username Availability
router.get('/check-username/:username', async (req, res) => {
    const { username } = req.params;
    try {
        const result = await db.query('SELECT id FROM users WHERE username = $1', [username]);
        res.json({ available: result.rows.length === 0 });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Complete Profile
router.post('/complete-profile', async (req, res) => {
    const { userId, username, date_of_birth, phone_number, education_qualification, profession, profile_picture } = req.body;
    try {
        // Check if username is taken (double check)
        const usernameCheck = await db.query('SELECT id FROM users WHERE username = $1 AND id != $2', [username, userId]);
        if (usernameCheck.rows.length > 0) {
            return res.status(400).json({ message: 'Username already taken' });
        }

        const result = await db.query(
            `UPDATE users 
             SET username = $1, date_of_birth = $2, phone_number = $3, education_qualification = $4, profession = $5, profile_picture = $6
             WHERE id = $7
             RETURNING id, name, email, username, profile_picture, date_of_birth, phone_number, education_qualification, profession, role`,
            [username, date_of_birth, phone_number, education_qualification, profession, profile_picture, userId]
        );

        res.json({ user: result.rows[0], message: 'Profile completed successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update Profile
router.put('/profile', async (req, res) => {
    const { userId, name, username, date_of_birth, phone_number, education_qualification, profession, profile_picture } = req.body;
    try {
        // Check if username is taken (double check)
        const usernameCheck = await db.query('SELECT id FROM users WHERE username = $1 AND id != $2', [username, userId]);
        if (usernameCheck.rows.length > 0) {
            return res.status(400).json({ message: 'Username already taken' });
        }

        const result = await db.query(
            `UPDATE users 
             SET name = $1, username = $2, date_of_birth = $3, phone_number = $4, education_qualification = $5, profession = $6, profile_picture = $7
             WHERE id = $8
             RETURNING id, name, email, username, profile_picture, date_of_birth, phone_number, education_qualification, profession, role`,
            [name, username, date_of_birth, phone_number, education_qualification, profession, profile_picture, userId]
        );

        res.json({ user: result.rows[0], message: 'Profile updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Forgot Password
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    const normalizedEmail = normalizeEmail(email);
    try {
        const userResult = await db.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [normalizedEmail]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expires = new Date(Date.now() + 3600000); // 1 hour from now

        await db.query(
            'UPDATE users SET reset_password_code = $1, reset_password_expires = $2 WHERE email = $3',
            [code, expires, normalizedEmail]
        );

        // In a real app, send email here
        console.log(`Reset Password Code for ${normalizedEmail}: ${code}`);
        const fs = require('fs');
        fs.appendFileSync('server_debug.log', `Reset Code for ${normalizedEmail}: ${code}\n`);

        res.json({ message: 'Reset code sent to your email.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Reset Password
router.post('/reset-password', async (req, res) => {
    const { email, code, newPassword } = req.body;
    const normalizedEmail = normalizeEmail(email);
    try {
        const userResult = await db.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [normalizedEmail]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = userResult.rows[0];

        if (user.reset_password_code !== code) {
            return res.status(400).json({ message: 'Invalid code' });
        }

        if (new Date() > new Date(user.reset_password_expires)) {
            return res.status(400).json({ message: 'Code expired' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await db.query(
            'UPDATE users SET password = $1, reset_password_code = NULL, reset_password_expires = NULL WHERE id = $2',
            [hashedPassword, user.id]
        );

        res.json({ message: 'Password reset successfully. You can now login.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
