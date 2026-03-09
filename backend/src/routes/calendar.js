const express = require('express');
const authenticateToken = require('../middleware/auth');
const db = require('../db');

const router = express.Router();

function toIcsDate(dateValue) {
    const d = new Date(dateValue);
    return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

router.get('/my.ics', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const result = await db.query(
            `SELECT s.id, s.scheduled_at, s.duration_minutes, s.status, c.title
             FROM course_sessions s
             INNER JOIN courses c ON c.id = s.course_id
             WHERE s.instructor_id = $1 OR s.student_id = $1
             ORDER BY s.scheduled_at ASC`,
            [userId]
        );

        const lines = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//PeerLearn//Live Sessions//EN',
        ];

        for (const row of result.rows) {
            const start = new Date(row.scheduled_at);
            const end = new Date(start.getTime() + Number(row.duration_minutes || 60) * 60 * 1000);
            lines.push('BEGIN:VEVENT');
            lines.push(`UID:peerlearn-session-${row.id}@peerlearn`);
            lines.push(`DTSTAMP:${toIcsDate(new Date())}`);
            lines.push(`DTSTART:${toIcsDate(start)}`);
            lines.push(`DTEND:${toIcsDate(end)}`);
            lines.push(`SUMMARY:${String(row.title || 'Live Session').replace(/\n/g, ' ')}`);
            lines.push(`DESCRIPTION:PeerLearn session status: ${row.status}`);
            lines.push('END:VEVENT');
        }
        lines.push('END:VCALENDAR');

        res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="peerlearn-sessions.ics"');
        return res.send(lines.join('\r\n'));
    } catch (error) {
        console.error('Failed to export calendar:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
