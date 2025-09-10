-- ====================================================================================================
-- MIGRATION 007: Ajouter user_id à graph_subscriptions et politiques RLS
-- ====================================================================================================
-- Created: 2025-09-09
-- Description: Ajoute la colonne user_id et configure les politiques RLS pour graph_subscriptions
-- ====================================================================================================

-- Ajouter la colonne user_id à la table graph_subscriptions
ALTER TABLE graph_subscriptions 
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Créer un index sur user_id pour les performances
CREATE INDEX idx_graph_subscriptions_user_id ON graph_subscriptions(user_id);

-- Supprimer l'ancienne politique de lecture générale
DROP POLICY IF EXISTS "graph_subscriptions_select_policy" ON graph_subscriptions;

-- ====================================================================================================
-- POLITIQUES RLS POUR GRAPH_SUBSCRIPTIONS
-- ====================================================================================================

-- Politique pour que les utilisateurs ne voient que leurs propres subscriptions
CREATE POLICY "Users can view their own subscriptions"
ON graph_subscriptions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Politique pour que les utilisateurs puissent insérer leurs propres subscriptions
CREATE POLICY "Users can insert their own subscriptions"
ON graph_subscriptions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Politique pour que les utilisateurs puissent mettre à jour leurs propres subscriptions
CREATE POLICY "Users can update their own subscriptions"
ON graph_subscriptions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Politique pour que les utilisateurs puissent supprimer leurs propres subscriptions
CREATE POLICY "Users can delete their own subscriptions"
ON graph_subscriptions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- ====================================================================================================
-- POLITIQUES POUR SERVICE_ROLE (Edge Functions)
-- ====================================================================================================

-- Le service_role a déjà rolbypassrls = true, donc il contourne automatiquement les politiques RLS
-- Mais on ajoute des politiques explicites pour plus de clarté

-- Service role peut tout faire sur graph_subscriptions
CREATE POLICY "Service role can manage all subscriptions"
ON graph_subscriptions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ====================================================================================================
-- MISE À JOUR DES DONNÉES EXISTANTES (si nécessaire)
-- ====================================================================================================

-- Note: Actuellement il n'y a pas de données existantes dans graph_subscriptions
-- Si il y en avait, on pourrait les assigner à un utilisateur par défaut ou les supprimer

-- Vérifier s'il y a des données existantes
DO $$
DECLARE
    existing_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO existing_count FROM graph_subscriptions WHERE user_id IS NULL;
    
    IF existing_count > 0 THEN
        RAISE NOTICE 'ATTENTION: % subscriptions existantes sans user_id trouvées', existing_count;
        RAISE NOTICE 'Ces subscriptions ne seront plus accessibles aux utilisateurs normaux';
        RAISE NOTICE 'Considérez les supprimer ou les assigner à un utilisateur';
    ELSE
        RAISE NOTICE 'Aucune subscription existante - migration propre';
    END IF;
END
$$;

-- ====================================================================================================
-- GRANTS ET PERMISSIONS
-- ====================================================================================================

-- S'assurer que le service_role a toutes les permissions
GRANT ALL ON graph_subscriptions TO service_role;

-- Les utilisateurs authentifiés peuvent accéder à leurs propres données via les politiques RLS
-- Pas besoin de grants supplémentaires

-- ====================================================================================================
-- COMMENTAIRES POUR DOCUMENTATION
-- ====================================================================================================

COMMENT ON COLUMN graph_subscriptions.user_id IS 'ID de l''utilisateur propriétaire de la subscription Microsoft Graph';
COMMENT ON POLICY "Users can view their own subscriptions" ON graph_subscriptions IS 'Les utilisateurs ne voient que leurs propres subscriptions';
COMMENT ON POLICY "Service role can manage all subscriptions" ON graph_subscriptions IS 'Service role (Edge Functions) peut gérer toutes les subscriptions';

-- ====================================================================================================
-- VALIDATION
-- ====================================================================================================

-- Vérifier que la colonne a été ajoutée correctement
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'graph_subscriptions' 
        AND column_name = 'user_id' 
        AND table_schema = 'public'
    ) THEN
        RAISE EXCEPTION 'Colonne user_id non créée dans graph_subscriptions';
    END IF;
    
    RAISE NOTICE '✅ Colonne user_id ajoutée avec succès à graph_subscriptions';
END
$$;

-- Vérifier que les politiques ont été créées
DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count 
    FROM pg_policies 
    WHERE tablename = 'graph_subscriptions';
    
    IF policy_count < 4 THEN
        RAISE WARNING 'Seulement % politiques RLS trouvées pour graph_subscriptions (attendu: au moins 4)', policy_count;
    ELSE
        RAISE NOTICE '✅ % politiques RLS créées pour graph_subscriptions', policy_count;
    END IF;
END
$$;

-- ====================================================================================================
-- END OF MIGRATION 007
-- ====================================================================================================