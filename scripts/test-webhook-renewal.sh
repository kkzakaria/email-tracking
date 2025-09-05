#!/bin/bash

# Test script pour le renouvellement manuel des webhooks
WEBHOOK_RENEWAL_URL="https://email-tracking-zeta.vercel.app/api/cron/renew-webhooks"
CRON_SECRET="webhook-renewal-2024"

echo "🔄 Test du renouvellement des webhooks..."
echo "URL: $WEBHOOK_RENEWAL_URL"
echo

# Test GET pour vérifier le statut du cron
echo "1. Test GET - Statut du cron job:"
curl -s "$WEBHOOK_RENEWAL_URL" | jq '.' 2>/dev/null || curl -s "$WEBHOOK_RENEWAL_URL"
echo

# Test POST pour déclencher le renouvellement manuel
echo "2. Test POST - Déclenchement manuel du renouvellement:"
curl -s -w "\nStatus: %{http_code}\n" \
  -X POST "$WEBHOOK_RENEWAL_URL" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" | jq '.' 2>/dev/null || \
curl -s -w "\nStatus: %{http_code}\n" \
  -X POST "$WEBHOOK_RENEWAL_URL" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json"
echo

echo "✅ Test terminé!"
echo
echo "Codes de réponse attendus:"
echo "- 200: Renouvellement réussi"
echo "- 401: Erreur d'authentification (vérifier CRON_SECRET)"
echo "- 500: Erreur serveur (vérifier les logs)"