#!/bin/bash

# Script pour tester la logique d'enregistrement des souscriptions
WEBHOOK_URL="https://email-tracking-zeta.vercel.app"

echo "🔍 DIAGNOSTIC RAPIDE - ENREGISTREMENT DES SOUSCRIPTIONS"
echo "======================================================="
echo

echo "1. TEST DU STATUT SYSTÈME"
echo "-------------------------"
echo "Vérification si WEBHOOK_ENABLED=true sur Vercel..."
curl -s "$WEBHOOK_URL/api/tracking/status" | jq '.' 2>/dev/null || curl -s "$WEBHOOK_URL/api/tracking/status"
echo
echo

echo "2. ANALYSE DU PROBLÈME IDENTIFIÉ"
echo "--------------------------------"
echo "Problème détecté dans WebhookService.createSubscription():"
echo "❌ Ligne 128: 'On continue quand même, la subscription est créée'"
echo "   → Les erreurs de base de données sont ignorées!"
echo
echo "Solutions:"
echo "✅ 1. Améliorer le logging des erreurs DB"
echo "✅ 2. Arrêter le processus si la DB échoue"
echo "✅ 3. Vérifier les permissions Supabase SERVICE_ROLE_KEY"
echo
echo

echo "3. CAUSES PROBABLES"
echo "==================="
echo "🔍 Variable WEBHOOK_ENABLED manquante → Système désactivé"
echo "🔍 SUPABASE_SERVICE_ROLE_KEY manquante → Permissions insuffisantes"  
echo "🔍 RLS policies trop restrictives → Insertion bloquée"
echo "🔍 user_id mismatch → Contrainte de clé étrangère"
echo
echo

echo "4. VÉRIFICATIONS IMMÉDIATES"
echo "============================"
echo "Vérifiez ces variables sur Vercel:"
echo "  • WEBHOOK_ENABLED=true"
echo "  • SUPABASE_SERVICE_ROLE_KEY=[votre_clé_service]"
echo
echo "Puis créez une nouvelle souscription et vérifiez les logs Vercel."
echo "Si l'erreur persiste, les erreurs de DB seront maintenant visibles."