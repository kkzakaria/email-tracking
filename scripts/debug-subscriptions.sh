#!/bin/bash

# Script pour déboguer les souscriptions webhook
WEBHOOK_URL="https://email-tracking-zeta.vercel.app"

echo "🔍 DEBUG DES SOUSCRIPTIONS WEBHOOK"
echo "=================================="
echo

echo "1. TEST CRÉATION DE SOUSCRIPTION"
echo "--------------------------------"
echo "⚠️ Ce test nécessite une authentification"
echo "Testez manuellement via l'interface :"
echo "URL: $WEBHOOK_URL/dashboard/webhooks"
echo

echo "2. TEST RÉCUPÉRATION DES SOUSCRIPTIONS" 
echo "--------------------------------------"
echo "⚠️ Ce test nécessite une authentification"
echo "Testez manuellement :"
echo "URL: $WEBHOOK_URL/api/webhooks/subscribe"
echo

echo "3. DIAGNOSTIC DES PROBLÈMES POTENTIELS"
echo "======================================"
echo

echo "❌ PROBLÈME POTENTIEL 1: Erreur d'insertion en base"
echo "   → Vérifiez les logs Vercel lors de la création"
echo "   → Possible erreur RLS (Row Level Security) Supabase"
echo "   → Service role key peut être manquante"
echo

echo "❌ PROBLÈME POTENTIEL 2: user.id ne correspond pas"
echo "   → L'interface utilise user.id du client auth"
echo "   → Le WebhookService utilise options.userId"
echo "   → Ces deux IDs doivent être identiques"
echo

echo "❌ PROBLÈME POTENTIEL 3: Client Supabase incorrect"
echo "   → WebhookService utilise service role key"
echo "   → Interface utilise user auth context"
echo "   → Possible conflit d'authentification"
echo

echo "❌ PROBLÈME POTENTIEL 4: Table webhook_subscriptions"
echo "   → Migration 005 peut ne pas être appliquée"
echo "   → Schema de table différent des colonnes utilisées"
echo "   → Contraintes de clés étrangères"
echo

echo "4. SOLUTIONS À TESTER"
echo "===================="
echo "✅ 1. Vérifier les logs Vercel pendant la création"
echo "✅ 2. Vérifier que SUPABASE_SERVICE_ROLE_KEY est définie"  
echo "✅ 3. Vérifier la migration 005 dans Supabase"
echo "✅ 4. Ajouter plus de logs dans WebhookService"
echo "✅ 5. Tester avec des logs explicites côté base de données"
echo

echo "5. REQUÊTES SUPABASE À EXÉCUTER MANUELLEMENT"
echo "============================================"
echo "-- Vérifier l'existence de la table :"
echo "SELECT * FROM information_schema.tables WHERE table_name = 'webhook_subscriptions';"
echo
echo "-- Vérifier le contenu (si la table existe) :"
echo "SELECT * FROM webhook_subscriptions ORDER BY created_at DESC LIMIT 10;"
echo
echo "-- Vérifier les policies RLS :"
echo "SELECT * FROM pg_policies WHERE tablename = 'webhook_subscriptions';"
echo
echo "-- Tester insertion manuelle :"
echo "INSERT INTO webhook_subscriptions ("
echo "  subscription_id, user_id, resource, change_types,"
echo "  notification_url, expiration_datetime, client_state, status"
echo ") VALUES ("
echo "  'test-123', '[YOUR_USER_ID]', 'me/messages', '{created,updated}',"
echo "  '$WEBHOOK_URL/api/webhooks/outlook', NOW() + interval '3 days', 'test', 'active'"
echo ");"
echo

echo "🎯 PROCHAINES ÉTAPES :"
echo "====================="
echo "1. Ajouter WEBHOOK_ENABLED=true sur Vercel"
echo "2. Vérifier SUPABASE_SERVICE_ROLE_KEY sur Vercel" 
echo "3. Vérifier les migrations Supabase sont appliquées"
echo "4. Créer une nouvelle souscription et vérifier les logs"
echo "5. Vérifier manuellement la table webhook_subscriptions dans Supabase"