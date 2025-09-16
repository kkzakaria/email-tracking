-- ====================================================================================================
-- TEMPORARY DISABLE RLS FOR TESTING
-- ====================================================================================================
-- Migration 024: Désactiver temporairement RLS pour tester la création d'utilisateurs
-- Created: 2025-01-16
-- Description: Test si le problème vient des politiques RLS
-- ====================================================================================================

-- Désactiver RLS sur user_profiles temporairement
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;

-- Log de la migration
DO $$
BEGIN
    RAISE NOTICE 'Migration 024: RLS temporairement désactivé sur user_profiles pour test';
END $$;