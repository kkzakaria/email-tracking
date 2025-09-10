-- ====================================================================================================
-- VÉRIFICATION DE LA CONFIGURATION REALTIME
-- ====================================================================================================
-- Script pour vérifier que le Realtime est correctement configuré
-- À exécuter dans Supabase Dashboard > SQL Editor
-- ====================================================================================================

-- 1. Vérifier les tables dans la publication Realtime
SELECT 
    'Tables in Realtime publication' as check_type,
    tablename as table_name,
    'ENABLED' as status
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

-- 2. Vérifier que RLS est activé sur les tables principales
SELECT 
    'RLS Status' as check_type,
    tablename as table_name,
    CASE 
        WHEN rowsecurity = true THEN 'ENABLED ✅'
        ELSE 'DISABLED ❌'
    END as status
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('tracked_emails', 'received_messages', 'graph_subscriptions', 'webhook_events')
ORDER BY tablename;

-- 3. Vérifier les politiques RLS sur tracked_emails
SELECT 
    'RLS Policy on tracked_emails' as check_type,
    policyname as policy_name,
    cmd::text as operation,
    roles::text as roles
FROM pg_policies 
WHERE tablename = 'tracked_emails'
ORDER BY policyname;

-- 4. Vérifier les permissions sur le schéma realtime
SELECT 
    'Schema Permissions' as check_type,
    nspname as schema_name,
    string_agg(
        CASE 
            WHEN has_schema_privilege(r.rolname, n.nspname, 'USAGE') THEN r.rolname 
        END, ', '
    ) as roles_with_usage
FROM pg_namespace n
CROSS JOIN pg_roles r
WHERE n.nspname IN ('public', 'realtime')
AND r.rolname IN ('authenticated', 'anon', 'service_role')
GROUP BY n.nspname
ORDER BY n.nspname;

-- 5. Résumé de la configuration
SELECT 
    'Configuration Summary' as info,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
            AND tablename = 'tracked_emails'
        ) THEN '✅ tracked_emails dans Realtime'
        ELSE '❌ tracked_emails PAS dans Realtime'
    END as tracked_emails_realtime,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_tables 
            WHERE tablename = 'tracked_emails' 
            AND rowsecurity = true
        ) THEN '✅ RLS activé sur tracked_emails'
        ELSE '❌ RLS désactivé sur tracked_emails'
    END as rls_status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'tracked_emails' 
            AND policyname LIKE '%realtime%'
        ) THEN '✅ Politiques Realtime présentes'
        ELSE '⚠️ Politiques Realtime manquantes'
    END as realtime_policies;