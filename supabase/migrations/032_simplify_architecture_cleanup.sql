-- ====================================================================================================
-- SIMPLIFICATION DE L'ARCHITECTURE - NETTOYAGE COMPLET
-- ====================================================================================================
-- Migration 032: Suppression des triggers, tables intermédiaires et données obsolètes
-- Created: 2025-01-16
-- Description: Simplification vers une architecture directe avec permissions application
-- ====================================================================================================

-- ====================================================================================================
-- ÉTAPE 1: NETTOYAGE DES DONNÉES OBSOLÈTES
-- ====================================================================================================

-- Nettoyer les webhook_events non traités (plus de 30 jours)
DELETE FROM webhook_events
WHERE processed = false
AND created_at < NOW() - INTERVAL '30 days';

-- Nettoyer les emails trackés expirés ou échoués de plus de 90 jours
DELETE FROM tracked_emails
WHERE status IN ('EXPIRED', 'FAILED')
AND created_at < NOW() - INTERVAL '90 days';

-- Compter les données avant suppression des tables
DO $$
DECLARE
    sent_count INTEGER;
    received_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO sent_count FROM sent_messages;
    SELECT COUNT(*) INTO received_count FROM received_messages;

    RAISE NOTICE '📊 Données à nettoyer:';
    RAISE NOTICE '  - sent_messages: % entrées', sent_count;
    RAISE NOTICE '  - received_messages: % entrées', received_count;
END $$;

-- ====================================================================================================
-- ÉTAPE 2: SUPPRESSION DES TRIGGERS
-- ====================================================================================================

-- Supprimer tous les triggers liés au tracking automatique
DROP TRIGGER IF EXISTS detect_sent_emails_on_message_sent ON sent_messages;
DROP TRIGGER IF EXISTS detect_replies_on_message_received ON received_messages;
DROP TRIGGER IF EXISTS auto_update_tracked_status ON tracked_emails;
DROP TRIGGER IF EXISTS update_tracked_emails_updated_at ON tracked_emails;

DO $$ BEGIN RAISE NOTICE '✅ Triggers supprimés'; END $$;

-- ====================================================================================================
-- ÉTAPE 3: SUPPRESSION DES FONCTIONS
-- ====================================================================================================

-- Supprimer toutes les fonctions liées à l'ancienne architecture
DROP FUNCTION IF EXISTS detect_sent_emails() CASCADE;
DROP FUNCTION IF EXISTS detect_email_replies() CASCADE;
DROP FUNCTION IF EXISTS log_sent_message(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) CASCADE;
DROP FUNCTION IF EXISTS log_received_message(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) CASCADE;
DROP FUNCTION IF EXISTS update_tracking_status() CASCADE;
DROP FUNCTION IF EXISTS check_reply_by_conversation() CASCADE;
DROP FUNCTION IF EXISTS check_reply_by_subject() CASCADE;

DO $$ BEGIN RAISE NOTICE '✅ Fonctions obsolètes supprimées'; END $$;

-- ====================================================================================================
-- ÉTAPE 4: ARCHIVAGE DES DONNÉES IMPORTANTES (OPTIONNEL)
-- ====================================================================================================

-- Créer une table d'archive temporaire pour les données importantes
CREATE TEMP TABLE archived_messages AS
SELECT
    'sent' as message_type,
    graph_message_id,
    internet_message_id,
    conversation_id,
    subject,
    from_email,
    to_email,
    sent_at,
    created_at
FROM sent_messages
WHERE sent_at > NOW() - INTERVAL '7 days'

UNION ALL

SELECT
    'received' as message_type,
    graph_message_id,
    internet_message_id,
    conversation_id,
    subject,
    from_email,
    to_email,
    received_at as sent_at,
    created_at
FROM received_messages
WHERE received_at > NOW() - INTERVAL '7 days';

-- Compter les messages archivés
DO $$
DECLARE
    archived_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO archived_count FROM archived_messages;
    RAISE NOTICE '💾 Messages récents archivés temporairement: %', archived_count;
END $$;

-- ====================================================================================================
-- ÉTAPE 5: SUPPRESSION DES TABLES INTERMÉDIAIRES
-- ====================================================================================================

-- Supprimer les tables intermédiaires
DROP TABLE IF EXISTS sent_messages CASCADE;
DROP TABLE IF EXISTS received_messages CASCADE;

DO $$ BEGIN RAISE NOTICE '✅ Tables intermédiaires supprimées'; END $$;

-- ====================================================================================================
-- ÉTAPE 6: NETTOYAGE DES COLONNES INUTILISÉES
-- ====================================================================================================

-- Supprimer les colonnes obsolètes de tracked_emails si elles existent
ALTER TABLE tracked_emails
DROP COLUMN IF EXISTS processed_by_trigger,
DROP COLUMN IF EXISTS trigger_log,
DROP COLUMN IF EXISTS legacy_user_id;

-- ====================================================================================================
-- ÉTAPE 7: OPTIMISATION DE LA TABLE tracked_emails
-- ====================================================================================================

-- Ajouter les colonnes manquantes pour la nouvelle architecture
ALTER TABLE tracked_emails
ADD COLUMN IF NOT EXISTS graph_message_id TEXT,
ADD COLUMN IF NOT EXISTS last_checked TIMESTAMPTZ DEFAULT NOW();

-- Créer un index unique sur graph_message_id s'il n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'idx_tracked_emails_graph_message_id'
    ) THEN
        CREATE UNIQUE INDEX idx_tracked_emails_graph_message_id
        ON tracked_emails(graph_message_id)
        WHERE graph_message_id IS NOT NULL;
    END IF;
END $$;

-- Mettre à jour les indexes pour les performances
DROP INDEX IF EXISTS idx_tracked_emails_user_id;
DROP INDEX IF EXISTS idx_tracked_emails_processed;

