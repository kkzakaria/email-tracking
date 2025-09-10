-- ====================================================================================================
-- EMAIL TRACKING SYSTEM - SUPABASE CENTRIC ARCHITECTURE
-- ====================================================================================================
-- Migration 001: Core schema pour architecture Supabase-centric
-- Created: 2025-01-08
-- Description: Schema simplifié pour système autonome avec Edge Functions
-- ====================================================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Custom types
CREATE TYPE email_status AS ENUM ('PENDING', 'REPLIED', 'FAILED', 'EXPIRED');

-- ====================================================================================================
-- TABLE: tracked_emails (Table principale simplifiée)
-- ====================================================================================================
CREATE TABLE tracked_emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identifiants Microsoft Graph
    message_id TEXT NOT NULL UNIQUE,
    internet_message_id TEXT,
    conversation_id TEXT,
    
    -- Contenu email
    subject TEXT NOT NULL,
    recipient_email TEXT NOT NULL,
    sender_email TEXT,
    
    -- Tracking
    sent_at TIMESTAMPTZ NOT NULL,
    status email_status DEFAULT 'PENDING',
    reply_received_at TIMESTAMPTZ,
    reply_detection_method TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes pour performance
CREATE INDEX idx_tracked_emails_status ON tracked_emails(status);
CREATE INDEX idx_tracked_emails_sent_at ON tracked_emails(sent_at DESC);
CREATE INDEX idx_tracked_emails_conversation ON tracked_emails(conversation_id) WHERE conversation_id IS NOT NULL;
CREATE INDEX idx_tracked_emails_message_id ON tracked_emails(message_id);

-- ====================================================================================================
-- TABLE: graph_subscriptions (Gestion subscriptions Microsoft Graph)
-- ====================================================================================================
CREATE TABLE graph_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Microsoft Graph subscription details
    subscription_id TEXT NOT NULL UNIQUE,
    resource TEXT NOT NULL, -- '/me/messages'
    notification_url TEXT NOT NULL,
    
    -- Configuration
    change_types TEXT[] NOT NULL DEFAULT ARRAY['created'],
    expiration_datetime TIMESTAMPTZ NOT NULL,
    client_state TEXT NOT NULL,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    last_renewal_at TIMESTAMPTZ,
    renewal_attempts INTEGER DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour gestion des subscriptions
CREATE INDEX idx_subscriptions_active ON graph_subscriptions(is_active, expiration_datetime);
CREATE INDEX idx_subscriptions_expiring ON graph_subscriptions(expiration_datetime) WHERE is_active = true;

-- ====================================================================================================
-- TABLE: received_messages (Messages reçus via webhooks)
-- ====================================================================================================
CREATE TABLE received_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Microsoft Graph identifiers
    graph_message_id TEXT NOT NULL,
    internet_message_id TEXT,
    conversation_id TEXT,
    
    -- Message content
    subject TEXT,
    from_email TEXT,
    to_email TEXT,
    body_preview TEXT,
    
    -- Timestamps
    received_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Contraintes
    UNIQUE(graph_message_id)
);

-- Index pour détection des réponses
CREATE INDEX idx_received_conversation ON received_messages(conversation_id, received_at DESC) WHERE conversation_id IS NOT NULL;
CREATE INDEX idx_received_unprocessed ON received_messages(processed_at) WHERE processed_at IS NULL;

-- ====================================================================================================
-- TABLE: webhook_events (Log des événements webhook)
-- ====================================================================================================
CREATE TABLE webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Webhook details
    subscription_id TEXT NOT NULL,
    change_type TEXT NOT NULL,
    resource_id TEXT,
    
    -- Processing
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMPTZ,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Raw data
    raw_notification JSONB,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour suivi des événements
CREATE INDEX idx_webhook_events_subscription ON webhook_events(subscription_id, created_at DESC);
CREATE INDEX idx_webhook_events_unprocessed ON webhook_events(processed, created_at) WHERE NOT processed;

-- ====================================================================================================
-- FUNCTIONS: Triggers et utilitaires
-- ====================================================================================================

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Appliquer le trigger aux tables avec updated_at
CREATE TRIGGER update_tracked_emails_updated_at 
    BEFORE UPDATE ON tracked_emails 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at 
    BEFORE UPDATE ON graph_subscriptions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ====================================================================================================
