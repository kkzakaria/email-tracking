-- ====================================================================================================
-- MIGRATION 014: Job cron pour les relances automatiques - MODE TEST
-- ====================================================================================================
-- Description: Extension du système cron pour ajouter le job de relances automatiques
-- Date: 2025-01-12
-- Mode: Désactivé par défaut pour tests manuels d'abord
-- ====================================================================================================

-- ====================================================================================================
-- JOB CRON POUR RELANCES AUTOMATIQUES (DÉSACTIVÉ PAR DÉFAUT)
-- ====================================================================================================

-- Planifier la vérification des relances automatiques
-- Fréquence: Toutes les 4 heures comme demandé (même que les subscriptions)
-- Status: DÉSACTIVÉ par défaut pour permettre tests manuels d'abord

/*
-- ATTENTION: Ce job est commenté pour démarrage en mode test manuel
-- Pour l'activer après validation des tests, décommenter le bloc suivant:

select cron.schedule(
    'email-reminder-check',
    '15 *\/4 * * *', -- Toutes les 4 heures à 15 minutes (décalé des subscriptions)
    $body$
    select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') 
               || '/functions/v1/reminder-manager',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
        ),
        body := jsonb_build_object(
            'action', 'check',
            'source', 'cron_reminder_check',
            'test_mode', true,
            'dry_run', false,
            'timestamp', now()::text
        ),
        timeout_milliseconds := 45000 -- 45 secondes de timeout
    ) as request_id;
    $body$
);
*/

-- ====================================================================================================
-- JOB CRON POUR ENVOI DES RELANCES DUES (DÉSACTIVÉ PAR DÉFAUT)
-- ====================================================================================================

-- Planifier l'envoi des relances dues (séparé du check pour plus de contrôle)
-- Fréquence: Toutes les heures durant les heures de travail
-- Status: DÉSACTIVÉ par défaut pour permettre tests manuels d'abord

/*
-- ATTENTION: Ce job est commenté pour démarrage en mode test manuel
-- Pour l'activer après validation des tests, décommenter le bloc suivant:

select cron.schedule(
    'email-reminder-send',
    '30 8-18 * * 1-5', -- Toutes les heures de 8h à 18h, lundi à vendredi
    $body$
    select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') 
               || '/functions/v1/reminder-manager',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
        ),
        body := jsonb_build_object(
            'action', 'send',
            'source', 'cron_reminder_send',
            'test_mode', true,
            'dry_run', false,
            'timestamp', now()::text
        ),
        timeout_milliseconds := 60000 -- 60 secondes de timeout pour les envois
    ) as request_id;
    $body$
);
*/

-- ====================================================================================================
-- FONCTION POUR ACTIVER/DÉSACTIVER LES JOBS DE RELANCES
-- ====================================================================================================

-- Fonction utilitaire pour activer les jobs de relances après validation des tests
CREATE OR REPLACE FUNCTION activate_reminder_cron_jobs()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    -- Activer le job de vérification des relances
    PERFORM cron.schedule(
        'email-reminder-check',
        '15 *\/4 * * *', -- Toutes les 4 heures à 15 minutes
        $body$
        select net.http_post(
            url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') 
                   || '/functions/v1/reminder-manager',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
            ),
            body := jsonb_build_object(
                'action', 'check',
                'source', 'cron_reminder_check',
                'test_mode', false,
                'dry_run', false,
                'timestamp', now()::text
            ),
            timeout_milliseconds := 45000
        ) as request_id;
        $body$
    );

    -- Activer le job d'envoi des relances
    PERFORM cron.schedule(
        'email-reminder-send',
        '30 8-18 * * 1-5', -- Heures de bureau
        $body$
        select net.http_post(
            url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') 
                   || '/functions/v1/reminder-manager',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
            ),
            body := jsonb_build_object(
                'action', 'send',
                'source', 'cron_reminder_send',
                'test_mode', false,
                'dry_run', false,
                'timestamp', now()::text
            ),
            timeout_milliseconds := 60000
        ) as request_id;
        $body$
    );

    RETURN 'Jobs de relances activés avec succès';
END;
$$;

