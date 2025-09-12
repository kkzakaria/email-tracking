#!/bin/bash
# ====================================================================================================
# SCRIPT DE TEST - Relance d'email spécifique
# ====================================================================================================
# Description: Test de relance sur un email spécifique par son ID
# Usage: ./scripts/test-specific-email-reminder.sh <email_id> [dry-run|real]
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

# Paramètres
EMAIL_ID="$1"
MODE="${2:-dry-run}"

# Vérifier les paramètres
if [[ -z "$EMAIL_ID" ]]; then
    echo -e "${RED}❌ Usage: $0 <email_id> [dry-run|real]${NC}"
    echo ""
    echo -e "${BLUE}Pour trouver des email IDs disponibles:${NC}"
    echo "supabase db psql -c \"SELECT id, subject, recipient_email, sent_at FROM tracked_emails WHERE status = 'PENDING' LIMIT 5;\""
    exit 1
fi

echo -e "${BLUE}🎯 Test de relance pour email spécifique${NC}"
echo "======================================================================================================"
echo -e "${BLUE}Email ID: $EMAIL_ID${NC}"
echo -e "${BLUE}Mode: $MODE${NC}"
echo ""

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

# Charger l'environnement
load_environment() {
    step "Chargement de l'environnement"
    
    if [[ ! -f "$ENV_FILE" ]]; then
        error "Fichier .env.local manquant"
        exit 1
    fi
    
    source "$ENV_FILE"
    
    if [[ -z "$NEXT_PUBLIC_SUPABASE_URL" ]] || [[ -z "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ]]; then
        error "Variables d'environnement Supabase manquantes"
        exit 1
    fi
    
    success "Environnement chargé"
}

# Vérifier l'email
check_email_exists() {
    step "Vérification de l'email"
    
    info "Recherche de l'email ID: $EMAIL_ID"
    
    local email_info
    email_info=$(supabase db psql -c "
        SELECT 
            id,
            message_id,
            subject,
            recipient_email,
            sender_email,
            sent_at,
            status,
            EXTRACT(DAY FROM (NOW() - sent_at)) as days_elapsed
        FROM tracked_emails 
        WHERE id = '$EMAIL_ID';
    " --csv 2>/dev/null || echo "")
    
    if [[ -z "$email_info" ]] || [[ "$email_info" == *"0 rows"* ]]; then
        error "Email avec ID $EMAIL_ID non trouvé"
        
        info "Emails PENDING disponibles:"
        supabase db psql -c "
            SELECT 
                id,
                subject,
                recipient_email,
                EXTRACT(DAY FROM (NOW() - sent_at)) as days_elapsed
            FROM tracked_emails 
            WHERE status = 'PENDING' 
            ORDER BY sent_at DESC 
            LIMIT 5;
        " 2>/dev/null || echo "Erreur lors de la récupération des emails"
        
        exit 1
    fi
    
    success "Email trouvé"
    
    # Afficher les détails de l'email
    echo ""
    supabase db psql -c "
        SELECT 
            'ID' as field, id::text as value FROM tracked_emails WHERE id = '$EMAIL_ID'
        UNION ALL
        SELECT 'Sujet' as field, subject as value FROM tracked_emails WHERE id = '$EMAIL_ID'
        UNION ALL
        SELECT 'Destinataire' as field, recipient_email as value FROM tracked_emails WHERE id = '$EMAIL_ID'
        UNION ALL
        SELECT 'Expéditeur' as field, COALESCE(sender_email, 'Non spécifié') as value FROM tracked_emails WHERE id = '$EMAIL_ID'
        UNION ALL
        SELECT 'Envoyé le' as field, sent_at::text as value FROM tracked_emails WHERE id = '$EMAIL_ID'
        UNION ALL
        SELECT 'Statut' as field, status as value FROM tracked_emails WHERE id = '$EMAIL_ID'
        UNION ALL
        SELECT 'Jours écoulés' as field, EXTRACT(DAY FROM (NOW() - sent_at))::text as value FROM tracked_emails WHERE id = '$EMAIL_ID';
    " 2>/dev/null || echo "Erreur lors de l'affichage des détails"
    
    echo ""
}

# Programmer la relance de test
schedule_test_reminder() {
    step "Programmation de la relance de test"
    
    local dry_run_flag="true"
    if [[ "$MODE" == "real" ]]; then
        dry_run_flag="false"
        echo -e "${RED}⚠️  Mode réel activé - l'email sera réellement envoyé !${NC}"
        echo -e "${YELLOW}Appuyez sur Entrée pour continuer ou Ctrl+C pour annuler...${NC}"
        read -r
    fi
    
    info "Programmation de la relance pour email $EMAIL_ID (dry_run: $dry_run_flag)"
    
    local response
    response=$(curl -s \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
        -d "{
            \"action\": \"schedule_test\",
            \"test_email_ids\": [\"$EMAIL_ID\"],
            \"dry_run\": $dry_run_flag
        }" \
        "$NEXT_PUBLIC_SUPABASE_URL/functions/v1/reminder-manager")
    
    if echo "$response" | jq -e '.success' > /dev/null 2>&1; then
        success "Relance programmée avec succès"
        
        local reminder_id
        reminder_id=$(echo "$response" | jq -r '.results[0].reminder_id // "N/A"')
        info "ID de la relance: $reminder_id"
        
        # Afficher les détails de la programmation
        if [[ "$reminder_id" != "N/A" ]]; then
            info "Vérification en base de données..."
            supabase db psql -c "
                SELECT 
                    'ID relance' as field, ter.id::text as value
                FROM test_email_reminders ter WHERE ter.id = '$reminder_id'
                UNION ALL
                SELECT 'Statut' as field, ter.status as value
                FROM test_email_reminders ter WHERE ter.id = '$reminder_id'
                UNION ALL
                SELECT 'Dry run' as field, ter.dry_run::text as value
                FROM test_email_reminders ter WHERE ter.id = '$reminder_id'
                UNION ALL
                SELECT 'Prochaine relance' as field, ter.next_reminder_due_at::text as value
                FROM test_email_reminders ter WHERE ter.id = '$reminder_id'
                UNION ALL
                SELECT 'Template' as field, LEFT(ter.template_content, 100) || '...' as value
                FROM test_email_reminders ter WHERE ter.id = '$reminder_id';
            " 2>/dev/null || echo "Erreur lors de la vérification"
        fi
    else
        error "Échec programmation relance"
        info "Réponse: $response"
        return 1
    fi
}

# Vérifier les relances candidates
check_reminders_for_email() {
    step "Vérification spécifique pour cet email"
    
    local dry_run_flag="true"
    if [[ "$MODE" == "real" ]]; then
        dry_run_flag="false"
    fi
    
    info "Vérification des relances candidates pour email $EMAIL_ID"
    
    local response
    response=$(curl -s \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
        -d "{
            \"action\": \"check\",
            \"test_email_ids\": [\"$EMAIL_ID\"],
            \"dry_run\": $dry_run_flag
        }" \
        "$NEXT_PUBLIC_SUPABASE_URL/functions/v1/reminder-manager")
    
    if echo "$response" | jq -e '.success' > /dev/null 2>&1; then
        success "Vérification réussie"
        
        local candidates
        candidates=$(echo "$response" | jq -r '.candidates // 0')
        local scheduled
        scheduled=$(echo "$response" | jq -r '.scheduled // 0')
        local working_hours
        working_hours=$(echo "$response" | jq -r '.working_hours')
        
        info "Emails candidats: $candidates"
        info "Relances programmées: $scheduled"
        info "Dans les heures de travail: $working_hours"
        
        # Afficher les détails si disponibles
        if echo "$response" | jq -e '.details[0]' > /dev/null 2>&1; then
            echo ""
            info "Détails de l'email:"
            echo "$response" | jq -r '.details[0] | "  Sujet: \(.subject // "N/A")\n  Destinataire: \(.recipient // "N/A")\n  Jours écoulés: \(.days_elapsed // "N/A")\n  Statut: \(.status // "N/A")"'
        fi
    else
        error "Échec vérification"
        info "Réponse: $response"
        return 1
    fi
}

# Essayer d'envoyer la relance
send_reminder() {
    step "Test d'envoi de la relance"
    
    local dry_run_flag="true"
    if [[ "$MODE" == "real" ]]; then
        dry_run_flag="false"
    fi
    
    info "Tentative d'envoi de relance pour email $EMAIL_ID"
    
    local response
    response=$(curl -s \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
        -d "{
            \"action\": \"send\",
            \"test_email_ids\": [\"$EMAIL_ID\"],
            \"dry_run\": $dry_run_flag
        }" \
        "$NEXT_PUBLIC_SUPABASE_URL/functions/v1/reminder-manager")
    
    if echo "$response" | jq -e '.success' > /dev/null 2>&1; then
        success "Test d'envoi réussi"
        
        local total
        total=$(echo "$response" | jq -r '.total // 0')
        local sent
        sent=$(echo "$response" | jq -r '.sent // 0')
        local failed  
        failed=$(echo "$response" | jq -r '.failed // 0')
        
        info "Total à envoyer: $total"
        info "Envoyés: $sent"
        info "Échecs: $failed"
        
        if [[ "$MODE" == "dry-run" ]]; then
            info "Mode simulation - aucun email réellement envoyé"
        else
            if [[ "$sent" -gt 0 ]]; then
                success "Email de relance envoyé !"
            else
                error "Aucun email envoyé - vérifiez les logs"
            fi
        fi
    else
        error "Échec test d'envoi"
        info "Réponse: $response"
        return 1
    fi
}

# Vérifier l'historique de relances
check_reminder_history() {
    step "Historique des relances pour cet email"
    
    info "Recherche des relances existantes..."
    
    local count
    count=$(supabase db psql -c "SELECT COUNT(*) FROM test_email_reminders WHERE tracked_email_id = '$EMAIL_ID';" --csv --no-header 2>/dev/null | tail -n 1 || echo "0")
    
    if [[ "$count" -gt 0 ]]; then
        info "Relances trouvées: $count"
        echo ""
        supabase db psql -c "
            SELECT 
                'ID' as field, id::text as value FROM test_email_reminders WHERE tracked_email_id = '$EMAIL_ID'
            UNION ALL
            SELECT 'Statut' as field, status as value FROM test_email_reminders WHERE tracked_email_id = '$EMAIL_ID'
            UNION ALL
            SELECT 'Nombre' as field, reminder_count::text as value FROM test_email_reminders WHERE tracked_email_id = '$EMAIL_ID'
            UNION ALL
            SELECT 'Max' as field, max_reminders::text as value FROM test_email_reminders WHERE tracked_email_id = '$EMAIL_ID'
            UNION ALL
            SELECT 'Dry run' as field, dry_run::text as value FROM test_email_reminders WHERE tracked_email_id = '$EMAIL_ID'
            UNION ALL
            SELECT 'Créé le' as field, created_at::text as value FROM test_email_reminders WHERE tracked_email_id = '$EMAIL_ID'
            UNION ALL
            SELECT 'Prochaine due' as field, COALESCE(next_reminder_due_at::text, 'Non planifiée') as value FROM test_email_reminders WHERE tracked_email_id = '$EMAIL_ID'
            ORDER BY field;
        " 2>/dev/null || echo "Erreur lors de la récupération de l'historique"
    else
        info "Aucune relance trouvée pour cet email"
    fi
}

# Résumé final
show_summary() {
    step "Résumé du test"
    
    echo -e "${GREEN}✅ Test de relance spécifique terminé${NC}"
    echo ""
    echo -e "${BLUE}📋 Email testé:${NC}"
    echo "   ID: $EMAIL_ID"
    echo "   Mode: $MODE"
    echo ""
    echo -e "${BLUE}🎯 Actions effectuées:${NC}"
    echo "   • Vérification existence de l'email"
    echo "   • Programmation de relance de test"
    echo "   • Vérification des candidats"
    echo "   • Test d'envoi"
    echo "   • Vérification historique"
    echo ""
    echo -e "${BLUE}📊 Pour voir les données complètes:${NC}"
    echo "   • Interface web: /dashboard/reminders"
    echo "   • Base de données: SELECT * FROM test_reminder_queue;"
    echo "   • Logs détaillés: Dans debug_logs des relances"
}

# Fonction principale
main() {
    if [[ "$MODE" == "real" ]]; then
        echo -e "${RED}⚠️  ATTENTION: Mode réel sélectionné${NC}"
        echo -e "${YELLOW}Un email de relance sera réellement envoyé !${NC}"
        echo ""
    fi
    
    load_environment
    check_email_exists
    schedule_test_reminder
    check_reminders_for_email
    send_reminder
    check_reminder_history
    show_summary
}

# Point d'entrée
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main
fi