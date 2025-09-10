-- ====================================================================================================
-- EMAIL TRACKING SYSTEM - SENT EMAILS EXTENSION
-- ====================================================================================================
-- Migration 008: Extension pour suivi des emails envoyés depuis Outlook
-- Created: 2025-01-09
-- Description: Ajoute le support des emails envoyés via webhooks Microsoft Graph
-- ====================================================================================================

SET search_path = 'public';

-- ====================================================================================================
-- TABLE: sent_messages (Messages envoyés via webhooks)
-- ====================================================================================================
CREATE TABLE sent_messages (
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
    sent_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Contraintes
    UNIQUE(graph_message_id)
);

-- Index pour détection automatique et performance
CREATE INDEX idx_sent_conversation ON sent_messages(conversation_id, sent_at DESC) WHERE conversation_id IS NOT NULL;
CREATE INDEX idx_sent_unprocessed ON sent_messages(processed_at) WHERE processed_at IS NULL;
CREATE INDEX idx_sent_graph_id ON sent_messages(graph_message_id);

-- ====================================================================================================
-- FUNCTION: Détection automatique des emails envoyés (AUTO-TRACKING)
-- ====================================================================================================
CREATE OR REPLACE FUNCTION detect_sent_emails()
RETURNS TRIGGER AS $$
DECLARE
    existing_tracked RECORD;
    new_tracked_id UUID;
BEGIN
    -- Ne traiter que les messages avec les données essentielles
    IF NEW.conversation_id IS NULL OR NEW.to_email IS NULL THEN
        -- Marquer comme traité même sans conversation_id
        NEW.processed_at = NOW();
        RETURN NEW;
    END IF;

    -- Marquer comme traité immédiatement
    NEW.processed_at = NOW();

    -- Vérifier s'il y a déjà un email tracké pour cette conversation
    SELECT id, message_id, subject INTO existing_tracked
    FROM tracked_emails 
    WHERE conversation_id = NEW.conversation_id 
    AND message_id = NEW.graph_message_id;

    -- Si l'email n'est pas déjà tracké, l'ajouter automatiquement
    IF NOT FOUND THEN
        INSERT INTO tracked_emails (
            message_id,
            internet_message_id,
            conversation_id,
            subject,
            recipient_email,
            sender_email,
            sent_at,
            status
        ) VALUES (
            NEW.graph_message_id,
            NEW.internet_message_id,
            NEW.conversation_id,
            NEW.subject,
            NEW.to_email,
            NEW.from_email,
            COALESCE(NEW.sent_at, NOW()),
            'PENDING'
        ) RETURNING id INTO new_tracked_id;

        -- Log de succès
        RAISE NOTICE 'Auto-tracked sent email % in conversation %', 
            new_tracked_id, NEW.conversation_id;
    ELSE
        -- Mettre à jour les informations si nécessaire
        UPDATE tracked_emails 
        SET 
            internet_message_id = COALESCE(NEW.internet_message_id, internet_message_id),
            subject = COALESCE(NEW.subject, subject),
            sender_email = COALESCE(NEW.from_email, sender_email),
            sent_at = COALESCE(NEW.sent_at, sent_at),
            updated_at = NOW()
        WHERE id = existing_tracked.id;

        RAISE NOTICE 'Updated existing tracked email % in conversation %', 
            existing_tracked.id, NEW.conversation_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger pour auto-tracking des emails envoyés
CREATE TRIGGER detect_sent_emails_on_message_sent
    BEFORE INSERT ON sent_messages
    FOR EACH ROW
    EXECUTE FUNCTION detect_sent_emails();

