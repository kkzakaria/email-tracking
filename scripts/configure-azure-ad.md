# Configuration Azure AD pour Vercel

## 🎯 Problème Résolu
La popup d'authentification Microsoft Graph ne s'ouvrait pas sur Vercel car :
1. **URL de callback incorrecte** : L'Edge Function utilisait `localhost:3000`
2. **Configuration Azure AD manquante** : Les URLs Vercel n'étaient pas autorisées

## ✅ Solution Appliquée

### 1. Correction Edge Function
- **Modifié** : `supabase/functions/microsoft-auth/index.ts`
- **Changement** : Utilise `APP_URL` depuis les secrets Supabase
- **Secret configuré** : `APP_URL=https://email-tracking-zeta.vercel.app`

### 2. Configuration Azure AD Requise

Aller sur : https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade

#### App Registration: `2a7d8d0e-794e-4b9c-b458-c01e0c6a1e0b`

**Redirect URIs à ajouter :**
```
https://email-tracking-zeta.vercel.app/auth/microsoft-callback
```

**Permissions API Microsoft Graph :**
- ✅ `User.Read` (Delegated) - Lecture profil utilisateur
- ✅ `Mail.Read` (Delegated) - Lecture des emails  
- ✅ `offline_access` (Delegated) - Refresh tokens

#### Étapes dans Azure Portal :

1. **Authentication > Redirect URIs > Web**
   - Ajouter : `https://email-tracking-zeta.vercel.app/auth/microsoft-callback`

2. **API Permissions > Microsoft Graph**
   - Vérifier : `User.Read`, `Mail.Read`, `offline_access`
   - Accorder le consentement admin si nécessaire

3. **Certificates & secrets**
   - Vérifier que le secret client est valide

### 3. Variables Vercel (si pas encore fait)

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY  
vercel env add NEXT_PUBLIC_APP_URL
# Valeur: https://email-tracking-zeta.vercel.app
```

### 4. Test de la Configuration

**URL de test :**
```
https://ydbsiljhjswtysmizcdw.supabase.co/functions/v1/microsoft-auth?action=authorize
```

**Vérifier que `redirect_uri` contient :**
```
https://email-tracking-zeta.vercel.app/auth/microsoft-callback
```

## 🚀 Résultat Attendu

Après cette configuration :
1. ✅ Le bouton "Se connecter à Microsoft Graph" ouvre une popup
2. ✅ L'authentification Microsoft fonctionne 
3. ✅ Le callback renvoie vers la bonne URL Vercel
4. ✅ Les tokens sont échangés et stockés

## 🔧 Dépannage

**Si la popup ne s'ouvre toujours pas :**
1. Vérifier le bloqueur de popup du navigateur
2. Ouvrir F12 > Console pour voir les erreurs
3. Vérifier F12 > Network pour les appels API

**Si erreur "redirect_uri_mismatch" :**
1. Vérifier la configuration Azure AD
2. S'assurer que l'URL est exacte (pas de trailing slash)

**Variables Supabase Secrets :**
```bash
supabase secrets list
# Doit contenir APP_URL
```