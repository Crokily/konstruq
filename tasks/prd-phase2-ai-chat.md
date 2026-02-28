# PRD: Konstruq Phase 2 — AI Chat with Dynamic Data Analysis

## Introduction

Phase 2 adds an AI-powered chat interface to Konstruq. Users upload their own CSV/XLSX data files (via two entry points: ERP data and PM data), and an AI agent (powered by Mistral Large) analyzes the uploaded data to answer questions, perform calculations, and generate dynamic charts. The AI works with any data structure — no predefined schemas. This is for the Mistral AI hackathon.

## Goals

- Users can upload CSV and XLSX files as data sources (two categories: ERP and PM)
- Files are parsed and stored without imposing any schema — the AI interprets the data
- Full-page chat interface at `/chat` where users converse with the AI
- AI can answer questions about uploaded data, perform calculations, and return dynamic charts
- Charts are rendered inline in the chat using existing Recharts components
- Powered by Mistral Large via Vercel AI SDK (`@ai-sdk/mistral`)

## Constraints

- **LLM**: Mistral AI only (`mistral-large-latest` via `@ai-sdk/mistral`)
- **Data**: User-uploaded files with unknown/arbitrary column structures
- **No predefined data templates** — AI must dynamically understand any uploaded data
- **Existing DataProvider/mock data**: remains for the static dashboard pages, unchanged
- **Hackathon timeline**: ~7 days

## User Stories

### US-101: Install AI SDK dependencies and create chat API route skeleton
**Description:** As a developer, I need the AI SDK packages installed and a basic `/api/chat` route that streams responses from Mistral Large.
**Acceptance Criteria:**
- `ai` and `@ai-sdk/mistral` packages installed in package.json
- `MISTRAL_API_KEY` read from environment (add to .env.local)
- `POST /api/chat` route at `src/app/api/chat/route.ts` accepts `{ messages }` body
- Route uses `streamText` with `mistral('mistral-large-latest')` and returns `toDataStreamResponse()`
- Basic system prompt: "You are Konstruq, a construction industry data analysis assistant."
- Typecheck passes
- Lint passes

### US-102: Database schema for uploaded datasets
**Description:** As a developer, I need a database table to store user-uploaded data files (parsed as JSON).
**Acceptance Criteria:**
- New table `uploaded_datasets` in `src/lib/db/schema.ts` with columns: id (uuid), userId (uuid FK), category (varchar 'erp'|'pm'), fileName (varchar), sheets (jsonb — array of {sheetName, columns, rowCount, rows}), meta (jsonb), isActive (boolean), uploadedAt (timestamp)
- New table `chat_sessions` with columns: id (uuid), userId (uuid FK), title (varchar), createdAt, updatedAt
- Run `npm run db:push` to push schema to Neon
- Typecheck passes

### US-103: File upload API — parse CSV and XLSX to JSON
**Description:** As a developer, I need an API route that accepts file uploads, parses CSV/XLSX into JSON row arrays, and stores them in the database.
**Acceptance Criteria:**
- Install `papaparse` and `xlsx` (SheetJS) packages
- Install `@types/papaparse` for TypeScript support
- `POST /api/upload` route at `src/app/api/upload/route.ts`
- Accepts `multipart/form-data` with fields: `file` (the file) and `category` ('erp' or 'pm')
- CSV files: parsed with papaparse (header: true), stored as single sheet
- XLSX files: all sheets parsed with xlsx, each sheet stored separately
- Each sheet stored as `{ sheetName, columns: string[], rowCount: number, rows: Record<string, unknown>[] }`
- Result saved to `uploaded_datasets` table with userId from Clerk auth
- Returns JSON `{ id, fileName, category, sheets: [{sheetName, columns, rowCount}] }` (without full row data)
- Handles errors: no file, unsupported format, parse failure
- Typecheck passes

### US-104: Data Sources page — upload UI and dataset list
**Description:** As a user, I want a page to upload my data files and see what I've uploaded.
**Acceptance Criteria:**
- New route `/data-sources` with page at `src/app/(dashboard)/data-sources/page.tsx`
- Add "Data Sources" link to sidebar navigation (with Database or Upload icon)
- Page has two sections: "Project Management Data" (PM) and "Financial / ERP Data" (ERP)
- Each section has: file upload dropzone/button (accepts .csv, .xlsx), list of uploaded datasets
- Upload triggers POST to `/api/upload` with correct category
- After upload, list refreshes showing: fileName, sheet count, total row count, upload date
- Each dataset has a delete button (calls `DELETE /api/upload/[id]`)
- `DELETE /api/upload/[id]` route removes dataset from DB
- Loading state during upload, success/error feedback
- Dark theme consistent with rest of app
- Typecheck passes
- Verify in browser

### US-105: Chat page — full chat UI with useChat
**Description:** As a user, I want a dedicated chat page where I can talk to the AI assistant.
**Acceptance Criteria:**
- New route `/chat` with page at `src/app/(dashboard)/chat/page.tsx`
- Add "AI Chat" link to sidebar navigation (with MessageSquare icon)
- Page layout: full-height chat area with scrollable message list + input bar at bottom
- Uses `useChat` hook from `ai/react` pointing to `/api/chat`
- Messages display with role indicator (user vs assistant)
- User messages right-aligned (amber accent), assistant messages left-aligned
- Input has send button, disabled while loading
- Streaming: assistant messages appear token-by-token as they stream
- Empty state: welcome message suggesting what to ask
- Dark theme (slate-950 bg, slate-800 message cards)
- Typecheck passes
- Verify in browser

