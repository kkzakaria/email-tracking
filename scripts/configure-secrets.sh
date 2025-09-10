#!/bin/bash

# ====================================================================================================
# SCRIPT: Configuration des secrets Supabase pour OAuth Microsoft
# ====================================================================================================
# Description: Configure tous les secrets nécessaires pour le flow OAuth Microsoft Graph
# Usage: ./scripts/configure-secrets.sh
# ====================================================================================================

set -e

echo "🔐 Configuration des secrets Supabase pour Microsoft OAuth..."

# Couleurs pour l'output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ====================================================================================================
# VÉRIFICATION DES VARIABLES D'ENVIRONNEMENT
# ====================================================================================================

echo -e "${BLUE}📋 Vérification des variables d'environnement...${NC}"

# Charger les variables depuis .env.local
if [ -f .env.local ]; then
    export $(grep -v '^#' .env.local | xargs)
    echo -e "${GREEN}✅ Variables chargées depuis .env.local${NC}"
else
    echo -e "${RED}❌ Fichier .env.local non trouvé${NC}"
    exit 1
fi

# Vérifier les variables Azure requises
if [ -z "$AZURE_CLIENT_ID" ] || [ -z "$AZURE_CLIENT_SECRET" ] || [ -z "$AZURE_TENANT_ID" ]; then
    echo -e "${RED}❌ Variables Azure manquantes dans .env.local${NC}"
    echo "   Vérifiez: AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID"
    exit 1
fi

# Vérifier les variables Supabase
if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ] || [ -z "$WEBHOOK_CLIENT_STATE" ]; then
    echo -e "${RED}❌ Variables Supabase manquantes dans .env.local${NC}"
    echo "   Vérifiez: SUPABASE_SERVICE_ROLE_KEY, WEBHOOK_CLIENT_STATE"
    exit 1
fi

echo -e "${GREEN}✅ Toutes les variables requises sont présentes${NC}"

# ====================================================================================================
# GÉNÉRATION DE LA CLÉ DE CHIFFREMENT
# ====================================================================================================

echo -e "${BLUE}🔑 Génération de la clé de chiffrement SERVER_SALT...${NC}"

# Générer une clé aléatoire de 256 bits (32 bytes) encodée en base64
SERVER_SALT=$(openssl rand -base64 32)

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Clé SERVER_SALT générée avec succès${NC}"
else
    echo -e "${RED}❌ Erreur génération SERVER_SALT${NC}"
    exit 1
fi

# ====================================================================================================
# CONFIGURATION DES SECRETS SUPABASE
# ====================================================================================================

echo -e "${BLUE}☁️  Configuration des secrets Supabase...${NC}"

# Liste des secrets à configurer
secrets=(
    "AZURE_CLIENT_ID:$AZURE_CLIENT_ID"
    "AZURE_CLIENT_SECRET:$AZURE_CLIENT_SECRET" 
    "AZURE_TENANT_ID:$AZURE_TENANT_ID"
    "SUPABASE_SERVICE_ROLE_KEY:$SUPABASE_SERVICE_ROLE_KEY"
    "WEBHOOK_CLIENT_STATE:$WEBHOOK_CLIENT_STATE"
    "SERVER_SALT:$SERVER_SALT"
)

echo -e "${YELLOW}📤 Configuration des secrets...${NC}"

for secret in "${secrets[@]}"; do
    key=$(echo $secret | cut -d: -f1)
    value=$(echo $secret | cut -d: -f2-)
    
    echo -n "   Configurant $key... "
    
    # Configurer le secret (mode silencieux)
    if echo "$value" | supabase secrets set "$key" --stdin > /dev/null 2>&1; then
        echo -e "${GREEN}✅${NC}"
    else
        echo -e "${RED}❌${NC}"
        echo -e "${RED}   Erreur configuration secret: $key${NC}"
        exit 1
    fi
done

# ====================================================================================================
# VÉRIFICATION DE LA CONFIGURATION
# ====================================================================================================

echo -e "${BLUE}🔍 Vérification de la configuration...${NC}"

echo -n "   Listage des secrets... "
if supabase secrets list > /tmp/secrets_list.txt 2>&1; then
    echo -e "${GREEN}✅${NC}"
    
    # Vérifier que tous les secrets sont présents
    missing_secrets=()
    for secret in "${secrets[@]}"; do
        key=$(echo $secret | cut -d: -f1)
        if ! grep -q "$key" /tmp/secrets_list.txt; then
            missing_secrets+=("$key")
        fi
    done
    
    if [ ${#missing_secrets[@]} -eq 0 ]; then
        echo -e "${GREEN}✅ Tous les secrets sont configurés correctement${NC}"
    else
        echo -e "${RED}❌ Secrets manquants: ${missing_secrets[*]}${NC}"
        exit 1
    fi
    
    # Nettoyer
    rm -f /tmp/secrets_list.txt
else
    echo -e "${RED}❌${NC}"
    echo -e "${RED}   Impossible de lister les secrets${NC}"
    exit 1
fi

# ====================================================================================================
# RÉCAPITULATIF
# ====================================================================================================

echo ""
echo -e "${GREEN}🎉 Configuration terminée avec succès !${NC}"
echo ""
echo -e "${BLUE}📋 Récapitulatif des secrets configurés:${NC}"
echo "   ✅ AZURE_CLIENT_ID"
echo "   ✅ AZURE_CLIENT_SECRET"  
echo "   ✅ AZURE_TENANT_ID"
echo "   ✅ SUPABASE_SERVICE_ROLE_KEY"
echo "   ✅ WEBHOOK_CLIENT_STATE"
echo "   ✅ SERVER_SALT (clé de chiffrement générée)"
echo ""
echo -e "${YELLOW}⚠️  Important:${NC}"
echo "   • La clé SERVER_SALT a été générée automatiquement"
echo "   • Ne partagez jamais cette clé - elle protège les tokens utilisateur"
echo "   • Sauvegardez cette clé si vous devez migrer vers un autre projet"
echo ""
echo -e "${BLUE}🔄 Prochaines étapes:${NC}"
echo "   1. Déployer les Edge Functions: supabase functions deploy"
echo "   2. Appliquer les migrations: supabase db push"  
echo "   3. Tester le flow OAuth dans l'interface"
echo ""