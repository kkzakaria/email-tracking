#!/bin/bash

# Script de diagnostic pour les problèmes de webhook

source .env.local

echo "🔍 Diagnostic des webhooks Microsoft Graph..."
echo "================================================"

# Test de l'endpoint webhook
echo "1. Test de l'endpoint webhook (santé)..."
curl -s "${NEXT_PUBLIC_SUPABASE_URL}/functions/v1/webhook-handler" \
  -H "apikey: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}" | echo

echo -e "\n2. Vérification des tokens Microsoft..."
curl -s -X GET \
  "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/microsoft_tokens?select=id,expires_at,created_at,token_nonce&order=created_at.desc&limit=3" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json"

echo -e "\n3. Vérification des événements webhook récents..."
curl -s -X GET \
  "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/webhook_events?select=id,subscription_id,change_type,resource_id,processed,created_at&order=created_at.desc&limit=5" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json"

echo -e "\n4. Vérification des messages reçus..."
curl -s -X GET \
  "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/received_messages?select=id,subject,from_email,conversation_id,created_at&order=created_at.desc&limit=5" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json"

echo -e "\n5. Vérification des subscriptions actives..."
curl -s -X POST \
  "${NEXT_PUBLIC_SUPABASE_URL}/functions/v1/subscription-manager" \
  -H "apikey: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"action": "status"}'

echo -e "\n✅ Diagnostic terminé"