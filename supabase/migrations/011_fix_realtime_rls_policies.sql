-- ====================================================================================================
-- EMAIL TRACKING SYSTEM - FIX REALTIME RLS POLICIES
-- ====================================================================================================
-- Migration 011: Correction des politiques RLS pour le Realtime
-- Created: 2025-01-10
-- Description: Ajoute les politiques nécessaires pour que le Realtime fonctionne avec RLS activé
-- ====================================================================================================

SET search_path = 'public';

-- ====================================================================================================
-- POLITIQUE REALTIME POUR tracked_emails
-- ====================================================================================================
-- Pour que le Realtime fonctionne avec RLS, il faut une politique qui permet
-- aux utilisateurs authentifiés de "recevoir" les changements

-- Supprimer l'ancienne politique si elle existe
DROP POLICY IF EXISTS "tracked_emails_select_policy" ON tracked_emails;

-- Recréer la politique SELECT avec support Realtime
CREATE POLICY "tracked_emails_select_policy" ON tracked_emails
    FOR SELECT
    TO authenticated, anon
    USING (true);

-- Politique pour les notifications Realtime (INSERT)
CREATE POLICY "tracked_emails_realtime_insert_policy" ON tracked_emails
    FOR INSERT
    TO authenticated
    WITH CHECK (false); -- Empêche l'insertion directe mais permet les notifications

-- Politique pour les notifications Realtime (UPDATE)
CREATE POLICY "tracked_emails_realtime_update_policy" ON tracked_emails
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (false); -- Empêche la modification directe mais permet les notifications

-- Politique pour les notifications Realtime (DELETE)
CREATE POLICY "tracked_emails_realtime_delete_policy" ON tracked_emails
    FOR DELETE
    TO authenticated
    USING (false); -- Empêche la suppression mais permet les notifications

-- ====================================================================================================
-- POLITIQUE REALTIME POUR received_messages
-- ====================================================================================================

-- Supprimer l'ancienne politique si elle existe
DROP POLICY IF EXISTS "received_messages_select_policy" ON received_messages;

-- Recréer la politique SELECT avec support Realtime
CREATE POLICY "received_messages_select_policy" ON received_messages
    FOR SELECT
    TO authenticated, anon
    USING (true);

-- Politique pour les notifications Realtime
CREATE POLICY "received_messages_realtime_insert_policy" ON received_messages
    FOR INSERT
    TO authenticated
    WITH CHECK (false);

CREATE POLICY "received_messages_realtime_update_policy" ON received_messages
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (false);

-- ====================================================================================================
-- POLITIQUE REALTIME POUR webhook_events
-- ====================================================================================================

-- Supprimer l'ancienne politique si elle existe
DROP POLICY IF EXISTS "webhook_events_select_policy" ON webhook_events;

-- Recréer la politique SELECT avec support Realtime
CREATE POLICY "webhook_events_select_policy" ON webhook_events
    FOR SELECT
    TO authenticated, anon
    USING (true);

-- Politique pour les notifications Realtime
CREATE POLICY "webhook_events_realtime_insert_policy" ON webhook_events
    FOR INSERT
    TO authenticated
    WITH CHECK (false);

-- ====================================================================================================
-- POLITIQUE REALTIME POUR graph_subscriptions
-- ====================================================================================================

-- Supprimer l'ancienne politique si elle existe
DROP POLICY IF EXISTS "graph_subscriptions_select_policy" ON graph_subscriptions;

-- Recréer la politique SELECT avec support Realtime
CREATE POLICY "graph_subscriptions_select_policy" ON graph_subscriptions
    FOR SELECT
    TO authenticated, anon
    USING (true);

-- Politique pour les notifications Realtime
CREATE POLICY "graph_subscriptions_realtime_update_policy" ON graph_subscriptions
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (false);

-- ====================================================================================================
-- VÉRIFICATION DE LA CONFIGURATION REALTIME
-- ====================================================================================================

-- S'assurer que les tables sont bien dans la publication Realtime
-- (Normalement déjà fait dans migration 004, mais on vérifie)
DO $$
BEGIN
    -- Vérifier si les tables sont dans la publication
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'tracked_emails'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE tracked_emails;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'received_messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE received_messages;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'webhook_events'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE webhook_events;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'graph_subscriptions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE graph_subscriptions;
    END IF;
END $$;

-- ====================================================================================================
-- GRANT SUPPLÉMENTAIRES POUR LE REALTIME
-- ====================================================================================================

-- S'assurer que les rôles ont les bonnes permissions
GRANT USAGE ON SCHEMA realtime TO authenticated, anon;
GRANT SELECT ON ALL TABLES IN SCHEMA realtime TO authenticated, anon;

-- Permissions sur les séquences pour les notifications
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ====================================================================================================
-- COMMENTAIRES POUR DOCUMENTATION
-- ====================================================================================================

COMMENT ON POLICY "tracked_emails_realtime_insert_policy" ON tracked_emails IS 
'Permet aux utilisateurs authentifiés de recevoir les notifications Realtime pour les nouveaux emails';

COMMENT ON POLICY "tracked_emails_realtime_update_policy" ON tracked_emails IS 
'Permet aux utilisateurs authentifiés de recevoir les notifications Realtime pour les mises à jour';

COMMENT ON POLICY "received_messages_realtime_insert_policy" ON received_messages IS 
'Permet aux utilisateurs authentifiés de recevoir les notifications Realtime pour les nouveaux messages';

-- Migration 011 completed: Realtime RLS policies fixed