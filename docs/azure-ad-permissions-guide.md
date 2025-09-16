# Guide de Configuration Azure AD - Permissions Application

## 🎯 Problème Identifié

L'application utilise des **permissions déléguées** mais nous avons besoin de **permissions d'application** pour l'automatisation des relances.

**Erreur actuelle :** `403 Access Denied` lors de l'envoi d'emails via Microsoft Graph API

## 📋 Étapes de Configuration

### 1. Accéder à Azure Portal
- URL : https://portal.azure.com
- **Azure Active Directory** → **App registrations**
- Sélectionner **"Email Tracking App"** (App ID: `2a7d8d0e-794e-4b9c-b458-c01e0c6a1e0b`)

### 2. Configurer les Permissions Application

#### A. Supprimer les permissions déléguées actuelles
- **API permissions** → Sélectionner chaque permission **déléguée** :
  - `Mail.Read` (Déléguée)
  - `Mail.ReadWrite` (Déléguée)
  - `Mail.Send` (Déléguée)
  - `User.Read` (Déléguée)
- Cliquer **"Remove permission"** pour chacune

#### B. Ajouter les permissions d'application
- **API permissions** → **"Add a permission"**
- **Microsoft Graph** → **"Application permissions"**
- Sélectionner :
  - **Mail.Send** ✅
  - **Mail.Read** ✅
  - **User.Read.All** ✅ (pour lire les profils utilisateur)
- Cliquer **"Add permissions"**

### 3. Accorder le Consentement Administrateur
- **API permissions** → **"Grant admin consent for [Tenant Name]"**
- Confirmer l'action
- ✅ Vérifier que le statut passe à **"Granted for [Tenant]"**

### 4. Vérification
Après configuration, les permissions doivent apparaître comme :

```
Microsoft Graph (3)
├── Mail.Read          Application    ✅ Accordé pour karta
├── Mail.Send          Application    ✅ Accordé pour karta
└── User.Read.All      Application    ✅ Accordé pour karta
```

## 🧪 Test après Configuration

Une fois configuré, testez avec :

```bash
# Test avec script direct (client_credentials)
node scripts/test-reminder-direct.js test

# Ou test avec Edge Functions (une fois déployées)
node scripts/test-application-permissions.js full
```

## ⚠️ Points Importants

1. **Permissions Application vs Déléguées :**
   - **Déléguées** : Nécessitent un utilisateur connecté
   - **Application** : L'app peut fonctionner sans utilisateur (automatisation)

2. **Consentement Administrateur :**
   - Obligatoire pour les permissions d'application
   - Sans lui, les tokens n'auront aucune permission effective

3. **Sécurité :**
   - Les permissions d'application donnent un accès étendu
   - Seuls les administrateurs peuvent les accorder
   - Les tokens sont valides pour toute l'organisation

## 🔍 Diagnostic Post-Configuration

Après configuration, le diagnostic devrait montrer :

```bash
node scripts/diagnose-graph-permissions.js
```

**Résultat attendu :**
```
✅ Permissions application accordées:
   - Role ID: b633e1c5-b582-4048-a93e-9f11b44c7e96 (Mail.Send)
   - Role ID: 810c84a8-4a9e-49e6-bf7d-12d183f40d01 (Mail.Read)
   - Role ID: df021288-bdef-4463-88db-98f22de89214 (User.Read.All)
```

Au lieu de :
```
❌ Aucune permission accordée !
```

## 📞 Support

Si les permissions ne fonctionnent pas après configuration :
1. Attendre 5-10 minutes (propagation Azure AD)
2. Vérifier que vous êtes **administrateur** du tenant
3. Contrôler les logs Azure AD pour les erreurs de consentement