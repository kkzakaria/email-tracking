-- ====================================================================================================
-- FIX USER PROFILE CREATION TRIGGER WITH PROPER RLS HANDLING
-- ====================================================================================================
-- Migration 010: Solution permanente pour le trigger de création de profils
-- Created: 2025-01-16
-- Description: Corrige le trigger pour qu'il fonctionne avec RLS sans compromettre la sécurité
-- ====================================================================================================

-- Réactiver le trigger si désactivé
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Recréer la fonction avec une approche différente
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
    -- Utiliser la fonction d'insertion directe qui bypass RLS pour les triggers
    PERFORM create_profile_for_new_user(
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'role', 'user')
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction helper pour créer le profil avec les bonnes permissions
CREATE OR REPLACE FUNCTION create_profile_for_new_user(
    p_auth_user_id UUID,
    p_email TEXT,
    p_full_name TEXT,
    p_role TEXT
)
RETURNS void AS $$
BEGIN
    -- Cette fonction s'exécute avec les permissions de l'owner (postgres)
    -- Elle peut bypasser RLS pour les opérations système légitimes
    SET LOCAL row_security = off;

    INSERT INTO user_profiles (
        auth_user_id,
        email,
        full_name,
        role,
        status,
        emails_sent,
        emails_replied,
        response_rate
    ) VALUES (
        p_auth_user_id,
        p_email,
        p_full_name,
        p_role,
        'active',
        0,
        0,
        0.00
    )
    ON CONFLICT (auth_user_id) DO NOTHING;

    -- Remettre RLS en mode normal
    SET LOCAL row_security = on;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Réactiver le trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_user_profile();

-- Ajouter des commentaires pour documentation
COMMENT ON FUNCTION create_user_profile() IS 'Trigger function pour créer automatiquement un profil utilisateur';
COMMENT ON FUNCTION create_profile_for_new_user(UUID, TEXT, TEXT, TEXT) IS 'Helper function pour création de profil avec bypass RLS sécurisé';

-- Log de la migration
DO $$
BEGIN
    RAISE NOTICE 'Migration 010: Trigger de création de profils réparé avec gestion RLS appropriée';
END $$;