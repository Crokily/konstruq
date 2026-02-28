# PRD: AI Output Optimization & Custom Dashboards

## Introduction

Konstruq V3 addresses two major user experience gaps:

1. **AI Output Optimization**: Chat AI currently dumps formula explanations as plain text above charts. Users don't need formula walls — they need clean charts with on-demand detail access. Every chart block should have a Chart/Table tab toggle, and formulas/methodology should be accessible via click interaction on the chart, not displayed as body text.

2. **Custom Dashboards**: Users need the ability to create persistent, project-scoped dashboards by conversing with AI in a sidebar chat. Each widget is AI-generated. Saved dashboards can be refreshed when underlying data changes, preserving layout while updating values.

## Goals

- Eliminate "wall of formulas" in chat output; embed analytical metadata in chart spec
- Add Chart ↔ Table tab toggle on every chart block (chat + dashboard)
- Enable formula/methodology detail via click-to-reveal popover on charts
- Allow users to create blank custom dashboards scoped to a project
- Provide sidebar AI chat within custom dashboard for widget creation
- Support dashboard save, persistent layout, and one-click data refresh

## Non-Goals

- Drag-and-drop widget reordering (future)
- Real-time collaborative editing
- Export to PDF/PowerPoint
- Widget resize/custom grid layouts (use simple ordered grid for now)

## Technical Considerations

