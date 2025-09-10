#!/bin/bash

# ====================================================================================================
# TEST SCRIPT - Déconnexion complète Microsoft Graph
# ====================================================================================================
# Script pour tester le flow complet de déconnexion avec désabonnement automatique
# Usage: ./scripts/test-disconnection.sh
# ====================================================================================================

set -e

echo "🔧 Test du système de déconnexion complète Microsoft Graph..."

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ====================================================================================================
# VÉRIFICATIONS PRÉALABLES
# ====================================================================================================

echo -e "${BLUE}📋 Vérification des prérequis...${NC}"

# Vérifier les variables d'environnement
if [ ! -f ".env.local" ]; then
    echo -e "${RED}❌ Fichier .env.local non trouvé${NC}"
    exit 1
fi

# Source du fichier .env.local
set -a
source .env.local
set +a

if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
    echo -e "${RED}❌ NEXT_PUBLIC_SUPABASE_URL non définie${NC}"
    exit 1
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo -e "${RED}❌ SUPABASE_SERVICE_ROLE_KEY non définie${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prérequis validés${NC}"

# ====================================================================================================
# ÉTAT AVANT DÉCONNEXION
# ====================================================================================================

echo -e "${BLUE}📊 État avant déconnexion...${NC}"

echo -e "${YELLOW}📈 Subscriptions actives:${NC}"
supabase db remote sql <<EOF
SELECT 
    gs.user_id,
    gs.subscription_id,
    gs.is_active,
    gs.expiration_datetime,
    au.email
FROM graph_subscriptions gs
LEFT JOIN auth.users au ON gs.user_id = au.id
WHERE gs.is_active = true
ORDER BY gs.created_at DESC;
EOF

echo -e "${YELLOW}🔑 Tokens stockés:${NC}"
supabase db remote sql <<EOF
SELECT 
    user_id,
    expires_at,
    scope,
    last_refreshed_at
FROM microsoft_tokens
ORDER BY created_at DESC;
EOF

# ====================================================================================================
# TEST DE DÉCONNEXION VIA API
# ====================================================================================================

echo -e "${BLUE}🧪 Test de déconnexion via Edge Function...${NC}"

# Note: Ce test nécessite un token d'authentification utilisateur réel
# Pour un test complet, il faudrait soit :
# 1. Utiliser un token utilisateur réel
# 2. Ou mocker la déconnexion dans un environnement de test

echo -e "${YELLOW}⚠️ Test de déconnexion nécessite une authentification utilisateur réelle${NC}"
echo -e "${YELLOW}📝 L'utilisateur peut tester via l'interface web avec le bouton 'Déconnecter'${NC}"

# ====================================================================================================
# FONCTION DE VÉRIFICATION POST-DÉCONNEXION
# ====================================================================================================

echo -e "${BLUE}📋 Instructions pour vérification manuelle:${NC}"
echo -e "${GREEN}1. Aller sur l'interface web${NC}"
echo -e "${GREEN}2. Cliquer sur le bouton 'Déconnecter' de Microsoft Graph${NC}"
echo -e "${GREEN}3. Vérifier que les subscriptions et tokens sont supprimés${NC}"

echo -e "${BLUE}🔍 Pour vérifier après déconnexion:${NC}"
echo -e "${YELLOW}supabase db remote sql <<< \"SELECT COUNT(*) as subscriptions_restantes FROM graph_subscriptions WHERE is_active = true;\"${NC}"
echo -e "${YELLOW}supabase db remote sql <<< \"SELECT COUNT(*) as tokens_restants FROM microsoft_tokens;\"${NC}"

# ====================================================================================================
# SYSTÈME DE MONITORING
# ====================================================================================================

echo -e "${BLUE}📊 Système de monitoring disponible:${NC}"
echo -e "${GREEN}✅ Logs Edge Function : Dashboard Supabase > Functions${NC}"
echo -e "${GREEN}✅ Requêtes SQL : Tables graph_subscriptions et microsoft_tokens${NC}"
echo -e "${GREEN}✅ Vérification Microsoft Graph : Portail Azure > App registrations${NC}"

echo -e "${GREEN}🎉 Script de test préparé avec succès${NC}"
echo -e "${YELLOW}💡 Utilisez l'interface web pour tester la déconnexion complète${NC}"