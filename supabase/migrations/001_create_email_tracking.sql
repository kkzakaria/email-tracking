-- Create email_tracking table
CREATE TABLE IF NOT EXISTS email_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    recipient_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    message_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'REPLIED', 'STOPPED', 'EXPIRED')),
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reply_received_at TIMESTAMPTZ,
    stopped_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_email_tracking_user_id ON email_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_email_tracking_status ON email_tracking(status);
CREATE INDEX IF NOT EXISTS idx_email_tracking_sent_at ON email_tracking(sent_at);
CREATE INDEX IF NOT EXISTS idx_email_tracking_message_id ON email_tracking(message_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER update_email_tracking_updated_at 
    BEFORE UPDATE ON email_tracking 
    FOR EACH ROW 
    EXECUTE PROCEDURE update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE email_tracking ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only see their own email tracking records
CREATE POLICY "Users can view own email tracking" 
    ON email_tracking FOR SELECT 
    USING (auth.uid() = user_id);

-- Users can only insert their own email tracking records
CREATE POLICY "Users can insert own email tracking" 
    ON email_tracking FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Users can only update their own email tracking records
CREATE POLICY "Users can update own email tracking" 
    ON email_tracking FOR UPDATE 
    USING (auth.uid() = user_id);

-- Users can only delete their own email tracking records
CREATE POLICY "Users can delete own email tracking" 
    ON email_tracking FOR DELETE 
    USING (auth.uid() = user_id);

-- Grant necessary permissions
GRANT ALL ON email_tracking TO authenticated;
GRANT SELECT ON email_tracking TO anon;