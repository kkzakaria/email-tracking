-- ====================================================================================================
-- USER MANAGEMENT SYSTEM - RLS POLICIES
-- ====================================================================================================
-- Migration 015: Politiques de sécurité Row Level Security
-- Created: 2025-01-16
-- Description: Sécurisation de l'accès aux profils utilisateurs
-- ====================================================================================================

-- ====================================================================================================
-- ACTIVATION RLS
-- ====================================================================================================
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- ====================================================================================================
-- POLITIQUE: Lecture des profils
-- Description: Les utilisateurs peuvent voir tous les profils (pour l'affichage dans le tableau)
-- ====================================================================================================
CREATE POLICY "Users can view all profiles"
    ON user_profiles
    FOR SELECT
    TO authenticated
    USING (true);

-- ====================================================================================================
-- POLITIQUE: Mise à jour de son propre profil
-- Description: Les utilisateurs peuvent modifier leur propre profil
-- ====================================================================================================
CREATE POLICY "Users can update own profile"
    ON user_profiles
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = auth_user_id)
    WITH CHECK (auth.uid() = auth_user_id);

-- ====================================================================================================
-- POLITIQUE: Gestion admin - Création
-- Description: Seuls les admins peuvent créer de nouveaux profils
-- ====================================================================================================
CREATE POLICY "Admins can create profiles"
    ON user_profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM user_profiles
            WHERE auth_user_id = auth.uid()
            AND role = 'admin'
        )
    );

-- ====================================================================================================
-- POLITIQUE: Gestion admin - Modification
-- Description: Les admins peuvent modifier tous les profils
-- ====================================================================================================
CREATE POLICY "Admins can update all profiles"
    ON user_profiles
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM user_profiles
            WHERE auth_user_id = auth.uid()
            AND role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM user_profiles
            WHERE auth_user_id = auth.uid()
            AND role = 'admin'
        )
    );

-- ====================================================================================================
-- POLITIQUE: Gestion admin - Suppression
-- Description: Les admins peuvent supprimer des profils
-- ====================================================================================================
CREATE POLICY "Admins can delete profiles"
    ON user_profiles
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM user_profiles
            WHERE auth_user_id = auth.uid()
            AND role = 'admin'
        )
        AND auth_user_id != auth.uid() -- Un admin ne peut pas supprimer son propre profil
    );

-- ====================================================================================================
-- FONCTION: Vérification du rôle utilisateur
-- Description: Helper pour vérifier le rôle d'un utilisateur
-- ====================================================================================================
CREATE OR REPLACE FUNCTION check_user_role(required_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM user_profiles
        WHERE auth_user_id = auth.uid()
        AND role = required_role
        AND status = 'active'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ====================================================================================================
-- FONCTION: Vérification si l'utilisateur est admin
-- Description: Helper simplifié pour vérifier le statut admin
-- ====================================================================================================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM user_profiles
        WHERE auth_user_id = auth.uid()
        AND role = 'admin'
        AND status = 'active'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ====================================================================================================
-- FONCTION: Obtenir le rôle de l'utilisateur courant
-- Description: Retourne le rôle de l'utilisateur connecté
-- ====================================================================================================
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TEXT AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role
    FROM user_profiles
    WHERE auth_user_id = auth.uid()
    AND status = 'active';

    RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ====================================================================================================
-- FONCTION: Obtenir le profil complet de l'utilisateur courant
-- Description: Retourne toutes les informations du profil de l'utilisateur connecté
-- ====================================================================================================
CREATE OR REPLACE FUNCTION get_current_user_profile()
RETURNS TABLE (
    id UUID,
    full_name TEXT,
    email TEXT,
    role TEXT,
    status TEXT,
    emails_sent INTEGER,
    emails_replied INTEGER,
    response_rate DECIMAL(5,2),
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        up.id,
        up.full_name,
        up.email,
        up.role,
        up.status,
        up.emails_sent,
        up.emails_replied,
        up.response_rate,
        up.last_login_at,
        up.created_at
    FROM user_profiles up
    WHERE up.auth_user_id = auth.uid()
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ====================================================================================================
-- GRANT: Permissions pour les fonctions
-- Description: Accorder l'exécution des fonctions aux utilisateurs authentifiés
-- ====================================================================================================
GRANT EXECUTE ON FUNCTION check_user_role TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin TO authenticated;
GRANT EXECUTE ON FUNCTION get_current_user_role TO authenticated;
GRANT EXECUTE ON FUNCTION get_current_user_profile TO authenticated;
GRANT EXECUTE ON FUNCTION get_users_with_profiles TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_email_stats TO authenticated;

-- ====================================================================================================
-- COMMENTS
-- ====================================================================================================
COMMENT ON POLICY "Users can view all profiles" ON user_profiles IS 'Permet à tous les utilisateurs authentifiés de voir les profils';
COMMENT ON POLICY "Users can update own profile" ON user_profiles IS 'Permet aux utilisateurs de modifier leur propre profil';
COMMENT ON POLICY "Admins can create profiles" ON user_profiles IS 'Seuls les admins peuvent créer de nouveaux profils';
COMMENT ON POLICY "Admins can update all profiles" ON user_profiles IS 'Les admins peuvent modifier tous les profils';
COMMENT ON POLICY "Admins can delete profiles" ON user_profiles IS 'Les admins peuvent supprimer des profils sauf le leur';

COMMENT ON FUNCTION check_user_role IS 'Vérifie si l''utilisateur courant a le rôle spécifié';
COMMENT ON FUNCTION is_admin IS 'Vérifie si l''utilisateur courant est admin';
COMMENT ON FUNCTION get_current_user_role IS 'Retourne le rôle de l''utilisateur connecté';
COMMENT ON FUNCTION get_current_user_profile IS 'Retourne le profil complet de l''utilisateur connecté';