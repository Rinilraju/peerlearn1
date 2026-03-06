const db = require('./db');
const fs = require('fs');

async function runMigrations() {
    console.log('Running database migrations...');
    try {
        // 1. Add price, category, instructor_id to courses
        await db.query(`ALTER TABLE courses ADD COLUMN IF NOT EXISTS price DECIMAL(10, 2) DEFAULT 0.00;`);
        await db.query(`ALTER TABLE courses ADD COLUMN IF NOT EXISTS category VARCHAR(255);`);
        await db.query(`ALTER TABLE courses ADD COLUMN IF NOT EXISTS instructor_id INTEGER REFERENCES users(id);`);

        // 2. Add tags to doubts
        await db.query(`ALTER TABLE doubts ADD COLUMN IF NOT EXISTS tags TEXT[];`);

        // 3. Add votes to doubts (if likely missing)
        await db.query(`ALTER TABLE doubts ADD COLUMN IF NOT EXISTS votes INTEGER DEFAULT 0;`);

        // 4. Track learner-course interactions for recommendations and ownership.
        await db.query(`
            CREATE TABLE IF NOT EXISTS course_interactions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
                interaction_type VARCHAR(30) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 5. Persist purchase state.
        await db.query(`
            CREATE TABLE IF NOT EXISTS payments (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
                amount DECIMAL(10, 2) NOT NULL,
                currency VARCHAR(10) NOT NULL DEFAULT 'usd',
                provider VARCHAR(30) NOT NULL DEFAULT 'stripe',
                provider_session_id VARCHAR(255),
                status VARCHAR(30) NOT NULL DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_course_interactions_user_course
            ON course_interactions(user_id, course_id);
        `);

        await db.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_session_unique
            ON payments(provider_session_id)
            WHERE provider_session_id IS NOT NULL;
        `);

        // 6. User enrollments after successful payment.
        await db.query(`
            CREATE TABLE IF NOT EXISTS enrollments (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
                payment_id INTEGER REFERENCES payments(id) ON DELETE SET NULL,
                enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, course_id)
            );
        `);

        console.log('Migrations completed successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
        // Don't exit process, let server try to run anyway, but log error
    }
}

module.exports = runMigrations;
