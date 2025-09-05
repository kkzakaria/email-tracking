#!/bin/bash

# Test script pour vérifier l'endpoint webhook Vercel
WEBHOOK_URL="https://email-tracking-zeta.vercel.app/api/webhooks/outlook"

echo "🔍 Test de l'endpoint webhook Vercel..."
echo "URL: $WEBHOOK_URL"
echo

# Test GET pour vérifier que l'endpoint est accessible
echo "1. Test GET - Vérification de l'accessibilité:"
curl -s -w "\nStatus: %{http_code}\n" "$WEBHOOK_URL"
echo

# Test POST pour valider la structure webhook
echo "2. Test POST - Validation de la structure:"
curl -s -w "\nStatus: %{http_code}\n" \
  -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "value": [{
      "subscriptionId": "test-subscription",
      "changeType": "created",
      "resource": "me/mailFolders/inbox/messages/test",
      "clientState": "secure-webhook-validation-key-2024"
    }]
  }'
echo

# Test validation token (simulation Microsoft Graph)
echo "3. Test Validation Token - Simulation Microsoft Graph:"
curl -s -w "\nStatus: %{http_code}\n" \
  "$WEBHOOK_URL?validationToken=test-validation-token"
echo

echo "✅ Tests terminés!"
echo
echo "Codes de réponse attendus:"
echo "- 200: Endpoint accessible et fonctionnel"
echo "- 202: Notification webhook acceptée"
echo "- 400/401: Erreur de validation (normal si pas d'authentification)"