# PRD: Konstruq Phase 1 — MVP Dashboard with Procore Integration & Visualization

## Introduction

Konstruq is a construction analytics dashboard that unifies Procore (project management) and Sage Intacct (ERP/financial) data into one visualization platform, replacing PowerBI for construction companies. Phase 1 focuses on: (1) completing infrastructure (auth + DB), (2) Procore sandbox integration, (3) mock data for Sage, and (4) construction-specific data visualizations.

## Goals

- Working auth flow with Clerk (sign-in, sign-up, protected routes)
- Database migrations deployed to Neon
- Procore OAuth integration with sandbox data sync
- Mock Sage Intacct financial data matching real API schema
- 6+ construction-specific chart visualizations
- Professional dark-themed UI rivaling Omni embedded analytics

## User Stories

### US-001: Fix build configuration and add typecheck/lint scripts
**Description:** As a developer, I need the project to build cleanly and have proper quality check scripts so that CI and Ralph loop can verify code quality.
**Acceptance Criteria:**
- [ ] `package.json` has `"typecheck": "tsc --noEmit"` script
- [ ] `npm run typecheck` passes with zero errors
- [ ] `npm run lint` passes
- [ ] `npm run build` succeeds
- [ ] Commit all fixes

### US-002: Database migration to Neon
**Description:** As a developer, I need the Drizzle schema pushed to Neon so the app has a working database.
**Acceptance Criteria:**
- [ ] `npm run db:generate` produces migration files in `./drizzle/`
- [ ] `npm run db:push` successfully pushes schema to Neon (tables: users, data_connections, synced_projects)
- [ ] Add `"db:generate"`, `"db:push"`, `"db:studio"` scripts to package.json
- [ ] Typecheck passes

### US-003: Clerk auth flow verification
**Description:** As a user, I want to sign in/sign up and be redirected to the dashboard, with protected routes working.
**Acceptance Criteria:**
- [ ] Landing page (`/`) shows sign-in/sign-up buttons when logged out
- [ ] `/sign-in` renders Clerk sign-in component
- [ ] `/sign-up` renders Clerk sign-up component
- [ ] After sign-in, redirects to `/dashboard`
- [ ] `/dashboard`, `/projects`, `/financials` are protected (redirect to sign-in if not authenticated)
- [ ] Sidebar shows `UserButton` component
- [ ] Typecheck passes
- [ ] Verify in browser at localhost:3000

### US-004: Procore OAuth flow — authorization and callback
**Description:** As a user, I want to connect my Procore account via OAuth so the app can access my project data.
**Acceptance Criteria:**
- [ ] `/api/procore/auth` route redirects to Procore OAuth authorization URL with correct client_id, redirect_uri, response_type=code
- [ ] `/api/procore/callback` route exchanges authorization code for access_token + refresh_token
- [ ] Tokens stored in `data_connections` table linked to current Clerk user
- [ ] Integrations page (`/integrations`) has "Connect Procore" button that triggers the OAuth flow
- [ ] After successful connection, sidebar shows Procore as "Connected" (green dot)
- [ ] Typecheck passes

### US-005: Procore data sync — fetch projects from sandbox
**Description:** As a user, I want to sync my Procore projects so I can see them in the dashboard.
**Acceptance Criteria:**
- [ ] `/api/procore/sync` route fetches projects from Procore REST API v1.1 using stored access_token
- [ ] Projects stored in `synced_projects` table with source='procore'
- [ ] Integrations page has "Sync Now" button for Procore
- [ ] Sync handles pagination (per_page=100)
- [ ] Sync shows success/error feedback
- [ ] Typecheck passes

### US-006: Mock Sage Intacct financial data
**Description:** As a developer, I need realistic mock financial data matching Sage Intacct API schema so the dashboard can display financial charts without a real Sage connection.
**Acceptance Criteria:**
- [ ] `src/lib/data/mock/projects.ts` — 6 construction projects with full detail
- [ ] `src/lib/data/mock/financials.ts` — per-project financials: budget, actual, committed, cost breakdown (labor/materials/subcontract/equipment/overhead), monthly EVM data (12 months PV/EV/AC)
- [ ] `src/lib/data/mock/change-orders.ts` — 3-5 change orders per project
- [ ] `src/lib/data/mock/schedules.ts` — 8-12 schedule tasks per project with Gantt-compatible dates
- [ ] `src/lib/data/mock/aging.ts` — AR and AP aging buckets
- [ ] `src/lib/data/providers/interface.ts` — DataProvider interface with all methods
- [ ] `src/lib/data/providers/mock.ts` — MockDataProvider implementing the interface
- [ ] All data uses types from `src/lib/types/procore.ts` and `src/lib/types/sage.ts`
- [ ] Typecheck passes

