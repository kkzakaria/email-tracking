#!/bin/bash

# ====================================================================================================
# DIAGNOSTIC - OAuth Microsoft Graph sur Vercel
# ====================================================================================================
# Script pour diagnostiquer les problèmes d'authentification Microsoft Graph sur Vercel
# Usage: ./scripts/diagnose-vercel-oauth.sh
# ====================================================================================================

set -e

echo "🔧 Diagnostic OAuth Microsoft Graph sur Vercel..."

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ====================================================================================================
# 1. VÉRIFICATION DES VARIABLES D'ENVIRONNEMENT
# ====================================================================================================

echo -e "${BLUE}📋 1. Vérification des variables d'environnement locales...${NC}"

if [ ! -f ".env.local" ]; then
    echo -e "${RED}❌ Fichier .env.local non trouvé${NC}"
    exit 1
fi

source .env.local

echo -e "${GREEN}✅ Variables locales:${NC}"
echo -e "   NEXT_PUBLIC_APP_URL: ${NEXT_PUBLIC_APP_URL}"
echo -e "   AZURE_CLIENT_ID: ${AZURE_CLIENT_ID:0:8}..."
echo -e "   AZURE_TENANT_ID: ${AZURE_TENANT_ID:0:8}..."

# ====================================================================================================
# 2. VÉRIFICATION DES URLS DE CALLBACK
# ====================================================================================================

echo -e "${BLUE}📋 2. URLs de callback configurées...${NC}"

CALLBACK_URL="${NEXT_PUBLIC_APP_URL}/auth/microsoft-callback"
echo -e "${YELLOW}URL de callback calculée: ${CALLBACK_URL}${NC}"

# ====================================================================================================
# 3. CONFIGURATION AZURE AD REQUISE
# ====================================================================================================

echo -e "${BLUE}📋 3. Configuration Azure AD requise...${NC}"

echo -e "${YELLOW}URLs à ajouter dans Azure AD App Registration:${NC}"
echo -e "   Redirect URIs (Web):"
echo -e "   - ${NEXT_PUBLIC_APP_URL}/auth/microsoft-callback"
echo -e "   - https://email-tracking-zeta.vercel.app/auth/microsoft-callback"

echo -e "${YELLOW}Permissions API Microsoft Graph:${NC}"
echo -e "   - User.Read (Delegated)"
echo -e "   - Mail.Read (Delegated)"
echo -e "   - offline_access (Delegated)"

# ====================================================================================================
# 4. VARIABLES VERCEL REQUISES
# ====================================================================================================

echo -e "${BLUE}📋 4. Variables d'environnement Vercel requises...${NC}"

echo -e "${YELLOW}Commandes Vercel CLI à exécuter:${NC}"
echo -e "vercel env add NEXT_PUBLIC_SUPABASE_URL"
echo -e "vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY"
echo -e "vercel env add SUPABASE_SERVICE_ROLE_KEY"
echo -e "vercel env add NEXT_PUBLIC_APP_URL"
echo -e "vercel env add AZURE_CLIENT_ID"
echo -e "vercel env add AZURE_CLIENT_SECRET"
echo -e "vercel env add AZURE_TENANT_ID"
echo -e "vercel env add WEBHOOK_CLIENT_STATE"

# ====================================================================================================
# 5. TEST DE L'EDGE FUNCTION
# ====================================================================================================

echo -e "${BLUE}📋 5. Test de l'Edge Function microsoft-auth...${NC}"

echo -e "${YELLOW}URL de test:${NC}"
EDGE_FUNCTION_URL="${NEXT_PUBLIC_SUPABASE_URL}/functions/v1/microsoft-auth?action=authorize"
echo -e "${EDGE_FUNCTION_URL}"

echo -e "${YELLOW}Test avec curl:${NC}"
curl -s -H "Authorization: Bearer ${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
     -H "Content-Type: application/json" \
     "${EDGE_FUNCTION_URL}" | jq '.' 2>/dev/null || echo "Response reçue (format non-JSON ou erreur)"

# ====================================================================================================
# 6. CHECKLIST DE DÉBOGAGE
# ====================================================================================================

echo -e "${BLUE}📋 6. Checklist de débogage sur Vercel...${NC}"

echo -e "${GREEN}✅ Étapes à vérifier:${NC}"
echo -e "   1. Variables d'environnement définies sur Vercel"
echo -e "   2. URLs de callback ajoutées dans Azure AD"
echo -e "   3. Edge Functions déployées sur Supabase"
echo -e "   4. Bloqueur de popup désactivé dans le navigateur"
echo -e "   5. HTTPS activé (requis par Microsoft)"

echo -e "${YELLOW}💡 Commandes de test:${NC}"
echo -e "   - Tester sur: ${NEXT_PUBLIC_APP_URL}"
echo -e "   - Vérifier console dev (F12) pour les erreurs JavaScript"
echo -e "   - Vérifier Network tab pour les appels d'API"

echo -e "${GREEN}🎉 Diagnostic terminé${NC}"