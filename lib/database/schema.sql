
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(10) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    public_key TEXT NOT NULL,
    secret_key_encrypted TEXT NOT NULL,
    avatar_url TEXT,
    bio TEXT NOT NULL DEFAULT 'Using Kakioki, enjoying my time on Earth.',
    is_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_username_trgm ON users USING gin (username gin_trgm_ops);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS friend_requests (
    id SERIAL PRIMARY KEY,
    from_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (from_id, to_id)
);

CREATE INDEX IF NOT EXISTS idx_friend_requests_from_status ON friend_requests(from_id, status);
CREATE INDEX IF NOT EXISTS idx_friend_requests_to_status ON friend_requests(to_id, status);

DROP TRIGGER IF EXISTS update_friend_requests_updated_at ON friend_requests;
CREATE TRIGGER update_friend_requests_updated_at
    BEFORE UPDATE ON friend_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS message_threads (
    id SERIAL PRIMARY KEY,
    thread_id UUID NOT NULL UNIQUE,
    user_a_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_b_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CHECK (user_a_id < user_b_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_message_threads_pair ON message_threads(user_a_id, user_b_id);

DROP TRIGGER IF EXISTS update_message_threads_updated_at ON message_threads;
CREATE TRIGGER update_message_threads_updated_at
    BEFORE UPDATE ON message_threads
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'messages'
          AND column_name = 'sender_id'
    ) THEN
        DROP TABLE messages CASCADE;
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS messages (
    id BIGSERIAL PRIMARY KEY,
    thread_id INTEGER NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
    from_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_message_id UUID NOT NULL UNIQUE,
    ciphertext TEXT NOT NULL,
    nonce TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    status_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_messages_thread_created_at ON messages(thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_to_id_created_at ON messages(to_id, created_at);

CREATE TABLE IF NOT EXISTS user_blocks (
    id SERIAL PRIMARY KEY,
    blocker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CHECK (blocker_id <> blocked_id),
    UNIQUE (blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON user_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON user_blocks(blocked_id);

CREATE TABLE IF NOT EXISTS account_deletion_queue (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    execute_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_account_deletion_queue_execute_at ON account_deletion_queue(execute_at);

CREATE OR REPLACE FUNCTION cleanup_old_accounts()
RETURNS INTEGER AS $$
DECLARE
    queued_count INTEGER;
BEGIN
    INSERT INTO account_deletion_queue (user_id, execute_at)
    SELECT id, CURRENT_TIMESTAMP
    FROM users
    WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '2 days'
    ON CONFLICT (user_id) DO NOTHING;

    GET DIAGNOSTICS queued_count = ROW_COUNT;
    RETURN queued_count;
END;
$$ LANGUAGE plpgsql;
