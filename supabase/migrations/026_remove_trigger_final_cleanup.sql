-- ====================================================================================================
-- FINAL CLEANUP - REMOVE USER PROFILE TRIGGER
-- ====================================================================================================
-- Migration 026: Suppression définitive du trigger défaillant
-- Created: 2025-01-16
-- Description: Nettoyage complet du trigger qui causait les erreurs de création d'utilisateur
--              La création de profil sera gérée directement dans l'Edge Function
-- ====================================================================================================

-- Supprimer le trigger s'il existe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Supprimer toutes les fonctions liées au trigger
DROP FUNCTION IF EXISTS create_user_profile() CASCADE;
DROP FUNCTION IF EXISTS create_profile_for_new_user(UUID, TEXT, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS update_user_profile_updated_at() CASCADE;

-- Nettoyer les migrations de test précédentes en supprimant leurs objets
-- (Garde les tables intactes, supprime seulement les fonctions problématiques)

-- Vérifier que les tables principales existent toujours
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles') THEN
        RAISE EXCEPTION 'ERREUR: Table user_profiles manquante - vérifier les migrations précédentes';
    END IF;

    RAISE NOTICE 'OK: Table user_profiles présente';
END $$;

-- Réactiver RLS sur user_profiles si elle était désactivée
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Vérifier les politiques RLS
DO $$
BEGIN
    -- Compter les politiques existantes
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'user_profiles'
        AND policyname LIKE '%admin%'
    ) THEN
        RAISE NOTICE 'ATTENTION: Aucune politique RLS admin trouvée - vérifier les permissions';
    ELSE
        RAISE NOTICE 'OK: Politiques RLS présentes sur user_profiles';
    END IF;
END $$;

-- Log de la migration
DO $$
BEGIN
    RAISE NOTICE '=== Migration 026 Complétée ===';
    RAISE NOTICE 'Trigger supprimé - création de profil sera gérée par Edge Function';
    RAISE NOTICE 'RLS réactivé sur user_profiles';
    RAISE NOTICE 'Prêt pour implémentation Edge Function';
END $$;