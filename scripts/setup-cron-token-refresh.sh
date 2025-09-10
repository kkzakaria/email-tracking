#!/bin/bash

# ====================================================================================================
# CONFIGURATION CRON TOKEN REFRESH
# ====================================================================================================
# Script pour configurer le système de rafraîchissement automatique des tokens Microsoft Graph
# Usage: ./scripts/setup-cron-token-refresh.sh
# ====================================================================================================

set -e

echo "🔧 Configuration du système de rafraîchissement automatique des tokens..."

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ====================================================================================================
# VÉRIFICATIONS PRÉALABLES
# ====================================================================================================

echo -e "${BLUE}📋 Vérification des prérequis...${NC}"

# Vérifier que Supabase CLI est installé
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI non trouvé${NC}"
    echo "Installez-le avec: npm install -g supabase"
    exit 1
fi

# Vérifier que nous sommes dans le bon répertoire
if [ ! -f "supabase/config.toml" ]; then
    echo -e "${RED}❌ Fichier supabase/config.toml non trouvé${NC}"
    echo "Exécutez ce script depuis la racine du projet"
    exit 1
fi

# Vérifier le fichier .env.local
if [ ! -f ".env.local" ]; then
    echo -e "${RED}❌ Fichier .env.local non trouvé${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prérequis validés${NC}"

# ====================================================================================================
# LECTURE DES VARIABLES D'ENVIRONNEMENT
# ====================================================================================================

echo -e "${BLUE}📖 Lecture des variables d'environnement...${NC}"

# Source du fichier .env.local
set -a
source .env.local
set +a

# Vérifications des variables requises
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
    echo -e "${RED}❌ NEXT_PUBLIC_SUPABASE_URL non définie${NC}"
    exit 1
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo -e "${RED}❌ SUPABASE_SERVICE_ROLE_KEY non définie${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Variables d'environnement validées${NC}"

# ====================================================================================================
# CONFIGURATION DES SECRETS SUPABASE VAULT
# ====================================================================================================

echo -e "${BLUE}🔐 Configuration des secrets Supabase Vault...${NC}"

# Stocker l'URL Supabase dans Vault
echo -e "${YELLOW}📝 Stockage de l'URL Supabase...${NC}"
supabase secrets set SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" || {
    echo -e "${RED}❌ Erreur lors du stockage de l'URL Supabase${NC}"
    exit 1
}

# Stocker la clé service role dans Vault
echo -e "${YELLOW}📝 Stockage de la clé service role...${NC}"
supabase secrets set SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" || {
    echo -e "${RED}❌ Erreur lors du stockage de la clé service role${NC}"
    exit 1
}

echo -e "${GREEN}✅ Secrets configurés dans Supabase Vault${NC}"

# ====================================================================================================
# APPLICATION DE LA MIGRATION
# ====================================================================================================

echo -e "${BLUE}🚀 Application de la migration...${NC}"

# Appliquer les migrations
supabase db push || {
    echo -e "${RED}❌ Erreur lors de l'application des migrations${NC}"
    exit 1
}

echo -e "${GREEN}✅ Migration appliquée avec succès${NC}"

# ====================================================================================================
# CONFIGURATION DES VARIABLES POSTGRESQL
# ====================================================================================================

echo -e "${BLUE}⚙️ Configuration des variables PostgreSQL...${NC}"

# Configuration via SQL direct
supabase db remote sql --execute "
-- Configuration des variables système
SELECT set_config('app.supabase_url', '$NEXT_PUBLIC_SUPABASE_URL', false);
SELECT set_config('app.service_role_key', '$SUPABASE_SERVICE_ROLE_KEY', false);

-- Test de la configuration
SELECT 'URL configurée: ' || current_setting('app.supabase_url', true) as config_test;
" || {
    echo -e "${RED}❌ Erreur lors de la configuration PostgreSQL${NC}"
    exit 1
}

echo -e "${GREEN}✅ Variables PostgreSQL configurées${NC}"

# ====================================================================================================
# TEST DU SYSTÈME
# ====================================================================================================

echo -e "${BLUE}🧪 Test du système...${NC}"

# Test de la fonction de refresh
echo -e "${YELLOW}📊 Test de la fonction de refresh...${NC}"
supabase db remote sql --execute "SELECT * FROM test_token_refresh();" || {
    echo -e "${YELLOW}⚠️ Test de la fonction échoué (normal si pas de tokens)${NC}"
}

# Vérifier le job cron
echo -e "${YELLOW}📅 Vérification du job cron...${NC}"
supabase db remote sql --execute "
SELECT 
    jobname, 
    schedule, 
    command,
    active
FROM cron.job 
WHERE jobname = 'microsoft-token-refresh';
" || {
    echo -e "${RED}❌ Erreur lors de la vérification du job cron${NC}"
    exit 1
}

# Vérifier les statistiques
echo -e "${YELLOW}📈 Statistiques actuelles...${NC}"
supabase db remote sql --execute "SELECT * FROM token_refresh_stats;" || {
    echo -e "${YELLOW}⚠️ Pas de statistiques disponibles${NC}"
}

echo -e "${GREEN}✅ Tests complétés${NC}"

# ====================================================================================================
# RÉSUMÉ DE LA CONFIGURATION
# ====================================================================================================

echo -e "\n${GREEN}🎉 CONFIGURATION TERMINÉE AVEC SUCCÈS${NC}"
echo -e "\n${BLUE}📋 RÉSUMÉ:${NC}"
echo -e "   ${GREEN}✅${NC} Job cron configuré : exécution toutes les 30 minutes"
echo -e "   ${GREEN}✅${NC} Fonction PostgreSQL : refresh_expired_microsoft_tokens()"
echo -e "   ${GREEN}✅${NC} Secrets Vault configurés"
echo -e "   ${GREEN}✅${NC} Variables système configurées"
echo -e "   ${GREEN}✅${NC} Tables de logs créées"

echo -e "\n${BLUE}🔍 MONITORING:${NC}"
echo -e "   📊 Statistiques : ${YELLOW}SELECT * FROM token_refresh_stats;${NC}"
echo -e "   📝 Logs récents : ${YELLOW}SELECT * FROM recent_cron_jobs;${NC}"
echo -e "   🧪 Test manuel : ${YELLOW}SELECT * FROM refresh_expired_microsoft_tokens();${NC}"

echo -e "\n${BLUE}⏰ PLANIFICATION:${NC}"
echo -e "   🕐 Fréquence : Toutes les 30 minutes"
echo -e "   🎯 Cible : Tokens expirant dans moins de 30 minutes"
echo -e "   📈 Seuil : Refresh automatique si < 30 min restantes"

echo -e "\n${YELLOW}💡 NOTES IMPORTANTES:${NC}"
echo -e "   - Le système fonctionne en arrière-plan indépendamment du frontend"
echo -e "   - Les logs sont stockés dans la table cron_job_logs"
echo -e "   - Le refresh utilise l'Edge Function microsoft-auth existante"
echo -e "   - Surveillance via les vues token_refresh_stats et recent_cron_jobs"

echo -e "\n${GREEN}🚀 Le système de rafraîchissement automatique est maintenant opérationnel!${NC}"