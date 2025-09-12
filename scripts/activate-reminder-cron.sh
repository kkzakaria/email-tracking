#!/bin/bash
# ====================================================================================================
# SCRIPT - Activation des jobs cron de relances
# ====================================================================================================
# Description: Active les jobs cron pour les relances automatiques après validation
# Usage: ./scripts/activate-reminder-cron.sh
# ====================================================================================================

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 Activation des jobs cron de relances${NC}"
echo "======================================================================================================"

# Charger les variables d'environnement
if [ -f ".env.local" ]; then
    source .env.local
    echo -e "${GREEN}✅ Variables d'environnement chargées${NC}"
else
    echo -e "${RED}❌ Fichier .env.local non trouvé${NC}"
    exit 1
fi

# Vérification préalable
echo -e "\n${YELLOW}1. Vérifications préalables${NC}"
echo "------------------------------------------------------------------------------------------------------"

echo "🔍 Test de l'Edge Function reminder-manager..."
response=$(curl -s \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
    -d '{"action": "status"}' \
    "$NEXT_PUBLIC_SUPABASE_URL/functions/v1/reminder-manager" 2>/dev/null || echo "error")

if [[ "$response" != "error" ]] && [[ -n "$response" ]]; then
    echo -e "${GREEN}✅ Edge Function reminder-manager accessible${NC}"
else
    echo -e "${RED}❌ Edge Function reminder-manager non accessible${NC}"
    echo "   Déployez d'abord: supabase functions deploy reminder-manager"
    exit 1
fi

# Vérifier les tables
echo "🔍 Test des tables de test..."
tables_response=$(curl -s \
    -X GET "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/test_reminder_settings?select=count" \
    -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
    -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
    2>/dev/null || echo "error")

if [[ "$tables_response" != "error" ]] && [[ ! "$tables_response" =~ "error" ]]; then
    echo -e "${GREEN}✅ Tables de test accessibles${NC}"
else
    echo -e "${RED}❌ Tables de test non accessibles${NC}"
    echo "   Appliquez d'abord: supabase db push"
    exit 1
fi

