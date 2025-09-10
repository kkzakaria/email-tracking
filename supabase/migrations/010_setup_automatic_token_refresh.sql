-- ====================================================================================================
-- AUTOMATIC TOKEN REFRESH SYSTEM - CRON JOB
-- ====================================================================================================
-- Migration 010: Système de rafraîchissement automatique des tokens Microsoft Graph
-- Created: 2025-01-09
-- Description: Ajoute un job cron PostgreSQL pour rafraîchir les tokens expirés automatiquement
-- ====================================================================================================

SET search_path = 'public';

-- ====================================================================================================
-- FONCTION: Rafraîchir automatiquement tous les tokens expirés
-- ====================================================================================================
CREATE OR REPLACE FUNCTION refresh_expired_microsoft_tokens()
RETURNS TABLE (
    user_id UUID,
    refresh_status TEXT,
    error_message TEXT
) AS $$
DECLARE
    token_record RECORD;
    refresh_result RECORD;
    request_body TEXT;
    response_data TEXT;
    success_count INTEGER := 0;
    error_count INTEGER := 0;
BEGIN
    RAISE NOTICE 'Starting automatic token refresh job at %', NOW();
    
    -- Sélectionner tous les tokens qui expirent dans moins de 30 minutes
    FOR token_record IN 
        SELECT 
            mt.user_id,
            mt.access_token_encrypted,
            mt.refresh_token_encrypted,
            mt.token_nonce,
            mt.expires_at,
            mt.scope,
            au.email
        FROM microsoft_tokens mt
        JOIN auth.users au ON mt.user_id = au.id
        WHERE mt.expires_at < NOW() + INTERVAL '30 minutes'
        AND mt.refresh_token_encrypted IS NOT NULL
        ORDER BY mt.expires_at ASC
    LOOP
        BEGIN
            RAISE NOTICE 'Refreshing tokens for user % (expires at %)', 
                token_record.user_id, token_record.expires_at;
            
            -- Préparer le corps de la requête pour l'Edge Function
            request_body := json_build_object(
                'action', 'refresh'
            )::TEXT;
            
            -- Appeler l'Edge Function microsoft-auth via HTTP
            SELECT INTO refresh_result
                status,
                content::json->>'success' as success,
                content::json->>'error' as error_msg
            FROM http((
                'POST',
                current_setting('app.supabase_url', true) || '/functions/v1/microsoft-auth',
                ARRAY[
                    http_header('Authorization', 'Bearer ' || current_setting('app.service_role_key', true)),
                    http_header('Content-Type', 'application/json'),
                    http_header('x-user-id', token_record.user_id::TEXT)
                ],
                'application/json',
                request_body
            ));
            
            -- Vérifier le résultat
            IF refresh_result.status = 200 AND refresh_result.success = 'true' THEN
                success_count := success_count + 1;
                
                -- Retourner le résultat de succès
                user_id := token_record.user_id;
                refresh_status := 'SUCCESS';
                error_message := NULL;
                RETURN NEXT;
                
                RAISE NOTICE 'Successfully refreshed tokens for user %', token_record.user_id;
                
            ELSE
                error_count := error_count + 1;
                
                -- Incrémenter le compteur d'échecs
                UPDATE microsoft_tokens 
                SET refresh_attempts = refresh_attempts + 1,
                    updated_at = NOW()
                WHERE microsoft_tokens.user_id = token_record.user_id;
                
                -- Retourner l'erreur
                user_id := token_record.user_id;
                refresh_status := 'ERROR';
                error_message := COALESCE(refresh_result.error_msg, 'HTTP Error ' || refresh_result.status);
                RETURN NEXT;
                
                RAISE WARNING 'Failed to refresh tokens for user %: %', 
                    token_record.user_id, error_message;
            END IF;
            
        EXCEPTION WHEN OTHERS THEN
            error_count := error_count + 1;
            
            -- Incrémenter le compteur d'échecs
            UPDATE microsoft_tokens 
            SET refresh_attempts = refresh_attempts + 1,
                updated_at = NOW()
            WHERE microsoft_tokens.user_id = token_record.user_id;
            
            -- Retourner l'exception
            user_id := token_record.user_id;
            refresh_status := 'EXCEPTION';
            error_message := SQLERRM;
            RETURN NEXT;
            
            RAISE WARNING 'Exception refreshing tokens for user %: %', 
                token_record.user_id, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE 'Token refresh job completed. Success: %, Errors: %', success_count, error_count;
    
    -- Insérer un log de l'exécution du job
    INSERT INTO cron_job_logs (job_name, execution_time, success_count, error_count, details)
    VALUES (
        'refresh_expired_microsoft_tokens',
        NOW(),
        success_count,
        error_count,
        format('Processed tokens, %s successes, %s errors', success_count, error_count)
    );
    
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ====================================================================================================
-- TABLE: Logs des jobs cron
-- ====================================================================================================
CREATE TABLE IF NOT EXISTS cron_job_logs (
    id SERIAL PRIMARY KEY,
    job_name TEXT NOT NULL,
    execution_time TIMESTAMPTZ DEFAULT NOW(),
    success_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_cron_job_logs_execution_time ON cron_job_logs(execution_time DESC);

-- ====================================================================================================
-- CONFIGURATION: Variables système pour les Edge Functions
-- ====================================================================================================

-- Ces variables doivent être configurées avec les vraies valeurs
-- Exemple de configuration (à adapter avec vos vraies valeurs) :
-- SELECT set_config('app.supabase_url', 'https://ydbsiljhjswtysmizcdw.supabase.co', false);
-- SELECT set_config('app.service_role_key', 'your-service-role-key-here', false);

-- ====================================================================================================
-- FONCTION: Configuration automatique des variables (à appeler une fois)
-- ====================================================================================================
CREATE OR REPLACE FUNCTION setup_token_refresh_config()
RETURNS void AS $$
BEGIN
    -- Configuration URL Supabase (à adapter)
    PERFORM set_config('app.supabase_url', 'https://ydbsiljhjswtysmizcdw.supabase.co', false);
    
    -- La service_role_key sera configurée via les secrets Vault
    -- Voir scripts/setup-vault-secrets.sh pour la configuration sécurisée
    
    RAISE NOTICE 'Token refresh configuration completed';
END;
$$ LANGUAGE plpgsql;

-- ====================================================================================================
-- JOB CRON: Planification automatique
-- ====================================================================================================

-- Supprimer le job s'il existe déjà
SELECT cron.unschedule('microsoft-token-refresh');

-- Créer le job cron (toutes les 30 minutes)
SELECT cron.schedule(
    'microsoft-token-refresh',
    '*/30 * * * *',  -- Toutes les 30 minutes
    'SELECT refresh_expired_microsoft_tokens();'
);

-- ====================================================================================================
-- PERMISSIONS ET SÉCURITÉ
-- ====================================================================================================

-- Grant permissions pour le service role
GRANT EXECUTE ON FUNCTION refresh_expired_microsoft_tokens() TO service_role;
GRANT EXECUTE ON FUNCTION setup_token_refresh_config() TO service_role;
GRANT ALL ON cron_job_logs TO service_role;

-- Permissions lecture pour les utilisateurs authentifiés
GRANT SELECT ON cron_job_logs TO authenticated;

-- ====================================================================================================
-- VUES: Monitoring et statistiques
-- ====================================================================================================

CREATE OR REPLACE VIEW token_refresh_stats AS
SELECT 
    COUNT(*) as total_tokens,
    COUNT(CASE WHEN expires_at < NOW() + INTERVAL '30 minutes' THEN 1 END) as tokens_need_refresh,
    COUNT(CASE WHEN expires_at < NOW() THEN 1 END) as expired_tokens,
    AVG(refresh_attempts) as avg_refresh_attempts,
    MAX(last_refreshed_at) as last_refresh_time
FROM microsoft_tokens;

CREATE OR REPLACE VIEW recent_cron_jobs AS
SELECT 
    job_name,
    execution_time,
    success_count,
    error_count,
    details,
    (success_count::float / NULLIF(success_count + error_count, 0) * 100) as success_rate
FROM cron_job_logs 
WHERE job_name = 'refresh_expired_microsoft_tokens'
ORDER BY execution_time DESC 
LIMIT 20;

-- Grant permissions sur les vues
GRANT SELECT ON token_refresh_stats TO authenticated, anon;
GRANT SELECT ON recent_cron_jobs TO authenticated, anon;

-- ====================================================================================================
-- FONCTION: Test manuel du système
-- ====================================================================================================
CREATE OR REPLACE FUNCTION test_token_refresh()
RETURNS TABLE (
    user_count INTEGER,
    tokens_to_refresh INTEGER,
    test_result TEXT
) AS $$
DECLARE
    user_cnt INTEGER;
    tokens_cnt INTEGER;
BEGIN
    -- Compter les utilisateurs et tokens
    SELECT COUNT(*) INTO user_cnt FROM microsoft_tokens;
    SELECT COUNT(*) INTO tokens_cnt FROM microsoft_tokens 
    WHERE expires_at < NOW() + INTERVAL '30 minutes';
    
    user_count := user_cnt;
    tokens_to_refresh := tokens_cnt;
    
    IF tokens_cnt > 0 THEN
        test_result := format('Ready to refresh %s tokens from %s users', tokens_cnt, user_cnt);
    ELSE
        test_result := format('No tokens need refresh. %s users total.', user_cnt);
    END IF;
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ====================================================================================================
-- COMMENTS pour documentation
-- ====================================================================================================

COMMENT ON FUNCTION refresh_expired_microsoft_tokens() IS 'Job automatique de rafraîchissement des tokens Microsoft Graph expirés';
COMMENT ON TABLE cron_job_logs IS 'Historique des exécutions des jobs cron de rafraîchissement';
COMMENT ON VIEW token_refresh_stats IS 'Statistiques temps réel du système de refresh des tokens';
COMMENT ON VIEW recent_cron_jobs IS 'Historique des 20 dernières exécutions du job de refresh';

-- ====================================================================================================
-- VALIDATION DE LA MIGRATION
-- ====================================================================================================

DO $$
BEGIN
    -- Vérifier que la fonction existe
    IF NOT EXISTS (SELECT FROM information_schema.routines WHERE routine_name = 'refresh_expired_microsoft_tokens') THEN
        RAISE EXCEPTION 'Migration failed: refresh_expired_microsoft_tokens function not created';
    END IF;
    
    -- Vérifier que la table de logs existe
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'cron_job_logs') THEN
        RAISE EXCEPTION 'Migration failed: cron_job_logs table not created';
    END IF;
    
    -- Vérifier que le job cron est programmé
    IF NOT EXISTS (SELECT FROM cron.job WHERE jobname = 'microsoft-token-refresh') THEN
        RAISE EXCEPTION 'Migration failed: cron job not scheduled';
    END IF;
    
    RAISE NOTICE 'Migration 010 completed successfully - Automatic token refresh system enabled';
    RAISE NOTICE 'Job scheduled to run every 30 minutes';
    RAISE NOTICE 'Use SELECT test_token_refresh(); to test the system';
END
$$;

-- ====================================================================================================
-- END OF MIGRATION 010
-- ====================================================================================================