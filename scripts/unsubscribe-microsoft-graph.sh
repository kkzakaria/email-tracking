#!/bin/bash

# ====================================================================================================
# SCRIPT: Désinscrire toutes les souscriptions Microsoft Graph
# ====================================================================================================
# Description: Liste et supprime toutes les souscriptions actives Microsoft Graph
# Usage: ./scripts/unsubscribe-microsoft-graph.sh
# ====================================================================================================

set -e

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=====================================================================================================${NC}"
echo -e "${BLUE}Microsoft Graph - Suppression des souscriptions${NC}"
echo -e "${BLUE}=====================================================================================================${NC}"

# Charger les variables d'environnement
if [ -f .env.local ]; then
    export $(cat .env.local | grep -v '^#' | xargs)
    echo -e "${GREEN}✅ Variables d'environnement chargées${NC}"
else
    echo -e "${RED}❌ Erreur: Fichier .env.local non trouvé${NC}"
    exit 1
fi

# Vérifier les variables requises
if [ -z "$AZURE_CLIENT_ID" ] || [ -z "$AZURE_CLIENT_SECRET" ] || [ -z "$AZURE_TENANT_ID" ]; then
    echo -e "${RED}❌ Erreur: Variables Azure manquantes dans .env.local${NC}"
    exit 1
fi

echo -e "\n${YELLOW}🔐 Obtention du token d'accès Microsoft Graph...${NC}"

# Obtenir un token d'accès avec client_credentials
TOKEN_RESPONSE=$(curl -s -X POST \
    "https://login.microsoftonline.com/$AZURE_TENANT_ID/oauth2/v2.0/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "client_id=$AZURE_CLIENT_ID" \
    -d "client_secret=$AZURE_CLIENT_SECRET" \
    -d "scope=https://graph.microsoft.com/.default" \
    -d "grant_type=client_credentials")

ACCESS_TOKEN=$(echo $TOKEN_RESPONSE | jq -r '.access_token')

if [ "$ACCESS_TOKEN" == "null" ] || [ -z "$ACCESS_TOKEN" ]; then
    echo -e "${RED}❌ Erreur: Impossible d'obtenir le token d'accès${NC}"
    echo "Réponse: $TOKEN_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✅ Token d'accès obtenu${NC}"

# Lister toutes les souscriptions
echo -e "\n${YELLOW}📋 Récupération des souscriptions actives...${NC}"

SUBSCRIPTIONS_RESPONSE=$(curl -s -X GET \
    "https://graph.microsoft.com/v1.0/subscriptions" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json")

# Vérifier si la requête a réussi
if echo "$SUBSCRIPTIONS_RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
    echo -e "${RED}❌ Erreur lors de la récupération des souscriptions:${NC}"
    echo "$SUBSCRIPTIONS_RESPONSE" | jq '.'
    exit 1
fi

# Extraire les souscriptions
SUBSCRIPTIONS=$(echo $SUBSCRIPTIONS_RESPONSE | jq -r '.value')
SUBSCRIPTION_COUNT=$(echo $SUBSCRIPTIONS | jq '. | length')

echo -e "${GREEN}✅ Nombre de souscriptions trouvées: $SUBSCRIPTION_COUNT${NC}"

if [ "$SUBSCRIPTION_COUNT" -eq 0 ]; then
    echo -e "${YELLOW}ℹ️  Aucune souscription active trouvée${NC}"
    exit 0
fi

# Afficher les souscriptions
echo -e "\n${BLUE}📝 Liste des souscriptions:${NC}"
echo "$SUBSCRIPTIONS" | jq -r '.[] | "- ID: \(.id)\n  Resource: \(.resource)\n  ChangeType: \(.changeType)\n  Expiration: \(.expirationDateTime)\n  NotificationUrl: \(.notificationUrl)\n"'

# Demander confirmation
echo -e "\n${YELLOW}⚠️  Voulez-vous supprimer toutes ces souscriptions? (y/N)${NC}"
read -r CONFIRMATION

if [ "$CONFIRMATION" != "y" ] && [ "$CONFIRMATION" != "Y" ]; then
    echo -e "${YELLOW}Annulation de la suppression${NC}"
    exit 0
fi

# Supprimer chaque souscription
echo -e "\n${YELLOW}🗑️  Suppression des souscriptions...${NC}"

DELETED_COUNT=0
FAILED_COUNT=0

for SUBSCRIPTION_ID in $(echo $SUBSCRIPTIONS | jq -r '.[] | .id'); do
    echo -e "\n${YELLOW}Suppression de: $SUBSCRIPTION_ID${NC}"
    
    DELETE_RESPONSE=$(curl -s -w "\n%{http_code}" -X DELETE \
        "https://graph.microsoft.com/v1.0/subscriptions/$SUBSCRIPTION_ID" \
        -H "Authorization: Bearer $ACCESS_TOKEN")
    
    HTTP_CODE=$(echo "$DELETE_RESPONSE" | tail -n 1)
    RESPONSE_BODY=$(echo "$DELETE_RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" -eq 204 ] || [ "$HTTP_CODE" -eq 200 ]; then
        echo -e "${GREEN}✅ Souscription supprimée: $SUBSCRIPTION_ID${NC}"
        DELETED_COUNT=$((DELETED_COUNT + 1))
    elif [ "$HTTP_CODE" -eq 404 ]; then
        echo -e "${YELLOW}⚠️  Souscription déjà supprimée ou inexistante: $SUBSCRIPTION_ID${NC}"
        DELETED_COUNT=$((DELETED_COUNT + 1))
    else
        echo -e "${RED}❌ Erreur lors de la suppression: $SUBSCRIPTION_ID (HTTP $HTTP_CODE)${NC}"
        if [ -n "$RESPONSE_BODY" ]; then
            echo "$RESPONSE_BODY" | jq '.' 2>/dev/null || echo "$RESPONSE_BODY"
        fi
        FAILED_COUNT=$((FAILED_COUNT + 1))
    fi
done

# Résumé
echo -e "\n${BLUE}=====================================================================================================${NC}"
echo -e "${BLUE}Résumé${NC}"
echo -e "${BLUE}=====================================================================================================${NC}"
echo -e "${GREEN}✅ Souscriptions supprimées: $DELETED_COUNT${NC}"
if [ "$FAILED_COUNT" -gt 0 ]; then
    echo -e "${RED}❌ Échecs: $FAILED_COUNT${NC}"
fi

# Nettoyer la base de données locale
echo -e "\n${YELLOW}🧹 Nettoyage de la base de données locale...${NC}"

if [ -n "$SUPABASE_SERVICE_ROLE_KEY" ] && [ -n "$NEXT_PUBLIC_SUPABASE_URL" ]; then
    # Marquer toutes les souscriptions comme inactives
    curl -s -X PATCH \
        "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/graph_subscriptions?is_active=eq.true" \
        -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
        -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
        -H "Content-Type: application/json" \
        -H "Prefer: return=minimal" \
        -d '{"is_active": false}' > /dev/null 2>&1
    
    echo -e "${GREEN}✅ Base de données locale mise à jour${NC}"
else
    echo -e "${YELLOW}⚠️  Variables Supabase manquantes, nettoyage manuel requis${NC}"
fi

echo -e "\n${GREEN}✅ Terminé!${NC}"