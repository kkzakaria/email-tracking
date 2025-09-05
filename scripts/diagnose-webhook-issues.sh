#!/bin/bash

# Script de diagnostic complet pour les webhooks
WEBHOOK_URL="https://email-tracking-zeta.vercel.app"

echo "🔍 DIAGNOSTIC COMPLET DES WEBHOOKS"
echo "=================================="
echo

echo "1. TEST DE L'ENDPOINT WEBHOOK"
echo "-----------------------------"
curl -s "$WEBHOOK_URL/api/webhooks/outlook" | jq '.' 2>/dev/null || curl -s "$WEBHOOK_URL/api/webhooks/outlook"
echo
echo

echo "2. TEST DU STATUT DU SYSTÈME"
echo "----------------------------"
curl -s "$WEBHOOK_URL/api/tracking/status" | jq '.' 2>/dev/null || curl -s "$WEBHOOK_URL/api/tracking/status"
echo
echo

echo "3. TEST DE LA LISTE DES SOUSCRIPTIONS (nécessite auth)"
echo "------------------------------------------------------"
echo "⚠️ Nécessite une authentification - testez depuis l'interface web"
echo "URL: $WEBHOOK_URL/api/webhooks/subscribe"
echo
echo

echo "4. VÉRIFICATION DES VARIABLES D'ENVIRONNEMENT CRITIQUES"
echo "-------------------------------------------------------"
echo "Variables d'environnement requises sur Vercel:"
echo "✅ WEBHOOK_ENABLED=true"
echo "✅ WEBHOOK_ENDPOINT_URL=$WEBHOOK_URL/api/webhooks/outlook"
echo "✅ WEBHOOK_CLIENT_STATE=secure-webhook-validation-key-2024"
echo "✅ AZURE_AD_CLIENT_ID, AZURE_AD_CLIENT_SECRET, AZURE_AD_TENANT_ID"
echo "✅ SUPABASE_SERVICE_ROLE_KEY (pour l'accès système aux webhooks)"
echo
echo

echo "5. TEST DU CRON DE RENOUVELLEMENT"
echo "---------------------------------"
curl -s "$WEBHOOK_URL/api/cron/renew-webhooks" | jq '.' 2>/dev/null || curl -s "$WEBHOOK_URL/api/cron/renew-webhooks"
echo
echo

echo "6. PROBLÈMES IDENTIFIÉS ET SOLUTIONS"
echo "===================================="
echo "❌ PROBLÈME 1: Variable WEBHOOK_ENABLED manquante"
echo "   → Ajouter WEBHOOK_ENABLED=true sur Vercel"
echo
echo "❌ PROBLÈME 2: Logique de détection des réponses imparfaite"
echo "   → Utilise subject matching au lieu de conversation tracking"
echo "   → Pas de conversation_id stocké dans email_tracking"
echo
echo "❌ PROBLÈME 3: Synchronisation manuelle peut ne pas détecter les réponses"
echo "   → hasEmailReceivedReply() compte les messages mais ne vérifie pas les expéditeurs"
echo
echo "❌ PROBLÈME 4: Interface peut ne pas refléter le statut réel"
echo "   → webhook monitoring dépend de l'état des subscriptions en DB"
echo
echo

echo "RECOMMANDATIONS:"
echo "==============="
echo "1. Ajouter WEBHOOK_ENABLED=true sur Vercel"
echo "2. Migrer la base de données pour ajouter conversation_id"
echo "3. Améliorer la logique de détection des réponses"
echo "4. Vérifier que les souscriptions sont bien créées en DB"
echo
echo "Pour plus de détails, consultez les logs Vercel et les tables Supabase:"
echo "- webhook_subscriptions (souscriptions actives)"
echo "- webhook_events (notifications reçues)"
echo "- webhook_processing_log (actions effectuées)"