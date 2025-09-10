# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Start development server with Turbopack
pnpm dev

# Build for production
pnpm build

# Start production server  
pnpm start

# Run linting
pnpm lint

# Supabase commands
supabase db push          # Apply migrations
supabase functions deploy # Deploy Edge Functions
```

## Architecture Overview - Nouvelle Version

### Technology Stack

- **Framework**: Next.js 15.5.2 with App Router and Turbopack
- **Language**: TypeScript with strict mode
- **Database**: Supabase (PostgreSQL) with Edge Functions serverless
- **Authentication**: Supabase Auth (RLS enabled)
- **Styling**: Tailwind CSS v4 with CSS variables for theming
- **UI Components**: shadcn/ui components (16 composants conservés)
- **Backend**: Supabase Edge Functions (Deno runtime)
- **Email Integration**: Microsoft Graph API via Edge Functions

### Project Structure - Nouvelle Architecture

Application de suivi d'emails avec architecture Supabase-centric :

```
app/
├── dashboard/             # Interface display-only principale
├── login/                # Page d'authentification Supabase
├── maintenance/          # Page de maintenance/refonte
└── page.tsx             # Redirection vers /maintenance

components/
└── ui/                  # shadcn/ui components uniquement (16)

lib/
└── utils.ts            # Utilitaire cn() pour shadcn/ui

supabase/
├── functions/          # Edge Functions Supabase
│   ├── webhook-handler/      # Réception webhooks Microsoft Graph
│   └── subscription-manager/ # Gestion subscriptions
└── migrations/         # Schema + Triggers + RLS policies
    ├── 001_create_new_architecture.sql
    ├── 002_enable_rls_policies.sql
    └── 003_fix_function_search_paths.sql

utils/supabase/        # Clients Supabase (legacy structure)
├── client.ts         # Browser client  
├── server.ts         # Server client
└── middleware.ts     # Auth middleware
```

### Key Conventions - Architecture Supabase

#### Flux de données autonome
1. **Webhooks Microsoft Graph** → Edge Function `webhook-handler`
2. **Messages reçus** → Table `received_messages` 
3. **Trigger PostgreSQL** → Détection automatique via `conversation_id`
4. **Statut mis à jour** → Table `tracked_emails` (`PENDING` → `REPLIED`)
5. **Interface temps réel** → Affichage via subscription Supabase

#### Database Schema - Tables principales

- `tracked_emails` - Emails trackés avec statuts (`PENDING`, `REPLIED`, `FAILED`, `EXPIRED`)
- `received_messages` - Messages reçus via webhooks Microsoft Graph
- `graph_subscriptions` - Subscriptions Microsoft Graph actives
- `webhook_events` - Log des événements webhook pour debugging
- `email_stats` - Vue des statistiques temps réel

#### Edge Functions - Gestion autonome

- **webhook-handler** : Réceptionne webhooks Microsoft Graph, traite les notifications
- **subscription-manager** : Actions CRUD sur subscriptions (create, renew, status, cleanup)
- **Fonctionnalités** : Renouvellement manuel/automatique, nettoyage, gestion d'erreurs complète

#### Renouvellement Automatique (pg_cron + pg_net)

- **Planification** : Jobs cron intégrés dans PostgreSQL via `pg_cron`
- **Fréquence** : Toutes les 4 heures (optimal pour subscriptions 71h)
- **Sécurité** : Secrets stockés dans Supabase Vault
- **Monitoring** : Logs via `cron.job_run_details` + Dashboard Supabase
- **Jobs configurés** :
  - `microsoft-graph-subscription-renewal` : Renouvellement automatique
  - `microsoft-graph-subscription-cleanup` : Nettoyage quotidien (2h du matin)

#### Authentication & Security

- **RLS activé** : Politiques de sécurité au niveau des lignes
- **authenticated role** : Lecture seule pour utilisateurs authentifiés
- **service_role** : Accès complet pour Edge Functions
- **Search path sécurisé** : Toutes les fonctions PostgreSQL avec `SET search_path = 'public'`

### Development Workflow - Nouvelle Approche

1. **Database Changes**: Créer migrations dans `supabase/migrations/`
2. **Edge Functions**: Code TypeScript dans `supabase/functions/`
3. **Frontend**: Interface display-only avec shadcn/ui
4. **Testing**: Via interface dashboard + logs Edge Functions
5. **Deployment**: `supabase functions deploy` + `supabase db push`

### Scripts de Maintenance

```bash
# Configuration du renouvellement automatique
./scripts/setup-vault-secrets.sh      # Configuration secrets Vault
./scripts/test-auto-renewal.sh        # Test du système automatique

# Supabase commands
supabase db push                       # Appliquer migrations (inclut setup cron)
supabase functions deploy             # Déployer Edge Functions
```

### Environment Variables - Configuration

Required in `.env.local`:
```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Microsoft Graph
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=
AZURE_TENANT_ID=

# Webhooks
WEBHOOK_CLIENT_STATE=          # Clé de sécurité validation
```

### Important Notes - Architecture Clean

- **Frontend**: Display-only, pas d'envoi d'emails (Phase 2)
- **Backend**: Edge Functions autonomes, pas d'API routes Next.js
- **Database**: Triggers PostgreSQL pour logique métier automatique
- **UI**: Uniquement shadcn/ui components (16 conservés)
- **Documentation**: Nettoyée, seuls README.md et CLAUDE.md restent

### Phase Actuelle

✅ **Phase 1 - Architecture Foundation** (Complète)
- Edge Functions webhook-handler et subscription-manager
- Schema PostgreSQL avec triggers automatiques
- RLS et sécurité configurés
- Interface display-only basique
- **Renouvellement automatique via pg_cron** (Migration 009)

🚧 **Phase 2 - Interface Reconstruction** (En cours)
- Reconstruction progressive du frontend
- Interface d'envoi d'emails
- Dashboard avancé avec analytics
- Notifications temps réel

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.