# Email Tracking - Architecture Supabase

Application de suivi d'emails professionnels avec architecture Supabase-centric et Edge Functions autonomes.

## 🏗️ Architecture

**Nouvelle architecture serverless :**
- ⚡ **Edge Functions Supabase** : Gestion autonome des webhooks et subscriptions Microsoft Graph
- 🗄️ **PostgreSQL + Triggers** : Détection automatique des réponses via `conversation_id`
- 🎯 **Frontend Display-Only** : Interface temps réel pour monitoring et statistiques
- 🔐 **RLS Sécurisé** : Accès contrôlé avec politiques Row Level Security

## 🚀 Démarrage Rapide

```bash
# Installation des dépendances
pnpm install

# Démarrage en développement
pnpm dev
```

## 🔧 Configuration Supabase

### 1. Base de données
```bash
# Appliquer les migrations
supabase db push
```

### 2. Edge Functions
```bash
# Déployer les fonctions
supabase functions deploy webhook-handler
supabase functions deploy subscription-manager
```

### 3. Variables d'environnement
```env
NEXT_PUBLIC_SUPABASE_URL=votre-url-supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre-cle-anon
SUPABASE_SERVICE_ROLE_KEY=votre-service-role-key

AZURE_CLIENT_ID=votre-app-id
AZURE_CLIENT_SECRET=votre-secret  
AZURE_TENANT_ID=votre-tenant-id

WEBHOOK_CLIENT_STATE=cle-securite-webhook
```

## 📊 Fonctionnalités

### ✅ Implémentées
- **Webhooks Microsoft Graph** automatisés via Edge Functions
- **Détection temps réel** des réponses par triggers PostgreSQL
- **Gestion autonome** des subscriptions (création, renouvellement, nettoyage)
- **Interface display-only** avec statistiques live
- **Sécurité RLS** pour accès authentifié

### 🚧 En Construction (Phase 2)
- Interface d'envoi d'emails trackés
- Dashboard avancé avec analytics
- Notifications temps réel
- Exports et rapports

## 🛠️ Stack Technique

- **Framework** : Next.js 15.5 + App Router + Turbopack
- **Base de données** : Supabase PostgreSQL + Edge Functions
- **Frontend** : React + TypeScript + Tailwind CSS v4
- **UI Components** : shadcn/ui (16 composants préservés)
- **Intégration** : Microsoft Graph API v3
- **Déploiement** : Vercel (Frontend) + Supabase (Backend)

## 📁 Structure du Projet

```
├── app/
│   ├── dashboard/          # Interface principale
│   ├── login/             # Authentification
│   ├── maintenance/       # Page de maintenance
│   └── layout.tsx         # Layout simplifié
├── components/ui/         # shadcn/ui components (16)
├── lib/utils.ts          # Utilitaires (cn function)
├── supabase/
│   ├── functions/        # Edge Functions
│   │   ├── webhook-handler/
│   │   └── subscription-manager/
│   └── migrations/       # Schema + Triggers + RLS
└── utils/supabase/       # Clients Supabase
```

## 🔄 Flux de Données

1. **Webhooks Microsoft** → Edge Function `webhook-handler`
2. **Messages reçus** → Table `received_messages`
3. **Trigger PostgreSQL** → Détection automatique via `conversation_id`
4. **Mise à jour statut** → Table `tracked_emails` (`PENDING` → `REPLIED`)
5. **Interface temps réel** → Affichage des mises à jour

## 🔐 Sécurité

- **Edge Functions** : Accès complet via `service_role`
- **Frontend** : Lecture seule via `authenticated` role
- **RLS Policies** : Sécurité au niveau des lignes
- **Search Path** : Fonctions PostgreSQL sécurisées

## 🚀 Déploiement

Le projet est configuré pour un déploiement automatique :
- **Frontend** : Vercel avec intégration Git
- **Backend** : Supabase Edge Functions + PostgreSQL
- **Variables** : Configuration via Vercel + Supabase Dashboard

---

**Architecture Supabase-centric** - Système autonome et résilient pour le suivi d'emails professionnels.