-- FUNCTION: Détection automatique des réponses (CORE LOGIC)
-- ====================================================================================================
CREATE OR REPLACE FUNCTION detect_email_replies()
RETURNS TRIGGER AS $$
DECLARE
    tracked_email RECORD;
    reply_count INTEGER;
BEGIN
    -- Ne traiter que les messages avec conversation_id
    IF NEW.conversation_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Marquer comme traité immédiatement
    NEW.processed_at = NOW();

    -- Chercher les emails trackés dans cette conversation
    FOR tracked_email IN 
        SELECT te.id, te.subject, te.sent_at
        FROM tracked_emails te
        WHERE te.conversation_id = NEW.conversation_id
        AND te.status = 'PENDING'
        AND NEW.received_at > te.sent_at -- Message reçu après envoi
    LOOP
        
        -- Vérifier s'il n'y a pas déjà une réponse enregistrée
        SELECT COUNT(*) INTO reply_count
        FROM received_messages rm
        WHERE rm.conversation_id = NEW.conversation_id
        AND rm.received_at > tracked_email.sent_at
        AND rm.received_at < NEW.received_at;

        -- Si c'est la première réponse après l'envoi
        IF reply_count = 0 THEN
            -- Mettre à jour le statut de l'email tracké
            UPDATE tracked_emails 
            SET 
                status = 'REPLIED',
                reply_received_at = NEW.received_at,
                reply_detection_method = 'supabase_trigger',
                updated_at = NOW()
            WHERE id = tracked_email.id;

            -- Log de succès
            RAISE NOTICE 'Reply detected for email % in conversation %', 
                tracked_email.id, NEW.conversation_id;
        END IF;

    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger pour détection automatique des réponses
CREATE TRIGGER detect_replies_on_message_received
    BEFORE INSERT ON received_messages
    FOR EACH ROW
    EXECUTE FUNCTION detect_email_replies();

-- ====================================================================================================
-- VIEWS: Statistiques et monitoring
-- ====================================================================================================

-- Vue des statistiques globales
CREATE OR REPLACE VIEW email_stats AS
SELECT 
    COUNT(*) as total_emails,
    COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_emails,
    COUNT(CASE WHEN status = 'REPLIED' THEN 1 END) as replied_emails,
    COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed_emails,
    COUNT(CASE WHEN status = 'EXPIRED' THEN 1 END) as expired_emails,
    COUNT(CASE WHEN conversation_id IS NOT NULL THEN 1 END) as emails_with_conversation_id,
    ROUND(AVG(EXTRACT(EPOCH FROM (reply_received_at - sent_at))/3600), 2) as avg_reply_time_hours
FROM tracked_emails;

-- Vue des subscriptions actives
CREATE OR REPLACE VIEW active_subscriptions AS
SELECT 
    subscription_id,
    resource,
    expiration_datetime,
    (expiration_datetime - NOW()) as time_until_expiry,
    last_renewal_at,
    created_at
FROM graph_subscriptions 
WHERE is_active = true
ORDER BY expiration_datetime ASC;

-- Vue des événements récents
CREATE OR REPLACE VIEW recent_webhook_events AS
SELECT 
    subscription_id,
    change_type,
    processed,
    error_message,
    created_at
FROM webhook_events 
ORDER BY created_at DESC 
LIMIT 100;

-- ====================================================================================================
-- FUNCTIONS: Utilitaires pour Edge Functions
-- ====================================================================================================

