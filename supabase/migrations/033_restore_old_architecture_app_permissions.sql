-- ====================================================================================================
-- RESTORE OLD ARCHITECTURE WITH APPLICATION PERMISSIONS
-- ====================================================================================================
-- Migration 033: Restaure l'ancienne architecture qui fonctionnait avec permissions application
-- Created: 2025-01-16
-- Description: Combines old working architecture with new application permissions approach
-- ====================================================================================================

SET search_path = 'public';

-- ====================================================================================================
-- 1. RESTORE TABLES: sent_messages ET received_messages
-- ====================================================================================================

-- Table des messages envoyés
CREATE TABLE IF NOT EXISTS sent_messages (
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

-- Table des messages reçus (manquante dans l'architecture v3.0)
CREATE TABLE IF NOT EXISTS received_messages (
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

-- Index pour sent_messages
CREATE INDEX IF NOT EXISTS idx_sent_conversation ON sent_messages(conversation_id, sent_at DESC) WHERE conversation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sent_unprocessed ON sent_messages(processed_at) WHERE processed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sent_graph_id ON sent_messages(graph_message_id);

-- Index pour received_messages
CREATE INDEX IF NOT EXISTS idx_received_conversation ON received_messages(conversation_id, received_at DESC) WHERE conversation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_received_unprocessed ON received_messages(processed_at) WHERE processed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_received_graph_id ON received_messages(graph_message_id);

-- ====================================================================================================
-- 2. RESTORE FUNCTION: Détection automatique des emails envoyés (AUTO-TRACKING)
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
DROP TRIGGER IF EXISTS detect_sent_emails_on_message_sent ON sent_messages;
CREATE TRIGGER detect_sent_emails_on_message_sent
    BEFORE INSERT ON sent_messages
    FOR EACH ROW
    EXECUTE FUNCTION detect_sent_emails();

-- ====================================================================================================
-- 2.5. RESTORE FUNCTION: Détection automatique des réponses (AUTO-REPLY DETECTION)
-- ====================================================================================================
CREATE OR REPLACE FUNCTION detect_email_replies()
RETURNS TRIGGER AS $$
DECLARE
    tracked_email RECORD;
    reply_count INTEGER;
BEGIN
    -- Ne traiter que les messages avec conversation_id
    IF NEW.conversation_id IS NULL THEN
        NEW.processed_at = NOW();
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
                reply_detection_method = 'conversation_id',
                updated_at = NOW()
            WHERE id = tracked_email.id;

            RAISE NOTICE 'Reply detected for tracked email % in conversation %',
                tracked_email.id, NEW.conversation_id;
        END IF;

    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger pour détection automatique des réponses
DROP TRIGGER IF EXISTS detect_email_replies_on_message_received ON received_messages;
CREATE TRIGGER detect_email_replies_on_message_received
    BEFORE INSERT ON received_messages
    FOR EACH ROW
    EXECUTE FUNCTION detect_email_replies();

-- ====================================================================================================
-- 3. RESTORE FUNCTION: Enregistrer un message envoyé (pour Edge Functions)
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
-- 4. RESTORE FUNCTIONS: log_received_message (pour compatibilité)
-- ====================================================================================================
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

-- ====================================================================================================
-- 5. UPDATE SUBSCRIPTION MANAGER: Support des subscriptions DUALES (inbox + sentitems)
-- ====================================================================================================

-- Ajouter colonnes pour supporter les subscriptions multiples si manquantes
ALTER TABLE graph_subscriptions
ADD COLUMN IF NOT EXISTS resource_type TEXT DEFAULT 'inbox';

-- Mettre à jour les subscriptions existantes
UPDATE graph_subscriptions
SET resource_type = CASE
    WHEN resource LIKE '%sentitems%' THEN 'sentitems'
    ELSE 'inbox'
END
WHERE resource_type = 'inbox';

-- Index pour les nouveaux champs
CREATE INDEX IF NOT EXISTS idx_graph_subscriptions_resource_type ON graph_subscriptions(resource_type, is_active);

-- ====================================================================================================
-- 6. EXTENDED tracked_emails: Nouvelles colonnes pour plus d'informations
-- ====================================================================================================

-- Ajouter colonnes manquantes pour compatibilité complète
ALTER TABLE tracked_emails
ADD COLUMN IF NOT EXISTS graph_message_id TEXT,
ADD COLUMN IF NOT EXISTS last_checked TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS reply_sender_email TEXT,
ADD COLUMN IF NOT EXISTS reply_subject TEXT,
ADD COLUMN IF NOT EXISTS reply_graph_message_id TEXT;

-- Index pour les nouvelles colonnes
CREATE INDEX IF NOT EXISTS idx_tracked_emails_graph_id ON tracked_emails(graph_message_id) WHERE graph_message_id IS NOT NULL;

-- ====================================================================================================
-- 7. VIEWS: Mise à jour pour inclure les nouvelles métriques
-- ====================================================================================================

-- Vue mise à jour avec toutes les tables
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

    -- Métriques d'envoi et réception
    (SELECT COUNT(*) FROM sent_messages) as total_sent_messages,
    (SELECT COUNT(*) FROM received_messages) as total_received_messages,

    -- Métriques des dernières 24h
    COUNT(CASE WHEN sent_at > NOW() - INTERVAL '24 hours' THEN 1 END) as emails_sent_last_24h,
    COUNT(CASE WHEN status = 'REPLIED' AND reply_received_at > NOW() - INTERVAL '24 hours' THEN 1 END) as replies_received_last_24h
FROM tracked_emails;

-- Vue activité récente (envoi + réception)
DROP VIEW IF EXISTS recent_email_activity;
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
-- 8. PERMISSIONS: Grant pour toutes les nouvelles fonctions
-- ====================================================================================================

-- Grant permissions pour le service role (Edge Functions)
GRANT ALL ON sent_messages TO service_role;
GRANT ALL ON received_messages TO service_role;
GRANT EXECUTE ON FUNCTION log_sent_message TO service_role;
GRANT EXECUTE ON FUNCTION log_received_message TO service_role;
GRANT EXECUTE ON FUNCTION detect_sent_emails TO service_role;
GRANT EXECUTE ON FUNCTION detect_email_replies TO service_role;

-- Grant permissions pour l'API authentifiée (lecture seule)
GRANT SELECT ON sent_messages TO authenticated;
GRANT SELECT ON received_messages TO authenticated;
GRANT SELECT ON recent_email_activity TO authenticated;
GRANT SELECT ON email_stats TO anon, authenticated;

-- ====================================================================================================
-- 9. COMMENTS: Documentation
-- ====================================================================================================

COMMENT ON TABLE sent_messages IS 'Messages envoyés capturés via webhooks Microsoft Graph - auto-tracking restauré';
COMMENT ON TABLE received_messages IS 'Messages reçus capturés via webhooks Microsoft Graph - auto-détection des réponses';
COMMENT ON FUNCTION detect_sent_emails() IS 'Auto-tracking des emails envoyés - populate tracked_emails automatiquement';
COMMENT ON FUNCTION detect_email_replies() IS 'Auto-détection des réponses - met à jour tracked_emails vers REPLIED automatiquement';
COMMENT ON FUNCTION log_sent_message IS 'Fonction utilitaire pour Edge Functions - enregistrement messages envoyés';
COMMENT ON FUNCTION log_received_message IS 'Fonction utilitaire pour Edge Functions - enregistrement messages reçus';
COMMENT ON VIEW recent_email_activity IS 'Activité email récente - envoi et réception combinés';

-- ====================================================================================================
-- 10. MIGRATION VALIDATION
-- ====================================================================================================

DO $$
BEGIN
    -- Vérifier que toutes les tables sont en place
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'sent_messages') THEN
        RAISE EXCEPTION 'Migration failed: sent_messages table not created';
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'received_messages') THEN
        RAISE EXCEPTION 'Migration failed: received_messages table not created';
    END IF;

    -- Vérifier que toutes les fonctions sont en place
    IF NOT EXISTS (SELECT FROM information_schema.routines WHERE routine_name = 'log_sent_message') THEN
        RAISE EXCEPTION 'Migration failed: log_sent_message function not created';
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.routines WHERE routine_name = 'log_received_message') THEN
        RAISE EXCEPTION 'Migration failed: log_received_message function not created';
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.routines WHERE routine_name = 'detect_sent_emails') THEN
        RAISE EXCEPTION 'Migration failed: detect_sent_emails function not created';
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.routines WHERE routine_name = 'detect_email_replies') THEN
        RAISE EXCEPTION 'Migration failed: detect_email_replies function not created';
    END IF;

    -- Vérifier que toutes les vues sont en place
    IF NOT EXISTS (SELECT FROM information_schema.views WHERE table_name = 'email_stats') THEN
        RAISE EXCEPTION 'Migration failed: email_stats view not created';
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.views WHERE table_name = 'recent_email_activity') THEN
        RAISE EXCEPTION 'Migration failed: recent_email_activity view not created';
    END IF;

    RAISE NOTICE 'Migration 033 completed successfully - Complete old architecture restored with application permissions';
    RAISE NOTICE 'Features restored: sent_messages + received_messages tables, auto-tracking triggers, dual subscriptions support';
END
$$;

-- ====================================================================================================
-- END OF MIGRATION 033
-- ====================================================================================================