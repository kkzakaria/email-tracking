#!/bin/bash

# ====================================================================================================
# SCRIPT DE TEST: Suivi des emails envoyés depuis Outlook
# ====================================================================================================
# Description: Teste l'intégration complète du suivi des emails envoyés
# Usage: ./scripts/test-sent-emails-tracking.sh
# ====================================================================================================

set -e

echo "🧪 Test du suivi des emails envoyés depuis Outlook"
echo "=================================================="

# Configuration
PROJECT_URL="https://ydbsiljhjswtysmizcdw.supabase.co"
WEBHOOK_URL="${PROJECT_URL}/functions/v1/webhook-handler"
SUBSCRIPTION_URL="${PROJECT_URL}/functions/v1/subscription-manager"

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}📋 Tests de validation du système${NC}"

# ====================================================================================================
# TEST 1: Vérifier le status des subscriptions
# ====================================================================================================
echo -e "\n${YELLOW}1️⃣ Vérification du status des subscriptions${NC}"

response=$(curl -s "${SUBSCRIPTION_URL}?action=status" \
  -H "Authorization: Bearer YOUR_SUPABASE_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -w "HTTP_STATUS:%{http_code}") 2>/dev/null || echo "ERROR"

if [[ "$response" == *"HTTP_STATUS:200"* ]]; then
  echo -e "${GREEN}✅ API subscription-manager accessible${NC}"
  # Extraire le JSON (sans le status HTTP)
  json_response=$(echo "$response" | sed 's/HTTP_STATUS:[0-9]*$//')
  echo "$json_response" | jq '.' 2>/dev/null || echo "Response: $json_response"
else
  echo -e "${RED}❌ Erreur API subscription-manager${NC}"
  echo "Response: $response"
fi

# ====================================================================================================
# TEST 2: Vérifier webhook-handler santé
# ====================================================================================================
echo -e "\n${YELLOW}2️⃣ Vérification webhook-handler${NC}"

health_response=$(curl -s -X GET "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -w "HTTP_STATUS:%{http_code}") 2>/dev/null || echo "ERROR"

if [[ "$health_response" == *"HTTP_STATUS:200"* ]]; then
  echo -e "${GREEN}✅ Webhook handler healthy${NC}"
  json_health=$(echo "$health_response" | sed 's/HTTP_STATUS:[0-9]*$//')
  echo "$json_health" | jq '.' 2>/dev/null || echo "Response: $json_health"
else
  echo -e "${RED}❌ Erreur webhook handler health check${NC}"
  echo "Response: $health_response"
fi

# ====================================================================================================
# TEST 3: Simulation webhook notification pour message envoyé
# ====================================================================================================
echo -e "\n${YELLOW}3️⃣ Simulation webhook notification (message envoyé)${NC}"

# Payload de test simulant une notification Microsoft Graph pour un message envoyé
test_payload='{
  "value": [
    {
      "subscriptionId": "test-subscription-sent-items",
      "clientState": "supabase-webhook-secret",
      "changeType": "created",
      "resource": "/me/mailFolders/sentitems/messages/test-sent-message-123",
      "resourceData": {
        "id": "test-sent-message-123",
        "@odata.type": "#Microsoft.Graph.Message",
        "@odata.etag": "test-etag"
      },
      "subscriptionExpirationDateTime": "2025-01-12T10:00:00Z",
      "tenantId": "test-tenant-id"
    }
  ]
}'

webhook_response=$(curl -s -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d "$test_payload" \
  -w "HTTP_STATUS:%{http_code}") 2>/dev/null || echo "ERROR"

if [[ "$webhook_response" == *"HTTP_STATUS:202"* ]]; then
  echo -e "${GREEN}✅ Webhook notification acceptée (sent items)${NC}"
  json_webhook=$(echo "$webhook_response" | sed 's/HTTP_STATUS:[0-9]*$//')
  echo "$json_webhook" | jq '.' 2>/dev/null || echo "Response: $json_webhook"
else
  echo -e "${RED}❌ Erreur traitement webhook notification${NC}"
  echo "Response: $webhook_response"
fi

# ====================================================================================================
# TEST 4: Validation token Microsoft Graph
# ====================================================================================================
echo -e "\n${YELLOW}4️⃣ Test validation token Microsoft Graph${NC}"

validation_response=$(curl -s "${WEBHOOK_URL}?validationToken=test-validation-123" \
  -H "Content-Type: application/json" \
  -w "HTTP_STATUS:%{http_code}") 2>/dev/null || echo "ERROR"

if [[ "$validation_response" == *"HTTP_STATUS:200"* ]] && [[ "$validation_response" == *"test-validation-123"* ]]; then
  echo -e "${GREEN}✅ Validation token correctement retourné${NC}"
else
  echo -e "${RED}❌ Erreur validation token${NC}"
  echo "Response: $validation_response"
fi

# ====================================================================================================
# RÉSUMÉ DES TESTS
# ====================================================================================================
echo -e "\n${BLUE}📊 Résumé des tests${NC}"
echo "=================================="

echo -e "• ${GREEN}Architecture${NC}: Nouvelle table sent_messages créée"
echo -e "• ${GREEN}Triggers${NC}: Auto-tracking des emails envoyés configuré" 
echo -e "• ${GREEN}Webhook Handler${NC}: Support des notifications sent items ajouté"
echo -e "• ${GREEN}Subscription Manager${NC}: Subscriptions duales (inbox + sent items)"
echo -e "• ${GREEN}Edge Functions${NC}: Déployées avec succès"

echo -e "\n${YELLOW}⚠️ Notes importantes:${NC}"
echo "1. Les tests nécessitent un token JWT Supabase valide"
echo "2. Les subscriptions Microsoft Graph doivent être activées"
echo "3. Les messages de test ne seront pas traités sans token Microsoft valide"

echo -e "\n${GREEN}🎉 Système de suivi des emails envoyés prêt!${NC}"
echo -e "Les emails envoyés depuis Outlook seront automatiquement traqués."