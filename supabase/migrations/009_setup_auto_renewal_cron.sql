-- ====================================================================================================
-- MIGRATION 009: Configuration du renouvellement automatique des subscriptions Microsoft Graph
-- ====================================================================================================
-- Description: Configure pg_cron + pg_net pour renouveler automatiquement les subscriptions
-- Date: 2025-01-10
-- ====================================================================================================

-- Activer les extensions requises
create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists pgcrypto; -- Si pas déjà activé

-- ====================================================================================================
-- CONFIGURATION DES SECRETS SUPABASE VAULT
-- ====================================================================================================

-- Stocker l'URL du projet (à adapter selon environnement)
-- Note: Cette valeur sera définie via un script de déploiement ou manuellement
-- Exemple pour dev local: 'http://api.supabase.internal:8000'
-- Exemple pour prod: 'https://votre-project-id.supabase.co'

-- Les secrets seront configurés via script de déploiement ou manuellement :
-- select vault.create_secret('https://your-project-id.supabase.co', 'project_url');
-- select vault.create_secret('your_supabase_anon_key', 'anon_key');

-- ====================================================================================================
-- JOB CRON POUR RENOUVELLEMENT AUTOMATIQUE DES SUBSCRIPTIONS
-- ====================================================================================================

-- Planifier le renouvellement automatique des subscriptions Microsoft Graph
-- Fréquence: Toutes les 4 heures (optimal pour subscriptions de 71 heures)
select cron.schedule(
    'microsoft-graph-subscription-renewal',
    '0 */4 * * *', -- Toutes les 4 heures à la minute 0
    $$
    select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') 
               || '/functions/v1/subscription-manager',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key')
        ),
        body := jsonb_build_object(
            'action', 'renew',
            'source', 'cron_auto_renewal',
            'timestamp', now()::text
        ),
        timeout_milliseconds := 30000 -- 30 secondes de timeout
    ) as request_id;
    $$
);

-- ====================================================================================================
-- JOB CRON POUR NETTOYAGE AUTOMATIQUE (OPTIONNEL)
-- ====================================================================================================

-- Planifier le nettoyage des subscriptions expirées
-- Fréquence: Une fois par jour à 2h du matin
select cron.schedule(
    'microsoft-graph-subscription-cleanup',
    '0 2 * * *', -- Tous les jours à 2h du matin
    $$
    select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') 
               || '/functions/v1/subscription-manager',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key')
        ),
        body := jsonb_build_object(
            'action', 'cleanup',
            'source', 'cron_auto_cleanup',
            'timestamp', now()::text
        ),
        timeout_milliseconds := 30000 -- 30 secondes de timeout
    ) as request_id;
    $$
);

-- ====================================================================================================
-- FONCTION UTILITAIRE POUR MONITORING DES JOBS CRON
-- ====================================================================================================

-- Fonction pour vérifier le statut des jobs de renouvellement
create or replace function check_renewal_job_status()
returns table(
    job_name text,
    schedule text,
    active boolean,
    last_run timestamp with time zone,
    last_status text,
    next_run timestamp with time zone
)
language sql
security definer
as $$
    select 
        j.jobname,
        j.schedule,
        j.active,
        jr.start_time,
        case 
            when jr.return_message is null then 'SUCCESS'
            when jr.return_message = '' then 'SUCCESS' 
            else 'ERROR: ' || jr.return_message
        end as last_status,
        -- Estimation du prochain run (approximatif)
        case 
            when j.jobname = 'microsoft-graph-subscription-renewal' then
                jr.start_time + interval '4 hours'
            when j.jobname = 'microsoft-graph-subscription-cleanup' then
                jr.start_time + interval '1 day'
            else null
        end as next_run
    from cron.job j
    left join lateral (
        select start_time, return_message
        from cron.job_run_details jrd 
        where jrd.jobid = j.jobid 
        order by start_time desc 
        limit 1
    ) jr on true
    where j.jobname in ('microsoft-graph-subscription-renewal', 'microsoft-graph-subscription-cleanup')
    order by j.jobname;
$$;

-- ====================================================================================================
-- COMMENTAIRES ET INSTRUCTIONS
-- ====================================================================================================

-- Pour configurer les secrets après déploiement :
-- 1. Environnement local :
--    select vault.create_secret('http://api.supabase.internal:8000', 'project_url');
--    select vault.create_secret('your_local_anon_key', 'anon_key');
--
-- 2. Environnement de production :
--    select vault.create_secret('https://your-project-id.supabase.co', 'project_url');
--    select vault.create_secret('your_prod_anon_key', 'anon_key');

-- Pour surveiller les jobs :
-- select * from check_renewal_job_status();

-- Pour voir l'historique détaillé :
-- select * from cron.job_run_details 
-- where jobid in (select jobid from cron.job where jobname like 'microsoft-graph%')
-- order by start_time desc limit 10;

-- Pour voir les réponses HTTP :
-- select * from net._http_response 
-- order by created desc limit 10;

-- Pour désactiver temporairement un job :
-- select cron.alter_job(
--     job_id := (select jobid from cron.job where jobname = 'microsoft-graph-subscription-renewal'),
--     active := false
-- );

-- Pour supprimer complètement un job :
-- select cron.unschedule('microsoft-graph-subscription-renewal');