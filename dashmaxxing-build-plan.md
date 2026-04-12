# Dashmaxxing — Build Plan
**Version:** 1.0  
**Status:** Active  
**Last Updated:** April 2026

---

## Overview

The build is broken into 8 sequential phases. Each phase produces something runnable — no phase leaves the app in a broken or non-testable state. Phases 1–3 are pure backend/infra with minimal UI. Phases 4–8 layer features on top of a stable foundation.

---

## Phase 1 — Foundation
**Goal:** A user can log in, create an org, and invite a teammate

### Infrastructure
- [ ] GCP project setup — Cloud Run, Cloud SQL, Cloud KMS, Cloud NAT, Memorystore (Redis)
- [ ] Terraform scaffolding (`infra/`) — Cloud Run services, Cloud SQL instance, KMS keyring, static egress IP via Cloud NAT
- [ ] `docker-compose.yml` for local dev — app + worker + Postgres + Redis

### Auth & Org
- [ ] SQLAlchemy models + first Alembic migration: `orgs`, `users`, `invitations`
- [ ] Google OAuth 2.0 login flow (`/login` page)
- [ ] Server-side session management via Redis (`core/security/session.py`)
- [ ] Org creation on first login — org name input, org slug auto-generation (URL-safe, unique)
- [ ] Invitation system:
  - Admin generates invite link scoped to org
  - Email sent to invitee with signup URL
  - Invited user with existing account: added to org directly
  - Invited user without account: prompted to create one first
- [ ] Role assignment on join: Admin (first user) or Member (invited)
- [ ] Basic navbar + org-aware routing (`/{org-slug}/`)
- [ ] Encryption helpers: `core/security/encryption.py` (AES-256-GCM) + `core/security/kms.py`

### Checkpoint
> Login works end-to-end. Org is created with a slug. A second user receives an invite email, creates an account, and joins the org with Member role.

---

## Phase 2 — Data Sources
**Goal:** A user can connect Google Sheets or a database and preview its schema

### Data Source Management
- [ ] `data_sources` DB model + Alembic migration
- [ ] Abstract connector interface (`core/data/connectors/base.py`)
- [ ] **Google Sheets connector** (`core/data/connectors/sheets.py`):
  - OAuth token stored encrypted via KMS
  - User pastes Sheet URL, selects tab
  - Schema preview: column names + inferred types + row count
- [ ] **PostgreSQL connector** (`core/data/connectors/postgres.py`):
  - Credentials stored encrypted via KMS
  - Connection test on save
  - Schema preview: table list → column names + types
- [ ] **MySQL connector** (`core/data/connectors/mysql.py`): same as Postgres
- [ ] Schema metadata encrypted at rest before DB write
- [ ] Data source management UI in `/settings` — list, add, remove connectors

### Checkpoint
> User connects a Google Sheet. Schema preview shows column names, types, and row count. User connects a Postgres DB, sees table list, selects a table, sees columns.

---

## Phase 3 — Dashboard & Chart Rendering
**Goal:** A user can create a dashboard and see charts load asynchronously

### Dashboard Core
- [ ] `dashboards`, `charts`, `dashboard_versions` models + migrations
- [ ] Dashboard creation — title input → slug + NanoID suffix generated → route created
- [ ] URL structure enforced: `/{org-slug}/{dashboard-slug}-{nanoid}`
- [ ] Chart config JSON schema defined and validated via Pydantic (`core/schemas/chart_config.py`)

### Grid Layout
- [ ] `GridLayout` custom Dash component wrapping `react-grid-layout` (`custom_components/grid_layout/`)
- [ ] 12-column grid, 80px row height, 12px gutter
- [ ] Drag to reposition — `onLayoutChange` fires → debounced 500ms → position saved to DB
- [ ] Drag edges/corners to resize — same pipeline
- [ ] Collision detection (no overlapping charts) handled by `react-grid-layout`

### Chart Rendering
- [ ] Dashboard page with skeleton loading states on initial render
- [ ] Per-chart async callbacks — each chart fires independently, populates as it resolves
- [ ] DuckDB in-memory engine (`core/data/duckdb_engine.py`) wired to connectors
- [ ] Chart types implemented (Plotly figures): line, bar, scatter, pie/donut, data table
- [ ] Two-layer config separation enforced:
  - `data` layer changes → re-fetch + re-render
  - `layout`/`style` changes → clientside callback, no server round-trip

### Global Controls
- [ ] Date range picker — applies to all charts on dashboard
- [ ] Granularity toggle (daily / weekly / monthly / quarterly)
- [ ] Dimension filter — categorical column dropdown, multi-select
- [ ] Filter state encoded in URL query params (shareable filtered views)

