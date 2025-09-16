-- ====================================================================================================
-- REMOVE TRIGGER COMPLETELY FOR TESTING
-- ====================================================================================================
-- Migration 025: Supprimer complètement le trigger pour isoler le problème
-- Created: 2025-01-16
-- Description: Test définitif - supprimer le trigger pour voir si ça résout le problème
-- ====================================================================================================

-- Supprimer le trigger complètement
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Supprimer la fonction trigger
DROP FUNCTION IF EXISTS create_user_profile();
DROP FUNCTION IF EXISTS create_profile_for_new_user(UUID, TEXT, TEXT, TEXT);

-- Log de la migration
DO $$
BEGIN
    RAISE NOTICE 'Migration 025: Trigger complètement supprimé pour test isolation problème';
END $$;