### US-007: Dashboard overview page — KPI cards and status chart
**Description:** As a user, I want to see key portfolio metrics at a glance on the dashboard.
**Acceptance Criteria:**
- [ ] 4 KPI cards: Active Projects (count), Total Contract Value ($), Avg CPI (ratio), At Risk Projects (count)
- [ ] KPI cards pull from MockDataProvider
- [ ] Project Status donut/pie chart (Recharts) showing project count by stage
- [ ] Revenue vs Expense area chart showing 12-month trend
- [ ] Charts have proper labels, tooltips, legends, and responsive sizing
- [ ] Dark theme styling consistent with the overall design
- [ ] Typecheck passes
- [ ] Verify in browser

### US-008: Project health scatter plot and project list table
**Description:** As a user, I want to see which projects are at risk via a health matrix and browse all projects in a sortable table.
**Acceptance Criteria:**
- [ ] Scatter plot: X=Schedule % Complete, Y=Budget % Spent, colored by health (green/yellow/red)
- [ ] 45° reference line showing ideal state
- [ ] Data table below with columns: Name, Type, Value, % Complete, Budget Status, Stage
- [ ] Table sortable by clicking column headers (using @tanstack/react-table)
- [ ] Clicking a project row navigates to `/projects/[id]`
- [ ] Typecheck passes
- [ ] Verify in browser

### US-009: Project detail page — cost breakdown and EVM chart
**Description:** As a user, I want to see detailed cost analysis and earned value management for a specific project.
**Acceptance Criteria:**
- [ ] Project header: name, type, dates, total value, percent complete
- [ ] Stacked bar chart: cost categories (Labor/Materials/Subcontract/Equipment/Overhead) with Budget vs Actual vs Committed
- [ ] EVM multi-line chart: PV, EV, AC curves over 12 months
- [ ] EVM KPI badges: CPI, SPI, Cost Variance, Schedule Variance
- [ ] Data source badges showing "Procore" and "Sage Intacct" tags on relevant sections
- [ ] Typecheck passes
- [ ] Verify in browser

### US-010: Financials page — cash flow, aging analysis, change order waterfall
**Description:** As a user, I want to see financial health across my portfolio.
**Acceptance Criteria:**
- [ ] Cash flow forecast combo chart: bar (AR/AP by month) + line (net cash flow) for 6 months
- [ ] AR/AP aging grouped bar chart: Current, 1-30, 31-60, 61-90, 90+ days
- [ ] Change order waterfall chart: original contract → each CO → revised total (for a selected project)
- [ ] Project selector dropdown to switch waterfall chart context
- [ ] All charts with proper tooltips, legends, currency formatting
- [ ] Typecheck passes
- [ ] Verify in browser

### US-011: Visual polish, responsive layout, and Integrations page
**Description:** As a user, I want a professional, polished dashboard that looks production-grade.
**Acceptance Criteria:**
- [ ] Integrations page (`/integrations`) with cards for Procore and Sage Intacct showing connection status
- [ ] Procore card has "Connect" button (triggers OAuth) or "Connected" status with last sync time
- [ ] Sage Intacct card shows "Coming Soon" state
- [ ] All pages responsive (work on 1280px+ screens)
- [ ] Consistent spacing, typography, and color palette across all pages
- [ ] Loading skeletons for chart areas
- [ ] Typecheck passes
- [ ] Verify in browser

## Functional Requirements

- FR-1: Clerk middleware protects all `/dashboard`, `/projects`, `/financials`, `/integrations` routes
- FR-2: Procore OAuth 2.0 Authorization Code flow with token storage in DB
- FR-3: Procore project sync via REST API v1.1 with pagination
- FR-4: Mock data provider returns realistic construction data matching API schemas
- FR-5: All charts use Recharts with dark theme styling
- FR-6: DataProvider interface allows switching mock/live via `DATA_PROVIDER` env var
- FR-7: EVM calculations: CPI = EV/AC, SPI = EV/PV, CV = EV-AC, SV = EV-PV

## Non-Goals

- Sage Intacct real API integration (deferred — no credentials yet)
- AI chat / natural language queries (Phase 2)
- Real-time data sync / webhooks
- Mobile responsive design (desktop-first for hackathon)
- User management / team features
- Data export (CSV, PDF)

## Technical Considerations

- Next.js 16 App Router with server components where possible
- Recharts for all charts (Tremor incompatible with React 19)
- Neon serverless driver with Drizzle ORM
- All Procore API calls go through server-side API routes (never expose tokens to client)
- Dark theme only for MVP (amber-500 accent, slate-900 backgrounds)

## Success Metrics

- All 11 user stories pass quality checks
- Dashboard loads in < 2 seconds
- 6+ distinct chart types visible across pages
- Procore OAuth flow works end-to-end with sandbox
- Professional enough to demo to hackathon judges
