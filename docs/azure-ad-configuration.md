# Configuration Azure AD pour l'Application Email Tracking

## Problème AADSTS50011 - Redirect URI Mismatch

### Erreur Rencontrée
```
AADSTS50011: The redirect URI 'http://localhost:3000/api/auth/microsoft/callback' 
specified in the request does not match the redirect URIs configured for the 
application '2a7d8d0e-794e-4b9c-b458-c01e0c6a1e0b'.
```

### Solution : Configurer les URI de Redirection

## 1. Accéder à Azure Portal

1. Aller sur https://portal.azure.com
2. Naviguer vers **Azure Active Directory** → **App registrations**
3. Chercher l'application : `2a7d8d0e-794e-4b9c-b458-c01e0c6a1e0b`
4. Cliquer sur l'application pour l'ouvrir

## 2. Configurer les URI de Redirection

### Étape 1: Aller dans Authentication
1. Dans le menu de gauche, cliquer sur **Authentication**
2. Sous **Platform configurations**, chercher **Web**

### Étape 2: Ajouter les URI de Redirection
Ajouter les URI suivantes dans **Redirect URIs** :

```
https://email-tracking-zeta.vercel.app/api/auth/microsoft/callback
http://localhost:3000/api/auth/microsoft/callback
```

### Étape 3: Configuration Complète

**Platform**: Web  
**Redirect URIs**:
- `https://email-tracking-zeta.vercel.app/api/auth/microsoft/callback` (Production Vercel)
- `http://localhost:3000/api/auth/microsoft/callback` (Développement local)

**Front-channel logout URL**: *(laisser vide)*

**Implicit grant and hybrid flows**:
- ☐ Access tokens (not needed for this flow)
- ☐ ID tokens (not needed for this flow)

### Étape 4: Sauvegarder
Cliquer sur **Save** en haut de la page

## 3. Vérifier les Permissions API

### Permissions Requises
Dans **API permissions**, vérifier que ces permissions sont accordées :

**Microsoft Graph**:
- `User.Read` (Delegated) ✅
- `Mail.Read` (Delegated) ✅  
- `Mail.Send` (Delegated) ✅
- `Mail.ReadWrite` (Delegated) ✅
- `openid` (Delegated) ✅
- `profile` (Delegated) ✅
- `email` (Delegated) ✅

### Grant Admin Consent
1. Cliquer sur **Grant admin consent for [Tenant]**
2. Confirmer en cliquant **Yes**

## 4. Variables d'Environnement

### Vérifier .env.local
```bash
# Azure AD Configuration
AZURE_AD_CLIENT_ID="your-client-id-from-azure-portal"
AZURE_AD_CLIENT_SECRET="your-client-secret-from-azure-portal"
AZURE_AD_TENANT_ID="your-tenant-id-from-azure-portal"

# App URLs
NEXT_PUBLIC_APP_URL="https://your-app-name.vercel.app"
```

### Variables Vercel
S'assurer que sur Vercel, les variables d'environnement sont configurées :

```bash
AZURE_AD_CLIENT_ID=your-client-id-from-azure-portal
AZURE_AD_CLIENT_SECRET=your-client-secret-from-azure-portal
AZURE_AD_TENANT_ID=your-tenant-id-from-azure-portal
NEXT_PUBLIC_APP_URL=https://your-app-name.vercel.app
```

## 5. Test de la Configuration

### URL de Test
```
https://your-app-name.vercel.app/login
```

### Flow Attendu
1. Cliquer sur "Se connecter avec Microsoft"
2. Redirection vers Microsoft Login
3. Authentification Microsoft
4. Redirection vers `https://your-app-name.vercel.app/api/auth/microsoft/callback`
5. Traitement du callback
6. Redirection finale vers `/dashboard`

## 6. Debugging

### Logs à Vérifier
```bash
# Dans les logs Vercel ou console
🔗 Microsoft OAuth redirect URL: https://your-app-name.vercel.app/api/auth/microsoft/callback
```

### URLs de Debug
- **Production**: https://your-app-name.vercel.app/login
- **Développement**: http://localhost:3000/login

### Commandes de Test
```bash
# Vérifier la configuration locale
echo $NEXT_PUBLIC_APP_URL

# Tester en développement
pnpm dev
# Aller sur http://localhost:3000/login

# Déployer sur Vercel
vercel --prod
```

## 7. Troubleshooting Commun

### Erreur: "Invalid client secret"
- Vérifier que `AZURE_AD_CLIENT_SECRET` est correct
- Regénérer un nouveau secret dans Azure AD si nécessaire

### Erreur: "Invalid client"
- Vérifier que `AZURE_AD_CLIENT_ID` correspond à l'app registration
- Vérifier que l'app registration est active

### Erreur: "Redirect URI mismatch" (encore)
- Vérifier l'orthographe exacte des URI dans Azure AD
- S'assurer qu'il n'y a pas d'espaces ou caractères invisibles
- Vérifier que les URI utilisent HTTPS en production

### Erreur: "Insufficient privileges"
- Vérifier que les permissions API sont accordées
- Cliquer sur "Grant admin consent" dans Azure AD

## 8. Configuration Multi-Environnement

### Development
```
http://localhost:3000/api/auth/microsoft/callback
```

### Staging (si applicable)
```
https://your-app-name-git-staging-yourorg.vercel.app/api/auth/microsoft/callback
```

### Production
```
https://your-app-name.vercel.app/api/auth/microsoft/callback
```

Ajouter tous ces URI dans Azure AD pour couvrir tous les environnements.

## 9. Sécurité

### Bonnes Pratiques
- ✅ Utiliser HTTPS en production
- ✅ Garder les secrets sécurisés
- ✅ Accorder seulement les permissions nécessaires
- ✅ Utiliser des URI de redirection spécifiques (pas de wildcards)
- ✅ Vérifier régulièrement les permissions accordées

### Audit
- Vérifier périodiquement les utilisateurs connectés
- Monitorer les tentatives de connexion échouées
- Renouveler les secrets Azure AD régulièrement