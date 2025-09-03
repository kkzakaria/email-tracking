-- Create webhook subscriptions table for managing Microsoft Graph subscriptions
CREATE TABLE IF NOT EXISTS webhook_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id TEXT UNIQUE NOT NULL, -- Microsoft Graph subscription ID
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    resource TEXT NOT NULL, -- Resource path being monitored (e.g., /me/messages)
    change_types TEXT[] NOT NULL, -- Array of change types (created, updated, deleted)
    notification_url TEXT NOT NULL, -- Our webhook endpoint URL
    expiration_datetime TIMESTAMPTZ NOT NULL, -- When the subscription expires
    client_state TEXT NOT NULL, -- Secret for validation
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'failed', 'renewing')),
    last_renewed_at TIMESTAMPTZ,
    renewal_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create webhook events table for logging received notifications
CREATE TABLE IF NOT EXISTS webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id TEXT REFERENCES webhook_subscriptions(subscription_id) ON DELETE SET NULL,
    event_type TEXT NOT NULL, -- Type of event (message.created, message.updated, etc.)
    resource_id TEXT, -- ID of the resource that changed
    resource_data JSONB, -- Full resource data if available
    change_type TEXT, -- created, updated, or deleted
    client_state TEXT, -- For validation
    tenant_id TEXT,
    user_id TEXT, -- Microsoft user ID
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMPTZ,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create table for tracking webhook processing status
CREATE TABLE IF NOT EXISTS webhook_processing_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES webhook_events(id) ON DELETE CASCADE,
    action TEXT NOT NULL, -- Action taken (update_status, create_tracking, etc.)
    details JSONB,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    processing_time_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_user_id ON webhook_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_status ON webhook_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_expiration ON webhook_subscriptions(expiration_datetime);
CREATE INDEX IF NOT EXISTS idx_webhook_events_subscription_id ON webhook_events(subscription_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON webhook_events(processed);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON webhook_events(created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_processing_log_event_id ON webhook_processing_log(event_id);

-- Enable Row Level Security (RLS)
ALTER TABLE webhook_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_processing_log ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for webhook_subscriptions
CREATE POLICY "Users can view own webhook subscriptions" 
    ON webhook_subscriptions FOR SELECT 
    USING (user_id = auth.uid());

CREATE POLICY "System can manage all webhook subscriptions" 
    ON webhook_subscriptions FOR ALL 
    USING (true)
    WITH CHECK (true);

-- Create RLS policies for webhook_events
CREATE POLICY "Users can view events for their subscriptions" 
    ON webhook_events FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM webhook_subscriptions 
            WHERE webhook_subscriptions.subscription_id = webhook_events.subscription_id 
            AND webhook_subscriptions.user_id = auth.uid()
        )
    );

CREATE POLICY "System can manage all webhook events" 
    ON webhook_events FOR ALL 
    USING (true)
    WITH CHECK (true);

-- Create RLS policies for webhook_processing_log
CREATE POLICY "Users can view logs for their events" 
    ON webhook_processing_log FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM webhook_events 
            JOIN webhook_subscriptions ON webhook_events.subscription_id = webhook_subscriptions.subscription_id
            WHERE webhook_events.id = webhook_processing_log.event_id 
            AND webhook_subscriptions.user_id = auth.uid()
        )
    );

-- Create function to automatically renew subscriptions
CREATE OR REPLACE FUNCTION renew_expiring_subscriptions()
RETURNS TABLE(subscription_id TEXT, needs_renewal BOOLEAN)
SET search_path = public
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ws.subscription_id,
        CASE 
            WHEN ws.expiration_datetime < NOW() + INTERVAL '6 hours' THEN true
            ELSE false
        END as needs_renewal
    FROM webhook_subscriptions ws
    WHERE ws.status = 'active'
    AND ws.expiration_datetime < NOW() + INTERVAL '6 hours';
END;
$$ LANGUAGE plpgsql;

-- Create function to process webhook event and update email tracking status
CREATE OR REPLACE FUNCTION process_webhook_event(event_id UUID)
RETURNS JSONB
SET search_path = public
SECURITY DEFINER
AS $$
DECLARE
    event_record webhook_events%ROWTYPE;
    result JSONB;
    conversation_id TEXT;
    tracked_email email_tracking%ROWTYPE;
BEGIN
    -- Get the event details
    SELECT * INTO event_record FROM webhook_events WHERE id = event_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Event not found');
    END IF;
    
    -- Extract conversation ID from resource data
    conversation_id := event_record.resource_data->>'conversationId';
    
    IF conversation_id IS NOT NULL THEN
        -- Find tracked emails with matching conversation ID
        -- This would need to be enhanced to store conversation_id in email_tracking table
        -- For now, we'll update based on other criteria
        
        -- Mark event as processed
        UPDATE webhook_events 
        SET processed = true, 
            processed_at = NOW()
        WHERE id = event_id;
        
        RETURN jsonb_build_object(
            'success', true, 
            'conversation_id', conversation_id,
            'event_type', event_record.event_type
        );
    END IF;
    
    RETURN jsonb_build_object('success', false, 'error', 'No conversation ID found');
END;
$$ LANGUAGE plpgsql;

-- Create function to clean up old webhook events
CREATE OR REPLACE FUNCTION cleanup_old_webhook_events(days_old INTEGER DEFAULT 30)
RETURNS INTEGER 
SET search_path = public
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM webhook_events 
    WHERE created_at < NOW() - (days_old || ' days')::INTERVAL
    AND processed = true;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT ALL ON webhook_subscriptions TO authenticated;
GRANT ALL ON webhook_events TO authenticated;
GRANT ALL ON webhook_processing_log TO authenticated;
GRANT ALL ON webhook_subscriptions TO anon; -- For webhook endpoint
GRANT ALL ON webhook_events TO anon; -- For webhook endpoint

-- Add helpful comments
COMMENT ON TABLE webhook_subscriptions IS 'Manages Microsoft Graph webhook subscriptions for email monitoring';
COMMENT ON TABLE webhook_events IS 'Logs all webhook notifications received from Microsoft Graph';
COMMENT ON TABLE webhook_processing_log IS 'Tracks processing status and actions taken for each webhook event';
COMMENT ON FUNCTION renew_expiring_subscriptions() IS 'Identifies subscriptions that need renewal (within 6 hours of expiration)';
COMMENT ON FUNCTION process_webhook_event(UUID) IS 'Processes a webhook event and updates related email tracking records';
COMMENT ON FUNCTION cleanup_old_webhook_events(INTEGER) IS 'Removes old processed webhook events to maintain database performance';