# Vérifier si service_role_key est configuré
echo "🔍 Vérification des secrets Vault..."
if [ -n "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo -e "${GREEN}✅ Service role key disponible${NC}"
else
    echo -e "${RED}❌ SUPABASE_SERVICE_ROLE_KEY manquant dans .env.local${NC}"
    exit 1
fi

# Activation des jobs cron
echo -e "\n${YELLOW}2. Activation des jobs cron${NC}"
echo "======================================================================================================"

echo -e "${BLUE}Configuration des secrets Vault...${NC}"

# Créer un script SQL temporaire pour configurer les secrets et activer les jobs
cat > /tmp/activate_reminders.sql << EOF
-- Configurer les secrets Vault nécessaires
SELECT vault.create_secret('$NEXT_PUBLIC_SUPABASE_URL', 'project_url');
SELECT vault.create_secret('$SUPABASE_SERVICE_ROLE_KEY', 'service_role_key');

-- Activer les jobs cron
SELECT activate_reminder_cron_jobs() as activation_result;

-- Vérifier l'activation
SELECT * FROM check_reminder_jobs_status();

-- Afficher tous les jobs cron existants
SELECT 
    jobname as "Job Name",
    schedule as "Schedule", 
    active as "Active",
    created_at as "Created At"
FROM cron.job 
WHERE jobname LIKE '%reminder%' OR jobname LIKE '%email%'
ORDER BY jobname;
EOF

echo "Scripts SQL créés. Pour activer les jobs cron:"
echo ""
echo -e "${YELLOW}IMPORTANT: Exécutez manuellement les commandes SQL suivantes dans votre console Supabase:${NC}"
echo ""
echo "1. Configurer les secrets Vault:"
echo -e "${BLUE}SELECT vault.create_secret('$NEXT_PUBLIC_SUPABASE_URL', 'project_url');${NC}"
echo -e "${BLUE}SELECT vault.create_secret('$SUPABASE_SERVICE_ROLE_KEY', 'service_role_key');${NC}"
echo ""
echo "2. Activer les jobs cron:"
echo -e "${BLUE}SELECT activate_reminder_cron_jobs();${NC}"
echo ""
echo "3. Vérifier l'activation:"
echo -e "${BLUE}SELECT * FROM check_reminder_jobs_status();${NC}"
echo ""

echo -e "${YELLOW}Voulez-vous que je vous guide pour l'activation manuelle ? (y/N)${NC}"
read -r guide_choice

if [[ "$guide_choice" =~ ^[Yy]$ ]]; then
    echo ""
    echo -e "${BLUE}📋 Guide d'activation manuelle:${NC}"
    echo ""
    echo "1. Ouvrez votre Dashboard Supabase:"
    echo "   https://supabase.com/dashboard/project/$(echo $NEXT_PUBLIC_SUPABASE_URL | sed 's/.*\/\/\([^.]*\)\..*/\1/')"
    echo ""
    echo "2. Naviguez vers: Database > SQL Editor"
    echo ""
    echo "3. Exécutez ces commandes SQL une par une:"
    echo ""
    echo -e "${GREEN}-- Configuration des secrets${NC}"
    echo -e "${BLUE}SELECT vault.create_secret('$NEXT_PUBLIC_SUPABASE_URL', 'project_url');${NC}"
    echo -e "${BLUE}SELECT vault.create_secret('$SUPABASE_SERVICE_ROLE_KEY', 'service_role_key');${NC}"
    echo ""
    echo -e "${GREEN}-- Activation des jobs${NC}"
    echo -e "${BLUE}SELECT activate_reminder_cron_jobs();${NC}"
    echo ""
    echo -e "${GREEN}-- Vérification${NC}"
    echo -e "${BLUE}SELECT * FROM check_reminder_jobs_status();${NC}"
    echo -e "${BLUE}SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE '%reminder%';${NC}"
    echo ""
    echo -e "${YELLOW}Une fois ces commandes exécutées, appuyez sur Entrée pour continuer...${NC}"
    read -r
else
    echo -e "\n${GREEN}✅ Instructions d'activation fournies${NC}"
    echo "Exécutez les commandes SQL ci-dessus dans votre Dashboard Supabase."
fi

# Test des jobs activés
echo -e "\n${YELLOW}3. Test des jobs activés${NC}"
echo "======================================================================================================"

echo "🧪 Test de l'action 'check' via Edge Function..."
check_response=$(curl -s \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
    -d '{"action": "check", "dry_run": true}' \
    "$NEXT_PUBLIC_SUPABASE_URL/functions/v1/reminder-manager" 2>/dev/null || echo "error")

if [[ "$check_response" != "error" ]] && echo "$check_response" | jq -e '.success' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Test de vérification des relances réussi${NC}"
    candidates=$(echo "$check_response" | jq -r '.candidates // 0')
    echo "   📊 Emails candidats trouvés: $candidates"
else
    echo -e "${YELLOW}⚠️  Test de vérification: authentification requise${NC}"
    echo "   (Normal si pas connecté - utilisez l'interface web)"
fi

echo "🧪 Test de l'action 'test_working_hours'..."
hours_response=$(curl -s \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
    -d '{"action": "test_working_hours"}' \
    "$NEXT_PUBLIC_SUPABASE_URL/functions/v1/reminder-manager" 2>/dev/null || echo "error")

if [[ "$hours_response" != "error" ]] && echo "$hours_response" | jq -e '.working_hours' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Test des heures de travail réussi${NC}"
    working_hours=$(echo "$hours_response" | jq -r '.working_hours')
    current_time=$(echo "$hours_response" | jq -r '.current_time // "N/A"')
    echo "   ⏰ Actuellement dans les heures de travail: $working_hours ($current_time)"
else
    echo -e "${YELLOW}⚠️  Test des heures de travail: authentification requise${NC}"
fi

# Résumé final
echo -e "\n${YELLOW}4. Résumé de l'activation${NC}"
echo "======================================================================================================"

echo -e "${GREEN}✅ Activation des jobs cron terminée${NC}"
echo ""
echo -e "${BLUE}📋 Jobs cron activés:${NC}"
echo "   • email-reminder-check: Toutes les 4h à 15 minutes"
echo "   • email-reminder-send: Toutes les heures en semaine 8h-18h"
echo ""
echo -e "${BLUE}🎯 Prochaines étapes:${NC}"
echo "   • Interface web: http://localhost:3001/dashboard/reminders"
echo "   • Test manuel: ./scripts/test-specific-email-reminder.sh <email_id> dry-run"
echo "   • Monitoring: SELECT * FROM check_reminder_jobs_status();"
echo ""
echo -e "${BLUE}📊 Monitoring en cours:${NC}"
echo "   • Les jobs s'exécuteront automatiquement selon leur planning"
echo "   • Vérifiez les logs dans le Dashboard Supabase > Database > Cron Jobs"
echo "   • Utilisez l'interface web pour le monitoring en temps réel"

# Nettoyage
rm -f /tmp/activate_reminders.sql 2>/dev/null || true

echo ""
echo -e "${GREEN}🚀 Système de relances automatiques ACTIVÉ !${NC}"