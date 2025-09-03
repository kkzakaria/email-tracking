# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development

```bash
# Start development server with Turbopack
pnpm dev

# Build for production with Turbopack
pnpm build

# Start production server
pnpm start

# Run ESLint
pnpm lint
```

### Package Management

This project uses `pnpm` as the package manager with workspace configuration for Prisma client optimization.

## Architecture Overview

### Technology Stack

- **Frontend Framework**: Next.js 15.5.2 with App Router and Turbopack
- **Language**: TypeScript with strict mode enabled
- **Styling**: Tailwind CSS v4 with CSS variables
- **UI Components**: shadcn/ui with "new-york" style
- **Icons**: Lucide React
- **Database**: Prisma ORM (client configured, schema pending)
- **Authentication**: Planned NextAuth.js with Microsoft Provider (per project structure)
- **Fonts**: Geist Sans and Geist Mono via next/font

### Project Structure

This is an email tracking application with the following planned architecture:

```text
app/                      # Next.js App Router directory
├── api/                 # API Routes
│   ├── auth/           # NextAuth authentication endpoints
│   ├── emails/         # Email tracking and management endpoints
│   │   ├── track/      # Email tracking logic
│   │   ├── list/       # Email listing
│   │   ├── check-replies/  # Reply checking
│   │   └── send-reminders/ # Reminder sending
│   └── cron/           # Scheduled jobs
├── dashboard/          # Dashboard pages and components
└── login/             # Authentication pages

lib/                    # Core utilities and business logic
├── graph/             # Microsoft Graph SDK integration
│   ├── client.ts      # Graph client setup
│   └── auth.ts        # Graph authentication
├── utils/             # Utility functions
│   └── email-parser.ts # Email parsing utilities
└── utils.ts           # shadcn/ui class utilities (cn function)

components/            # Reusable UI components
├── ui/               # Base UI components (shadcn/ui)
└── layout/          # Layout components
```

### Key Conventions

#### Import Aliases

- `@/*` - Root directory imports
- `@/components` - Component imports
- `@/lib` - Library/utility imports
- `@/components/ui` - UI component imports
- `@/hooks` - Custom hooks

#### TypeScript Configuration

- Target: ES2017
- Strict mode enabled
- Module resolution: bundler
- Path aliases configured with @ prefix

#### Component Development

- Use shadcn/ui components from `@/components/ui`
- Utilize the `cn()` utility from `@/lib/utils` for className merging
- Follow the "new-york" style guide for shadcn/ui components
- Icons should use lucide-react library

#### Styling

- Tailwind CSS v4 with PostCSS
- CSS variables enabled for theming
- Global styles in `app/globals.css`
- Use `tw-animate-css` for animations

### Database Integration

- Prisma ORM is configured but schema is not yet defined
- pnpm workspace configured to optimize Prisma client builds
- Database models and migrations should be placed in `prisma/` directory

### Microsoft Graph Integration

The project is structured to integrate with Microsoft Graph API for email operations:

- Authentication flow through NextAuth.js
- Graph client setup in `lib/graph/client.ts`
- Email operations through Microsoft Graph SDK

### Development Notes

- The project uses Next.js Turbopack for faster development builds
- ESLint is configured with Next.js core-web-vitals and TypeScript rules
- The application is designed for email tracking with Microsoft 365 integration
- Planned features include email tracking, reply checking, and reminder scheduling through cron jobs
  