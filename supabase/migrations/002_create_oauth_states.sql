-- Create oauth_states table for CSRF protection
CREATE TABLE IF NOT EXISTS oauth_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    state TEXT NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL DEFAULT 'microsoft',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT FALSE
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_oauth_states_state ON oauth_states(state);
CREATE INDEX IF NOT EXISTS idx_oauth_states_user_id ON oauth_states(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires_at ON oauth_states(expires_at);

-- Enable Row Level Security (RLS)
ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only see their own OAuth states
CREATE POLICY "Users can view own OAuth states" 
    ON oauth_states FOR SELECT 
    USING (auth.uid() = user_id);

-- Users can only insert their own OAuth states
CREATE POLICY "Users can insert own OAuth states" 
    ON oauth_states FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own OAuth states
CREATE POLICY "Users can delete own OAuth states" 
    ON oauth_states FOR DELETE 
    USING (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON oauth_states TO authenticated;

-- Create a function to clean up expired states
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_states()
RETURNS void AS $$
BEGIN
    DELETE FROM oauth_states 
    WHERE expires_at < NOW() OR used = TRUE;
END;
$$ LANGUAGE plpgsql;

-- Optional: Create a periodic cleanup (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-oauth-states', '0 * * * *', 'SELECT cleanup_expired_oauth_states();');