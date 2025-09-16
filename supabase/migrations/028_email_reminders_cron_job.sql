-- ====================================================================================================
-- EMAIL REMINDERS CRON JOB - INTEGRATION WITH EXISTING SYSTEM
-- ====================================================================================================
-- Migration 028: Intégration du système de relances dans les jobs cron existants
-- Created: 2025-01-16
-- Description: Réutilise l'infrastructure cron existante pour les relances (même pattern que subscriptions)
-- ====================================================================================================

-- ====================================================================================================
-- FONCTION POUR ACTIVER LE JOB CRON DES RELANCES
-- ====================================================================================================

-- Fonction pour activer le job cron des relances
CREATE OR REPLACE FUNCTION activate_email_reminders_cron()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    -- Planifier la vérification et l'envoi des relances
    -- Fréquence: Toutes les 4 heures (même pattern que les subscriptions)
    -- Décalé de 30 minutes pour éviter la concurrence
    PERFORM cron.schedule(
        'email-reminders-processor',
        '30 */4 * * *', -- Toutes les 4 heures à 30 minutes (4:30, 8:30, 12:30, 16:30, 20:30, 0:30)
        $body$
        select net.http_post(
            url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
                   || '/functions/v1/email-reminder',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
            ),
            body := jsonb_build_object(
                'action', 'send',
                'source', 'cron_email_reminders',
                'timestamp', now()::text
            ),
            timeout_milliseconds := 60000 -- 60 secondes pour traiter les envois
        ) as request_id;
        $body$
    );

    RETURN 'Job cron des relances activé avec succès - Fréquence: toutes les 4 heures à 30 minutes';
END;
$$;

-- ====================================================================================================
-- FONCTION POUR DÉSACTIVER LE JOB CRON DES RELANCES
-- ====================================================================================================

-- Fonction pour désactiver le job cron des relances
CREATE OR REPLACE FUNCTION deactivate_email_reminders_cron()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    -- Désactiver le job de relances
    PERFORM cron.unschedule('email-reminders-processor');

    RETURN 'Job cron des relances désactivé avec succès';
END;
$$;

-- ====================================================================================================
-- FONCTION DE MONITORING DES JOBS DE RELANCES
-- ====================================================================================================

-- Fonction pour vérifier le statut du job de relances
CREATE OR REPLACE FUNCTION check_email_reminders_job_status()
RETURNS TABLE(
    job_name text,
    schedule text,
    active boolean,
    last_run timestamp with time zone,
    last_status text,
    next_estimated_run timestamp with time zone,
    last_response jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
    SELECT
        j.jobname,
        j.schedule,
        j.active,
        jr.start_time,
        CASE
            WHEN jr.return_message IS NULL OR jr.return_message = '' THEN 'SUCCESS'
            ELSE 'ERROR: ' || jr.return_message
        END as last_status,
        -- Estimation du prochain run (toutes les 4h)
        jr.start_time + interval '4 hours' as next_estimated_run,
        -- Essayer de parser la réponse de la Edge Function si disponible
        CASE
            WHEN jr.return_message IS NOT NULL AND jr.return_message ~ '^{.*}$' THEN
                jr.return_message::jsonb
            ELSE
                NULL
        END as last_response
    FROM cron.job j
    LEFT JOIN LATERAL (
        SELECT start_time, return_message
        FROM cron.job_run_details jrd
        WHERE jrd.jobid = j.jobid
        ORDER BY start_time DESC
        LIMIT 1
    ) jr ON true
    WHERE j.jobname = 'email-reminders-processor'
    ORDER BY j.jobname;
$$;

-- ====================================================================================================
-- FONCTION POUR DÉCLENCHER MANUELLEMENT LES RELANCES
-- ====================================================================================================

-- Fonction pour déclencher manuellement le traitement des relances (utile pour tests)
CREATE OR REPLACE FUNCTION trigger_email_reminders_manually(
    p_target_user_ids UUID[] DEFAULT NULL,
    p_target_email_ids UUID[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_result jsonb;
    v_response record;
BEGIN
    -- Appeler directement la Edge Function email-reminder
    SELECT INTO v_response net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
               || '/functions/v1/email-reminder',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
        ),
        body := jsonb_build_object(
            'action', 'send',
            'source', 'manual_trigger',
            'target_user_ids', COALESCE(p_target_user_ids, ARRAY[]::UUID[]),
            'target_email_ids', COALESCE(p_target_email_ids, ARRAY[]::UUID[]),
            'timestamp', now()::text
        ),
        timeout_milliseconds := 60000
    );

    -- Formatter la réponse
    v_result := jsonb_build_object(
        'success', true,
        'trigger_type', 'manual',
        'timestamp', now(),
        'http_status', v_response.status,
        'response', CASE
            WHEN v_response.content IS NOT NULL AND v_response.content ~ '^{.*}$' THEN
                v_response.content::jsonb
            ELSE
                jsonb_build_object('raw_response', v_response.content)
        END
    );

    RETURN v_result;

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'trigger_type', 'manual',
        'timestamp', now()
    );
