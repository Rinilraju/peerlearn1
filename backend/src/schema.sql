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

CREATE TABLE IF NOT EXISTS doubts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE IF NOT EXISTS answers (
  id SERIAL PRIMARY KEY,
  doubt_id INTEGER REFERENCES doubts(id),
  user_id INTEGER REFERENCES users(id),
  text TEXT NOT NULL,
  parent_id INTEGER REFERENCES answers(id), -- For nested replies
  votes INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS votes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  item_id INTEGER NOT NULL, -- link to doubt_id or answer_id
  item_type VARCHAR(20) NOT NULL, -- 'doubt' or 'answer'
  vote_type INTEGER NOT NULL, -- 1 for upvote, -1 for downvote
  UNIQUE(user_id, item_id, item_type)
);

ALTER TABLE doubts ADD COLUMN IF NOT EXISTS votes INTEGER DEFAULT 0;