- **Existing stack**: Next.js 16, Clerk auth, Drizzle + Neon, Recharts, shadcn/ui, Mistral LLM
- **Chart specs**: Chat charts use `ChartSpec` from `src/lib/charting/spec.ts`; Dashboard charts use `ChartSpec` from `src/lib/dashboard/types.ts` — both need table data exposure
- **System prompt**: `src/app/api/chat/_lib/system-prompt.ts` controls AI output behavior
- **Chat message parsing**: `src/components/chat/message-renderer.tsx` parses ```chart blocks
- **Dashboard rendering**: `src/components/dashboard/dashboard-client.tsx` renders AI-generated KPIs + charts
- **DB**: Schema at `src/lib/db/schema.ts`, push via `drizzle-kit push`
- **Auth pattern**: `auth()` → `resolveAppUserId()` in every API route

## User Stories

### Phase 1: AI Output Optimization

#### US-001: Extend chart specs with table data and methodology metadata
As a developer, I need chart spec types to carry underlying table data and formula/methodology info so the UI can render them on demand.

**Acceptance Criteria:**
- Chat `ChartSpec` in `src/lib/charting/spec.ts` gains optional `methodology?: { formula?: string; description?: string; assumptions?: string[] }`
- `NormalizeChartSpecResult` already exposes `spec.data` — no change needed for table data (it's the chart's `data` array)
- Dashboard `ChartSpec` in `src/lib/dashboard/types.ts` gains same optional `methodology` field
- `parseChartSpec` in `types.ts` parses methodology if present
- `normalizeChartSpec` in `spec.ts` passes through methodology if present
- Typecheck passes

#### US-002: Chart/Table tab toggle for chat chart blocks
As a user, I want to switch between Chart and Table views on every chart in chat messages.

**Acceptance Criteria:**
- `ChartBlock` component (`src/components/chat/chart-block.tsx`) wraps content in shadcn `Tabs` with two tabs: "Chart" (default) and "Table"
- Chart tab renders existing `ChartFromSpec` as before
- Table tab renders the chart's `data` array as a formatted shadcn `Table` with:
  - Column headers derived from data keys (xAxisKey + metrics keys, or all keys from first row)
  - Numeric values formatted with locale-aware number formatting
  - Currency values detected and formatted with $ prefix
  - Scrollable container for wide tables
- Tab switching is instant (no re-render of chart), both views pre-rendered
- Full-screen dialog also includes the tabs
- Typecheck passes
- Verify in browser

#### US-003: Update chat system prompt to suppress formula text and embed methodology
As a user, I want the AI to stop dumping formulas as plain text and instead embed analytical details in chart metadata.

**Acceptance Criteria:**
- `CHAT_SYSTEM_PROMPT` in `system-prompt.ts` updated with new output rules:
  - "Do NOT write formulas, equations, or calculation breakdowns as plain text in the message body"
  - "Instead, embed analytical methodology in each chart's `methodology` field"
  - "Message text should contain: brief insight summary, key findings, actionable recommendations"
- Chart block format spec in the prompt updated to include optional `methodology` field: `"methodology": { "formula": "EAC = AC + (BAC - EV) / CPI", "description": "Estimate at Completion using CPI method", "assumptions": ["CPI trend continues", "No scope changes"] }`
- Existing tool workflow, output format, source integrity rules preserved unchanged
- Typecheck passes

#### US-004: Methodology popover on chart blocks
As a user, I want to click a button on a chart to see the formula/methodology used.

**Acceptance Criteria:**
- When `methodology` exists on a chart spec, `ChartBlock` renders a small info icon button (lucide `Info` or `Calculator`) next to the full-screen button
- Clicking the button opens a shadcn `Popover` showing:
  - Formula (if present) in monospace font
  - Description text
  - Assumptions as a bulleted list (if present)
- If no methodology data exists, the button is not rendered
- Popover styling matches dark theme (border-border, bg-card)
- Typecheck passes
- Verify in browser

#### US-005: Chart/Table tabs on dashboard charts
As a user, I want the same Chart/Table toggle on AI-generated dashboard charts.

**Acceptance Criteria:**
- `DashboardClient` chart cards gain a small tab bar (shadcn `Tabs`) in the card header: "Chart" | "Table"
- Table view renders the chart's `data` array with the same formatting approach as US-002
- KPI cards are not affected (no table view for KPIs)
- Chart grouping sections still work when tabs are present
- Methodology button also appears on dashboard charts if methodology data exists
- Typecheck passes
- Verify in browser

### Phase 2: Custom Dashboard Infrastructure

#### US-006: Database schema for custom dashboards and widgets
As a developer, I need DB tables to store user-created dashboards and their widget configurations.

**Acceptance Criteria:**
- New `customDashboards` table: id (uuid PK), userId (uuid FK→users), projectId (uuid FK→projects), name (varchar 255, notNull), description (text, nullable), status (varchar 50, default 'active'), createdAt, updatedAt
- New `dashboardWidgets` table: id (uuid PK), dashboardId (uuid FK→customDashboards, notNull), widgetType (varchar 50, notNull — 'chart' | 'kpi'), title (varchar 255, notNull), config (jsonb, notNull — stores full chart/kpi spec), sortOrder (integer, default 0), createdAt, updatedAt
- Both tables exported from schema.ts
- Schema pushed via `drizzle-kit push`
- Typecheck passes

#### US-007: Custom dashboards CRUD API
As a user, I need API endpoints to create, list, get, and delete custom dashboards.

**Acceptance Criteria:**
- POST `/api/custom-dashboards` — creates dashboard for auth user, body: `{ projectId, name, description? }`, validates project ownership, returns dashboard object
- GET `/api/custom-dashboards?projectId=xxx` — returns user's dashboards for given project (or all if no projectId), each includes widgetCount
- GET `/api/custom-dashboards/[id]` — returns single dashboard with all its widgets (ordered by sortOrder), validates ownership
- DELETE `/api/custom-dashboards/[id]` — archives dashboard (status='archived')
- All routes: 401 unauth, 404 not found, 400 bad input
- Typecheck passes

#### US-008: Dashboard widgets CRUD API
As a user, I need API endpoints to add, update, and remove widgets from a custom dashboard.

**Acceptance Criteria:**
- POST `/api/custom-dashboards/[id]/widgets` — adds widget, body: `{ widgetType, title, config, sortOrder? }`, validates dashboard ownership, returns widget object
- PATCH `/api/custom-dashboards/[id]/widgets/[widgetId]` — updates widget config/title/sortOrder, validates ownership
- DELETE `/api/custom-dashboards/[id]/widgets/[widgetId]` — deletes widget row, validates ownership
- POST `/api/custom-dashboards/[id]/widgets/reorder` — accepts `{ widgetIds: string[] }` and updates sortOrder for all widgets in that order
- Typecheck passes

#### US-009: Custom dashboards list UI under project detail
As a user, I want to see and create custom dashboards from the project detail page.

**Acceptance Criteria:**
- `/projects/[id]` page gains a "Custom Dashboards" section below the AI-generated dashboard
- Section shows cards for each custom dashboard (name, widget count, last updated)
- "Create Dashboard" button opens shadcn Dialog with name + description fields
- Submitting calls POST `/api/custom-dashboards` with the project's ID
- Each dashboard card links to `/projects/[id]/dashboards/[dashboardId]`
- Empty state shown when no custom dashboards exist
- Typecheck passes
- Verify in browser

#### US-010: Custom dashboard canvas page
As a user, I want to view a custom dashboard that renders its saved widgets in a grid.

**Acceptance Criteria:**
- New page: `/projects/[id]/dashboards/[dashboardId]/page.tsx`
- Server component fetches dashboard + widgets from GET `/api/custom-dashboards/[dashboardId]`
- Renders header with dashboard name, project name breadcrumb, and action buttons (Refresh, Delete)
- KPI widgets render as cards (same style as `DynamicKPICard` in dashboard-client)
- Chart widgets render as cards with DynamicChart + Chart/Table tabs (reuse from US-005)
- Widgets ordered by sortOrder in a responsive grid (2-col on desktop, 1-col mobile)
- Empty state when no widgets: "Start building your dashboard using the AI chat panel"
- Typecheck passes
- Verify in browser

#### US-011: Dashboard sidebar AI chat panel
As a user, I want a slide-out AI chat panel on the custom dashboard page to create widgets by conversation.

**Acceptance Criteria:**
- Custom dashboard page has a "AI Assistant" toggle button (bottom-right FAB or header button)
- Clicking opens a shadcn `Sheet` (side panel) from the right with:
  - Chat message list (scrollable)
  - Composer input at bottom
  - "Add to Dashboard" button appears on AI-generated chart/kpi blocks in the chat
- Chat uses the same message format as main chat (```chart, ```kpi blocks parsed)
- Chat calls a new endpoint POST `/api/custom-dashboards/[id]/chat` which:
  - Accepts messages + dashboardId
  - Uses streamText with Mistral
  - System prompt is a dashboard-builder variant (see US-012)
  - Data tools scoped to the dashboard's project (reuses `createDataTools` with projectId)
- Sheet does not cover the main dashboard grid
- Typecheck passes
- Verify in browser

#### US-012: Dashboard-builder system prompt and widget insertion
As a developer, I need a specialized system prompt for dashboard-building chat and the logic to insert AI results as widgets.

**Acceptance Criteria:**
- New system prompt `DASHBOARD_BUILDER_PROMPT` in `src/app/api/custom-dashboards/_lib/system-prompt.ts`
- Prompt instructs AI to: generate charts/KPIs one at a time, use same ```chart / ```kpi output format, focus on the project's uploaded data, ask clarifying questions about what metric/visualization the user wants
- "Add to Dashboard" button on chat chart/kpi blocks calls POST `/api/custom-dashboards/[id]/widgets` with the parsed spec as config
- After adding, the widget appears in the main grid (optimistic update or refetch)
- Widget title derived from chart title or kpi label
- Typecheck passes

#### US-013: Dashboard refresh — regenerate widgets with latest data
As a user, I want to click "Refresh" on a custom dashboard to update all widgets with the latest uploaded data while preserving layout.

**Acceptance Criteria:**
- "Refresh" button in dashboard header triggers POST `/api/custom-dashboards/[id]/refresh`
- Refresh endpoint: for each widget, re-queries the project's datasets and calls LLM with the widget's original title/intent as the prompt, plus latest data context
- Widget `config` is updated in DB with new chart data
- Frontend shows loading skeleton per-widget during refresh
- Failed widget refreshes show error badge but don't block others
- Widget sort order and titles preserved
- Typecheck passes
- Verify in browser

#### US-014: Navigation and sidebar integration
As a user, I want custom dashboards accessible from the main sidebar navigation.

**Acceptance Criteria:**
- Sidebar nav gains a "My Dashboards" link under Projects → navigates to `/dashboards`
- New `/dashboards` page lists all user's custom dashboards across all projects
- Each card shows: dashboard name, project name, widget count, last updated
- Cards link to the dashboard canvas page
- Breadcrumbs on dashboard canvas: Projects → [Project Name] → [Dashboard Name]
- Page title and metadata set correctly
- Typecheck passes
- Verify in browser

## Success Metrics

- Chat messages contain ≤ 2 sentences of methodology text (rest embedded in chart metadata)
- Every chart block offers Chart/Table toggle
- Users can create, save, and refresh custom dashboards end-to-end
- All 14 stories pass typecheck + build
