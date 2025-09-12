#!/bin/bash
# ====================================================================================================
# SCRIPT DE TEST - Système de relances automatiques
# ====================================================================================================
# Description: Tests complets du système de relances en mode isolé
# Usage: ./scripts/test-reminder-system.sh [dry-run|real]
# ====================================================================================================

set -e

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_ROOT/.env.local"

# Mode par défaut
MODE="${1:-dry-run}"

echo -e "${BLUE}🧪 Test du système de relances automatiques - Mode: $MODE${NC}"
echo "======================================================================================================"

# Fonction utilitaire pour afficher les étapes
step() {
    echo -e "\n${YELLOW}📋 $1${NC}"
    echo "------------------------------------------------------------------------------------------------------"
}

# Fonction utilitaire pour afficher les succès
success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Fonction utilitaire pour afficher les erreurs
error() {
    echo -e "${RED}❌ $1${NC}"
}

# Fonction utilitaire pour afficher les informations
info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Vérifier les prérequis
check_prerequisites() {
    step "Vérification des prérequis"
    
    # Vérifier que nous sommes dans le bon répertoire
    if [[ ! -f "$PROJECT_ROOT/package.json" ]]; then
        error "Ce script doit être exécuté depuis la racine du projet email-tracking"
        exit 1
    fi
    
    # Vérifier le fichier .env.local
    if [[ ! -f "$ENV_FILE" ]]; then
        error "Fichier .env.local manquant"
        exit 1
    fi
    
    # Vérifier les variables d'environnement essentielles
    source "$ENV_FILE"
    
    if [[ -z "$NEXT_PUBLIC_SUPABASE_URL" ]]; then
        error "NEXT_PUBLIC_SUPABASE_URL manquant dans .env.local"
        exit 1
    fi
    
    if [[ -z "$SUPABASE_SERVICE_ROLE_KEY" ]]; then
        error "SUPABASE_SERVICE_ROLE_KEY manquant dans .env.local"
        exit 1
    fi
    
    # Vérifier que supabase CLI est disponible
    if ! command -v supabase &> /dev/null; then
        error "Supabase CLI non installé"
        exit 1
    fi
    
    success "Tous les prérequis sont satisfaits"
}

# Appliquer les migrations
apply_migrations() {
    step "Application des migrations de test"
    
    cd "$PROJECT_ROOT"
    
    info "Application de la migration 013 (tables de test)..."
    if supabase db push --include-all; then
        success "Migration 013 appliquée"
    else
        error "Échec application migration 013"
        exit 1
    fi
    
    info "Application de la migration 014 (jobs cron)..."
    # La migration 014 ne fait que créer les fonctions, les jobs restent désactivés
    success "Migration 014 appliquée (jobs désactivés)"
}

# Déployer les Edge Functions
deploy_functions() {
    step "Déploiement des Edge Functions"
    
    cd "$PROJECT_ROOT"
    
    info "Déploiement de reminder-manager..."
    if supabase functions deploy reminder-manager; then
        success "Edge Function reminder-manager déployée"
    else
        error "Échec déploiement reminder-manager"
        exit 1
    fi
}

# Tester la fonction de statut
test_status() {
    step "Test 1: Récupération du statut"
    
    local response
    response=$(curl -s \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
        -d '{"action": "status"}' \
        "$NEXT_PUBLIC_SUPABASE_URL/functions/v1/reminder-manager")
    
    if echo "$response" | jq -e '.test_mode' > /dev/null 2>&1; then
        success "Statut récupéré avec succès"
        info "Mode test: $(echo "$response" | jq -r '.test_mode')"
        info "Utilisateur: $(echo "$response" | jq -r '.user_id // "non connecté"')"
    else
        error "Échec récupération statut"
        info "Réponse: $response"
        return 1
    fi
}

# Tester les heures de travail
test_working_hours() {
    step "Test 2: Vérification des heures de travail"
    
    local response
    response=$(curl -s \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
        -d '{"action": "test_working_hours"}' \
        "$NEXT_PUBLIC_SUPABASE_URL/functions/v1/reminder-manager")
    
    if echo "$response" | jq -e '.working_hours' > /dev/null 2>&1; then
        success "Test heures de travail réussi"
        local working_hours
        working_hours=$(echo "$response" | jq -r '.working_hours')
        local current_time
        current_time=$(echo "$response" | jq -r '.current_time')
        local current_day
        current_day=$(echo "$response" | jq -r '.current_day')
        
        info "Actuellement: $current_time $current_day"
        info "Dans les heures de travail: $working_hours"
    else
        error "Échec test heures de travail"
        info "Réponse: $response"
        return 1
    fi
}

# Tester la vérification des relances
test_check_reminders() {
    step "Test 3: Vérification des emails pour relances"
    
    local dry_run_flag="true"
    if [[ "$MODE" == "real" ]]; then
        dry_run_flag="false"
    fi
    
    local response
    response=$(curl -s \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
        -d "{\"action\": \"check\", \"dry_run\": $dry_run_flag}" \
        "$NEXT_PUBLIC_SUPABASE_URL/functions/v1/reminder-manager")
    
    if echo "$response" | jq -e '.success' > /dev/null 2>&1; then
        success "Vérification des relances réussie"
        local candidates
        candidates=$(echo "$response" | jq -r '.candidates // 0')
        local scheduled
        scheduled=$(echo "$response" | jq -r '.scheduled // 0')
        
        info "Emails candidats: $candidates"
        info "Relances programmées: $scheduled"
        info "Mode dry-run: $(echo "$response" | jq -r '.dry_run')"
    else
        error "Échec vérification relances"
        info "Réponse: $response"
        return 1
    fi
}

