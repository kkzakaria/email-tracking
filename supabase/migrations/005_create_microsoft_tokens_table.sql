-- ====================================================================================================
-- MIGRATION: Création de la table microsoft_tokens pour le stockage sécurisé des tokens OAuth
-- ====================================================================================================
-- Description: Table pour stocker les tokens Microsoft Graph chiffrés avec Argon2id + NaCl
-- Sécurité: RLS activé, tokens chiffrés côté client, clés dérivées par utilisateur
-- ====================================================================================================

-- Création de la table microsoft_tokens
CREATE TABLE microsoft_tokens (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) UNIQUE NOT NULL,
    
    -- Tokens chiffrés avec NaCl (secretbox)
    access_token_encrypted text NOT NULL,
    refresh_token_encrypted text NOT NULL,
    
    -- Nonce pour le chiffrement NaCl (24 bytes en base64)
    token_nonce text NOT NULL,
    
    -- Métadonnées des tokens
    expires_at timestamptz NOT NULL,
    scope text DEFAULT 'Mail.Read offline_access',
    
    -- Audit et maintenance
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    last_refreshed_at timestamptz,
    refresh_attempts integer DEFAULT 0
);

-- ====================================================================================================
-- SÉCURITÉ: Row Level Security (RLS)
-- ====================================================================================================

-- Activation du RLS sur la table
ALTER TABLE microsoft_tokens ENABLE ROW LEVEL SECURITY;

-- Politique: Un utilisateur ne peut accéder qu'à ses propres tokens
CREATE POLICY "Utilisateurs peuvent voir leurs propres tokens" ON microsoft_tokens
    FOR ALL 
    USING (auth.uid() = user_id);

-- Politique pour les Edge Functions (service_role)
CREATE POLICY "Service role peut accéder aux tokens" ON microsoft_tokens
    FOR ALL 
    USING (auth.role() = 'service_role');

-- ====================================================================================================
-- INDEX ET OPTIMISATIONS
-- ====================================================================================================

-- Index unique sur user_id pour les lookups rapides
CREATE UNIQUE INDEX idx_microsoft_tokens_user_id ON microsoft_tokens(user_id);

-- Index pour la maintenance automatique (tokens expirés)
CREATE INDEX idx_microsoft_tokens_expires_at ON microsoft_tokens(expires_at);

-- ====================================================================================================
-- TRIGGERS POUR MAINTENANCE AUTOMATIQUE
-- ====================================================================================================

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_microsoft_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public';

-- Trigger pour updated_at
CREATE TRIGGER trigger_update_microsoft_tokens_updated_at
    BEFORE UPDATE ON microsoft_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_microsoft_tokens_updated_at();

-- ====================================================================================================
-- COMMENTAIRES POUR DOCUMENTATION
-- ====================================================================================================

COMMENT ON TABLE microsoft_tokens IS 
'Stockage sécurisé des tokens OAuth Microsoft Graph. Tokens chiffrés avec Argon2id + NaCl.';

COMMENT ON COLUMN microsoft_tokens.access_token_encrypted IS 
'Access token Microsoft chiffré avec NaCl secretbox. Clé dérivée avec Argon2id(user_id + SERVER_SALT).';

COMMENT ON COLUMN microsoft_tokens.refresh_token_encrypted IS 
'Refresh token Microsoft chiffré avec NaCl secretbox. Permet le renouvellement automatique.';

COMMENT ON COLUMN microsoft_tokens.token_nonce IS 
'Nonce unique pour le chiffrement NaCl (24 bytes en base64). Généré côté client.';

COMMENT ON COLUMN microsoft_tokens.scope IS 
'Scopes OAuth accordés par l''utilisateur (ex: Mail.Read offline_access).';