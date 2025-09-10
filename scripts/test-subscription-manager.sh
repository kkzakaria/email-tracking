#!/bin/bash

# Script pour tester la fonction subscription-manager

source .env.local

echo "🧪 Test de la fonction subscription-manager..."
echo "================================================"

echo "1. Test avec action create..."
curl -v -X POST \
  "${NEXT_PUBLIC_SUPABASE_URL}/functions/v1/subscription-manager" \
  -H "apikey: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"action": "create"}' 2>&1

echo -e "\n2. Test avec action status..."
curl -v -X POST \
  "${NEXT_PUBLIC_SUPABASE_URL}/functions/v1/subscription-manager" \
  -H "apikey: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"action": "status"}' 2>&1

echo -e "\n✅ Tests terminés"