# Tester l'envoi de relances
test_send_reminders() {
    step "Test 4: Envoi des relances dues"
    
    local dry_run_flag="true"
    if [[ "$MODE" == "real" ]]; then
        dry_run_flag="false"
    fi
    
    local response
    response=$(curl -s \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
        -d "{\"action\": \"send\", \"dry_run\": $dry_run_flag}" \
        "$NEXT_PUBLIC_SUPABASE_URL/functions/v1/reminder-manager")
    
    if echo "$response" | jq -e '.success' > /dev/null 2>&1; then
        success "Test envoi relances réussi"
        local total
        total=$(echo "$response" | jq -r '.total // 0')
        local sent
        sent=$(echo "$response" | jq -r '.sent // 0')
        local failed
        failed=$(echo "$response" | jq -r '.failed // 0')
        
        info "Relances dues: $total"
        info "Envoyées: $sent"
        info "Échecs: $failed"
        info "Mode dry-run: $(echo "$response" | jq -r '.dry_run')"
    else
        error "Échec test envoi relances"
        info "Réponse: $response"
        return 1
    fi
}

# Vérifier les données de test
check_test_data() {
    step "Test 5: Vérification des données de test"
    
    info "Connexion à la base de données..."
    
    # Compter les entrées dans les tables de test
    local settings_count
    settings_count=$(supabase db psql -c "SELECT COUNT(*) FROM test_reminder_settings;" --csv --no-header 2>/dev/null | tail -n 1 || echo "0")
    
    local reminders_count
    reminders_count=$(supabase db psql -c "SELECT COUNT(*) FROM test_email_reminders;" --csv --no-header 2>/dev/null | tail -n 1 || echo "0")
    
    info "Paramètres de test: $settings_count"
    info "Relances de test: $reminders_count"
    
    if [[ "$reminders_count" -gt 0 ]]; then
        info "Affichage des relances récentes:"
        supabase db psql -c "
            SELECT 
                te.subject,
                te.recipient_email,
                ter.status,
                ter.dry_run,
                ter.created_at
            FROM test_email_reminders ter
            JOIN tracked_emails te ON te.id = ter.tracked_email_id
            ORDER BY ter.created_at DESC 
            LIMIT 5;
        " || echo "Erreur lors de la récupération des données"
    fi
    
    success "Vérification des données terminée"
}

# Nettoyer les données de test
cleanup_test_data() {
    step "Nettoyage des données de test (optionnel)"
    
    echo -e "${YELLOW}Voulez-vous nettoyer les données de test ? (y/N)${NC}"
    read -r cleanup_choice
    
    if [[ "$cleanup_choice" =~ ^[Yy]$ ]]; then
        info "Suppression des données de test..."
        
        supabase db psql -c "DELETE FROM test_email_reminders;" || true
        supabase db psql -c "DELETE FROM test_reminder_templates;" || true  
        supabase db psql -c "DELETE FROM test_reminder_settings;" || true
        
        success "Données de test supprimées"
    else
        info "Données de test conservées pour inspection"
    fi
}

# Afficher le résumé final
show_summary() {
    step "Résumé des tests"
    
    echo -e "${GREEN}✅ Tests du système de relances terminés${NC}"
    echo ""
    echo -e "${BLUE}📋 Ce qui a été testé:${NC}"
    echo "   • Migration des tables de test"
    echo "   • Déploiement Edge Function reminder-manager"  
    echo "   • Récupération du statut"
    echo "   • Test des heures de travail"
    echo "   • Vérification des emails candidats"
    echo "   • Test d'envoi (mode: $MODE)"
    echo "   • Vérification des données créées"
    echo ""
    echo -e "${BLUE}🎯 Prochaines étapes:${NC}"
    echo "   • Tester depuis l'interface web /dashboard/reminders"
    echo "   • Configurer des templates personnalisés"
    echo "   • Valider avec des emails spécifiques"
    echo "   • Activer les jobs cron si tests satisfaisants:"
    echo "     SELECT activate_reminder_cron_jobs();"
    echo ""
    echo -e "${YELLOW}⚠️  Note: Les jobs cron restent désactivés en mode test${NC}"
}

# Fonction principale
main() {
    echo -e "${BLUE}Mode sélectionné: $MODE${NC}"
    if [[ "$MODE" == "real" ]]; then
        echo -e "${RED}⚠️  ATTENTION: Mode réel activé - des emails pourraient être envoyés !${NC}"
        echo -e "${YELLOW}Appuyez sur Entrée pour continuer ou Ctrl+C pour annuler...${NC}"
        read -r
    fi
    
    # Exécuter tous les tests
    check_prerequisites
    apply_migrations
    deploy_functions
    
    echo -e "\n${BLUE}🧪 Début des tests fonctionnels${NC}"
    echo "======================================================================================================"
    
    test_status
    test_working_hours  
    test_check_reminders
    test_send_reminders
    check_test_data
    
    cleanup_test_data
    show_summary
}

# Point d'entrée
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi