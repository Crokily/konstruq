# PRD: Konstruq V2 — Project-Centric Architecture, AI Dashboards & Analytics Prompts

## Introduction

Konstruq is a construction ERP analytics platform. This PRD covers three interconnected requirements:

1. **Project-Centric Data Structure** — Users must create projects before uploading data. Uploads, chat, and dashboards are scoped to projects.
2. **AI-Generated Dashboards** — Extend the main dashboard's AI generation approach to Projects and Financials pages, with construction-domain chart prioritization.
3. **Construction Analytics Prompt Optimization** — Integrate a professional predictive analytics prompt into the chat system without breaking existing tool/output format rules.

Current state: data is flat per user (no project concept), Projects/Financials pages use hardcoded `MockDataProvider`, chat system prompt is basic.

## Goals

- Users can create named projects and upload datasets scoped to each project
- Chat conversations can be filtered by project context
- All three dashboard pages (Main, Projects, Financials) generate charts/KPIs from real user data via AI
- Construction-specific chart prioritization ensures the most relevant visualizations appear first
- Chat AI operates with professional-grade construction analytics methodology
- MockDataProvider and all mock/dead code removed

## User Stories

### US-001: Add projects table and modify uploadedDatasets schema
**Description:** As a developer, I need the database schema to support user-created projects with datasets linked to them.

**Acceptance Criteria:**
- [ ] New `projects` table in `schema.ts`: id (uuid PK), userId (FK → users.id), name (varchar 255, not null), description (text, nullable), status (varchar 50, default 'active'), createdAt, updatedAt
- [ ] `uploadedDatasets` table gains `projectId` column (uuid FK → projects.id, nullable)
- [ ] Run `npx drizzle-kit push` successfully against Neon
- [ ] Clear all existing rows from `uploaded_datasets` table via a one-time SQL command (test phase cleanup)
- [ ] Typecheck passes

---

### US-002: Projects CRUD API endpoints
**Description:** As a user, I need API endpoints to create, list, and delete my projects.

**Acceptance Criteria:**
- [ ] `POST /api/projects` — creates project for authenticated user, returns `{ id, name, description, status, createdAt }`
- [ ] `GET /api/projects` — returns array of user's projects ordered by updatedAt desc, each includes `datasetCount` (number of active uploadedDatasets)
- [ ] `DELETE /api/projects/[id]` — soft-deletes project (sets status to 'archived'), returns `{ success: true }`
- [ ] All endpoints require auth (Clerk), resolve appUserId via `resolveAppUserId`
- [ ] Returns appropriate error responses (401, 404, 500)
- [ ] Typecheck passes

---

### US-003: Projects list page with create dialog
**Description:** As a user, I want to see my projects and create new ones from the Projects page.

**Acceptance Criteria:**
- [ ] `/projects` page fetches projects from `GET /api/projects` (client component or server component with client interactivity)
- [ ] Displays project cards: name, status badge, dataset count, created date
- [ ] "Create Project" button opens a Dialog with name (required) and description (optional) fields
- [ ] Submitting the dialog calls `POST /api/projects` and updates the list
- [ ] Each project card links to `/projects/[id]`
- [ ] Empty state message when no projects exist
- [ ] Delete button on each card calls `DELETE /api/projects/[id]`
- [ ] MockDataProvider import removed from `/projects/page.tsx`
- [ ] Typecheck passes
- [ ] Verify in browser

---

### US-004: Upload API accepts projectId
**Description:** As a developer, the upload endpoint must accept and store a projectId with each dataset.

**Acceptance Criteria:**
- [ ] `POST /api/upload` accepts `projectId` field in FormData (required)
- [ ] Validates that projectId belongs to the authenticated user and project exists
- [ ] Stores projectId in `uploadedDatasets` record
- [ ] Returns projectId in response JSON
- [ ] Returns 400 if projectId is missing or invalid
- [ ] Typecheck passes

---

### US-005: Data Sources page with project selector
**Description:** As a user, I want to select a project before uploading data, and see which project each dataset belongs to.

**Acceptance Criteria:**
- [ ] Upload area includes a project selector dropdown populated from `GET /api/projects`
- [ ] Upload button is disabled until a project is selected
- [ ] Selected projectId is sent with the upload FormData
- [ ] Dataset list shows project name label on each item
- [ ] Server-side data fetch includes project name via join or separate query
- [ ] Typecheck passes
- [ ] Verify in browser

---

### US-006: Chat data tools filter by projectId
**Description:** As a developer, the chat backend tools must support optional project-scoped queries.

**Acceptance Criteria:**
- [ ] `POST /api/chat` accepts optional `projectId` in request body
- [ ] `createDataTools(appUserId, projectId?)` signature updated
- [ ] `listDatasets` tool: when projectId provided, filters `uploadedDatasets` by projectId; when null, returns all user datasets
- [ ] `getDatasetSchema`, `queryDatasetRows`, `searchDatasets`, `aggregateColumn` tools: all respect projectId filter through their dataset lookups
- [ ] Chat system prompt is updated to mention project context awareness (brief addition, not full prompt rewrite)
- [ ] Typecheck passes

---

### US-007: Chat UI project selector
**Description:** As a user, I want to select a project in the chat interface to scope my conversation to that project's data.

**Acceptance Criteria:**
- [ ] Chat page header area includes a project selector dropdown (fetched from `/api/projects`)
- [ ] "All Projects" option available as default (no projectId filter)
- [ ] Selected projectId is passed to the chat API via `useChat`'s `body` parameter in `ChatRuntimeProvider`
- [ ] Switching projects does NOT clear conversation (user can switch freely)
- [ ] Conversation objects in localStorage gain a `projectId` field
- [ ] ConversationSidebar shows project name badge if conversation has a projectId
- [ ] Typecheck passes
- [ ] Verify in browser

---

### US-008: Dashboard generate API accepts projectId
**Description:** As a developer, the dashboard generation endpoint must support optional project scoping.

**Acceptance Criteria:**
- [ ] `POST /api/dashboard/generate` accepts optional `projectId` in request body JSON
- [ ] When projectId provided: queries only that project's datasets
- [ ] When no projectId: queries all user's active datasets (existing behavior preserved)
- [ ] Validates projectId belongs to authenticated user when provided
- [ ] Response unchanged in structure (DashboardResponse)
- [ ] Typecheck passes

---

### US-009: Integrate construction analytics prompt
**Description:** As a developer, I need to merge the advanced construction predictive analytics methodology (from docs/agentprompt.txt) into the chat system prompt.

**Acceptance Criteria:**
- [ ] `CHAT_SYSTEM_PROMPT` in `src/app/api/chat/_lib/system-prompt.ts` is updated
- [ ] Identity section enhanced: "Advanced Construction Predictive & Forecasting Analytics Agent"
- [ ] **Preserved unchanged:** Tool workflow (mandatory), Output format rules (chart/table/kpi blocks), Source and schema integrity rules
- [ ] **Enhanced:** Chart policy section gains agentprompt.txt §4 visualization rules (confidence intervals, fan charts, risk networks, heatmaps)
- [ ] **New section:** Data Understanding & Pre-Processing (from agentprompt.txt §1)
- [ ] **New section:** Forecasting Methodology reference (agentprompt.txt §2) — framed as analytical reasoning guidance, not literal model execution
- [ ] **New section:** Key Forecast Metrics (agentprompt.txt §3) — Advanced Cost, Schedule, Resource, Risk forecasting output specs
- [ ] **New section:** Bias Minimisation Rules (agentprompt.txt §5)
- [ ] Existing tool workflow, output format, source integrity rules are byte-for-byte identical
- [ ] Typecheck passes

---

### US-010: Extract shared dashboard generation utilities
**Description:** As a developer, I need reusable utilities for dashboard generation so that three dashboard variants (executive, project-controls, financials) share common infrastructure.

**Acceptance Criteria:**
- [ ] New file `src/lib/dashboard/generate.ts` with shared functions: `fetchUserDatasets(appUserId, projectId?)`, `callDashboardLLM(systemPrompt, userPrompt, datasets)`, `parseJsonResponse(text)`
- [ ] Existing `/api/dashboard/generate/route.ts` refactored to use these shared utilities
- [ ] Route accepts `variant` parameter: `"executive"` (default), `"project-controls"`, `"financials"`
- [ ] Each variant selects its own system prompt from a prompt map
- [ ] Executive variant produces identical behavior to current implementation
- [ ] Typecheck passes

---

### US-011: Enhance main dashboard prompt with chart priorities
**Description:** As a user, I want the executive dashboard to prioritize construction-relevant charts based on what data I've uploaded.

**Acceptance Criteria:**
- [ ] Executive system prompt in the variant prompt map includes data-aware priority rules: cost/budget data → Budget vs Actual, Cost Variance; schedule data → Schedule Variance, SPI Trend; EVM data → S-Curve, CPI/SPI; labor data → Resource Utilisation, Productivity; subcontractor data → On-Time Delivery; cash flow data → Cashflow Forecast, Aging
- [ ] Prompt references Dashboard #1 structure from docs/3dashboard.txt (tabs: Risk & Tasks, Schedule, Resources, Subcontractors)
- [ ] Charts response may include optional `group` field for tab/section categorization
- [ ] `DashboardContent` type in `types.ts` updated: `ChartSpec` gains optional `group?: string`
- [ ] `DashboardClient` renders group headers when charts have group values
- [ ] Typecheck passes
- [ ] Verify in browser

