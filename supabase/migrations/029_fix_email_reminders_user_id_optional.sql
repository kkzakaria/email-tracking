-- ====================================================================================================
-- FIX EMAIL REMINDERS - USER_ID OPTIONNEL
-- ====================================================================================================
-- Migration 029: Rendre user_id optionnel dans email_reminders
-- Created: 2025-09-16
-- Description: Le tracked_email_id suffit pour les relances, user_id devient optionnel
-- ====================================================================================================

-- Rendre user_id nullable
ALTER TABLE email_reminders ALTER COLUMN user_id DROP NOT NULL;

-- Supprimer la contrainte de clé étrangère stricte sur user_id
ALTER TABLE email_reminders DROP CONSTRAINT IF EXISTS email_reminders_user_id_fkey;

-- Ajouter une contrainte de clé étrangère optionnelle
ALTER TABLE email_reminders ADD CONSTRAINT email_reminders_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Modifier les politiques RLS pour gérer les cas où user_id est null
DROP POLICY IF EXISTS "users_own_reminders" ON email_reminders;

-- Politique mise à jour : gérer user_id optionnel
CREATE POLICY "users_own_reminders" ON email_reminders
    FOR ALL
    TO authenticated
    USING (
        user_id IS NULL OR auth.uid() = user_id
    )
    WITH CHECK (
        user_id IS NULL OR auth.uid() = user_id
    );

-- Politique pour service_role reste inchangée
-- (service_role a déjà accès complet)

COMMENT ON COLUMN email_reminders.user_id IS 'ID utilisateur optionnel - les relances fonctionnent avec tracked_email_id seulement';

-- ====================================================================================================
-- VÉRIFICATIONS FINALES
-- ====================================================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Migration 029 appliquée avec succès';
    RAISE NOTICE '📧 user_id maintenant optionnel dans email_reminders';
    RAISE NOTICE '🔗 Contrainte FK mise à jour pour SET NULL';
    RAISE NOTICE '🛡️ Politiques RLS adaptées';
END $$;