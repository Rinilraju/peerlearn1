const express = require('express');
const authenticateToken = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const db = require('../db');

const router = express.Router();

async function logAction({ adminId, targetUserId = null, targetCourseId = null, reportId = null, actionType, reason = null, metadata = null }) {
    await db.query(
        `INSERT INTO moderation_actions (admin_id, target_user_id, target_course_id, report_id, action_type, reason, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [adminId, targetUserId, targetCourseId, reportId, actionType, reason, metadata ? JSON.stringify(metadata) : null]
    );
}

router.get('/reports', authenticateToken, requireAdmin, async (req, res) => {
    const status = String(req.query.status || 'open').toLowerCase();
    try {
        const result = await db.query(
            `SELECT dr.id, dr.category, dr.details, dr.status, dr.priority, dr.created_at, dr.updated_at,
                    dr.course_id, dr.session_id, dr.reported_user_id,
                    r.id AS reporter_id, r.name AS reporter_name, r.email AS reporter_email,
                    ru.name AS reported_user_name,
                    c.title AS course_title
             FROM dispute_reports dr
             INNER JOIN users r ON r.id = dr.reporter_id
             LEFT JOIN users ru ON ru.id = dr.reported_user_id
             LEFT JOIN courses c ON c.id = dr.course_id
             WHERE ($1 = 'all' OR dr.status = $1)
             ORDER BY
               CASE dr.priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END,
               dr.created_at DESC`,
            [status]
        );
        return res.json(result.rows);
    } catch (error) {
        console.error('Failed to fetch reports for admin:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

router.patch('/reports/:id/resolve', authenticateToken, requireAdmin, async (req, res) => {
    const adminId = req.user.id;
    const { id } = req.params;
    const { status, resolutionNotes } = req.body;
    const safeStatus = ['resolved', 'dismissed', 'in_review'].includes(String(status || '').toLowerCase())
        ? String(status).toLowerCase()
        : null;
    if (!safeStatus) {
        return res.status(400).json({ message: 'Invalid status. Use resolved, dismissed, or in_review.' });
    }

    try {
        const result = await db.query(
            `UPDATE dispute_reports
             SET status = $1,
                 resolution_notes = $2,
                 resolved_by = CASE WHEN $1 IN ('resolved', 'dismissed') THEN $3 ELSE NULL END,
                 resolved_at = CASE WHEN $1 IN ('resolved', 'dismissed') THEN CURRENT_TIMESTAMP ELSE NULL END,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $4
             RETURNING *`,
            [safeStatus, resolutionNotes || null, adminId, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Report not found.' });
        }
        await logAction({
            adminId,
            reportId: Number(id),
            actionType: `report_${safeStatus}`,
            reason: resolutionNotes || null,
        });
        return res.json(result.rows[0]);
    } catch (error) {
        console.error('Failed to resolve report:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

router.post('/users/:id/suspend', authenticateToken, requireAdmin, async (req, res) => {
    const adminId = req.user.id;
    const { id } = req.params;
    const { reason, durationHours, reportId } = req.body;
    const hours = Number(durationHours || 0);
    const untilClause = Number.isFinite(hours) && hours > 0
        ? `CURRENT_TIMESTAMP + INTERVAL '${Math.floor(hours)} hours'`
        : 'NULL';
    try {
        const result = await db.query(
            `UPDATE users
             SET is_suspended = TRUE,
                 suspended_reason = $1,
                 suspended_until = ${untilClause}
             WHERE id = $2
             RETURNING id, name, email, role, is_suspended, suspended_until`,
            [reason || 'Policy violation', id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }
        await logAction({
            adminId,
            targetUserId: Number(id),
            reportId: reportId ? Number(reportId) : null,
            actionType: 'suspend_user',
            reason: reason || 'Policy violation',
            metadata: { durationHours: hours > 0 ? Math.floor(hours) : null },
        });
        return res.json(result.rows[0]);
    } catch (error) {
        console.error('Failed to suspend user:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

router.post('/users/:id/unsuspend', authenticateToken, requireAdmin, async (req, res) => {
    const adminId = req.user.id;
    const { id } = req.params;
    const { reason } = req.body;
    try {
        const result = await db.query(
            `UPDATE users
             SET is_suspended = FALSE,
                 suspended_reason = NULL,
                 suspended_until = NULL
             WHERE id = $1
             RETURNING id, name, email, role, is_suspended`,
            [id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }
        await logAction({
            adminId,
            targetUserId: Number(id),
            actionType: 'unsuspend_user',
            reason: reason || null,
        });
        return res.json(result.rows[0]);
    } catch (error) {
        console.error('Failed to unsuspend user:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

router.delete('/courses/:id', authenticateToken, requireAdmin, async (req, res) => {
    const adminId = req.user.id;
    const { id } = req.params;
    const { reason, reportId } = req.body || {};
    try {
        const courseResult = await db.query('SELECT id, title FROM courses WHERE id = $1 LIMIT 1', [id]);
        if (courseResult.rows.length === 0) {
            return res.status(404).json({ message: 'Course not found.' });
        }
        await db.query('DELETE FROM courses WHERE id = $1', [id]);
        await logAction({
            adminId,
            targetCourseId: Number(id),
            reportId: reportId ? Number(reportId) : null,
            actionType: 'delete_course',
            reason: reason || 'Moderation removal',
            metadata: { courseTitle: courseResult.rows[0].title },
        });
        return res.json({ ok: true, deletedCourseId: Number(id) });
    } catch (error) {
        console.error('Failed to delete course:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

router.get('/audit', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT ma.id, ma.action_type, ma.reason, ma.created_at,
                    ma.target_user_id, ma.target_course_id, ma.report_id,
                    u.name AS admin_name
             FROM moderation_actions ma
             INNER JOIN users u ON u.id = ma.admin_id
             ORDER BY ma.created_at DESC
             LIMIT 200`
        );
        return res.json(result.rows);
    } catch (error) {
        console.error('Failed to fetch moderation audit:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
