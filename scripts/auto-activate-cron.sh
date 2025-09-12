#!/bin/bash
# ====================================================================================================
# SCRIPT - Auto-activation des jobs cron via API REST
# ====================================================================================================

set -e

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🚀 Auto-activation des jobs cron de relances${NC}"
echo "======================================================================================================"

# Charger les variables d'environnement
if [ -f ".env.local" ]; then
    source .env.local
else
    echo -e "${RED}❌ .env.local non trouvé${NC}"
    exit 1
fi

# 1. Configurer les secrets Vault
echo -e "\n${YELLOW}1. Configuration des secrets Vault${NC}"
echo "------------------------------------------------------------------------------------------------------"

# Secret project_url
echo "Configuration du secret project_url..."
project_url_response=$(curl -s -X POST \
    "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/rpc/vault.create_secret" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -d "{\"secret\": \"$NEXT_PUBLIC_SUPABASE_URL\", \"name\": \"project_url\"}" \
    2>/dev/null || echo "error")

if [[ "$project_url_response" != "error" ]]; then
    echo -e "${GREEN}✅ Secret project_url configuré${NC}"
else
    echo -e "${YELLOW}⚠️  Secret project_url (peut-être déjà existant)${NC}"
fi

# Secret service_role_key  
echo "Configuration du secret service_role_key..."
service_key_response=$(curl -s -X POST \
    "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/rpc/vault.create_secret" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -d "{\"secret\": \"$SUPABASE_SERVICE_ROLE_KEY\", \"name\": \"service_role_key\"}" \
    2>/dev/null || echo "error")

if [[ "$service_key_response" != "error" ]]; then
    echo -e "${GREEN}✅ Secret service_role_key configuré${NC}"
else
    echo -e "${YELLOW}⚠️  Secret service_role_key (peut-être déjà existant)${NC}"
fi

# 2. Activer les jobs cron
echo -e "\n${YELLOW}2. Activation des jobs cron${NC}"
echo "------------------------------------------------------------------------------------------------------"

echo "Activation des jobs via activate_reminder_cron_jobs()..."
activation_response=$(curl -s -X POST \
    "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/rpc/activate_reminder_cron_jobs" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -d "{}" \
    2>/dev/null || echo "error")

if [[ "$activation_response" != "error" ]] && [[ ! "$activation_response" =~ "error" ]]; then
    echo -e "${GREEN}✅ Jobs cron activés avec succès${NC}"
    echo "   Résultat: $activation_response"
else
    echo -e "${RED}❌ Erreur lors de l'activation${NC}"
    echo "   Réponse: $activation_response"
fi

# 3. Vérifier l'activation
echo -e "\n${YELLOW}3. Vérification de l'activation${NC}"
echo "------------------------------------------------------------------------------------------------------"

echo "Vérification du statut des jobs..."
status_response=$(curl -s -X POST \
    "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/rpc/check_reminder_jobs_status" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -d "{}" \
    2>/dev/null || echo "error")

if [[ "$status_response" != "error" ]] && echo "$status_response" | jq . > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Statut des jobs récupéré${NC}"
    echo ""
    echo "Jobs cron actifs:"
    echo "$status_response" | jq -r '.[] | "  • \(.job_name): \(.schedule) (Actif: \(.active))"' 2>/dev/null || echo "  Aucun job trouvé ou format inattendu"
else
    echo -e "${YELLOW}⚠️  Impossible de récupérer le statut des jobs${NC}"
    echo "   Réponse: $status_response"
fi

# 4. Test fonctionnel
echo -e "\n${YELLOW}4. Test fonctionnel${NC}"
echo "------------------------------------------------------------------------------------------------------"

echo "Test de l'Edge Function reminder-manager..."
test_response=$(curl -s \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
    -d '{"action": "status"}' \
    "$NEXT_PUBLIC_SUPABASE_URL/functions/v1/reminder-manager" 2>/dev/null || echo "error")

if [[ "$test_response" != "error" ]]; then
    echo -e "${GREEN}✅ Edge Function reminder-manager accessible${NC}"
    if echo "$test_response" | jq -e '.test_mode' > /dev/null 2>&1; then
        echo "   Mode test: $(echo "$test_response" | jq -r '.test_mode')"
    fi
else
    echo -e "${RED}❌ Edge Function reminder-manager non accessible${NC}"
fi

# Résumé
echo -e "\n${YELLOW}5. Résumé de l'activation automatique${NC}"
echo "======================================================================================================"

echo -e "${GREEN}🎯 Actions effectuées:${NC}"
echo "   • Configuration des secrets Vault"
echo "   • Activation des jobs cron"
echo "   • Vérification du statut"
echo "   • Test fonctionnel"

echo -e "\n${BLUE}📋 Jobs cron configurés:${NC}"
echo "   • email-reminder-check: */4 * * * (toutes les 4h)"  
echo "   • email-reminder-send: 30 8-18 * * 1-5 (heures de bureau)"

echo -e "\n${BLUE}🚀 Prochaines étapes:${NC}"
echo "   • Interface de test: http://localhost:3001/dashboard/reminders"
echo "   • Page simplifiée: http://localhost:3001/dashboard/reminders/test"
echo "   • Monitoring: Dashboard Supabase > Database > Cron Jobs"

echo ""
echo -e "${GREEN}✅ Activation automatique terminée !${NC}"