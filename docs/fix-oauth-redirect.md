# Fix OAuth Redirect Error - Guide Rapide

## ⚠️ Erreur AADSTS50011

```
The redirect URI 'http://localhost:3000/api/auth/microsoft/callback' 
does not match the redirect URIs configured for the application
```

## 🚀 Solution Rapide (5 minutes)

### Étape 1: Aller sur Azure Portal
1. **Ouvrir** : https://portal.azure.com
2. **Naviguer** : Azure Active Directory → App registrations
3. **Chercher** : Votre application ID Azure AD
4. **Cliquer** sur l'application

### Étape 2: Configurer les URI de Redirection
1. **Cliquer** sur **Authentication** (dans le menu de gauche)
2. **Trouver** la section **Web** sous Platform configurations
3. **Ajouter** ces URI dans **Redirect URIs** :

```
https://your-app-name.vercel.app/api/auth/microsoft/callback
http://localhost:3000/api/auth/microsoft/callback
```

4. **Cliquer** sur **Save**

### Étape 3: Tester
```bash
# Test diagnostic
GET https://your-app-name.vercel.app/api/debug/oauth-config

# Test connexion  
https://your-app-name.vercel.app/login
```

## 🔧 Code Corrigé

L'action de connexion a été mise à jour pour détecter automatiquement l'environnement :

```typescript
// app/login/actions.ts - Version corrigée
const getRedirectUrl = () => {
  // Production Vercel
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}/api/auth/microsoft/callback`
  }
  
  // Configuration manuelle
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/microsoft/callback`
  }
  
  // Développement local
  return 'http://localhost:3000/api/auth/microsoft/callback'
}
```

## 🧪 API de Diagnostic

**URL** : `/api/debug/oauth-config`

**Utilité** :
- Vérifier la configuration OAuth actuelle
- Diagnostiquer les problèmes d'URL de redirection
- Obtenir les URI à configurer dans Azure AD

**Exemple de réponse** :
```json
{
  "status": "OK",
  "azure_config": {
    "client_id": "your-azure-client-id",
    "tenant_id": "your-azure-tenant-id"
  },
  "app_urls": {
    "calculated_redirect_url": "https://your-app-name.vercel.app/api/auth/microsoft/callback"
  },
  "required_azure_redirects": [
    "https://your-app-name.vercel.app/api/auth/microsoft/callback",
    "http://localhost:3000/api/auth/microsoft/callback"
  ]
}
```

## ✅ Vérification

Après configuration, vous devriez voir :

1. **Azure AD** : Les 2 URI de redirection ajoutés
2. **Logs** : `🔗 Microsoft OAuth redirect URL: https://your-app-name.vercel.app/...`
3. **Test** : Connexion Microsoft qui fonctionne

## 🆘 Si ça ne marche pas

### Vérifications Communes
- [ ] Les URI dans Azure AD sont **exactement** identiques (pas d'espaces)
- [ ] L'application Azure AD est **active** 
- [ ] Les **permissions** sont accordées (Grant admin consent)
- [ ] Les **variables d'environnement** sont correctes sur Vercel

### Debug Avancé
```bash
# Vérifier les variables Vercel
vercel env ls

# Tester en local
echo $NEXT_PUBLIC_APP_URL
pnpm dev

# Logs détaillés
vercel logs --follow
```

### Contact Support
Si le problème persiste après ces étapes, contacter l'administrateur Azure AD avec :
- Application ID : Votre ID d'application Azure AD
- URI à ajouter : Les 2 URI listés ci-dessus
- Capture d'écran de l'erreur