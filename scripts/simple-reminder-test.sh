#!/bin/bash
# ====================================================================================================
# SCRIPT DE TEST SIMPLE - Diagnostic rapide du système de relances
# ====================================================================================================

set -e

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔍 Test simple du système de relances${NC}"
echo "======================================================================================================"

# 1. Vérifier le fichier .env.local
echo -e "\n${YELLOW}1. Variables d'environnement${NC}"
if [ -f ".env.local" ]; then
    source .env.local
    echo -e "${GREEN}✅ .env.local trouvé et chargé${NC}"
    
    if [ -n "$NEXT_PUBLIC_SUPABASE_URL" ]; then
        echo "   URL Supabase: ${NEXT_PUBLIC_SUPABASE_URL}"
    else
        echo -e "${RED}❌ NEXT_PUBLIC_SUPABASE_URL manquant${NC}"
    fi
    
    if [ -n "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ]; then
        echo "   Clé anon: ${NEXT_PUBLIC_SUPABASE_ANON_KEY:0:20}..."
    else
        echo -e "${RED}❌ NEXT_PUBLIC_SUPABASE_ANON_KEY manquant${NC}"
    fi
else
    echo -e "${RED}❌ .env.local non trouvé${NC}"
    exit 1
fi

# 2. Test de base de données
echo -e "\n${YELLOW}2. Accès base de données${NC}"
# Test simple avec une requête basic
response=$(curl -s \
    -X POST "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/rpc/now" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
    -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
    2>/dev/null || echo "error")

if [ "$response" != "error" ] && [ -n "$response" ]; then
    echo -e "${GREEN}✅ Base de données accessible${NC}"
    echo "   Réponse: $response"
else
    echo -e "${RED}❌ Base de données non accessible${NC}"
    echo "   Vérifiez les variables SUPABASE_* dans .env.local"
fi

# 3. Test Edge Function
echo -e "\n${YELLOW}3. Edge Function reminder-manager${NC}"
response=$(curl -s \
    -X POST "$NEXT_PUBLIC_SUPABASE_URL/functions/v1/reminder-manager" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
    -d '{"action": "status"}' \
    2>/dev/null || echo "error")

if [ "$response" != "error" ] && [ -n "$response" ]; then
    echo -e "${GREEN}✅ Edge Function reminder-manager accessible${NC}"
    echo "   Réponse: $response"
    
    # Essayer de parser la réponse
    if echo "$response" | jq . > /dev/null 2>&1; then
        echo "   Format JSON valide ✅"
        if echo "$response" | jq -e '.test_mode' > /dev/null 2>&1; then
            echo "   Mode test activé ✅"
        fi
    fi
else
    echo -e "${RED}❌ Edge Function reminder-manager non accessible${NC}"
    echo "   Réponse: $response"
    echo ""
    echo "   Pour déployer l'Edge Function:"
    echo "   supabase functions deploy reminder-manager"
fi

# 4. Test des tables
echo -e "\n${YELLOW}4. Tables de test${NC}"
# Vérifier si les tables existent
response=$(curl -s \
    -X GET "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/test_reminder_settings?select=count" \
    -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
    -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
    2>/dev/null || echo "error")

if [ "$response" != "error" ] && [[ ! "$response" =~ "error" ]] && [[ ! "$response" =~ "relation.*does not exist" ]]; then
    echo -e "${GREEN}✅ Tables de test accessibles${NC}"
    echo "   Table test_reminder_settings existe"
else
    echo -e "${RED}❌ Tables de test non accessibles${NC}"
    echo "   Appliquez les migrations: supabase db push"
fi

# 5. Résumé et prochaines étapes
echo -e "\n${YELLOW}5. Résumé${NC}"
echo "======================================================================================================"
echo -e "${BLUE}État du système:${NC}"
echo "• Variables d'environnement: $([ -f ".env.local" ] && echo "✅" || echo "❌")"
echo "• Base de données: $([ "$response" != "error" ] && echo "✅" || echo "❌")"  
echo "• Edge Function: En cours de vérification..."
echo "• Tables de test: En cours de vérification..."

echo -e "\n${BLUE}Actions recommandées:${NC}"
echo "1. Si Edge Function manquante: supabase functions deploy reminder-manager"
echo "2. Si tables manquantes: supabase db push"
echo "3. Test complet: ./scripts/test-reminder-system.sh dry-run"
echo "4. Interface web: http://localhost:3000/dashboard/reminders"

echo -e "\n${BLUE}Note importante:${NC}"
echo "Les jobs cron sont DÉSACTIVÉS par défaut - c'est normal !"
echo "Ils seront activés après validation des tests manuels."

echo ""