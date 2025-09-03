# Email Tracking - Guide d'installation

## 🚀 Configuration rapide

### 1. Prérequis
- Node.js 18+ et pnpm
- PostgreSQL installé localement ou une instance cloud
- Un compte Microsoft Azure avec une App Registration

### 2. Installation des dépendances

```bash
pnpm install
```

### 3. Configuration de la base de données

#### Option A : PostgreSQL local
```bash
# Créer la base de données
createdb email_tracking

# Copier le fichier d'environnement
cp .env.local.example .env.local

# Modifier DATABASE_URL dans .env.local
DATABASE_URL="postgresql://votre_user:votre_password@localhost:5432/email_tracking"
```

#### Option B : Utiliser une base cloud (Neon, Supabase, etc.)
Remplacez DATABASE_URL par l'URL fournie par votre provider.

### 4. Configurer Prisma

```bash
# Générer le client Prisma
pnpm prisma generate

# Exécuter les migrations
pnpm prisma migrate dev
```

### 5. Configuration Azure AD

1. Aller sur [Azure Portal](https://portal.azure.com)
2. Naviguer vers "Azure Active Directory" > "App registrations"
3. Cliquer sur "New registration"
   - Name: "Email Tracking App"
   - Supported account types: "Accounts in any organizational directory (Any Azure AD directory - Multitenant)"
   - Redirect URI: Web - `http://localhost:3000/api/auth/callback/microsoft-entra-id`

4. Après création, noter :
   - Application (client) ID → `AZURE_AD_CLIENT_ID`
   - Directory (tenant) ID → `AZURE_AD_TENANT_ID` (ou utiliser "common" pour multi-tenant)

5. Dans "Certificates & secrets" :
   - New client secret
   - Noter la valeur → `AZURE_AD_CLIENT_SECRET`

6. Dans "API permissions", ajouter :
   - Microsoft Graph :
     - User.Read (Delegated)
     - Mail.Read (Delegated)
     - Mail.Send (Delegated)
     - Mail.ReadWrite (Delegated) - optionnel
     - offline_access (Delegated)
   - Cliquer sur "Grant admin consent" si nécessaire

### 6. Configuration NextAuth

Dans `.env.local` :
```env
# Générer avec : openssl rand -base64 32
NEXTAUTH_SECRET="votre_secret_genere"
NEXTAUTH_URL="http://localhost:3000"
```

### 7. Lancer l'application

```bash
pnpm dev
```

Ouvrir [http://localhost:3000](http://localhost:3000)

## 📝 Structure du projet

```
email-tracking/
├── app/                      # Next.js App Router
│   ├── api/                 # API Routes
│   │   ├── auth/           # NextAuth endpoints
│   │   └── emails/         # Email tracking endpoints
│   ├── dashboard/          # Pages du dashboard
│   └── login/              # Page de connexion
├── components/              # Composants React
├── lib/                     # Logique métier
│   ├── auth/               # Configuration auth
│   ├── graph/              # Microsoft Graph API
│   └── db.ts               # Client Prisma
├── prisma/                  # Schema et migrations
└── types/                   # Types TypeScript
```

## 🔧 Commandes utiles

```bash
# Base de données
pnpm prisma studio          # Interface GUI pour la DB
pnpm prisma migrate dev      # Créer une migration
pnpm prisma migrate reset    # Reset la DB (ATTENTION!)

# Développement
pnpm dev                     # Lancer en mode dev
pnpm build                   # Build production
pnpm start                   # Lancer la build production
pnpm lint                    # Linter le code
```

## 🐛 Troubleshooting

### Erreur : "Invalid client" lors de la connexion
- Vérifier que les redirect URIs dans Azure correspondent exactement
- Vérifier AZURE_AD_CLIENT_ID et AZURE_AD_CLIENT_SECRET

### Erreur : "Database connection failed"
- Vérifier que PostgreSQL est lancé
- Vérifier DATABASE_URL dans .env.local
- Exécuter `pnpm prisma generate`

### Erreur : "NEXTAUTH_SECRET is not set"
- Générer un secret : `openssl rand -base64 32`
- L'ajouter dans .env.local

## 🚀 Prochaines étapes

1. **Phase 2** : Ajouter le tracking d'emails
2. **Phase 3** : Système de rappels automatiques
3. **Phase 4** : Analytics et statistiques
4. **Phase 5** : Déploiement production

## 📚 Documentation

- [Next.js Documentation](https://nextjs.org/docs)
- [NextAuth.js Documentation](https://next-auth.js.org/)
- [Microsoft Graph API](https://docs.microsoft.com/en-us/graph/)
- [Prisma Documentation](https://www.prisma.io/docs/)