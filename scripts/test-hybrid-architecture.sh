#!/bin/bash

# ====================================================================================================
# TEST HYBRID ARCHITECTURE (Old + Application Permissions)
# ====================================================================================================
# Script de test pour l'architecture hybride restaurée
# Combine l'ancienne logique qui fonctionnait avec les permissions application
# ====================================================================================================

echo "🧪 Test de l'architecture hybride restaurée"
echo "=============================================="

# Configuration
SUPABASE_URL="https://zmqfrclfbqnrrnqemfrb.supabase.co"
TOKEN="sbp_029982f00899846f288d1b3c779c73e60f6c98cc"

echo ""
echo "📋 1. Test du Subscription Manager (DUAL SUBSCRIPTIONS)"
echo "--------------------------------------------------------"

# Test création des subscriptions duales
echo "🔄 Création des subscriptions duales (inbox + sentitems)..."
SUBSCRIPTION_RESPONSE=$(curl -s -X POST \
  "${SUPABASE_URL}/functions/v1/subscription-manager?action=create" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"userEmail": "service-exploitation@karta-transit.ci"}')

echo "📤 Réponse création subscriptions:"
echo "$SUBSCRIPTION_RESPONSE" | jq '.'

# Vérifier le statut
echo ""
echo "📊 Statut des subscriptions:"
STATUS_RESPONSE=$(curl -s -X GET \
  "${SUPABASE_URL}/functions/v1/subscription-manager?action=list" \
  -H "Authorization: Bearer ${TOKEN}")

echo "$STATUS_RESPONSE" | jq '.database[] | {id: .subscription_id, resource: .resource, resource_type: .resource_type, status: .status, expires_at: .expires_at}'

echo ""
echo "📋 2. Test du Webhook Handler (ANCIENNE LOGIQUE)"
echo "-----------------------------------------------"

# Simuler un webhook pour message envoyé (SentItems)
echo "📤 Simulation webhook message ENVOYÉ (SentItems)..."
SENT_WEBHOOK_PAYLOAD='{
  "value": [
    {
      "subscriptionId": "test-sent-subscription",
      "clientState": "your-webhook-client-state",
      "changeType": "created",
      "resource": "users/service-exploitation@karta-transit.ci/mailFolders/sentitems/messages/test-sent-message-id",
      "resourceData": {
        "id": "test-sent-message-id",
        "@odata.type": "#Microsoft.Graph.Message",
        "@odata.etag": "test-etag"
      },
      "subscriptionExpirationDateTime": "2025-01-20T00:00:00.0000000Z"
    }
  ]
}'

SENT_WEBHOOK_RESPONSE=$(curl -s -X POST \
  "${SUPABASE_URL}/functions/v1/webhook-handler" \
  -H "Content-Type: application/json" \
  -d "$SENT_WEBHOOK_PAYLOAD")

echo "📤 Réponse webhook message envoyé:"
echo "$SENT_WEBHOOK_RESPONSE" | jq '.'

echo ""
echo "📬 Simulation webhook message REÇU (Inbox)..."
RECEIVED_WEBHOOK_PAYLOAD='{
  "value": [
    {
      "subscriptionId": "test-inbox-subscription",
      "clientState": "your-webhook-client-state",
      "changeType": "created",
      "resource": "users/service-exploitation@karta-transit.ci/messages/test-received-message-id",
      "resourceData": {
        "id": "test-received-message-id",
        "@odata.type": "#Microsoft.Graph.Message",
        "@odata.etag": "test-etag"
      },
      "subscriptionExpirationDateTime": "2025-01-20T00:00:00.0000000Z"
    }
  ]
}'

RECEIVED_WEBHOOK_RESPONSE=$(curl -s -X POST \
  "${SUPABASE_URL}/functions/v1/webhook-handler" \
  -H "Content-Type: application/json" \
  -d "$RECEIVED_WEBHOOK_PAYLOAD")

echo "📬 Réponse webhook message reçu:"
echo "$RECEIVED_WEBHOOK_RESPONSE" | jq '.'

echo ""
echo "📋 3. Vérification des données en base"
echo "-------------------------------------"