-- Fonction pour désactiver les jobs de relances
CREATE OR REPLACE FUNCTION deactivate_reminder_cron_jobs()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    -- Désactiver les jobs de relances
    PERFORM cron.unschedule('email-reminder-check');
    PERFORM cron.unschedule('email-reminder-send');

    RETURN 'Jobs de relances désactivés avec succès';
END;
$$;

-- ====================================================================================================
-- FONCTION DE MONITORING DES JOBS DE RELANCES
-- ====================================================================================================

-- Fonction pour vérifier le statut des jobs de relances
CREATE OR REPLACE FUNCTION check_reminder_jobs_status()
RETURNS TABLE(
    job_name text,
    schedule text,
    active boolean,
    last_run timestamp with time zone,
    last_status text,
    next_run timestamp with time zone
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
            WHEN jr.return_message IS NULL THEN 'SUCCESS'
            WHEN jr.return_message = '' THEN 'SUCCESS' 
            ELSE 'ERROR: ' || jr.return_message
        END as last_status,
        -- Estimation du prochain run
        CASE 
            WHEN j.jobname = 'email-reminder-check' THEN
                jr.start_time + interval '4 hours'
            WHEN j.jobname = 'email-reminder-send' THEN
                jr.start_time + interval '1 hour'
            ELSE NULL
        END as next_run
    FROM cron.job j
    LEFT JOIN LATERAL (
        SELECT start_time, return_message
        FROM cron.job_run_details jrd 
        WHERE jrd.jobid = j.jobid 
        ORDER BY start_time DESC 
        LIMIT 1
    ) jr ON true
    WHERE j.jobname IN ('email-reminder-check', 'email-reminder-send')
    ORDER BY j.jobname;
$$;

-- ====================================================================================================
-- CONFIGURATION DES SECRETS REQUIS POUR LES RELANCES
-- ====================================================================================================

-- Note: Le secret service_role_key doit être ajouté au Vault pour les jobs de relances
-- Contrairement aux subscriptions qui utilisent anon_key, les relances nécessitent plus de permissions

-- Script à exécuter manuellement après déploiement :
-- select vault.create_secret('your_service_role_key_here', 'service_role_key');

-- ====================================================================================================
-- INSTRUCTIONS D'ACTIVATION
-- ====================================================================================================

/*
INSTRUCTIONS POUR ACTIVER LE SYSTÈME DE RELANCES :

1. Tests manuels d'abord :
   - Tester la Edge Function reminder-manager avec des emails spécifiques
   - Valider le mode dry_run
   - Vérifier les heures de travail
   - Confirmer l'envoi via Microsoft Graph API

2. Configuration des secrets :
   select vault.create_secret('your_service_role_key', 'service_role_key');

3. Activation des jobs après validation :
   select activate_reminder_cron_jobs();

4. Monitoring :
   select * from check_reminder_jobs_status();

5. Pour désactiver si nécessaire :
   select deactivate_reminder_cron_jobs();

6. Historique des exécutions :
   select * from cron.job_run_details 
   where jobid in (select jobid from cron.job where jobname like 'email-reminder%')
   order by start_time desc limit 20;
*/

-- ====================================================================================================
-- GRANTS: Permissions pour les fonctions utilitaires
-- ====================================================================================================

-- Grant permissions pour le service role
GRANT EXECUTE ON FUNCTION activate_reminder_cron_jobs TO service_role;
GRANT EXECUTE ON FUNCTION deactivate_reminder_cron_jobs TO service_role;
GRANT EXECUTE ON FUNCTION check_reminder_jobs_status TO service_role;

-- Grant permissions pour authenticated users (pour monitoring)
GRANT EXECUTE ON FUNCTION check_reminder_jobs_status TO authenticated;

-- ====================================================================================================
-- COMMENTAIRES ET DOCUMENTATION
-- ====================================================================================================

COMMENT ON FUNCTION activate_reminder_cron_jobs IS 'Active les jobs cron pour les relances automatiques après validation des tests';
COMMENT ON FUNCTION deactivate_reminder_cron_jobs IS 'Désactive les jobs cron de relances';
COMMENT ON FUNCTION check_reminder_jobs_status IS 'Vérifie le statut des jobs de relances automatiques';

-- ====================================================================================================
-- END OF MIGRATION 014 - REMINDER CRON JOBS (TEST MODE)
-- ====================================================================================================