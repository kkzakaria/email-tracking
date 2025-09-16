-- ====================================================================================================
-- USER MANAGEMENT SYSTEM - USER PROFILES
-- ====================================================================================================
-- Migration 014: Table des profils utilisateurs étendus
-- Created: 2025-01-16
-- Description: Gestion complète des utilisateurs avec profils étendus et statistiques
-- ====================================================================================================

-- ====================================================================================================
-- TABLE: user_profiles
-- Description: Profils étendus pour les utilisateurs du système
-- ====================================================================================================
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Relation avec Supabase Auth
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,

    -- Informations de base
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,

    -- Rôle et permissions
    role TEXT NOT NULL CHECK (role IN ('admin', 'user', 'viewer')) DEFAULT 'user',

    -- Statut du compte
    status TEXT NOT NULL CHECK (status IN ('active', 'inactive')) DEFAULT 'active',

    -- Statistiques d'utilisation
    emails_sent INTEGER DEFAULT 0,
    emails_replied INTEGER DEFAULT 0,
    response_rate DECIMAL(5,2) DEFAULT 0.00, -- Pourcentage de réponse

    -- Tracking d'activité
    last_login_at TIMESTAMPTZ,
    last_activity_at TIMESTAMPTZ,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),

    -- Constraints
    CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

-- Indexes pour performance
CREATE INDEX idx_user_profiles_auth_user ON user_profiles(auth_user_id);
CREATE INDEX idx_user_profiles_email ON user_profiles(email);
CREATE INDEX idx_user_profiles_role ON user_profiles(role);
CREATE INDEX idx_user_profiles_status ON user_profiles(status);
CREATE INDEX idx_user_profiles_created_at ON user_profiles(created_at DESC);

-- ====================================================================================================
-- TRIGGER: Synchronisation avec auth.users
-- Description: Crée automatiquement un profil lors de la création d'un utilisateur
-- ====================================================================================================
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_profiles (
        auth_user_id,
        email,
        full_name,
        role,
        status
    ) VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
        'active'
    )
    ON CONFLICT (auth_user_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger pour création automatique du profil
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_user_profile();

-- ====================================================================================================
-- TRIGGER: Mise à jour du timestamp updated_at
-- ====================================================================================================
CREATE OR REPLACE FUNCTION update_user_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_user_profile_updated_at();

-- ====================================================================================================
-- FUNCTION: Mise à jour des statistiques utilisateur
-- Description: Met à jour les stats d'emails envoyés/répondus
-- ====================================================================================================
CREATE OR REPLACE FUNCTION update_user_email_stats(
    p_user_id UUID,
    p_increment_sent BOOLEAN DEFAULT FALSE,
    p_increment_replied BOOLEAN DEFAULT FALSE
)
RETURNS void AS $$
DECLARE
    v_sent INTEGER;
    v_replied INTEGER;
    v_rate DECIMAL(5,2);
BEGIN
    -- Récupérer les valeurs actuelles
    SELECT emails_sent, emails_replied INTO v_sent, v_replied
    FROM user_profiles
    WHERE auth_user_id = p_user_id;

    -- Incrémenter si nécessaire
    IF p_increment_sent THEN
        v_sent := v_sent + 1;
    END IF;

    IF p_increment_replied THEN
        v_replied := v_replied + 1;
    END IF;

    -- Calculer le taux de réponse
    IF v_sent > 0 THEN
        v_rate := (v_replied::DECIMAL / v_sent::DECIMAL) * 100;
    ELSE
        v_rate := 0;
    END IF;

    -- Mettre à jour le profil
    UPDATE user_profiles
    SET
        emails_sent = v_sent,
        emails_replied = v_replied,
        response_rate = v_rate,
        last_activity_at = NOW()
    WHERE auth_user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ====================================================================================================
-- FUNCTION: Récupérer les utilisateurs avec leurs profils
-- Description: Fonction helper pour l'Edge Function
-- ====================================================================================================
CREATE OR REPLACE FUNCTION get_users_with_profiles(
    p_role TEXT DEFAULT NULL,
    p_status TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 100,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    auth_user_id UUID,
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
        up.auth_user_id,
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
    WHERE
        (p_role IS NULL OR up.role = p_role) AND
        (p_status IS NULL OR up.status = p_status)
    ORDER BY up.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ====================================================================================================
-- COMMENTS
-- ====================================================================================================
COMMENT ON TABLE user_profiles IS 'Profils utilisateurs étendus avec statistiques et permissions';
COMMENT ON COLUMN user_profiles.auth_user_id IS 'Référence vers auth.users de Supabase';
COMMENT ON COLUMN user_profiles.role IS 'Rôle utilisateur: admin, user, viewer';
COMMENT ON COLUMN user_profiles.status IS 'Statut du compte: active, inactive';
COMMENT ON COLUMN user_profiles.response_rate IS 'Taux de réponse en pourcentage';