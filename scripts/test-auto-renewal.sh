#!/bin/bash

# ====================================================================================================
# SCRIPT DE TEST DU RENOUVELLEMENT AUTOMATIQUE
# ====================================================================================================
# Description: Teste le système de renouvellement automatique des subscriptions
# Usage: ./scripts/test-auto-renewal.sh
# ====================================================================================================

set -e

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}====================================================================================================${NC}"
echo -e "${BLUE} TEST DU SYSTÈME DE RENOUVELLEMENT AUTOMATIQUE${NC}"
echo -e "${BLUE}====================================================================================================${NC}"

# Vérifier si on est dans le bon répertoire
if [[ ! -f "supabase/config.toml" ]]; then
    echo -e "${RED}❌ Erreur: Ce script doit être exécuté depuis la racine du projet${NC}"
    exit 1
fi

echo -e "${BLUE}🔍 1. Vérification de la configuration...${NC}"

# Vérifier que la migration a été appliquée
echo -e "${YELLOW}📋 Vérification des migrations...${NC}"
MIGRATION_CHECK=$(cat << 'EOF'
select 
    version,
    name,
    executed_at
from supabase_migrations.schema_migrations 
where version like '009%' or name like '%cron%'
order by version desc;
EOF
)

echo "Exécutez cette requête pour vérifier les migrations:"
echo "$MIGRATION_CHECK"
echo ""

# Vérifier les extensions
echo -e "${BLUE}🧩 2. Vérification des extensions...${NC}"
EXTENSION_CHECK=$(cat << 'EOF'
select 
    extname,
    extversion,
    extnamespace::regnamespace as schema
from pg_extension 
where extname in ('pg_cron', 'pg_net', 'pgcrypto')
order by extname;
EOF
)

echo "Vérification des extensions requises:"
echo "$EXTENSION_CHECK"
echo ""

# Vérifier les secrets Vault
echo -e "${BLUE}🔐 3. Vérification des secrets Vault...${NC}"
VAULT_CHECK=$(cat << 'EOF'
select 
    name,
    description,
    created_at,
    case when name = 'project_url' then 
        left(decrypted_secret, 30) || '...'
    else 
        left(decrypted_secret, 10) || '...' || right(decrypted_secret, 10)
    end as secret_preview
from vault.decrypted_secrets 
where name in ('project_url', 'anon_key')
order by name;
EOF
)

echo "Vérification des secrets (aperçu sécurisé):"
echo "$VAULT_CHECK"
echo ""

# Vérifier les jobs cron
echo -e "${BLUE}⏰ 4. Vérification des jobs cron...${NC}"
CRON_JOBS_CHECK=$(cat << 'EOF'
select 
    jobid,
    jobname,
    schedule,
    active,
    created_at
from cron.job 
where jobname like 'microsoft-graph%'
order by jobname;
EOF
)

echo "État des jobs cron:"
echo "$CRON_JOBS_CHECK"
echo ""

# Vérifier l'historique des jobs
echo -e "${BLUE}📊 5. Historique récent des jobs...${NC}"
CRON_HISTORY_CHECK=$(cat << 'EOF'
select 
    j.jobname,
    jr.start_time,
    jr.end_time,
    jr.return_message,
    case 
        when jr.return_message is null or jr.return_message = '' then 'SUCCESS'
        else 'ERROR'
    end as status
from cron.job_run_details jr
join cron.job j on j.jobid = jr.jobid
where j.jobname like 'microsoft-graph%'
order by jr.start_time desc
limit 10;
EOF
)

echo "Historique des exécutions:"
echo "$CRON_HISTORY_CHECK"
echo ""

# Test manuel du renouvellement
echo -e "${BLUE}🧪 6. Test manuel du renouvellement...${NC}"
MANUAL_TEST=$(cat << 'EOF'
-- Test manuel du renouvellement (simule l'exécution du cron)
select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') 
           || '/functions/v1/subscription-manager',
    headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key')
    ),
    body := jsonb_build_object(
        'action', 'renew',
        'source', 'manual_test_script',
        'timestamp', now()::text
    ),
    timeout_milliseconds := 30000
) as request_id;
EOF
)

