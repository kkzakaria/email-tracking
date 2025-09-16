-- ====================================================================================================
-- CREATE BACKUP TABLES BEFORE CLEANUP
-- ====================================================================================================
-- Migration 035: Créer des sauvegardes avant nettoyage des données
-- Created: 2025-09-16
-- Description: Sauvegarde de sécurité avant nettoyage et resynchronisation
-- ====================================================================================================

SET search_path = 'public';

-- ====================================================================================================
-- 1. CRÉER LES TABLES DE SAUVEGARDE
-- ====================================================================================================

-- Sauvegarde de tracked_emails (681 entrées)
DROP TABLE IF EXISTS tracked_emails_backup;
CREATE TABLE tracked_emails_backup AS
SELECT * FROM tracked_emails;

-- Sauvegarde de sent_messages (5 entrées)
DROP TABLE IF EXISTS sent_messages_backup;
CREATE TABLE sent_messages_backup AS
SELECT * FROM sent_messages;

-- Sauvegarde de received_messages (5 entrées)
DROP TABLE IF EXISTS received_messages_backup;
CREATE TABLE received_messages_backup AS
SELECT * FROM received_messages;

-- ====================================================================================================
-- 2. AJOUTER METADATA DE SAUVEGARDE
-- ====================================================================================================

-- Ajouter des colonnes de métadonnées aux sauvegardes
ALTER TABLE tracked_emails_backup ADD COLUMN backup_created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE sent_messages_backup ADD COLUMN backup_created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE received_messages_backup ADD COLUMN backup_created_at TIMESTAMPTZ DEFAULT NOW();

-- ====================================================================================================
-- 3. PERMISSIONS POUR LES SAUVEGARDES
-- ====================================================================================================

-- Grant permissions pour consultation des sauvegardes
GRANT SELECT ON tracked_emails_backup TO authenticated, service_role;
GRANT SELECT ON sent_messages_backup TO authenticated, service_role;
GRANT SELECT ON received_messages_backup TO authenticated, service_role;

-- ====================================================================================================
-- 4. COMMENTS ET DOCUMENTATION
-- ====================================================================================================

COMMENT ON TABLE tracked_emails_backup IS 'Sauvegarde de tracked_emails avant nettoyage du 2025-09-16 - 681 entrées';
COMMENT ON TABLE sent_messages_backup IS 'Sauvegarde de sent_messages avant nettoyage du 2025-09-16 - 5 entrées';
COMMENT ON TABLE received_messages_backup IS 'Sauvegarde de received_messages avant nettoyage du 2025-09-16 - 5 entrées';

-- ====================================================================================================
-- 5. VALIDATION DES SAUVEGARDES
-- ====================================================================================================

DO $$
DECLARE
    tracked_backup_count INTEGER;
    sent_backup_count INTEGER;
    received_backup_count INTEGER;
    tracked_original_count INTEGER;
    sent_original_count INTEGER;
    received_original_count INTEGER;
BEGIN
    -- Compter les entrées sauvegardées
    SELECT COUNT(*) INTO tracked_backup_count FROM tracked_emails_backup;
    SELECT COUNT(*) INTO sent_backup_count FROM sent_messages_backup;
    SELECT COUNT(*) INTO received_backup_count FROM received_messages_backup;

    -- Compter les entrées originales
    SELECT COUNT(*) INTO tracked_original_count FROM tracked_emails;
    SELECT COUNT(*) INTO sent_original_count FROM sent_messages;
    SELECT COUNT(*) INTO received_original_count FROM received_messages;

    -- Validation des sauvegardes
    IF tracked_backup_count != tracked_original_count THEN
        RAISE EXCEPTION 'Erreur sauvegarde tracked_emails: % backup vs % original',
            tracked_backup_count, tracked_original_count;
    END IF;

    IF sent_backup_count != sent_original_count THEN
        RAISE EXCEPTION 'Erreur sauvegarde sent_messages: % backup vs % original',
            sent_backup_count, sent_original_count;
    END IF;

    IF received_backup_count != received_original_count THEN
        RAISE EXCEPTION 'Erreur sauvegarde received_messages: % backup vs % original',
            received_backup_count, received_original_count;
    END IF;

    RAISE NOTICE 'Migration 035 completed successfully - Sauvegardes créées:';
    RAISE NOTICE '  - tracked_emails_backup: % entrées', tracked_backup_count;
    RAISE NOTICE '  - sent_messages_backup: % entrées', sent_backup_count;
    RAISE NOTICE '  - received_messages_backup: % entrées', received_backup_count;
    RAISE NOTICE 'Toutes les sauvegardes correspondent aux tables originales';
END
$$;

-- ====================================================================================================
-- END OF MIGRATION 035
-- ====================================================================================================