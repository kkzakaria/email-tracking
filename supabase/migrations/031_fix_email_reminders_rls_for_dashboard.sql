-- ====================================================================================================
-- FIX EMAIL REMINDERS RLS - PERMETTRE LECTURE AU DASHBOARD
-- ====================================================================================================
-- Migration 031: Permettre aux utilisateurs authentifiés de lire toutes les relances
-- Created: 2025-09-16
-- Description: Corriger les politiques RLS pour permettre au dashboard de récupérer les relances
-- ====================================================================================================

-- Supprimer les anciennes politiques
DROP POLICY IF EXISTS "users_own_reminders" ON email_reminders;
DROP POLICY IF EXISTS "service_role_all_reminders" ON email_reminders;

-- ====================================================================================================
-- NOUVELLES POLITIQUES RLS
-- ====================================================================================================

-- Politique : Les utilisateurs authentifiés peuvent LIRE toutes les relances (pour le dashboard)
CREATE POLICY "authenticated_can_read_all_reminders" ON email_reminders
    FOR SELECT
    TO authenticated
    USING (true);

-- Politique : Les utilisateurs peuvent INSÉRER leurs propres relances
CREATE POLICY "users_can_insert_own_reminders" ON email_reminders
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

-- Politique : Les utilisateurs peuvent MODIFIER leurs propres relances
CREATE POLICY "users_can_update_own_reminders" ON email_reminders
    FOR UPDATE
    TO authenticated
    USING (user_id IS NULL OR auth.uid() = user_id)
    WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

-- Politique : Les utilisateurs peuvent SUPPRIMER leurs propres relances
CREATE POLICY "users_can_delete_own_reminders" ON email_reminders
    FOR DELETE
    TO authenticated
    USING (user_id IS NULL OR auth.uid() = user_id);

-- Politique pour service_role (Edge Functions) - accès complet
CREATE POLICY "service_role_full_access_reminders" ON email_reminders
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ====================================================================================================
-- COMMENTAIRES
-- ====================================================================================================

COMMENT ON POLICY "authenticated_can_read_all_reminders" ON email_reminders
IS 'Permet aux utilisateurs authentifiés de lire toutes les relances pour affichage dans le dashboard';

COMMENT ON POLICY "users_can_insert_own_reminders" ON email_reminders
IS 'Les utilisateurs peuvent insérer leurs propres relances';

COMMENT ON POLICY "users_can_update_own_reminders" ON email_reminders
IS 'Les utilisateurs peuvent modifier leurs propres relances';

COMMENT ON POLICY "users_can_delete_own_reminders" ON email_reminders
IS 'Les utilisateurs peuvent supprimer leurs propres relances';

COMMENT ON POLICY "service_role_full_access_reminders" ON email_reminders
IS 'Service role a accès complet pour les Edge Functions';

-- ====================================================================================================
-- VÉRIFICATIONS FINALES
-- ====================================================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Migration 031 appliquée avec succès';
    RAISE NOTICE '📖 Utilisateurs authentifiés peuvent LIRE toutes les relances';
    RAISE NOTICE '✏️ Utilisateurs peuvent MODIFIER leurs propres relances';
    RAISE NOTICE '🔧 Service role a accès complet';
    RAISE NOTICE '📊 Le dashboard peut maintenant enrichir les emails avec les relances';
END $$;