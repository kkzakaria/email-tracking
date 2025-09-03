# Structure du projet Next.js - Email Tracking

```txt
email-tracking/
├── package.json
├── next.config.js
├── tailwind.config.js
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── lib/
│   ├── db.ts
│   ├── graph/
│   │   ├── client.ts
│   │   └── auth.ts
│   └── utils/
│       └── email-parser.ts
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   ├── page.tsx
│   ├── api/
│   │   ├── auth/
│   │   │   └── [...nextauth]/
│   │   │       └── route.ts
│   │   ├── emails/
│   │   │   ├── track/
│   │   │   │   └── route.ts
│   │   │   ├── list/
│   │   │   │   └── route.ts
│   │   │   ├── check-replies/
│   │   │   │   └── route.ts
│   │   │   └── send-reminders/
│   │   │       └── route.ts
│   │   └── cron/
│   │       └── check-emails/
│   │           └── route.ts
│   ├── dashboard/
│   │   ├── page.tsx
│   │   └── components/
│   │       ├── EmailList.tsx
│   │       ├── AddEmailModal.tsx
│   │       └── StatisticsCard.tsx
│   └── login/
│       └── page.tsx
├── components/
│   ├── ui/
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   └── modal.tsx
│   └── layout/
│       └── Navigation.tsx
├── types/
│   └── email.ts
└── .env.local
```

## Technologies utilisées

- **Frontend:** Next.js 15 (App Router), TypeScript, Tailwind CSS
- **Backend:** Next.js API Routes
- **Base de données:** PostgreSQL + Prisma ORM
- **Authentification:** NextAuth.js avec Microsoft Provider
- **API:** Microsoft Graph SDK
- **Jobs:** Vercel Cron ou API Routes avec NextAuth
- **UI:** Shadcn/ui components
