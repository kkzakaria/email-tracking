-- ====================================================================================================
-- MIGRATION 018: Correction des délais de relance - 4h au lieu de 48h/72h
-- ====================================================================================================
-- Description: Corrige les délais pour avoir des relances toutes les 4h pendant heures ouvrables
-- Date: 2025-01-12
-- Logique: Email 10h → relance 14h → relance 18h → relance 8h lendemain → relance 12h
-- ====================================================================================================

SET search_path = 'public';

-- Mettre à jour les valeurs par défaut de la table test_reminder_settings
-- pour avoir des relances toutes les 4h au lieu de 48h/72h
ALTER TABLE test_reminder_settings 
ALTER COLUMN default_delay_hours SET DEFAULT 4;

ALTER TABLE test_reminder_settings 
ALTER COLUMN reminder_interval_hours SET DEFAULT 4;

-- Mettre à jour les enregistrements existants si ils utilisent les anciennes valeurs
UPDATE test_reminder_settings 
SET 
    default_delay_hours = 4,
    reminder_interval_hours = 4,
    updated_at = NOW()
WHERE 
    default_delay_hours = 48 OR 
    reminder_interval_hours = 72;

-- Validation et logs
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    -- Compter les enregistrements mis à jour
    SELECT COUNT(*) INTO updated_count
    FROM test_reminder_settings 
    WHERE default_delay_hours = 4 AND reminder_interval_hours = 4;
    
    RAISE NOTICE 'Migration 018: ✅ Délais corrigés vers 4h pour % enregistrement(s)', updated_count;
    RAISE NOTICE 'Migration 018: ✅ Logique: Email 10h → 14h → 18h → 8h lendemain → 12h';
    
    -- Vérifier la configuration
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'test_reminder_settings' 
        AND column_name = 'default_delay_hours'
        AND column_default = '4'
    ) THEN
        RAISE NOTICE 'Migration 018: ✅ default_delay_hours = 4h confirmé';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'test_reminder_settings' 
        AND column_name = 'reminder_interval_hours'
        AND column_default = '4'
    ) THEN
        RAISE NOTICE 'Migration 018: ✅ reminder_interval_hours = 4h confirmé';
    END IF;
END
$$;