END;
$$;

-- ====================================================================================================
-- MISE À JOUR DE LA VUE EMAIL_STATS POUR INCLURE LE MONITORING CRON
-- ====================================================================================================

-- Fonction pour récupérer les statistiques complètes incluant le statut du cron
CREATE OR REPLACE FUNCTION get_email_reminders_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_stats jsonb;
    v_cron_status record;
    v_upcoming_count integer;
BEGIN
    -- Statistiques des relances
    SELECT jsonb_build_object(
        'total_reminders', COUNT(*),
        'scheduled', COUNT(CASE WHEN status = 'SCHEDULED' THEN 1 END),
        'sent', COUNT(CASE WHEN status = 'SENT' THEN 1 END),
        'cancelled', COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END),
        'failed', COUNT(CASE WHEN status = 'FAILED' THEN 1 END),
        'success_rate', CASE
            WHEN COUNT(CASE WHEN status IN ('SENT', 'FAILED') THEN 1 END) > 0 THEN
                ROUND(
                    COUNT(CASE WHEN status = 'SENT' THEN 1 END)::decimal /
                    COUNT(CASE WHEN status IN ('SENT', 'FAILED') THEN 1 END)::decimal * 100,
                    2
                )
            ELSE 0
        END
    ) INTO v_stats
    FROM email_reminders;

    -- Statut du job cron
    SELECT * INTO v_cron_status
    FROM check_email_reminders_job_status()
    LIMIT 1;

    -- Nombre de relances dues dans les prochaines 24h
    SELECT COUNT(*) INTO v_upcoming_count
    FROM email_reminders
    WHERE status = 'SCHEDULED'
    AND scheduled_for BETWEEN NOW() AND NOW() + INTERVAL '24 hours';

    -- Combiner toutes les statistiques
    v_stats := v_stats || jsonb_build_object(
        'cron_job', CASE
            WHEN v_cron_status IS NOT NULL THEN
                jsonb_build_object(
                    'active', v_cron_status.active,
                    'last_run', v_cron_status.last_run,
                    'last_status', v_cron_status.last_status,
                    'next_estimated_run', v_cron_status.next_estimated_run
                )
            ELSE
                jsonb_build_object('active', false, 'status', 'not_configured')
        END,
        'upcoming_24h', v_upcoming_count,
        'last_update', NOW()
    );

    RETURN v_stats;
END;
$$;

-- ====================================================================================================
-- PERMISSIONS
-- ====================================================================================================

-- Grants pour service_role
GRANT EXECUTE ON FUNCTION activate_email_reminders_cron TO service_role;
GRANT EXECUTE ON FUNCTION deactivate_email_reminders_cron TO service_role;
GRANT EXECUTE ON FUNCTION check_email_reminders_job_status TO service_role;
GRANT EXECUTE ON FUNCTION trigger_email_reminders_manually TO service_role;
GRANT EXECUTE ON FUNCTION get_email_reminders_dashboard_stats TO service_role;

