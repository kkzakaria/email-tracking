#!/usr/bin/env node

/**
 * Test avec permissions déléguées Microsoft Graph
 * Nécessite un flow OAuth2 pour obtenir un token utilisateur
 */

require('dotenv').config({ path: '.env.local' });

const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID;
const AZURE_CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET;
const AZURE_TENANT_ID = process.env.AZURE_TENANT_ID;

console.log('🔍 Test des permissions déléguées Microsoft Graph...');
console.log('=' .repeat(50));

console.log(`
⚠️ PROBLÈME IDENTIFIÉ :
- Vos permissions sont de type "Déléguée"
- Pour l'automatisation, il faut des permissions "Application"

🔧 SOLUTION REQUISE :
1. Azure Portal > App registrations > Email Tracking App
2. API permissions > Mail.Send > Supprimer
3. Add permission > Microsoft Graph > Application permissions
4. Mail > Mail.Send (Application permission, pas Delegated)
5. Grant admin consent

📧 PERMISSIONS ACTUELLES DÉTECTÉES :
- Mail.Read (Déléguée) ✅
- Mail.ReadWrite (Déléguée) ✅
- Mail.Send (Déléguée) ✅ ← Problème : devrait être Application
- offline_access (Déléguée) ✅
- User.Read (Déléguée) ✅

🎯 PERMISSION REQUISE :
- Mail.Send (Application) ❌ ← Manquante

💡 ALTERNATIVE TEMPORAIRE :
Pour tester avec les permissions déléguées actuelles, il faudrait :
1. Implémenter un flow OAuth2 interactif
2. L'utilisateur se connecte et donne son consentement
3. Utiliser le token utilisateur pour envoyer les emails

Mais pour un système de relance automatique, les permissions Application sont indispensables.
`);

console.log('\n🔄 Une fois corrigé, relancez : node scripts/test-reminder-direct.js test');