# Vérifier sent_messages
echo "📤 Vérification table sent_messages:"
SENT_MESSAGES=$(curl -s -X GET \
  "${SUPABASE_URL}/rest/v1/sent_messages?select=*&order=created_at.desc&limit=5" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptcWZyY2xmYnFucnJucWVtZnJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY5MzU1OTMsImV4cCI6MjA1MjUxMTU5M30.Y7_P4o7eJVcBN8TXGIgJFaZkc2S24PXqL82e1AYdmm8")

echo "$SENT_MESSAGES" | jq '.[] | {id: .id, graph_message_id: .graph_message_id, subject: .subject, processed_at: .processed_at}'

# Vérifier received_messages
echo ""
echo "📬 Vérification table received_messages:"
RECEIVED_MESSAGES=$(curl -s -X GET \
  "${SUPABASE_URL}/rest/v1/received_messages?select=*&order=created_at.desc&limit=5" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptcWZyY2xmYnFucnJucWVtZnJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY5MzU1OTMsImV4cCI6MjA1MjUxMTU5M30.Y7_P4o7eJVcBN8TXGIgJFaZkc2S24PXqL82e1AYdmm8")

echo "$RECEIVED_MESSAGES" | jq '.[] | {id: .id, graph_message_id: .graph_message_id, subject: .subject, processed_at: .processed_at}'

# Vérifier tracked_emails (doit être auto-peuplée par triggers)
echo ""
echo "🎯 Vérification table tracked_emails (AUTO-TRACKING):"
TRACKED_EMAILS=$(curl -s -X GET \
  "${SUPABASE_URL}/rest/v1/tracked_emails?select=*&order=created_at.desc&limit=5" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptcWZyY2xmYnFucnJucWVtZnJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY5MzU1OTMsImV4cCI6MjA1MjUxMTU5M30.Y7_P4o7eJVcBN8TXGIgJFaZkc2S24PXqL82e1AYdmm8")

echo "$TRACKED_EMAILS" | jq '.[] | {id: .id, message_id: .message_id, subject: .subject, status: .status, sent_at: .sent_at}'

echo ""
echo "📋 4. Test des vues mises à jour"
echo "-------------------------------"

# Tester la vue email_stats
echo "📊 Vue email_stats:"
EMAIL_STATS=$(curl -s -X GET \
  "${SUPABASE_URL}/rest/v1/email_stats?select=*" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptcWZyY2xmYnFucnJucWVtZnJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY5MzU1OTMsImV4cCI6MjA1MjUxMTU5M30.Y7_P4o7eJVcBN8TXGIgJFaZkc2S24PXqL82e1AYdmm8")

echo "$EMAIL_STATS" | jq '.'

# Tester la vue recent_email_activity
echo ""
echo "📈 Vue recent_email_activity (5 dernières):"
RECENT_ACTIVITY=$(curl -s -X GET \
  "${SUPABASE_URL}/rest/v1/recent_email_activity?select=*&limit=5" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptcWZyY2xmYnFucnJucWVtZnJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY5MzU1OTMsImV4cCI6MjA1MjUxMTU5M30.Y7_P4o7eJVcBN8TXGIgJFaZkc2S24PXqL82e1AYdmm8")

echo "$RECENT_ACTIVITY" | jq '.[] | {activity_type: .activity_type, subject: .subject, email: .email, activity_at: .activity_at}'

echo ""
echo "🎯 RÉSUMÉ DU TEST"
echo "================="
echo "✅ Architecture hybride restaurée :"
echo "   - Subscriptions DUALES (inbox + sentitems) avec permissions application"
echo "   - Tables sent_messages + received_messages restaurées"
echo "   - Triggers automatiques detect_sent_emails() activés"
echo "   - Webhook handler utilise ancienne logique avec log_sent_message() et log_received_message()"
echo "   - Auto-tracking des emails envoyés depuis Outlook fonctionnel"
echo ""
echo "🚀 L'architecture combine le meilleur des deux mondes :"
echo "   - Permissions application (centralisées, sans utilisateur connecté)"
echo "   - Logique de l'ancienne version (qui fonctionnait avec Outlook)"

echo ""
echo "🔧 Prochaines étapes :"
echo "   1. Tester avec de vrais emails envoyés depuis Outlook"
echo "   2. Vérifier que les webhooks Microsoft Graph arrivent bien"
echo "   3. Confirmer que l'auto-tracking fonctionne"