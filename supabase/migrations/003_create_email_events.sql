-- Create email_events table for detailed tracking analytics
CREATE TABLE IF NOT EXISTS email_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_tracking_id UUID NOT NULL REFERENCES email_tracking(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('OPEN', 'CLICK')),
    target_url TEXT, -- URL cliquée (null pour les ouvertures)
    client_ip TEXT,
    user_agent TEXT,
    referer TEXT,
    country TEXT, -- Pays basé sur l'IP (à implémenter plus tard)
    city TEXT,    -- Ville basée sur l'IP (à implémenter plus tard)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_email_events_tracking_id ON email_events(email_tracking_id);
CREATE INDEX IF NOT EXISTS idx_email_events_type ON email_events(event_type);
CREATE INDEX IF NOT EXISTS idx_email_events_created_at ON email_events(created_at);
CREATE INDEX IF NOT EXISTS idx_email_events_tracking_type ON email_events(email_tracking_id, event_type);

-- Enable Row Level Security (RLS)
ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only see events for their own emails
CREATE POLICY "Users can view own email events" 
    ON email_events FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM email_tracking 
            WHERE email_tracking.id = email_events.email_tracking_id 
            AND email_tracking.user_id = auth.uid()
        )
    );

-- System can insert events (for pixel and click tracking endpoints)
CREATE POLICY "System can insert email events" 
    ON email_events FOR INSERT 
    WITH CHECK (true);

-- Users cannot update or delete events (immutable tracking data)
CREATE POLICY "Events are immutable" 
    ON email_events FOR UPDATE 
    USING (false);

CREATE POLICY "Events cannot be deleted by users" 
    ON email_events FOR DELETE 
    USING (false);

-- Grant permissions
GRANT ALL ON email_events TO authenticated;
GRANT SELECT, INSERT ON email_events TO anon; -- Pour les endpoints de tracking

-- Create view for email analytics
CREATE OR REPLACE VIEW email_analytics AS
SELECT 
    et.id as tracking_id,
    et.user_id,
    et.recipient_email,
    et.subject,
    et.status,
    et.sent_at,
    et.created_at,
    
    -- Statistiques d'ouverture
    COUNT(CASE WHEN ev.event_type = 'OPEN' THEN 1 END) as open_count,
    MIN(CASE WHEN ev.event_type = 'OPEN' THEN ev.created_at END) as first_open_at,
    MAX(CASE WHEN ev.event_type = 'OPEN' THEN ev.created_at END) as last_open_at,
    
    -- Statistiques de clic
    COUNT(CASE WHEN ev.event_type = 'CLICK' THEN 1 END) as click_count,
    MIN(CASE WHEN ev.event_type = 'CLICK' THEN ev.created_at END) as first_click_at,
    MAX(CASE WHEN ev.event_type = 'CLICK' THEN ev.created_at END) as last_click_at,
    
    -- URLs cliquées uniques
    COUNT(DISTINCT CASE WHEN ev.event_type = 'CLICK' THEN ev.target_url END) as unique_clicks,
    
    -- Dernière activité
    MAX(ev.created_at) as last_activity_at

FROM email_tracking et
LEFT JOIN email_events ev ON et.id = ev.email_tracking_id
GROUP BY et.id, et.user_id, et.recipient_email, et.subject, et.status, et.sent_at, et.created_at;

-- Grant permissions on the view
GRANT SELECT ON email_analytics TO authenticated;

-- Create function to get email stats with events
CREATE OR REPLACE FUNCTION get_email_stats_with_events(user_uuid UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT JSON_BUILD_OBJECT(
        'total_emails', COUNT(*),
        'pending', COUNT(*) FILTER (WHERE status = 'PENDING'),
        'replied', COUNT(*) FILTER (WHERE status = 'REPLIED'),
        'stopped', COUNT(*) FILTER (WHERE status = 'STOPPED'),
        'expired', COUNT(*) FILTER (WHERE status = 'EXPIRED'),
        
        'total_opens', COALESCE(SUM(open_count), 0),
        'total_clicks', COALESCE(SUM(click_count), 0),
        'unique_opens', COUNT(*) FILTER (WHERE open_count > 0),
        'unique_clicks', COUNT(*) FILTER (WHERE click_count > 0),
        
        'avg_opens_per_email', COALESCE(AVG(open_count), 0),
        'avg_clicks_per_email', COALESCE(AVG(click_count), 0),
        
        'open_rate', CASE 
            WHEN COUNT(*) > 0 THEN (COUNT(*) FILTER (WHERE open_count > 0))::FLOAT / COUNT(*) * 100
            ELSE 0 
        END,
        'click_rate', CASE 
            WHEN COUNT(*) > 0 THEN (COUNT(*) FILTER (WHERE click_count > 0))::FLOAT / COUNT(*) * 100
            ELSE 0 
        END
    )
    INTO result
    FROM email_analytics
    WHERE user_id = user_uuid;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION get_email_stats_with_events(UUID) TO authenticated;

-- Create function to clean up old events (optional, for maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_email_events(days_old INTEGER DEFAULT 365)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM email_events 
    WHERE created_at < NOW() - (days_old || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission (admin only for cleanup)
GRANT EXECUTE ON FUNCTION cleanup_old_email_events(INTEGER) TO authenticated;