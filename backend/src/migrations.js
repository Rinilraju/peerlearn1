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
                role VARCHAR(20) NOT NULL DEFAULT 'student',
                reset_password_code VARCHAR(6),
                reset_password_expires TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'student';`);

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
            CREATE TABLE IF NOT EXISTS course_search_events (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                query_text VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_course_search_events_user_created
            ON course_search_events(user_id, created_at DESC);
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
                started_at TIMESTAMP,
                ended_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await db.query(`ALTER TABLE course_sessions ADD COLUMN IF NOT EXISTS started_at TIMESTAMP;`);
        await db.query(`ALTER TABLE course_sessions ADD COLUMN IF NOT EXISTS ended_at TIMESTAMP;`);
        await db.query(`ALTER TABLE course_sessions ADD COLUMN IF NOT EXISTS reminder_sent_10m BOOLEAN NOT NULL DEFAULT FALSE;`);

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

        // 10. Direct class requests from students to tutors.
        await db.query(`
            CREATE TABLE IF NOT EXISTS class_requests (
                id SERIAL PRIMARY KEY,
                requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                tutor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                topic VARCHAR(255) NOT NULL,
                message TEXT,
                preferred_time TIMESTAMP,
                status VARCHAR(30) NOT NULL DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                responded_at TIMESTAMP
            );
        `);

        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_class_requests_tutor_status
            ON class_requests(tutor_id, status, created_at DESC);
        `);

        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_class_requests_requester
            ON class_requests(requester_id, created_at DESC);
        `);

        // 11. Tutor/course reviews and ratings.
        await db.query(`
            CREATE TABLE IF NOT EXISTS tutor_reviews (
                id SERIAL PRIMARY KEY,
                reviewer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                tutor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
                comment TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(reviewer_id, tutor_id)
            );
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS course_reviews (
                id SERIAL PRIMARY KEY,
                reviewer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
                rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
                comment TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(reviewer_id, course_id)
            );
        `);

        // 12. Assignments and submissions.
        await db.query(`
            CREATE TABLE IF NOT EXISTS course_assignments (
                id SERIAL PRIMARY KEY,
                course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
                instructor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                assignment_type VARCHAR(30) NOT NULL DEFAULT 'homework',
                quiz_payload JSONB,
                due_at TIMESTAMP,
                max_score INTEGER NOT NULL DEFAULT 100,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS assignment_submissions (
                id SERIAL PRIMARY KEY,
                assignment_id INTEGER NOT NULL REFERENCES course_assignments(id) ON DELETE CASCADE,
                student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                content TEXT,
                quiz_answers JSONB,
                status VARCHAR(30) NOT NULL DEFAULT 'submitted',
                score INTEGER,
                submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                graded_at TIMESTAMP,
                UNIQUE(assignment_id, student_id)
            );
        `);

        // 13. Session notes persistence for live classes.
        await db.query(`
            CREATE TABLE IF NOT EXISTS session_notes (
                id SERIAL PRIMARY KEY,
                session_id INTEGER NOT NULL REFERENCES course_sessions(id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                notes TEXT NOT NULL DEFAULT '',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(session_id, user_id)
            );
        `);

        // 14. Lightweight audit logs for admin/security visibility.
        await db.query(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                action VARCHAR(100) NOT NULL,
                path VARCHAR(255),
                method VARCHAR(20),
                ip VARCHAR(64),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_tutor_reviews_tutor
            ON tutor_reviews(tutor_id, created_at DESC);
        `);
        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_course_reviews_course
            ON course_reviews(course_id, created_at DESC);
        `);
        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_assignments_course
            ON course_assignments(course_id, created_at DESC);
        `);
        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_submissions_student
            ON assignment_submissions(student_id, submitted_at DESC);
        `);
        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_audit_logs_created
            ON audit_logs(created_at DESC);
        `);

        console.log('Migrations completed successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
        // Don't exit process, let server try to run anyway, but log error
    }
}

module.exports = runMigrations;
