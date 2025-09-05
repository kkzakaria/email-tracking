#!/bin/bash

# Script pour diagnostiquer pourquoi les réponses ne sont pas détectées
WEBHOOK_URL="https://email-tracking-zeta.vercel.app"

echo "🔍 DIAGNOSTIC DE DÉTECTION DES RÉPONSES"
echo "======================================"
echo

echo "1. VÉRIFICATION DU STATUT SYSTÈME"
echo "--------------------------------"
curl -s "$WEBHOOK_URL/api/tracking/status" | jq '.' 2>/dev/null || curl -s "$WEBHOOK_URL/api/tracking/status"
echo
echo

echo "2. TEST D'ACCÈS AUX ENDPOINTS"
echo "-----------------------------"
echo "Test endpoint emails:"
curl -s -o /dev/null -w "Status: %{http_code}\n" "$WEBHOOK_URL/api/emails"
echo "Test endpoint webhooks:"
curl -s -o /dev/null -w "Status: %{http_code}\n" "$WEBHOOK_URL/api/webhooks/subscribe"
echo
echo

echo "3. PROBLÈMES DÉTECTÉS"
echo "===================="
echo "❌ PROBLÈME 1: Pas de relation email_tracking ↔ webhook_events"
echo "   → Les emails trackés et les webhooks sont séparés"
echo "   → Solution: Migration 006 doit être appliquée"
echo
echo "❌ PROBLÈME 2: conversation_id manquant lors de l'envoi"
echo "   → Les emails sont créés sans conversation_id"
echo "   → Les webhooks ne peuvent pas faire le matching"
echo
echo "❌ PROBLÈME 3: Système en mode sync au lieu de webhook"
echo "   → Le temps réel n'est pas actif"
echo "   → Les réponses ne sont détectées que manuellement"
echo
echo

echo "4. VÉRIFICATIONS À FAIRE"
echo "========================"
echo "✅ 1. Vérifier que la migration 006 est appliquée dans Supabase"
echo "✅ 2. Vérifier qu'il y a des souscriptions webhook actives"
echo "✅ 3. Vérifier que l'email envoyé a un conversation_id"
echo "✅ 4. Vérifier que des événements webhook ont été reçus"
echo
echo "SQL à exécuter dans Supabase:"
echo "-- Vérifier la structure de la table"
echo "SELECT column_name, data_type FROM information_schema.columns"
echo "WHERE table_name = 'email_tracking' AND column_name IN ('conversation_id', 'internet_message_id');"
echo
echo "-- Vérifier les données de votre email de test"
echo "SELECT id, recipient_email, subject, status, conversation_id, created_at"
echo "FROM email_tracking ORDER BY created_at DESC LIMIT 5;"
echo
echo "-- Vérifier les événements webhook reçus"
echo "SELECT id, event_type, change_type, resource_data->>'conversationId' as conv_id, created_at"
echo "FROM webhook_events ORDER BY created_at DESC LIMIT 5;"
echo
echo

echo "5. SOLUTION IMMÉDIATE"
echo "===================="
echo "Pour forcer la détection de votre réponse:"
echo "1. Allez dans l'interface Dashboard"
echo "2. Cliquez sur 'Synchroniser avec Outlook'"
echo "3. Cette action vérifiera manuellement les réponses"
echo
echo "Pour une solution permanente:"
echo "1. Appliquer la migration 006 dans Supabase"
echo "2. Modifier l'envoi d'emails pour capturer conversation_id"
echo "3. Relancer le système webhook avec POST /api/tracking/status"