-- Créer de nouveaux indexes optimisés
CREATE INDEX IF NOT EXISTS idx_tracked_emails_pending
ON tracked_emails(status, sent_at DESC)
WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_tracked_emails_conversation_status
ON tracked_emails(conversation_id, status)
WHERE conversation_id IS NOT NULL;

-- ====================================================================================================
-- ÉTAPE 8: NETTOYAGE DES VUES OBSOLÈTES
-- ====================================================================================================

-- Supprimer les vues qui dépendent des tables supprimées
DROP VIEW IF EXISTS email_activity_summary CASCADE;
DROP VIEW IF EXISTS recent_email_activity CASCADE;
DROP VIEW IF EXISTS sent_messages_summary CASCADE;
DROP VIEW IF EXISTS received_messages_summary CASCADE;
DROP VIEW IF EXISTS email_stats CASCADE;

-- Recréer une vue simplifiée pour les statistiques
CREATE VIEW email_stats AS
SELECT
    COUNT(*) as total_emails,
    COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_emails,
    COUNT(CASE WHEN status = 'REPLIED' THEN 1 END) as replied_emails,
    COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed_emails,
    COUNT(CASE WHEN status = 'EXPIRED' THEN 1 END) as expired_emails,
    COUNT(CASE WHEN conversation_id IS NOT NULL THEN 1 END) as emails_with_conversation,
    ROUND(AVG(
        CASE
            WHEN status = 'REPLIED' AND reply_received_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (reply_received_at - sent_at))/3600
        END
    ), 2) as avg_reply_time_hours,
    COUNT(CASE WHEN sent_at > NOW() - INTERVAL '24 hours' THEN 1 END) as emails_last_24h,
    COUNT(CASE WHEN sent_at > NOW() - INTERVAL '7 days' THEN 1 END) as emails_last_7_days
FROM tracked_emails;

-- ====================================================================================================
-- ÉTAPE 9: NETTOYAGE DES PERMISSIONS ET RLS
-- ====================================================================================================

-- Révoquer les permissions sur les tables supprimées (automatique avec CASCADE)
-- Ajuster les politiques RLS pour la nouvelle architecture

-- Supprimer les anciennes politiques
DROP POLICY IF EXISTS "sent_messages_service_role" ON tracked_emails;
DROP POLICY IF EXISTS "received_messages_service_role" ON tracked_emails;

-- Créer des politiques simplifiées
DO $$
BEGIN
    -- Politique pour service_role (Edge Functions)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'tracked_emails'
        AND policyname = 'service_role_all_access'
    ) THEN
        CREATE POLICY "service_role_all_access" ON tracked_emails
        FOR ALL TO service_role
        USING (true)
        WITH CHECK (true);
    END IF;

    -- Politique pour authenticated users (lecture seule)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'tracked_emails'
        AND policyname = 'authenticated_read_access'
    ) THEN
        CREATE POLICY "authenticated_read_access" ON tracked_emails
        FOR SELECT TO authenticated
        USING (true);
    END IF;
END $$;

-- ====================================================================================================
-- ÉTAPE 10: VALIDATION ET RAPPORT FINAL
-- ====================================================================================================

DO $$
DECLARE
    tracked_count INTEGER;
    webhook_count INTEGER;
    stats_count INTEGER;
BEGIN
    -- Compter les données restantes
    SELECT COUNT(*) INTO tracked_count FROM tracked_emails;
    SELECT COUNT(*) INTO webhook_count FROM webhook_events;
    SELECT COUNT(*) INTO stats_count FROM email_stats;

    RAISE NOTICE '';
    RAISE NOTICE '===========================================';
    RAISE NOTICE '✅ MIGRATION 032 COMPLÉTÉE AVEC SUCCÈS';
    RAISE NOTICE '===========================================';
    RAISE NOTICE '';
    RAISE NOTICE '📊 État final de la base de données:';
    RAISE NOTICE '  - tracked_emails: % entrées', tracked_count;
    RAISE NOTICE '  - webhook_events: % entrées', webhook_count;
    RAISE NOTICE '  - Vue email_stats: active';
    RAISE NOTICE '';
    RAISE NOTICE '🗑️ Éléments supprimés:';
    RAISE NOTICE '  - Tables: sent_messages, received_messages';
    RAISE NOTICE '  - Triggers: detect_sent_emails, detect_replies';
    RAISE NOTICE '  - Fonctions: log_sent_message, detect_sent_emails, etc.';
    RAISE NOTICE '  - Vues obsolètes: recent_email_activity, etc.';
    RAISE NOTICE '';
    RAISE NOTICE '✨ Architecture simplifiée activée';
    RAISE NOTICE '  - Flux direct: Webhook → webhook-handler → tracked_emails';
    RAISE NOTICE '  - Permissions application Microsoft Graph';
    RAISE NOTICE '  - Une seule table de tracking';
    RAISE NOTICE '';

    -- Vérifier qu'il n'y a plus de tables intermédiaires
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name IN ('sent_messages', 'received_messages')) THEN
        RAISE EXCEPTION 'ERREUR: Tables intermédiaires non supprimées';
    END IF;

    -- Vérifier qu'il n'y a plus de triggers obsolètes
    IF EXISTS (SELECT FROM pg_trigger WHERE tgname LIKE '%detect_sent%' OR tgname LIKE '%detect_replies%') THEN
        RAISE EXCEPTION 'ERREUR: Triggers obsolètes non supprimés';
    END IF;

    RAISE NOTICE '✅ Validation réussie - Architecture simplifiée opérationnelle';
END $$;

-- ====================================================================================================
-- FIN DE LA MIGRATION 032
-- ====================================================================================================