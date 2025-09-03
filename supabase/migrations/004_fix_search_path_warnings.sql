-- Fix search_path warnings for all functions by setting it explicitly
-- This prevents potential security issues with mutable search paths

-- 1. Fix update_updated_at_column function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER 
SET search_path = public
SECURITY DEFINER
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Fix cleanup_expired_oauth_states function
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_states()
RETURNS void
SET search_path = public
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM oauth_states WHERE created_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- 3. Fix get_email_stats_with_events function
CREATE OR REPLACE FUNCTION get_email_stats_with_events(user_uuid UUID)
RETURNS JSON 
SET search_path = public
SECURITY DEFINER
AS $$
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
$$ LANGUAGE plpgsql;

-- 4. Fix cleanup_old_email_events function
CREATE OR REPLACE FUNCTION cleanup_old_email_events(days_old INTEGER DEFAULT 365)
RETURNS INTEGER 
SET search_path = public
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM email_events 
    WHERE created_at < NOW() - (days_old || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Add comment explaining the security fix
COMMENT ON FUNCTION update_updated_at_column() IS 'Auto-update updated_at timestamp with immutable search_path for security';
COMMENT ON FUNCTION cleanup_expired_oauth_states() IS 'Clean expired OAuth states with immutable search_path for security';
COMMENT ON FUNCTION get_email_stats_with_events(UUID) IS 'Get email statistics with events data with immutable search_path for security';
COMMENT ON FUNCTION cleanup_old_email_events(INTEGER) IS 'Clean old email events with immutable search_path for security';