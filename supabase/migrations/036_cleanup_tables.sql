-- ====================================================================================================
-- CLEANUP TABLES FOR FRESH SYNC
-- ====================================================================================================
-- Migration 036: Nettoyage des tables avant resynchronisation propre
-- Created: 2025-09-16
-- Description: Vider les tables de tracking pour une synchronisation propre des 7 derniers jours
-- ====================================================================================================

SET search_path = 'public';

-- ====================================================================================================
-- 1. NETTOYAGE DES TABLES DE TRACKING
-- ====================================================================================================

-- Vider la table principale des emails trackés
DELETE FROM tracked_emails;

-- Vider les tables de l'architecture hybride
DELETE FROM sent_messages;
DELETE FROM received_messages;

-- Optionnel: Nettoyer aussi les événements de webhook (logs)
DELETE FROM webhook_events WHERE created_at < NOW() - INTERVAL '7 days';

-- ====================================================================================================
-- 2. RESET DES SÉQUENCES (si applicable)
-- ====================================================================================================

-- Note: Les UUID n'utilisent pas de séquences, mais on peut nettoyer d'autres éléments

-- ====================================================================================================
-- 3. VALIDATION DU NETTOYAGE
-- ====================================================================================================

DO $$
DECLARE
    tracked_count INTEGER;
    sent_count INTEGER;
    received_count INTEGER;
    webhook_old_count INTEGER;
BEGIN
    -- Vérifier que les tables sont vides
    SELECT COUNT(*) INTO tracked_count FROM tracked_emails;
    SELECT COUNT(*) INTO sent_count FROM sent_messages;
    SELECT COUNT(*) INTO received_count FROM received_messages;
    SELECT COUNT(*) INTO webhook_old_count FROM webhook_events WHERE created_at < NOW() - INTERVAL '7 days';

    -- Validation
    IF tracked_count != 0 THEN
        RAISE EXCEPTION 'Erreur nettoyage: tracked_emails contient encore % entrées', tracked_count;
    END IF;

    IF sent_count != 0 THEN
        RAISE EXCEPTION 'Erreur nettoyage: sent_messages contient encore % entrées', sent_count;
    END IF;

    IF received_count != 0 THEN
        RAISE EXCEPTION 'Erreur nettoyage: received_messages contient encore % entrées', received_count;
    END IF;

    RAISE NOTICE 'Migration 036 completed successfully - Nettoyage terminé:';
    RAISE NOTICE '  - tracked_emails: % entrées (vidé)', tracked_count;
    RAISE NOTICE '  - sent_messages: % entrées (vidé)', sent_count;
    RAISE NOTICE '  - received_messages: % entrées (vidé)', received_count;
    RAISE NOTICE '  - webhook_events anciens: % supprimés', webhook_old_count;
    RAISE NOTICE 'Tables prêtes pour la resynchronisation des 7 derniers jours';
END
$$;

-- ====================================================================================================
-- 4. VÉRIFICATION DES SAUVEGARDES
-- ====================================================================================================

DO $$
DECLARE
    backup_tracked_count INTEGER;
    backup_sent_count INTEGER;
    backup_received_count INTEGER;
BEGIN
    -- Vérifier que les sauvegardes existent toujours
    SELECT COUNT(*) INTO backup_tracked_count FROM tracked_emails_backup;
    SELECT COUNT(*) INTO backup_sent_count FROM sent_messages_backup;
    SELECT COUNT(*) INTO backup_received_count FROM received_messages_backup;

    RAISE NOTICE 'Sauvegardes conservées:';
    RAISE NOTICE '  - tracked_emails_backup: % entrées', backup_tracked_count;
    RAISE NOTICE '  - sent_messages_backup: % entrées', backup_sent_count;
    RAISE NOTICE '  - received_messages_backup: % entrées', backup_received_count;
END
$$;

-- ====================================================================================================
-- END OF MIGRATION 036
-- ====================================================================================================