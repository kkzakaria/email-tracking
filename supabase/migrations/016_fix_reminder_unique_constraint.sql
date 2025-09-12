-- ====================================================================================================
-- MIGRATION 016: Fix contrainte unique pour ON CONFLICT dans test_email_reminders
-- ====================================================================================================
-- Description: Ajoute la contrainte unique manquante sur tracked_email_id
-- Date: 2025-01-12
-- Bug fix: "there is no unique or exclusion constraint matching the ON CONFLICT specification"
-- ====================================================================================================

SET search_path = 'public';

-- Ajouter la contrainte unique manquante sur tracked_email_id
-- pour que ON CONFLICT fonctionne dans schedule_test_reminder()
ALTER TABLE test_email_reminders 
ADD CONSTRAINT unique_test_email_reminders_tracked_email 
UNIQUE (tracked_email_id);

-- Vérifier que la contrainte a été créée
DO $$
BEGIN
    -- Test de validation de la contrainte
    RAISE NOTICE 'Migration 016: Contrainte unique ajoutée sur test_email_reminders.tracked_email_id';
    
    -- Vérifier l'existence de la contrainte
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'unique_test_email_reminders_tracked_email'
        AND table_name = 'test_email_reminders'
    ) THEN
        RAISE NOTICE 'Migration 016: ✅ Contrainte unique confirmée';
    ELSE
        RAISE EXCEPTION 'Migration 016: ❌ Contrainte unique manquante';
    END IF;
END
$$;