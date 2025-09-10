-- ====================================================================================================
-- TEST: DÉSACTIVER TEMPORAIREMENT RLS POUR DIAGNOSTIQUER
-- ====================================================================================================
-- ⚠️ ATTENTION: Script de test uniquement - réactiver RLS après le test
-- ====================================================================================================

-- Désactiver RLS temporairement sur tracked_emails pour tester
ALTER TABLE tracked_emails DISABLE ROW LEVEL SECURITY;

-- Vérifier le statut
SELECT 
    tablename,
    CASE 
        WHEN rowsecurity = true THEN 'RLS ENABLED'
        ELSE 'RLS DISABLED'
    END as rls_status
FROM pg_tables 
WHERE tablename = 'tracked_emails';

-- ====================================================================================================
-- APRÈS LE TEST, RÉACTIVER RLS AVEC:
-- ALTER TABLE tracked_emails ENABLE ROW LEVEL SECURITY;
-- ====================================================================================================