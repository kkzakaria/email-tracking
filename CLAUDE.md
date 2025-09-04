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
```

## Architecture Overview

### Technology Stack

- **Framework**: Next.js 15.5.2 with App Router and Turbopack
- **Language**: TypeScript with strict mode
- **Database**: Supabase (PostgreSQL) with Row Level Security
- **Authentication**: Supabase Auth with Microsoft OAuth integration
- **Styling**: Tailwind CSS v4 with CSS variables for theming
- **UI Components**: shadcn/ui components with custom styling
- **Icons**: Lucide React
- **Email Operations**: Microsoft Graph API v3
- **State Management**: React Query (TanStack Query)
- **Tables**: TanStack React Table for data grids

### Project Structure

Email tracking application with Microsoft 365 integration:

```
app/
├── api/                     # API endpoints
│   ├── auth/microsoft/     # Microsoft OAuth flow
│   ├── emails/            # Email CRUD and tracking operations
│   │   ├── send/         # Send emails with tracking
│   │   ├── sync/         # Sync with Outlook
│   │   ├── pixel/[id]/   # Tracking pixel endpoint
│   │   └── click/[id]/   # Link click tracking
│   └── webhooks/          # Webhook handlers
│       └── outlook/       # Microsoft Graph webhooks
├── dashboard/             # Main application UI
│   ├── compose/          # Email composition
│   └── webhooks/         # Webhook monitoring
└── login/                # Authentication flow

lib/
├── supabase/             # Supabase client configurations
│   ├── client.ts        # Browser client
│   ├── server.ts        # Server client
│   └── middleware.ts    # Auth middleware
├── microsoft/            # Microsoft Graph integration
│   ├── graph-helper.ts  # Graph API utilities
│   ├── email-service.ts # Email operations
│   └── webhook-service.ts # Webhook subscriptions
└── services/             # Business logic services

components/
├── ui/                   # shadcn/ui base components
├── dashboard/           # Dashboard-specific components
└── layout/             # Layout components
```

### Key Conventions

#### Import Aliases
- `@/*` - Root directory imports
- `@/components/ui` - UI component imports
- `@/lib` - Library and utility imports
- `@/hooks` - Custom React hooks

#### Database Schema

Supabase tables with RLS enabled:
- `email_tracking` - Core tracking records
- `email_events` - Click and open events
- `oauth_states` - OAuth flow state management
- `webhook_subscriptions` - Graph API webhooks
- `webhook_events` - Webhook event logs

Run migrations: `supabase db push`

#### Authentication Flow

1. User authenticates via Supabase Auth
2. Microsoft OAuth tokens stored in Supabase
3. Graph API client uses tokens from Supabase
4. Server-side auth via `createClient` from `@/lib/supabase/server`
5. Client-side auth via `createBrowserClient` from `@/lib/supabase/client`

#### Component Patterns

- Use shadcn/ui components from `@/components/ui`
- Apply `cn()` utility for className merging
- Server Components by default, Client Components when needed
- Loading states with `loading.tsx` files
- Error boundaries with `error.tsx` files

#### API Development

- Route handlers in `app/api/*/route.ts`
- Always validate auth with `supabase.auth.getUser()`
- Return proper HTTP status codes
- Handle errors gracefully with try/catch

### Development Workflow

1. **Database Changes**: Edit SQL files in `supabase/migrations/`
2. **UI Components**: Use shadcn/ui CLI or create in `components/ui/`
3. **Business Logic**: Add services in `lib/services/`
4. **API Endpoints**: Create route handlers in `app/api/`
5. **Testing**: Manual testing via dashboard interface

### Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=
AZURE_TENANT_ID=
```
  