-- ====================================================================================================
-- EMAIL TRACKING SYSTEM - RLS POLICIES
-- ====================================================================================================
-- Migration 002: Activation des politiques RLS pour les utilisateurs authentifiés
-- Created: 2025-01-08
-- Description: Politiques de sécurité au niveau des lignes pour l'accès authentifié
-- ====================================================================================================

-- Note: RLS déjà activé via Dashboard Supabase
-- ALTER TABLE tracked_emails ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE graph_subscriptions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE received_messages ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- ====================================================================================================
-- POLITIQUES POUR tracked_emails
-- ====================================================================================================

-- Lecture : Tous les utilisateurs authentifiés peuvent voir tous les emails trackés
CREATE POLICY "tracked_emails_select_policy" ON tracked_emails
    FOR SELECT
    TO authenticated
    USING (true);

-- Insertion : Les Edge Functions (service_role) peuvent insérer
-- Note: Les utilisateurs authentifiés ne peuvent pas insérer directement
-- car l'envoi se fait via Edge Functions

-- ====================================================================================================
-- POLITIQUES POUR graph_subscriptions
-- ====================================================================================================

-- Lecture : Utilisateurs authentifiés peuvent voir les subscriptions
CREATE POLICY "graph_subscriptions_select_policy" ON graph_subscriptions
    FOR SELECT
    TO authenticated
    USING (true);

-- Insertion/Mise à jour : Réservé aux Edge Functions (service_role)
-- Les subscriptions sont gérées automatiquement

-- ====================================================================================================
-- POLITIQUES POUR received_messages
-- ====================================================================================================

-- Lecture : Utilisateurs authentifiés peuvent voir les messages reçus
CREATE POLICY "received_messages_select_policy" ON received_messages
    FOR SELECT
    TO authenticated
    USING (true);

-- Insertion : Réservé aux Edge Functions (service_role)
-- Les messages sont insérés via webhooks

-- ====================================================================================================
-- POLITIQUES POUR webhook_events
-- ====================================================================================================

-- Lecture : Utilisateurs authentifiés peuvent voir les événements webhook (monitoring)
CREATE POLICY "webhook_events_select_policy" ON webhook_events
    FOR SELECT
    TO authenticated
    USING (true);

-- Insertion : Réservé aux Edge Functions (service_role)
-- Les événements sont loggés automatiquement

-- ====================================================================================================
-- POLITIQUES POUR LES VUES
-- ====================================================================================================

-- Note: Les vues héritent automatiquement des politiques des tables sous-jacentes
-- email_stats, active_subscriptions, recent_webhook_events sont accessibles 
-- via les politiques des tables tracked_emails, graph_subscriptions, webhook_events

-- ====================================================================================================
-- PERMISSIONS EXPLICITES POUR LES RÔLES
-- ====================================================================================================

-- Confirmer les permissions pour authenticated (lecture seule)
GRANT SELECT ON tracked_emails TO authenticated;
GRANT SELECT ON graph_subscriptions TO authenticated;
GRANT SELECT ON received_messages TO authenticated;
GRANT SELECT ON webhook_events TO authenticated;

-- Permissions pour les vues
GRANT SELECT ON email_stats TO authenticated;
GRANT SELECT ON active_subscriptions TO authenticated;
GRANT SELECT ON recent_webhook_events TO authenticated;

-- Permissions pour service_role (Edge Functions) - déjà accordées dans migration 001
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
-- GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- ====================================================================================================
-- COMMENTAIRES POUR DOCUMENTATION
-- ====================================================================================================

COMMENT ON POLICY "tracked_emails_select_policy" ON tracked_emails IS 
    'Permet à tous les utilisateurs authentifiés de voir les emails trackés - système display-only';

COMMENT ON POLICY "graph_subscriptions_select_policy" ON graph_subscriptions IS 
    'Permet aux utilisateurs authentifiés de monitorer les subscriptions Microsoft Graph';

COMMENT ON POLICY "received_messages_select_policy" ON received_messages IS 
    'Permet aux utilisateurs authentifiés de voir les messages reçus via webhooks';

COMMENT ON POLICY "webhook_events_select_policy" ON webhook_events IS 
    'Permet aux utilisateurs authentifiés de voir les événements webhook pour debugging';

-- ====================================================================================================
-- VERIFICATION DES POLITIQUES
-- ====================================================================================================

-- Vérifier que les politiques sont bien créées
DO $$
BEGIN
    -- Compter les politiques créées
    IF (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public') >= 4 THEN
        RAISE NOTICE '✅ Politiques RLS créées avec succès';
        RAISE NOTICE 'ℹ️ Utilisateurs authentifiés : Lecture seule sur toutes les tables';
        RAISE NOTICE 'ℹ️ Edge Functions (service_role) : Accès complet pour automation';
    ELSE
        RAISE WARNING '⚠️ Certaines politiques RLS n''ont pas été créées correctement';
    END IF;
END $$;

-- ====================================================================================================
-- END OF MIGRATION 002
-- ====================================================================================================