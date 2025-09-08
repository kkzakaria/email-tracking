-- ====================================================================================================
-- EMAIL TRACKING SYSTEM - ENABLE REALTIME REPLICATION
-- ====================================================================================================
-- Migration 004: Activation du Realtime sur les tables principales
-- Created: 2025-01-08
-- Description: Active la réplication Realtime pour les mises à jour en temps réel
-- ====================================================================================================

-- Enable Realtime for tracked_emails table
-- Cette table contient les emails suivis et leurs statuts
ALTER PUBLICATION supabase_realtime ADD TABLE tracked_emails;

-- Enable Realtime for graph_subscriptions table  
-- Pour surveiller l'état des subscriptions Microsoft Graph
ALTER PUBLICATION supabase_realtime ADD TABLE graph_subscriptions;

-- Enable Realtime for received_messages table
-- Pour les nouvelles réponses reçues en temps réel
ALTER PUBLICATION supabase_realtime ADD TABLE received_messages;

-- Enable Realtime for webhook_events table
-- Pour monitorer les événements webhooks en temps réel
ALTER PUBLICATION supabase_realtime ADD TABLE webhook_events;

-- ====================================================================================================
-- COMMENTAIRES ET DOCUMENTATION
-- ====================================================================================================

COMMENT ON PUBLICATION supabase_realtime IS 'Publication Realtime pour synchronisation temps réel des tables email tracking';

-- Note: Après application de cette migration, les tables seront disponibles pour:
-- 1. Subscriptions Realtime côté client (JavaScript/TypeScript)
-- 2. Mises à jour automatiques dans l'interface utilisateur
-- 3. Notifications push des changements d'état des emails
-- 4. Monitoring en temps réel des webhooks et subscriptions

-- Exemple d'utilisation côté client:
-- const subscription = supabase
--   .channel('tracked_emails_changes')
--   .on('postgres_changes', 
--       { event: '*', schema: 'public', table: 'tracked_emails' },
--       (payload) => console.log('Email status changed:', payload)
--   )
--   .subscribe();