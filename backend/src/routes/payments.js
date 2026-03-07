const express = require('express');
const authenticateToken = require('../middleware/auth');
const db = require('../db');

const router = express.Router();

let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
}
const simulatePayments = process.env.SIMULATE_PAYMENTS !== 'false';

async function upsertEnrollment({ userId, courseId, paymentId }) {
    await db.query(
        `INSERT INTO enrollments (user_id, course_id, payment_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, course_id)
         DO UPDATE SET payment_id = COALESCE(enrollments.payment_id, EXCLUDED.payment_id)`,
        [userId, courseId, paymentId]
    );
    await db.query(
        `INSERT INTO course_interactions (user_id, course_id, interaction_type)
         VALUES ($1, $2, 'enroll')`,
        [userId, courseId]
    );
}

router.post('/create-checkout-session', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const { courseId } = req.body;

    if (!courseId) {
        return res.status(400).json({ message: 'courseId is required' });
    }

    try {
        const courseResult = await db.query('SELECT id, title, description, price, instructor_id FROM courses WHERE id = $1', [courseId]);
        if (courseResult.rows.length === 0) {
            return res.status(404).json({ message: 'Course not found' });
        }

        const course = courseResult.rows[0];
        if (Number(course.instructor_id) === Number(userId)) {
            return res.status(400).json({ message: 'Tutors cannot enroll in their own courses.' });
        }

        // Simulated payment mode (default) to allow enrollment without gateway setup.
        if (simulatePayments || !stripe) {
            const paymentResult = await db.query(
                `INSERT INTO payments (user_id, course_id, amount, currency, provider, provider_session_id, status)
                 VALUES ($1, $2, $3, 'usd', 'simulated', $4, 'paid')
                 RETURNING id`,
                [userId, course.id, Number(course.price || 0), `sim-${Date.now()}-${userId}`]
            );
            await upsertEnrollment({ userId, courseId: course.id, paymentId: paymentResult.rows[0].id });
            return res.status(201).json({
                simulated: true,
                enrolled: true,
                paymentId: paymentResult.rows[0].id,
                message: 'Simulated payment completed. Enrollment activated.',
            });
        }

        const amount = Math.max(Math.round(Number(course.price || 0) * 100), 50);
        const origin = process.env.CLIENT_URL || req.headers.origin || 'http://localhost:5173';

        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: course.title,
                            description: course.description || 'PeerLearn course enrollment',
                        },
                        unit_amount: amount,
                    },
                    quantity: 1,
                },
            ],
            success_url: `${origin}/courses/${course.id}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/courses/${course.id}?payment=cancelled`,
            metadata: {
                userId: String(userId),
                courseId: String(course.id),
            },
        });

        const paymentResult = await db.query(
            `INSERT INTO payments (user_id, course_id, amount, currency, provider, provider_session_id, status)
             VALUES ($1, $2, $3, 'usd', 'stripe', $4, 'pending')
             RETURNING id`,
            [userId, course.id, Number(course.price || 0), session.id]
        );

        return res.status(201).json({
            checkoutUrl: session.url,
            sessionId: session.id,
            paymentId: paymentResult.rows[0].id,
        });
    } catch (error) {
        console.error('Create checkout session failed:', error);
        return res.status(500).json({ message: 'Failed to create checkout session' });
    }
});

router.post('/confirm', authenticateToken, async (req, res) => {
    if (simulatePayments || !stripe) {
        return res.status(400).json({
            message: 'Stripe confirmation is disabled in simulated payment mode.',
        });
    }

    const userId = req.user.id;
    const { sessionId } = req.body;

    if (!sessionId) {
        return res.status(400).json({ message: 'sessionId is required' });
    }

    try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        if (session.payment_status !== 'paid') {
            return res.status(400).json({ message: 'Payment is not completed yet.' });
        }

        const courseId = Number(session.metadata?.courseId);
        const metadataUserId = Number(session.metadata?.userId);
        if (!courseId || metadataUserId !== Number(userId)) {
            return res.status(400).json({ message: 'Invalid checkout metadata.' });
        }

        const paymentResult = await db.query(
            `UPDATE payments
             SET status = 'paid', updated_at = CURRENT_TIMESTAMP
             WHERE provider_session_id = $1 AND user_id = $2
             RETURNING id, course_id`,
            [sessionId, userId]
        );

        if (paymentResult.rows.length === 0) {
            return res.status(404).json({ message: 'Payment record not found.' });
        }

        const payment = paymentResult.rows[0];
        await upsertEnrollment({ userId, courseId: payment.course_id, paymentId: payment.id });

        return res.json({ ok: true, courseId: payment.course_id });
    } catch (error) {
        console.error('Payment confirmation failed:', error);
        return res.status(500).json({ message: 'Failed to confirm payment' });
    }
});

module.exports = router;