### US-106: Wire uploaded data into chat context
**Description:** As a developer, I need the chat API to load all of the user's uploaded datasets and include them in the AI's system prompt so the AI can analyze the data.
**Acceptance Criteria:**
- `/api/chat` route loads all `uploaded_datasets` for the current user (via Clerk auth)
- System prompt dynamically built: lists each dataset (fileName, category, sheets with column names and row counts)
- For datasets that fit in context (< 80K tokens estimated): full row data included as JSON in system prompt
- For oversized datasets: only schema + first 20 sample rows included, with a note to AI that data is truncated
- Token estimation: rough calc of `JSON.stringify(rows).length / 4`
- AI system prompt instructs: "The user has uploaded the following datasets. Analyze them to answer questions. You can perform calculations, comparisons, and suggest visualizations."
- Test: upload a small CSV, then ask "what columns does my data have?" — AI should correctly list them
- Typecheck passes

### US-107: Chart rendering in chat messages — parse and display
**Description:** As a user, I want to see charts inline in the AI's chat responses when the AI decides a visualization would be helpful.
**Acceptance Criteria:**
- System prompt instructs AI to output chart specs in ```chart code blocks when visualization is appropriate
- Chart spec format: `{ type, title, xAxisKey, xAxisLabel?, yAxisLabel?, metrics: [{key, label, color?}], data: [...], formatAs?: 'currency'|'percent'|'number' }`
- Supported chart types: `bar`, `line`, `area`, `pie`, `scatter`, `stacked-bar`, `composed`
- New component `src/components/chat/chart-from-spec.tsx` — maps spec to Recharts components
- New component `src/components/chat/message-renderer.tsx` — parses assistant message content, splits into text parts and chart parts
- Text parts rendered as Markdown (install `react-markdown` + `remark-gfm` if not present)
- Chart parts rendered via `<ChartFromSpec>`
- Charts use dark theme styling consistent with existing dashboard charts (amber, blue, green palette)
- Charts are responsive (fill container width, fixed 300px height)
- Typecheck passes
- Verify in browser

### US-108: Chat polish — tables, KPI badges, error handling
**Description:** As a user, I want the chat to also render data tables and KPI cards, and handle errors gracefully.
**Acceptance Criteria:**
- AI can also output ```table blocks with format: `{ headers: string[], rows: string[][] }`
- AI can also output ```kpi blocks with format: `{ items: [{label, value, trend?, description?}] }`
- `message-renderer.tsx` handles all three block types (chart, table, kpi)
- Tables rendered with existing shadcn Table component, dark styled
- KPI items rendered as horizontal badge row (similar to existing EVM KPI badges)
- If AI returns malformed JSON in a code block, display as plain code (graceful fallback)
- Chat input shows character count or loading spinner while AI is responding
- If API returns error (500, etc.), show user-friendly error message in chat
- "Clear chat" button to reset conversation
- Typecheck passes
- Verify in browser

### US-109: End-to-end demo flow — upload data and chat
**Description:** As a hackathon judge, I want to see the complete flow: upload data files, then chat with the AI about the data and see charts.
**Acceptance Criteria:**
- Prepare 2 demo CSV files in `demo-data/` directory:
  - `demo-data/pm-projects.csv` — 6 construction projects with columns like: project_name, type, status, city, state, start_date, end_date, contract_value, percent_complete
  - `demo-data/erp-financials.csv` — financial data with columns like: project_name, budget, actual_cost, committed, labor_cost, material_cost, subcontract_cost, billed_to_date, change_orders_amount
- Upload both files via Data Sources page (verify they appear in list)
- Go to Chat page
- Test these conversations produce correct results:
  - "What data do I have?" → AI lists the uploaded datasets and their columns
  - "Which project has the highest contract value?" → AI answers with correct project name and value
  - "Show me a bar chart comparing budget vs actual cost across all projects" → AI returns inline bar chart
  - "Calculate the cost variance for each project" → AI computes and returns a table
- All interactions work end-to-end without errors
- Typecheck passes
- Verify in browser

## Functional Requirements

- FR-1: File uploads via multipart/form-data, supporting .csv and .xlsx
- FR-2: Parsed data stored as JSON arrays in PostgreSQL (no schema assumptions)
- FR-3: All user data loaded into Mistral Large context for analysis
- FR-4: Chat uses Vercel AI SDK `useChat` + `streamText` for streaming responses
- FR-5: AI can return inline charts via ```chart blocks, rendered with Recharts
- FR-6: AI can return inline tables via ```table blocks, rendered with shadcn Table
- FR-7: AI can return KPI badges via ```kpi blocks
- FR-8: All data access is user-scoped (each user sees only their own uploads)

## Non-Goals

- Real Procore/Sage API integration (MVP uses uploaded files only)
- Chat history persistence across sessions (nice-to-have, not required)
- Multi-user collaboration on shared datasets
- File size limits / chunking for very large files (hackathon data will be small)
- RAG / vector search over documents (data fits in context window)
- Tool calling for data queries (data goes directly into context for simplicity)

## Technical Considerations

- Mistral Large: 128K context window, tool calling supported but NOT needed for MVP (data in context is simpler)
- Token budget: ~30K for data, ~5K for system prompt, ~10K for conversation, ~80K for AI reasoning
- `papaparse` for CSV, `xlsx` (SheetJS) for Excel parsing — both work server-side in Node.js
- Chart spec is a simple JSON convention in markdown code blocks — no framework dependency
- react-markdown + remark-gfm for rendering AI text responses
- Existing dashboard pages and mock DataProvider remain unchanged

## Success Metrics

- Upload → Chat → Chart flow works in under 30 seconds
- AI correctly identifies columns and values from uploaded data
- At least 3 different chart types renderable from AI responses
- Demo-ready for Mistral AI hackathon judges