echo "Test manuel - exécutez cette requête pour tester le renouvellement:"
echo "$MANUAL_TEST"
echo ""

# Vérifier les réponses HTTP
echo -e "${BLUE}🌐 7. Vérification des réponses HTTP...${NC}"
HTTP_RESPONSES_CHECK=$(cat << 'EOF'
-- Vérifier les réponses HTTP récentes
select 
    id,
    status_code,
    headers->>'x-completed-jobs' as completed_jobs,
    headers->>'x-failed-jobs' as failed_jobs,
    content,
    error_msg,
    created
from net._http_response 
order by created desc 
limit 5;
EOF
)

echo "Historique des réponses HTTP:"
echo "$HTTP_RESPONSES_CHECK"
echo ""

# Fonction utilitaire de monitoring
echo -e "${BLUE}📈 8. Fonction de monitoring...${NC}"
MONITORING_FUNCTION=$(cat << 'EOF'
-- Utiliser la fonction de monitoring créée dans la migration
select * from check_renewal_job_status();
EOF
)

echo "État complet des jobs (fonction utilitaire):"
echo "$MONITORING_FUNCTION"
echo ""

# Instructions de dépannage
echo -e "${BLUE}🔧 9. Instructions de dépannage...${NC}"
echo -e "${YELLOW}Si les jobs ne fonctionnent pas:${NC}"

TROUBLESHOOTING=$(cat << 'EOF'
-- 1. Vérifier que les secrets sont bien configurés
select count(*) as secrets_count 
from vault.secrets 
where name in ('project_url', 'anon_key');
-- Doit retourner 2

-- 2. Vérifier que les jobs sont actifs
select jobname, active 
from cron.job 
where jobname like 'microsoft-graph%';
-- active doit être true

-- 3. Réactiver un job si nécessaire
select cron.alter_job(
    job_id := (select jobid from cron.job where jobname = 'microsoft-graph-subscription-renewal'),
    active := true
);

-- 4. Exécuter manuellement un job pour test
select cron.run_job((select jobid from cron.job where jobname = 'microsoft-graph-subscription-renewal'));

-- 5. Voir les erreurs détaillées
select 
    j.jobname,
    jr.start_time,
    jr.return_message,
    jr.end_time - jr.start_time as duration
from cron.job_run_details jr
join cron.job j on j.jobid = jr.jobid
where j.jobname like 'microsoft-graph%' 
    and (jr.return_message is not null and jr.return_message != '')
order by jr.start_time desc;
EOF
)

echo "$TROUBLESHOOTING"
echo ""

echo -e "${GREEN}====================================================================================================${NC}"
echo -e "${GREEN} ✅ GUIDE DE TEST TERMINÉ${NC}"
echo -e "${GREEN}====================================================================================================${NC}"
echo -e "${GREEN} Exécutez les requêtes SQL ci-dessus dans l'éditeur Supabase pour tester votre configuration.${NC}"
echo -e "${GREEN}====================================================================================================${NC}"

# Proposer d'appliquer la migration
read -p "Voulez-vous appliquer la migration maintenant ? (y/N): " APPLY_MIGRATION
if [[ "$APPLY_MIGRATION" == "y" || "$APPLY_MIGRATION" == "Y" ]]; then
    echo -e "${BLUE}📤 Application de la migration...${NC}"
    
    if command -v supabase &> /dev/null; then
        supabase db push || {
            echo -e "${YELLOW}⚠️ Erreur lors de l'application. Appliquez manuellement avec:${NC}"
            echo "supabase db push"
        }
    else
        echo -e "${YELLOW}⚠️ Supabase CLI non trouvé. Appliquez manuellement avec:${NC}"
        echo "supabase db push"
    fi
fi

echo -e "${BLUE}📚 Prochaines étapes:${NC}"
echo "1. Appliquer la migration: supabase db push"
echo "2. Configurer les secrets: ./scripts/setup-vault-secrets.sh"
echo "3. Tester avec les requêtes SQL fournies ci-dessus"
echo "4. Surveiller les logs dans le dashboard Supabase"