-- ====================================================================================================
-- FUNCTION: Enregistrer un message envoyé (pour Edge Functions)
-- ====================================================================================================
CREATE OR REPLACE FUNCTION log_sent_message(
    p_graph_message_id TEXT,
    p_internet_message_id TEXT DEFAULT NULL,
    p_conversation_id TEXT DEFAULT NULL,
    p_subject TEXT DEFAULT NULL,
    p_from_email TEXT DEFAULT NULL,
    p_to_email TEXT DEFAULT NULL,
    p_body_preview TEXT DEFAULT NULL,
    p_sent_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS UUID AS $$
DECLARE
    result_id UUID;
BEGIN
    INSERT INTO sent_messages (
        graph_message_id,
        internet_message_id,
        conversation_id,
        subject,
        from_email,
        to_email,
        body_preview,
        sent_at
    ) VALUES (
        p_graph_message_id,
        p_internet_message_id,
        p_conversation_id,
        p_subject,
        p_from_email,
        p_to_email,
        p_body_preview,
        p_sent_at
    )
    ON CONFLICT (graph_message_id) DO UPDATE SET
        internet_message_id = EXCLUDED.internet_message_id,
        conversation_id = EXCLUDED.conversation_id,
        subject = EXCLUDED.subject,
        from_email = EXCLUDED.from_email,
        to_email = EXCLUDED.to_email,
        body_preview = EXCLUDED.body_preview,
        sent_at = EXCLUDED.sent_at
    RETURNING id INTO result_id;

    RETURN result_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ====================================================================================================
-- UPDATES: Étendre les vues existantes pour inclure les emails envoyés
-- ====================================================================================================

-- Mise à jour de la vue email_stats pour inclure les métriques d'envoi
DROP VIEW IF EXISTS email_stats;
CREATE OR REPLACE VIEW email_stats AS
SELECT 
    -- Statistiques des emails trackés
    COUNT(*) as total_emails,
    COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_emails,
    COUNT(CASE WHEN status = 'REPLIED' THEN 1 END) as replied_emails,
    COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed_emails,
    COUNT(CASE WHEN status = 'EXPIRED' THEN 1 END) as expired_emails,
    COUNT(CASE WHEN conversation_id IS NOT NULL THEN 1 END) as emails_with_conversation_id,
    ROUND(AVG(EXTRACT(EPOCH FROM (reply_received_at - sent_at))/3600), 2) as avg_reply_time_hours,
    
    -- Nouvelles métriques d'envoi
    (SELECT COUNT(*) FROM sent_messages) as total_sent_messages,
    (SELECT COUNT(*) FROM received_messages) as total_received_messages,
    
    -- Métriques des dernières 24h
    COUNT(CASE WHEN sent_at > NOW() - INTERVAL '24 hours' THEN 1 END) as emails_sent_last_24h,
    COUNT(CASE WHEN status = 'REPLIED' AND reply_received_at > NOW() - INTERVAL '24 hours' THEN 1 END) as replies_received_last_24h
FROM tracked_emails;

-- ====================================================================================================
-- NOUVELLE VUE: Activité email récente (envoi + réception)
-- ====================================================================================================
CREATE OR REPLACE VIEW recent_email_activity AS
SELECT 
    'sent' as activity_type,
    graph_message_id as message_id,
    subject,
    from_email as email,
    to_email as other_email,
    sent_at as activity_at,
    conversation_id
FROM sent_messages
WHERE sent_at IS NOT NULL

UNION ALL

SELECT 
    'received' as activity_type,
    graph_message_id as message_id,
    subject,
    from_email as email,
    to_email as other_email,
    received_at as activity_at,
    conversation_id
FROM received_messages
WHERE received_at IS NOT NULL

ORDER BY activity_at DESC
LIMIT 100;

-- ====================================================================================================
-- MISE À JOUR: Permissions et sécurité
-- ====================================================================================================

-- Grant permissions pour le service role (Edge Functions)
GRANT ALL ON sent_messages TO service_role;
GRANT EXECUTE ON FUNCTION log_sent_message TO service_role;
GRANT EXECUTE ON FUNCTION detect_sent_emails TO service_role;

-- Grant permissions pour l'API authentifiée (lecture seule)
GRANT SELECT ON sent_messages TO authenticated;
GRANT SELECT ON recent_email_activity TO authenticated;
GRANT SELECT ON email_stats TO anon, authenticated;

-- ====================================================================================================
-- INDEXES supplémentaires pour performance
-- ====================================================================================================

-- Index composite pour requêtes de l'interface
CREATE INDEX idx_sent_messages_activity ON sent_messages(sent_at DESC, from_email);
CREATE INDEX idx_tracked_emails_recent ON tracked_emails(sent_at DESC) WHERE status = 'PENDING';

-- Index pour nettoyage automatique
CREATE INDEX idx_sent_messages_old ON sent_messages(created_at) WHERE processed_at IS NOT NULL;

-- ====================================================================================================
-- COMMENTS pour documentation
-- ====================================================================================================

COMMENT ON TABLE sent_messages IS 'Messages envoyés capturés via webhooks Microsoft Graph - auto-tracking';
COMMENT ON FUNCTION detect_sent_emails() IS 'Auto-tracking des emails envoyés - populate tracked_emails automatiquement';
COMMENT ON FUNCTION log_sent_message IS 'Fonction utilitaire pour Edge Functions - enregistrement messages envoyés';
COMMENT ON VIEW recent_email_activity IS 'Activité email récente - envoi et réception combinés';

-- ====================================================================================================
-- MIGRATION VALIDATION
-- ====================================================================================================

-- Vérifier que les tables existent
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'sent_messages') THEN
        RAISE EXCEPTION 'Migration failed: sent_messages table not created';
    END IF;
    
    IF NOT EXISTS (SELECT FROM information_schema.routines WHERE routine_name = 'log_sent_message') THEN
        RAISE EXCEPTION 'Migration failed: log_sent_message function not created';
    END IF;
    
    IF NOT EXISTS (SELECT FROM information_schema.routines WHERE routine_name = 'detect_sent_emails') THEN
        RAISE EXCEPTION 'Migration failed: detect_sent_emails function not created';
    END IF;
    
    RAISE NOTICE 'Migration 008 completed successfully - Sent emails tracking enabled';
END
$$;

-- ====================================================================================================
-- END OF MIGRATION 008
-- ====================================================================================================