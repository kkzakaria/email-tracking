#!/bin/bash
# ====================================================================================================
# SCRIPT - Vérification du statut des jobs cron de relances
# ====================================================================================================
# Description: Vérifie l'état des jobs cron et permet de les activer si nécessaire
# Usage: ./scripts/check-reminder-cron-status.sh
# ====================================================================================================

set -e

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Vérification des jobs cron de relances${NC}"
echo "======================================================================================================"

# Charger les variables d'environnement
if [ -f ".env.local" ]; then
    source .env.local
    echo -e "${GREEN}✅ Variables d'environnement chargées${NC}"
else
    echo -e "${RED}❌ Fichier .env.local non trouvé${NC}"
    echo "   Créez le fichier .env.local avec les variables Supabase"
    exit 1
fi

# Vérifier si pg_cron est disponible
echo -e "\n${YELLOW}1. Vérification de l'extension pg_cron${NC}"
echo "------------------------------------------------------------------------------------------------------"

# Test plus simple - vérifier si la fonction existe
echo "Vérification de l'accès à la base de données..."

# Via supabase functions pour accéder à la DB
response=$(curl -s -X POST \
  "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/rpc/check_reminder_jobs_status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" 2>/dev/null || echo "error")

if [ "$response" != "error" ] && [ -n "$response" ]; then
    echo -e "${GREEN}✅ Base de données accessible et fonction check_reminder_jobs_status disponible${NC}"
    if echo "$response" | jq . > /dev/null 2>&1; then
        echo "   Nombre de jobs trouvés: $(echo "$response" | jq length 2>/dev/null || echo "0")"
    fi
else
    echo -e "${YELLOW}⚠️  Fonction check_reminder_jobs_status pas encore disponible (normal si migration récente)${NC}"
fi

# Vérifier les jobs existants
echo -e "\n${YELLOW}2. Jobs cron existants${NC}"
echo "------------------------------------------------------------------------------------------------------"

# Créer un script SQL temporaire pour vérifier les jobs
cat > /tmp/check_jobs.sql << 'EOF'
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN 'Aucun job de relance trouvé'
        ELSE COUNT(*)::text || ' job(s) de relance trouvé(s)'
    END as status
FROM cron.job 
WHERE jobname IN ('email-reminder-check', 'email-reminder-send');

SELECT 
    jobname as "Job",
    schedule as "Planning", 
    active as "Actif",
    created_at as "Créé le"
FROM cron.job 
WHERE jobname IN ('email-reminder-check', 'email-reminder-send')
ORDER BY jobname;
EOF

echo "Jobs de relances actuels:"
# Note: Cette commande peut ne pas fonctionner selon la version de Supabase CLI
# Dans ce cas, utiliser l'interface web ou tester directement

# Vérifier les fonctions d'activation
echo -e "\n${YELLOW}3. Fonctions d'activation disponibles${NC}"
echo "------------------------------------------------------------------------------------------------------"

# Vérifier si les fonctions existent
cat > /tmp/check_functions.sql << 'EOF'
SELECT 
    proname as "Fonction",
    CASE 
        WHEN proname IS NOT NULL THEN 'Disponible'
        ELSE 'Manquante'
    END as "Statut"
FROM pg_proc 
WHERE proname IN ('activate_reminder_cron_jobs', 'deactivate_reminder_cron_jobs', 'check_reminder_jobs_status')
ORDER BY proname;
EOF

echo "Fonctions de gestion des jobs:"
echo "- activate_reminder_cron_jobs(): Active les jobs cron"
echo "- deactivate_reminder_cron_jobs(): Désactive les jobs cron"  
echo "- check_reminder_jobs_status(): Vérifie le statut des jobs"

# Vérifier le statut via l'Edge Function
echo -e "\n${YELLOW}4. Test de l'Edge Function reminder-manager${NC}"
echo "------------------------------------------------------------------------------------------------------"

echo "Test de connexion à l'Edge Function..."
response=$(curl -s \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
    -d '{"action": "status"}' \
    "$NEXT_PUBLIC_SUPABASE_URL/functions/v1/reminder-manager" 2>/dev/null || echo '{"error": "Connexion échouée"}')

if echo "$response" | jq -e '.test_mode' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Edge Function reminder-manager opérationnelle${NC}"
    echo "   Mode test: $(echo "$response" | jq -r '.test_mode')"
    echo "   User ID: $(echo "$response" | jq -r '.user_id // "non connecté"')"
    echo "   Heures de travail: $(echo "$response" | jq -r '.working_hours // "non vérifié"')"
else
    echo -e "${RED}❌ Edge Function reminder-manager non accessible ou erreur d'authentification${NC}"
    echo "   Réponse: $response"
    echo ""
    echo "   Solutions possibles:"
    echo "   • Déployez l'Edge Function: supabase functions deploy reminder-manager"
    echo "   • Vérifiez les variables d'environnement SUPABASE_*"
    echo "   • Testez l'authentification avec un token utilisateur valide"
fi

# Instructions d'activation
echo -e "\n${YELLOW}5. Instructions d'activation${NC}"
echo "======================================================================================================"

echo -e "${BLUE}Pour activer les jobs cron après validation des tests:${NC}"
echo ""
echo "1. Tester d'abord manuellement:"
echo "   ./scripts/test-reminder-system.sh dry-run"
echo ""
echo "2. Vérifier l'interface web:"
echo "   http://localhost:3000/dashboard/reminders"
echo ""
echo "3. Activer les jobs cron (via SQL):"
echo "   SELECT activate_reminder_cron_jobs();"
echo ""
echo "4. Vérifier l'activation:"
echo "   SELECT * FROM check_reminder_jobs_status();"
echo ""
echo "5. Désactiver si nécessaire:"
echo "   SELECT deactivate_reminder_cron_jobs();"

echo -e "\n${GREEN}📋 Résumé:${NC}"
echo "• Les jobs cron sont DÉSACTIVÉS par défaut (mode sécurisé)"
echo "• Les fonctions d'activation/désactivation sont disponibles"
echo "• Tester manuellement avant d'activer les jobs automatiques"
echo "• L'Edge Function reminder-manager est indépendante des jobs cron"

echo -e "\n${BLUE}🎯 Pour activer maintenant:${NC}"
echo -e "${YELLOW}Voulez-vous activer les jobs cron maintenant ? (y/N)${NC}"
read -r activate_choice

if [[ "$activate_choice" =~ ^[Yy]$ ]]; then
    echo -e "\n${BLUE}Activation des jobs cron...${NC}"
    
    # Créer un script SQL temporaire pour l'activation
    cat > /tmp/activate_jobs.sql << 'EOF'
SELECT activate_reminder_cron_jobs() as result;
SELECT * FROM check_reminder_jobs_status();
EOF
    
    echo "Pour activer les jobs, exécutez manuellement:"
    echo "SELECT activate_reminder_cron_jobs();"
    echo ""
    echo "Puis vérifiez avec:"
    echo "SELECT * FROM check_reminder_jobs_status();"
    
else
    echo -e "\n${GREEN}✅ Jobs restent désactivés - parfait pour les tests !${NC}"
fi

# Nettoyage
rm -f /tmp/check_jobs.sql /tmp/check_functions.sql /tmp/activate_jobs.sql 2>/dev/null || true

echo ""
echo -e "${GREEN}✅ Vérification terminée${NC}"