-- Grants pour authenticated users (pour monitoring)
GRANT EXECUTE ON FUNCTION check_email_reminders_job_status TO authenticated;
GRANT EXECUTE ON FUNCTION get_email_reminders_dashboard_stats TO authenticated;

-- ====================================================================================================
-- COMMENTAIRES POUR DOCUMENTATION
-- ====================================================================================================

COMMENT ON FUNCTION activate_email_reminders_cron IS 'Active le job cron pour les relances automatiques (toutes les 4h à 30min)';
COMMENT ON FUNCTION deactivate_email_reminders_cron IS 'Désactive le job cron des relances automatiques';
COMMENT ON FUNCTION check_email_reminders_job_status IS 'Vérifie le statut du job cron des relances';
COMMENT ON FUNCTION trigger_email_reminders_manually IS 'Déclenche manuellement le traitement des relances (utile pour tests)';
COMMENT ON FUNCTION get_email_reminders_dashboard_stats IS 'Récupère les statistiques complètes pour le dashboard';

-- ====================================================================================================
-- INSTRUCTIONS D'ACTIVATION
-- ====================================================================================================

/*
INSTRUCTIONS POUR ACTIVER LE SYSTÈME DE RELANCES :

1. Configurer le secret service_role_key dans Vault (si pas déjà fait) :
   select vault.create_secret('your_service_role_key', 'service_role_key');

2. Activer le job cron après validation :
   select activate_email_reminders_cron();

3. Vérifier le statut du job :
   select * from check_email_reminders_job_status();

4. Pour tester manuellement :
   select trigger_email_reminders_manually();

5. Monitoring via dashboard :
   select get_email_reminders_dashboard_stats();

6. Historique des exécutions :
   select * from cron.job_run_details
   where jobid in (select jobid from cron.job where jobname = 'email-reminders-processor')
   order by start_time desc limit 10;

7. Pour désactiver si nécessaire :
   select deactivate_email_reminders_cron();

NOTES IMPORTANTES :
- Le job s'exécute toutes les 4 heures à 30 minutes (décalé des subscriptions)
- Réutilise l'infrastructure cron existante (Vault, secrets, monitoring)
- S'intègre parfaitement avec l'architecture Supabase-centric
- Les logs sont centralisés dans cron.job_run_details
*/

-- ====================================================================================================
-- VÉRIFICATIONS FINALES
-- ====================================================================================================

DO $$
DECLARE
    function_count INTEGER;
BEGIN
    -- Vérifier les fonctions
    SELECT COUNT(*) INTO function_count
    FROM information_schema.routines
    WHERE routine_name IN (
        'activate_email_reminders_cron',
        'deactivate_email_reminders_cron',
        'check_email_reminders_job_status',
        'trigger_email_reminders_manually',
        'get_email_reminders_dashboard_stats'
    )
    AND routine_schema = 'public';

    IF function_count >= 5 THEN
        RAISE NOTICE '✅ Job cron des relances configuré avec succès';
        RAISE NOTICE '📊 % fonctions créées pour la gestion et monitoring', function_count;
        RAISE NOTICE '⏰ Fréquence: Toutes les 4 heures à 30 minutes';
        RAISE NOTICE '🔗 Réutilise l''infrastructure cron existante (Vault, secrets)';
        RAISE NOTICE '🚀 Prêt pour activation : select activate_email_reminders_cron();';
    ELSE
        RAISE WARNING '⚠️ Installation incomplète - Fonctions: %/5', function_count;
    END IF;
END $$;

-- ====================================================================================================
-- END OF MIGRATION 028 - EMAIL REMINDERS CRON JOB
-- ====================================================================================================