### Checkpoint
> Dashboard with 3+ charts loads — each chart skeleton appears immediately, charts populate independently in any order. Dragging and resizing works and persists on reload. Date filter applied globally changes all charts simultaneously.

---

## Phase 4 — Edit with AI
**Goal:** A user can click a chart and tell the AI to modify it in natural language

### AI Infrastructure
- [ ] Abstract AI provider interface (`core/ai/provider.py`)
- [ ] Gemini implementation via Vertex AI (`core/ai/gemini.py`) — zero data retention enabled
- [ ] Chart edit system prompt (`core/ai/prompts/chart_edit.txt`) — strict JSON output enforced, schema-aware
- [ ] Config diff utility (`core/ai/chart_editor.py`) — compares before/after config, generates human-readable summary

### Edit Panel
- [ ] Chart toolbar with "Edit with AI" button (`app/components/chart/chart_toolbar.py`)
- [ ] AI edit slide-in panel (`app/components/ai_panel.py`) — text input, submit, loading state
- [ ] Callback flow (`app/callbacks/ai_edit.py`):
  1. Validate session + editor role
  2. Decrypt schema metadata (KMS) — in memory only
  3. Call Gemini with chart config + schema + instruction
  4. Validate returned JSON against Pydantic schema
  5. Display diff: *"AI changed: `data.dimension` null → 'country'"*
  6. Apply change (cosmetic → clientside, data → re-fetch)
  7. Clear schema from memory
- [ ] Auto-save after every confirmed AI edit → new version snapshot created

### Checkpoint
> User clicks a chart, types "break this down by country", sees diff summary, chart updates with dimension breakdown applied. Cosmetic edits (color, font) feel instant.

---

## Phase 5 — Built-in Transforms + Pyodide
**Goal:** Users can apply analytical transforms to data before charting

### Built-in Transforms
- [ ] Transform engine (`core/data/transforms.py`):
  - `rolling_average` — configurable window
  - `linear_extrapolation` — N periods forward
  - `yoy_comparison` — prior year overlay as second series
  - `cumulative_sum` — running total
  - `pct_change` — period-over-period % change
  - `z_score_normalization` — normalize for cross-metric comparison
- [ ] Transform picker UI in chart toolbar — dropdown list, parameter inputs
- [ ] Transform config stored in `data.transforms` array in chart JSON

### Pyodide (Custom Python)
- [ ] Pyodide bootstrap (`assets/pyodide_runner.js`):
  - Loads Pyodide (~5MB) once on first use
  - Cached by browser after first load
  - *"Loading Python environment..."* indicator shown during initialisation
- [ ] Python code editor panel (`app/components/chart/code_editor.py`) — CodeMirror or Monaco
- [ ] Client-side callback:
  1. Receives aggregated DataFrame as JSON from server
  2. Passes to Pyodide in browser memory
  3. Runs user's `transform(df)` function
  4. Returns transformed DataFrame to Plotly for rendering
- [ ] Guardrails:
  - Function must be named `transform`, accept and return a DataFrame — validated before run
  - 10-second execution timeout — cancelled with error message if exceeded
  - Inline syntax error display in editor
  - Warning banner: *"This code runs in your browser only and is never sent to Dashmaxxing servers"*
- [ ] Custom code stored in `data.transforms` array as `{"type": "custom_python", "code": "..."}`

### Checkpoint
> User applies rolling average via dropdown — chart updates with smoothed line. Technical user opens code editor, writes a custom extrapolation function, sees it applied live in the chart.

---

## Phase 6 — Annotations & Version Control
**Goal:** Users can annotate charts and browse/restore version history

### Annotations
- [ ] `annotations` DB model + migration
- [ ] Click-to-annotate on chart data points — click fires annotation form
- [ ] Date range annotation — click and drag across time axis
- [ ] Annotation form (`app/components/annotation_panel.py`):
  - Short title (required)
  - Description text (optional)
  - Root cause tag: `infra`, `marketing`, `data issue`, `external`, `other`
  - One or more external links (any URL — Notion, Slack, incident report, etc.)
- [ ] Annotation markers/overlays rendered on chart via Plotly layout shapes + annotations
- [ ] Propagation: annotations tied to a date or date range automatically appear on all charts sharing the same time axis on the dashboard
- [ ] Annotations stored in both chart config JSON and `annotations` DB table
- [ ] All users with dashboard access can view annotations; only editors can add/edit/delete

### Version Control
- [ ] Version history panel (`app/pages/version_history.py`):
  - List of all snapshots — editor name, timestamp, change summary
  - Accessible from dashboard header
- [ ] Restore flow — select version → confirm → new version entry created with label *"Restored to version from [timestamp]"*
  - History is append-only — no version is ever deleted
