#!/bin/bash

# ====================================================================================================
# SCRIPT DE TEST - SYSTÈME DE TRACKING D'EMAILS
# ====================================================================================================
# Ce script teste le système de tracking d'emails après migration vers permissions application
# ====================================================================================================

set -e

echo "🔍 ===== DIAGNOSTIC DU SYSTÈME DE TRACKING D'EMAILS ====="

# Charger les variables d'environnement
if [ -f .env.local ]; then
    source .env.local
    echo "✅ Variables d'environnement chargées"
else
    echo "❌ Fichier .env.local introuvable"
    exit 1
fi

# ====================================================================================================
# 1. TEST DES TRIGGERS POSTGRESQL
# ====================================================================================================

echo ""
echo "📊 ===== 1. ÉTAT DES TRIGGERS POSTGRESQL ====="

# Créer un test SQL temporaire
cat > /tmp/test-triggers.sql << 'EOF'
-- Vérifier l'existence des triggers
SELECT
    schemaname,
    tablename,
    triggername,
    actionstatement
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE triggername LIKE '%detect_sent%' OR triggername LIKE '%email%';

-- Vérifier les fonctions relatives au tracking
SELECT
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines
WHERE routine_name LIKE '%detect_sent%' OR routine_name LIKE '%log_sent%'
ORDER BY routine_name;

-- Compter les entrées dans les tables de tracking
SELECT 'tracked_emails' as table_name, COUNT(*) as count FROM tracked_emails
UNION ALL
SELECT 'sent_messages', COUNT(*) FROM sent_messages
UNION ALL
SELECT 'received_messages', COUNT(*) FROM received_messages
UNION ALL
SELECT 'webhook_events', COUNT(*) FROM webhook_events;

-- Dernières entrées dans tracked_emails
SELECT
    id, message_id, subject, status, sent_at, created_at
FROM tracked_emails
ORDER BY created_at DESC
LIMIT 5;

-- Dernières entrées dans webhook_events
SELECT
    id, change_type, processed, processed_at
FROM webhook_events
ORDER BY processed_at DESC
LIMIT 5;
EOF

echo "🔍 Exécution des requêtes de diagnostic..."

# Exécuter via curl et Supabase
curl -X POST "${SUPABASE_URL}/rest/v1/rpc/exec_sql" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{
    "query": "SELECT current_database(), current_user;"
  }' 2>/dev/null | jq '.' || echo "❌ Erreur connexion base de données"

# ====================================================================================================
# 2. TEST DES EDGE FUNCTIONS
# ====================================================================================================

echo ""
echo "🔧 ===== 2. TEST DES EDGE FUNCTIONS ====="

# Test webhook-handler avec validation
echo "🧪 Test webhook-handler (validation)..."
WEBHOOK_VALIDATION=$(curl -s -X POST "${SUPABASE_URL}/functions/v1/webhook-handler" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"validationTokens": ["test123"]}')
echo "Résultat: $WEBHOOK_VALIDATION"

# Test app-token-manager
echo "🧪 Test app-token-manager..."
APP_TOKEN_TEST=$(curl -s -X POST "${SUPABASE_URL}/functions/v1/app-token-manager" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"action": "status"}')
echo "Résultat: $APP_TOKEN_TEST"

# ====================================================================================================
# 3. ANALYSE DES LOGS
# ====================================================================================================

echo ""
echo "📋 ===== 3. ANALYSE DES LOGS (DERNIÈRES 5 MINUTES) ====="

# Logs webhook-handler
echo "🔍 Logs webhook-handler..."
supabase functions logs webhook-handler --follow=false 2>/dev/null | head -20 || echo "❌ Impossible d'accéder aux logs"

# ====================================================================================================
# 4. RECOMMANDATIONS
# ====================================================================================================

echo ""
echo "💡 ===== 4. DIAGNOSTIC ET RECOMMANDATIONS ====="

echo "📝 État du système:"
echo "  - webhook-handler: $(echo $WEBHOOK_VALIDATION | jq -r 'if .validationTokens then "✅ Fonctionne" else "❌ Erreur" end' 2>/dev/null || echo "❌ Erreur")"
echo "  - app-token-manager: $(echo $APP_TOKEN_TEST | jq -r 'if .success then "✅ Fonctionne" else "❌ Erreur" end' 2>/dev/null || echo "❌ Erreur")"

echo ""
echo "🎯 Prochaines étapes recommandées:"
echo "  1. Vérifier les triggers PostgreSQL (detect_sent_emails)"
echo "  2. Analyser les logs des Edge Functions"
echo "  3. Tester le flux complet d'envoi d'email"
echo "  4. Vérifier la cohérence des tables tracking"

# Nettoyer
rm -f /tmp/test-triggers.sql

echo ""
echo "✅ Diagnostic terminé!"