---

### US-012: AI-generated project controls dashboard
**Description:** As a user, I want `/projects/[id]` to show an AI-generated dashboard focused on project controls using that project's uploaded datasets.

**Acceptance Criteria:**
- [ ] `/projects/[id]/page.tsx` replaced: no longer uses MockDataProvider
- [ ] Page calls `POST /api/dashboard/generate` with `{ projectId: id, variant: "project-controls" }`
- [ ] Project-controls system prompt focuses on Dashboard #2 from docs/3dashboard.txt: Master Schedule Tracking, Lookahead Planning, Dependencies & Delay Analysis, Equipment Utilisation
- [ ] Page shows project name/description header (fetched from `/api/projects` or DB)
- [ ] Reuses `DashboardClient` component (or a lightweight variant) for rendering
- [ ] Shows empty state if project has no datasets
- [ ] Typecheck passes
- [ ] Verify in browser

---

### US-013: AI-generated financial dashboard
**Description:** As a user, I want the Financials page to show an AI-generated dashboard focused on financial analytics across all my projects.

**Acceptance Criteria:**
- [ ] `/financials/page.tsx` replaced: no longer uses MockDataProvider
- [ ] Page calls `POST /api/dashboard/generate` with `{ variant: "financials" }` (no projectId = portfolio level)
- [ ] Financials system prompt focuses on Dashboard #3 from docs/3dashboard.txt: Budget Control, Earned Value Management, Cash Flow & Claims, Cost Detail & Drills
- [ ] Reuses `DashboardClient` component for rendering
- [ ] Shows empty state if user has no datasets
- [ ] MockDataProvider imports removed from financials page
- [ ] Typecheck passes
- [ ] Verify in browser

---

### US-014: Remove MockDataProvider and dead code
**Description:** As a developer, I need to clean up all unused mock data and dead code.

**Acceptance Criteria:**
- [ ] `src/lib/data/mock/` directory deleted (aging.ts, change-orders.ts, financials.ts, projects.ts, schedules.ts)
- [ ] `src/lib/data/providers/mock.ts` deleted
- [ ] `src/lib/data/providers/interface.ts` deleted (unless still referenced by live code)
- [ ] `src/lib/data/index.ts` deleted or updated to remove mock exports
- [ ] `src/components/dashboard/dashboard-workspace.tsx` deleted (confirmed unused)
- [ ] No remaining imports of deleted files in any `.ts` / `.tsx` file
- [ ] `src/lib/types/procore.ts` and `src/lib/types/sage.ts` retained only if referenced by live code (dataConnections, syncedProjects)
- [ ] Typecheck passes
- [ ] Build passes (`npm run build`)

---

## Functional Requirements

- FR-1: `projects` table: id, userId, name, description, status, createdAt, updatedAt
- FR-2: `uploadedDatasets.projectId` FK to projects, nullable
- FR-3: CRUD API for projects at `/api/projects` and `/api/projects/[id]`
- FR-4: Upload requires projectId; validation that project belongs to user
- FR-5: Chat tools filter datasets by optional projectId
- FR-6: Chat UI includes project selector; projectId passed in API body
- FR-7: Dashboard generation supports variant parameter and optional projectId
- FR-8: Three dashboard variants with domain-specific system prompts
- FR-9: Chat system prompt integrates agentprompt.txt methodology without breaking existing tool/format rules
- FR-10: All mock data and dead code removed

## Non-Goals

- No database-persisted chat history (localStorage is sufficient for MVP)
- No project-level user permissions / multi-tenant sharing
- No Procore/Sage integration changes
- No Gantt chart or network diagram rendering (mentioned in 3dashboard.txt but beyond current chart types)
- No actual ML model execution (ARIMA, LSTM etc.) — prompt guidance only
- No automated project creation from uploaded data

## Technical Considerations

- Database: Neon Postgres via Drizzle ORM, using `drizzle-kit push` (no migrations folder)
- Auth: Clerk — all API routes use `auth()` from `@clerk/nextjs/server`
- AI: Mistral (`mistral-large-latest`) via Vercel AI SDK
- Charts: Recharts with `DynamicChart` component
- State: `useChat` from `ai/react` with `body` parameter for extra fields
- Existing `DashboardClient` component is reusable for all three dashboard variants
- localStorage conversation format: add optional `projectId` field (backward compatible)

## Success Metrics

- User can create project → upload data → see AI dashboard in under 2 minutes
- Projects/Financials pages render AI-generated charts from real data (no mock data)
- Chat scoped to a project only surfaces that project's datasets
- Typecheck, lint, and build all pass with zero errors
- No remaining references to MockDataProvider in production code