-- Fonction pour enregistrer un message reçu (appelée par Edge Functions)
CREATE OR REPLACE FUNCTION log_received_message(
    p_graph_message_id TEXT,
    p_internet_message_id TEXT DEFAULT NULL,
    p_conversation_id TEXT DEFAULT NULL,
    p_subject TEXT DEFAULT NULL,
    p_from_email TEXT DEFAULT NULL,
    p_to_email TEXT DEFAULT NULL,
    p_body_preview TEXT DEFAULT NULL,
    p_received_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS UUID AS $$
DECLARE
    result_id UUID;
BEGIN
    INSERT INTO received_messages (
        graph_message_id,
        internet_message_id,
        conversation_id,
        subject,
        from_email,
        to_email,
        body_preview,
        received_at
    ) VALUES (
        p_graph_message_id,
        p_internet_message_id,
        p_conversation_id,
        p_subject,
        p_from_email,
        p_to_email,
        p_body_preview,
        p_received_at
    )
    ON CONFLICT (graph_message_id) DO UPDATE SET
        internet_message_id = EXCLUDED.internet_message_id,
        conversation_id = EXCLUDED.conversation_id,
        subject = EXCLUDED.subject,
        from_email = EXCLUDED.from_email,
        to_email = EXCLUDED.to_email,
        body_preview = EXCLUDED.body_preview,
        received_at = EXCLUDED.received_at
    RETURNING id INTO result_id;

    RETURN result_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour enregistrer un email tracké
CREATE OR REPLACE FUNCTION log_tracked_email(
    p_message_id TEXT,
    p_subject TEXT,
    p_recipient_email TEXT,
    p_internet_message_id TEXT DEFAULT NULL,
    p_conversation_id TEXT DEFAULT NULL,
    p_sender_email TEXT DEFAULT NULL,
    p_sent_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS UUID AS $$
DECLARE
    result_id UUID;
BEGIN
    INSERT INTO tracked_emails (
        message_id,
        internet_message_id,
        conversation_id,
        subject,
        recipient_email,
        sender_email,
        sent_at
    ) VALUES (
        p_message_id,
        p_internet_message_id,
        p_conversation_id,
        p_subject,
        p_recipient_email,
        p_sender_email,
        p_sent_at
    )
    ON CONFLICT (message_id) DO UPDATE SET
        internet_message_id = EXCLUDED.internet_message_id,
        conversation_id = EXCLUDED.conversation_id,
        subject = EXCLUDED.subject,
        recipient_email = EXCLUDED.recipient_email,
        sender_email = EXCLUDED.sender_email,
        sent_at = EXCLUDED.sent_at
    RETURNING id INTO result_id;

    RETURN result_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ====================================================================================================
-- ROW LEVEL SECURITY (RLS) 
-- ====================================================================================================
-- Note: Pour l'instant désactivé car le système est autonome via Edge Functions
-- Sera activé si nécessaire avec authentification utilisateur

-- ALTER TABLE tracked_emails ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE graph_subscriptions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE received_messages ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- ====================================================================================================
-- GRANTS: Permissions pour les Edge Functions
-- ====================================================================================================

-- Grant permissions pour le service role (Edge Functions)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Grant permissions pour l'API anonyme (lecture seule pour stats)
GRANT SELECT ON email_stats TO anon;
GRANT SELECT ON active_subscriptions TO anon;

-- ====================================================================================================
-- INDEXES additionnels pour performance
-- ====================================================================================================

-- Index composite pour requêtes complexes
CREATE INDEX idx_tracked_emails_status_sent_at ON tracked_emails(status, sent_at DESC);
CREATE INDEX idx_tracked_emails_recipient_status ON tracked_emails(recipient_email, status);

-- Index pour cleaning automatique
CREATE INDEX idx_tracked_emails_old ON tracked_emails(created_at) WHERE status IN ('REPLIED', 'FAILED', 'EXPIRED');
CREATE INDEX idx_webhook_events_old ON webhook_events(created_at) WHERE processed = true;

-- ====================================================================================================
-- COMMENTS pour documentation
-- ====================================================================================================

COMMENT ON TABLE tracked_emails IS 'Table principale des emails trackés - version simplifiée pour architecture Supabase';
COMMENT ON TABLE graph_subscriptions IS 'Gestion des subscriptions Microsoft Graph webhooks';
COMMENT ON TABLE received_messages IS 'Messages reçus via webhooks Microsoft Graph';
COMMENT ON TABLE webhook_events IS 'Log des événements webhook pour debugging';

COMMENT ON FUNCTION detect_email_replies() IS 'Détection automatique des réponses via triggers PostgreSQL';
COMMENT ON FUNCTION log_received_message IS 'Fonction utilitaire pour Edge Functions - enregistrement messages reçus';
COMMENT ON FUNCTION log_tracked_email IS 'Fonction utilitaire pour Edge Functions - enregistrement emails trackés';

COMMENT ON VIEW email_stats IS 'Statistiques globales pour dashboard temps réel';
COMMENT ON VIEW active_subscriptions IS 'Monitoring des subscriptions Microsoft Graph';

-- ====================================================================================================
-- END OF MIGRATION 001
-- ====================================================================================================