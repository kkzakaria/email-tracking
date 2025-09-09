#!/bin/bash

# Script pour tester le endpoint webhook et vérifier les données

# Load environment variables
source .env.local

echo "🧪 Test de l'endpoint webhook..."

# Vérifier les événements webhook non traités
echo "📊 Vérification des événements webhook non traités..."
curl -s -X POST \
  "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/get_unprocessed_webhook_events" \
  -H "apikey: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{}' | head -500

echo -e "\n📊 Vérification des messages reçus..."
curl -s -X POST \
  "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/received_messages?select=*" \
  -H "apikey: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" | head -500

echo -e "\n✅ Test terminé"