- [ ] Concurrent editing banner:
  - Detected via Redis presence key (set on dashboard open, TTL 30s, refreshed while active)
  - Banner shown: *"[Name] is also editing this dashboard"*

### Checkpoint
> User annotates a date range "Server outage — Mar 3". Annotation appears on all time-axis charts. Version history shows all edits. Restoring a version brings back previous chart state without deleting history.

---

## Phase 7 — Sharing & Access Control
**Goal:** Users can share dashboards at three tiers with appropriate access enforcement

### Usage Limits
- [ ] Limit enforcement at API layer (not just UI):
  - Max 3 dashboards per org
  - Max 7 charts per dashboard
  - Max 2 editor seats per org
  - Unlimited viewers
- [ ] "New Dashboard" button disabled with tooltip when limit reached
- [ ] Editor seat enforcement — 3rd user invited as editor is downgraded to viewer with a warning

### Sharing
- [ ] `dashboard_access` DB model + migration
- [ ] Sharing modal (`app/components/share_modal.py`):
  - **Tier 1 — Org-wide toggle:** any org member can view
  - **Tier 2 — Email invite:** input field, sends email with dashboard link, revocable per-invitee
  - **Tier 3 — Public link:** generate NanoID token, optional password, copy link button
- [ ] Link revocation — generate new token → old token returns 404
- [ ] Public view route (`/{org-slug}/{dashboard-slug}-{nanoid}/public`):
  - No login required
  - View-only — all edit callbacks blocked server-side
  - Data source connection details not exposed
  - Password gate if set

### Role Enforcement
- [ ] All edit callbacks verify editor role server-side — viewer session cannot trigger mutations regardless of UI state
- [ ] Viewer role: can use global filters (date range, granularity, dimension), cannot edit charts, annotations, or settings

### Checkpoint
> Dashboard shared via public link opens without login. Charts render, filters work, but "Edit with AI" and annotation tools are absent. Generating a new link breaks the old one.

---

## Phase 8 — Onboarding Flow + Production Polish
**Goal:** New users get an AI-generated dashboard from onboarding Q&A. App is production-ready.

### Onboarding
- [ ] Dashboard generator prompt (`core/ai/prompts/dashboard_gen.txt`):
  - Enforces dimension-first philosophy
  - Prefers fewer richer charts over many narrow ones
  - Always includes date, granularity, and dimension controls
- [ ] Onboarding Q&A page (`app/pages/onboarding.py`):
  - Schema shown to user (column names + types)
  - Freetext input: *"What questions are you trying to answer with this data?"*
  - Submit → Gemini call with schema + answers → full dashboard JSON config returned
  - Dashboard rendered immediately on completion

### Refresh Notifications
- [ ] Refresh interval setting in dashboard settings (Google Sheets sources only)
- [ ] Cloud Tasks job checks interval → sets a Redis flag when elapsed
- [ ] Dashboard polls Redis flag → shows banner: *"New data may be available — click to refresh"*
- [ ] Clicking banner re-fetches all charts (same as page load)

### Error & Empty States
- [ ] Lost Google Sheets auth → chart shows: *"Data source access lost. Contact the dashboard owner."*
- [ ] DB unreachable → chart shows: *"Could not connect to data source. Check your connection settings."*
- [ ] Query timeout → chart shows: *"Query took too long. Try a smaller date range."*
- [ ] Empty dashboard → prompt to add first chart
- [ ] No data returned → chart shows: *"No data for the selected filters."*

### Production Hardening
- [ ] Gunicorn multi-worker config for `app` Cloud Run service
- [ ] All callbacks stateless — no global Python state
- [ ] End-to-end tests for critical paths:
  - Login → create org → invite user
  - Connect Google Sheet → preview schema → generate dashboard
  - Edit chart with AI → verify diff → confirm → version saved
  - Share via public link → open without login → verify view-only
- [ ] Cloud Run deploy pipeline (CI/CD via Cloud Build)
- [ ] Cloud SQL automated backups enabled
- [ ] Secrets in GCP Secret Manager (never in env files in production)
- [ ] Structured logging via Google Cloud Logging

### Checkpoint
> Full user journey works end-to-end in production. New user signs up, connects a Sheet, answers onboarding questions, gets a generated dashboard, shares it via public link.

---

## Suggested First Week

| Day | Focus |
|---|---|
| Day 1 | GCP project setup + `docker-compose.yml` local env running |
| Day 2 | SQLAlchemy models + Alembic + DB running locally |
| Day 3 | Google OAuth login + Redis session working |
| Day 4 | Org creation + slug generation + KMS encryption helpers |
| Day 5 | Invitation flow — send email, join org, role assignment |

Phase 1 is entirely backend with no UI decisions — the right place to start. Every subsequent phase builds on a working foundation.
