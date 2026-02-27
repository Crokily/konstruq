# Konstruq — Construction Analytics Dashboard

AI-powered data analytics platform for the construction industry.
Integrates **Procore** (project management) and **Sage Intacct** (ERP/financial) into a unified dashboard.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Auth**: Clerk
- **Database**: Neon (PostgreSQL) + Drizzle ORM
- **Charts**: Recharts
- **UI**: shadcn/ui + Tailwind CSS 4
- **Language**: TypeScript

## Getting Started

```bash
npm install
cp .env.example .env.local
# Fill in your environment variables (see .env.example for details)
npm run dev
```

## Environment Variables

See [`.env.example`](.env.example) for all required variables:
- **Clerk**: Authentication (publishable key + secret key)
- **Neon**: Database connection string
- **Procore**: OAuth client ID/secret for project data
- **Sage Intacct**: Web Services credentials for financial data

## Architecture

```
Konstruq Dashboard
├── Procore Adapter (REST API v1.0, OAuth 2.0)
│   └── Projects, Budgets, RFIs, Change Orders, Schedules
├── Sage Intacct Adapter (XML Web Services / REST API)
│   └── GL, AP/AR, Cost Types, Project Contracts, Estimates
└── Unified DataProvider Interface
    └── Mock mode (demo data) ↔ Live mode (real APIs)
```
