#!/bin/bash

# Script pour nettoyer les données de test

source .env.local

echo "🧹 Nettoyage des données de test..."
echo "================================================"

echo "1. Nettoyage de la table webhook_events..."
curl -s -X DELETE \
  "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/webhook_events?created_at=gte.2025-01-01" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal"

echo -e "\n2. Nettoyage de la table received_messages..."
curl -s -X DELETE \
  "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/received_messages?created_at=gte.2025-01-01" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal"

echo -e "\n3. Suppression des anciens tokens non-chiffrés..."
curl -s -X DELETE \
  "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/microsoft_tokens?token_nonce=eq.TEMP_NO_ENCRYPTION" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal"

echo -e "\n4. Vérification du nettoyage..."
echo "Webhook events restants:"
curl -s -X GET \
  "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/webhook_events?select=count" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json"

echo -e "\nMessages reçus restants:"
curl -s -X GET \
  "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/received_messages?select=count" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json"

echo -e "\nTokens Microsoft restants:"
curl -s -X GET \
  "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/microsoft_tokens?select=id,token_nonce,created_at" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json"

echo -e "\n✅ Nettoyage terminé"