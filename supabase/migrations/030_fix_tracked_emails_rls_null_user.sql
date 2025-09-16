-- ====================================================================================================
-- FIX TRACKED EMAILS RLS - PERMETTRE AFFICHAGE DES EMAILS SANS USER_ID
-- ====================================================================================================
-- Migration 030: Permettre aux utilisateurs authentifiés de voir tous les emails trackés
-- Created: 2025-09-16
-- Description: Corriger les politiques RLS pour afficher les emails avec user_id = null
-- ====================================================================================================

-- Supprimer la politique restrictive actuelle
DROP POLICY IF EXISTS "users_own_emails" ON tracked_emails;

-- Créer une politique plus permissive pour le dashboard
CREATE POLICY "authenticated_can_view_all_tracked_emails" ON tracked_emails
    FOR SELECT
    TO authenticated
    USING (true);

-- Politique pour les insertions/modifications (plus restrictive)
CREATE POLICY "service_role_can_modify_tracked_emails" ON tracked_emails
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Politique pour les webhooks et système automatique
CREATE POLICY "anon_can_insert_tracked_emails" ON tracked_emails
    FOR INSERT
    TO anon
    WITH CHECK (true);

COMMENT ON POLICY "authenticated_can_view_all_tracked_emails" ON tracked_emails
IS 'Permet aux utilisateurs authentifiés de voir tous les emails trackés pour le dashboard';

COMMENT ON POLICY "service_role_can_modify_tracked_emails" ON tracked_emails
IS 'Service role a accès complet pour l''automatisation';

COMMENT ON POLICY "anon_can_insert_tracked_emails" ON tracked_emails
IS 'Permet aux webhooks d''insérer des emails trackés';

-- ====================================================================================================
-- VÉRIFICATIONS FINALES
-- ====================================================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Migration 030 appliquée avec succès';
    RAISE NOTICE '👥 Utilisateurs authentifiés peuvent voir tous les emails trackés';
    RAISE NOTICE '🔧 Service role a accès complet';
    RAISE NOTICE '📧 Webhooks peuvent insérer des emails';
    RAISE NOTICE '📊 Dashboard doit maintenant afficher tous les emails';
END $$;