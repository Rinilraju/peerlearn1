const db = require('./db');
const fs = require('fs');

async function runMigrations() {
    console.log('Running database migrations...');
    try {
        // 0. Ensure base tables exist for fresh deployments.
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                verification_code VARCHAR(6),
                is_verified BOOLEAN DEFAULT FALSE,
                username VARCHAR(255) UNIQUE,
                profile_picture TEXT,
                date_of_birth DATE,
                phone_number VARCHAR(20),
                education_qualification VARCHAR(255),
                profession VARCHAR(255),
                reset_password_code VARCHAR(6),
                reset_password_expires TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS doubts (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                title VARCHAR(255) NOT NULL,
                description TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS courses (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                description TEXT NOT NULL,
                price DECIMAL(10, 2) DEFAULT 0.00,
                category VARCHAR(255),
                instructor_id INTEGER REFERENCES users(id),
                video_url VARCHAR(255),
                thumbnail VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS answers (
                id SERIAL PRIMARY KEY,
                doubt_id INTEGER REFERENCES doubts(id),
                user_id INTEGER REFERENCES users(id),
                text TEXT NOT NULL,
                parent_id INTEGER REFERENCES answers(id),
                votes INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS votes (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                item_id INTEGER NOT NULL,
                item_type VARCHAR(20) NOT NULL,
                vote_type INTEGER NOT NULL,
                UNIQUE(user_id, item_id, item_type)
            );
        `);

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

        // 7. Scheduled 1:1 sessions between instructor and enrolled student.
        await db.query(`
            CREATE TABLE IF NOT EXISTS course_sessions (
                id SERIAL PRIMARY KEY,
                course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
                instructor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                scheduled_at TIMESTAMP NOT NULL,
                duration_minutes INTEGER NOT NULL DEFAULT 60,
                meeting_room_id VARCHAR(100) NOT NULL,
                status VARCHAR(30) NOT NULL DEFAULT 'scheduled',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 8. In-app notifications (session reminders, scheduling updates).
        await db.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                title VARCHAR(255) NOT NULL,
                body TEXT NOT NULL,
                type VARCHAR(50) NOT NULL DEFAULT 'general',
                related_session_id INTEGER REFERENCES course_sessions(id) ON DELETE SET NULL,
                is_read BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 9. Simple course chat between tutor and enrolled students.
        await db.query(`
            CREATE TABLE IF NOT EXISTS course_chat_messages (
                id SERIAL PRIMARY KEY,
                course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
                sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                message TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_course_sessions_instructor_student
            ON course_sessions(instructor_id, student_id, scheduled_at);
        `);

        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_notifications_user
            ON notifications(user_id, is_read, created_at DESC);
        `);

        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_course_chat_pair
            ON course_chat_messages(course_id, sender_id, receiver_id, created_at DESC);
        `);

        console.log('Migrations completed successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
        // Don't exit process, let server try to run anyway, but log error
    }
}

module.exports = runMigrations;
