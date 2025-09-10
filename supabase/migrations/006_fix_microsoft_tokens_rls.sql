-- ====================================================================================================
-- MIGRATION: Fix Microsoft Tokens RLS policies
-- ====================================================================================================
-- Description: Ajoute les politiques RLS manquantes pour la table microsoft_tokens
-- Date: 2025-09-09
-- ====================================================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own tokens" ON microsoft_tokens;
DROP POLICY IF EXISTS "Users can insert their own tokens" ON microsoft_tokens;
DROP POLICY IF EXISTS "Users can update their own tokens" ON microsoft_tokens;
DROP POLICY IF EXISTS "Users can delete their own tokens" ON microsoft_tokens;
DROP POLICY IF EXISTS "Service role can manage all tokens" ON microsoft_tokens;

-- ====================================================================================================
-- POLITIQUES RLS - microsoft_tokens
-- ====================================================================================================

-- Les utilisateurs peuvent voir leurs propres tokens
CREATE POLICY "Users can view their own tokens" ON microsoft_tokens
  FOR SELECT
  USING (auth.uid() = user_id);

-- Les utilisateurs peuvent insérer leurs propres tokens (via Edge Function)
CREATE POLICY "Users can insert their own tokens" ON microsoft_tokens
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Les utilisateurs peuvent mettre à jour leurs propres tokens
CREATE POLICY "Users can update their own tokens" ON microsoft_tokens
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Les utilisateurs peuvent supprimer leurs propres tokens
CREATE POLICY "Users can delete their own tokens" ON microsoft_tokens
  FOR DELETE
  USING (auth.uid() = user_id);

-- Service role peut tout faire (pour les Edge Functions)
CREATE POLICY "Service role can manage all tokens" ON microsoft_tokens
  FOR ALL
  USING (auth.role() = 'service_role');

-- ====================================================================================================
-- GRANT PERMISSIONS
-- ====================================================================================================

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON microsoft_tokens TO authenticated;

-- Grant all permissions to service role
GRANT ALL ON microsoft_tokens TO service_role;