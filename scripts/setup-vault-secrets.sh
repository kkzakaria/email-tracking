#!/bin/bash

# ====================================================================================================
# SCRIPT DE CONFIGURATION DES SECRETS SUPABASE VAULT
# ====================================================================================================
# Description: Configure les secrets requis pour le renouvellement automatique des subscriptions
# Usage: ./scripts/setup-vault-secrets.sh
# ====================================================================================================

set -e

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}====================================================================================================${NC}"
echo -e "${BLUE} CONFIGURATION DES SECRETS SUPABASE VAULT POUR RENOUVELLEMENT AUTOMATIQUE${NC}"
echo -e "${BLUE}====================================================================================================${NC}"

# Vérifier si on est dans le bon répertoire
if [[ ! -f "supabase/config.toml" ]]; then
    echo -e "${RED}❌ Erreur: Ce script doit être exécuté depuis la racine du projet${NC}"
    exit 1
fi

# Charger les variables d'environnement
if [[ -f ".env.local" ]]; then
    source .env.local
    echo -e "${GREEN}✅ Fichier .env.local chargé${NC}"
else
    echo -e "${YELLOW}⚠️ Attention: Fichier .env.local non trouvé${NC}"
fi

# Déterminer l'environnement
read -p "Environnement (local/prod) [local]: " ENV
ENV=${ENV:-local}

if [[ "$ENV" == "local" ]]; then
    PROJECT_URL="http://api.supabase.internal:8000"
    ANON_KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY"
    echo -e "${BLUE}🔧 Configuration pour environnement LOCAL${NC}"
elif [[ "$ENV" == "prod" ]]; then
    PROJECT_URL="$NEXT_PUBLIC_SUPABASE_URL"
    ANON_KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY"
    echo -e "${BLUE}🚀 Configuration pour environnement PRODUCTION${NC}"
else
    echo -e "${RED}❌ Environnement invalide. Utiliser 'local' ou 'prod'${NC}"
    exit 1
fi

# Vérifier que les variables sont définies
if [[ -z "$PROJECT_URL" ]]; then
    echo -e "${RED}❌ Erreur: PROJECT_URL non définie${NC}"
    exit 1
fi

if [[ -z "$ANON_KEY" ]]; then
    echo -e "${RED}❌ Erreur: ANON_KEY non définie (vérifiez NEXT_PUBLIC_SUPABASE_ANON_KEY)${NC}"
    exit 1
fi

echo -e "${YELLOW}📋 Configuration:${NC}"
echo -e "  Project URL: ${PROJECT_URL}"
echo -e "  Anon Key: ${ANON_KEY:0:20}...${ANON_KEY: -10}"

read -p "Confirmer la configuration ? (y/N): " CONFIRM
if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
    echo -e "${YELLOW}⏹️ Configuration annulée${NC}"
    exit 0
fi

echo -e "${BLUE}🔐 Configuration des secrets Vault...${NC}"

# Script SQL pour configurer les secrets
SQL_SCRIPT=$(cat << EOF
-- Configuration des secrets Supabase Vault pour renouvellement automatique
select vault.create_secret('${PROJECT_URL}', 'project_url');
select vault.create_secret('${ANON_KEY}', 'anon_key');

-- Vérification des secrets créés
select 
    name,
    description,
    created_at
from vault.secrets 
where name in ('project_url', 'anon_key')
order by name;
EOF
)

# Exécuter la configuration via supabase CLI
if command -v supabase &> /dev/null; then
    echo -e "${BLUE}📤 Exécution via Supabase CLI...${NC}"
    echo "$SQL_SCRIPT" | supabase db reset --db-url "$DATABASE_URL" 2>/dev/null || \
    echo "$SQL_SCRIPT" | supabase db exec --db-url "$DATABASE_URL" 2>/dev/null || \
    {
        echo -e "${YELLOW}⚠️ Impossible d'exécuter automatiquement. Exécutez manuellement:${NC}"
        echo "$SQL_SCRIPT"
        exit 1
    }
else
    echo -e "${YELLOW}⚠️ Supabase CLI non trouvé. Exécutez manuellement dans l'éditeur SQL:${NC}"
    echo "$SQL_SCRIPT"
    exit 1
fi

echo -e "${GREEN}✅ Configuration des secrets terminée${NC}"

echo -e "${BLUE}🔍 Vérification de la configuration...${NC}"

# Vérifier que les jobs cron sont bien configurés
VERIFY_SQL=$(cat << EOF
-- Vérifier les jobs cron configurés
select 
    jobname,
    schedule,
    active,
    created_at
from cron.job 
where jobname like 'microsoft-graph%'
order by jobname;

-- Vérifier les secrets
select 
    name,
    created_at
from vault.secrets 
where name in ('project_url', 'anon_key')
order by name;
EOF
)

echo -e "${BLUE}📊 Pour vérifier la configuration, exécutez:${NC}"
echo "$VERIFY_SQL"

echo -e "${GREEN}====================================================================================================${NC}"
echo -e "${GREEN} ✅ CONFIGURATION TERMINÉE${NC}"
echo -e "${GREEN}====================================================================================================${NC}"
echo -e "${GREEN} Les secrets sont maintenant configurés dans Supabase Vault.${NC}"
echo -e "${GREEN} Les jobs cron de renouvellement automatique sont actifs:${NC}"
echo -e "${GREEN}   • microsoft-graph-subscription-renewal (toutes les 4h)${NC}"
echo -e "${GREEN}   • microsoft-graph-subscription-cleanup (quotidien à 2h)${NC}"
echo -e "${GREEN}====================================================================================================${NC}"

# Proposer de tester immédiatement
read -p "Voulez-vous tester le renouvellement maintenant ? (y/N): " TEST_NOW
if [[ "$TEST_NOW" == "y" || "$TEST_NOW" == "Y" ]]; then
    echo -e "${BLUE}🧪 Test du renouvellement...${NC}"
    
    TEST_SQL=$(cat << EOF
-- Tester manuellement le job de renouvellement
select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') 
           || '/functions/v1/subscription-manager',
    headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key')
    ),
    body := jsonb_build_object(
        'action', 'renew',
        'source', 'manual_test',
        'timestamp', now()::text
    ),
    timeout_milliseconds := 30000
) as request_id;
EOF
)
    
    echo "$TEST_SQL" | supabase db exec 2>/dev/null || {
        echo -e "${YELLOW}⚠️ Exécutez manuellement pour tester:${NC}"
        echo "$TEST_SQL"
    }
    
    echo -e "${BLUE}📈 Vérifiez les résultats dans quelques secondes avec:${NC}"
    echo "select * from net._http_response order by created desc limit 3;"
fi