# Dashmaxxing — Product Requirements Document (MVP)
**Version:** 0.3  
**Status:** Draft  
**Last Updated:** April 2026

---

## 1. Overview

### 1.1 Problem Statement
Tableau and similar BI tools are built for analysts, not for entire teams. They are complex to set up, slow to render, and require a dedicated person to maintain — creating a single point of failure for data-driven teams. Non-technical stakeholders are left dependent on analysts for even simple dashboard changes.

### 1.2 Product Vision
Dashmaxxing is an AI-powered dashboard platform that is fast, collaborative, and easy enough for anyone on a team to use — without sacrificing the flexibility that technical users expect. It removes the bottleneck of having one person own all dashboards.

### 1.3 Target User (MVP)
**Small-to-mid startup teams** (5–50 people) running on Google Workspace who want to build and share data dashboards without needing a dedicated BI analyst. The team includes a mix of technical and non-technical users.

### 1.4 Deployment Model
SaaS web application hosted on Google Cloud Platform (GCP). Raw data never persists on Dashmaxxing servers. Google Sheets data is fetched live via the Sheets API. Database connections are made directly from the Dashmaxxing backend over an encrypted connection — users only need to provide their DB credentials and whitelist Dashmaxxing's static egress IP. No action beyond login and setup is required from users.

---

## 2. Goals & Non-Goals

### Goals (MVP)
- Enable any team member to build and edit dashboards without Tableau expertise
- Provide a fast, per-chart async loading experience (no waiting for the full dashboard)
- Allow AI-assisted chart editing through natural language
- Support annotations tied to data points and date ranges, with external documentation links
- Implement version control so teams can track changes and revert safely
- Support secure sharing within an org, by email invite, and via public link
- Store no raw user data on Dashmaxxing servers

### Non-Goals (MVP)
- Natural language data analysis ("why did bookings drop?")
- Live collaborative editing (Figma-style simultaneous edits)
- Server-side custom Python execution (security risk — client-side via Pyodide is supported instead)
- Anomaly detection or AI-proactive insights
- Audience / presentation mode
- CSV file upload (deferred — Google Sheets covers this use case)
- Snapshot comparison across time periods

---

## 3. Core Features

### 3.1 Onboarding & Data Connection

#### First-time Setup
1. User signs in with Google (Google OAuth — zero-friction for Workspace teams)
2. User connects a data source (see §3.2)
3. Dashmaxxing displays a schema preview: table/column names, data types, sample row counts
4. User is prompted: **"What questions are you trying to answer with this data?"**
5. Based on their response, AI generates an initial dashboard with relevant charts (see §3.3 for generation philosophy)

#### Org Setup & Invitation
- The first user to sign up creates an org and becomes the Admin
- Subsequent users join by **invitation only** — Admin sends an email invite from within Dashmaxxing
- Invited users receive an email with a signup link scoped to that org
- There is no auto-detection by email domain — users cannot join an org without an explicit invite
- An invited user who already has a Dashmaxxing account is added to the org directly; a new user is prompted to create an account first

#### URL Structure
Path-based routing — no subdomains:
```
dashmaxxing.com/{org-slug}/{dashboard-slug}-{nanoid}
```
Example: `dashmaxxing.com/acme-co/bookings-overview-v1k3p9`

- `org-slug` — derived from the org name on signup, user-editable, URL-safe
- `dashboard-slug` — derived from the dashboard title, auto-updated when title changes
- `nanoid` — 8-character random suffix appended to slug for uniqueness and non-guessability
- Filter state (date range, granularity, dimension selection) is encoded in URL query params so filtered views are shareable directly

---

### 3.2 Data Sources

#### Supported at MVP

| Source | Type | Notes |
|---|---|---|
| Google Sheets | Live pull | User selects a specific tab; data fetched fresh on every dashboard load. Maintainer can configure a refresh interval notification to prompt viewers to reload when new data is likely available |
| PostgreSQL | Direct connection | Queries run in user's environment |
| MySQL | Direct connection | Queries run in user's environment |

#### Google Sheets Specifics
- User pastes the Sheet URL and selects a tab
- Dashboard owner authenticates once via Google OAuth — their token is used to fetch data for all dashboard viewers
- Viewers do **not** need individual Sheets access — only the dashboard owner does
- If a viewer opens a dashboard and the owner's token has lost Sheets access, they see: *"You don't have access to the data source for this dashboard. Contact the dashboard owner."*

#### Refresh Notification (Google Sheets)
- Data is fetched fresh on every dashboard load — no stale cache
- Maintainers can set a **refresh interval** in dashboard settings (e.g., every 60 minutes)
- When the interval elapses, viewers see a non-intrusive banner: *"New data may be available — click to refresh"*
- Clicking the banner re-fetches all charts, identical to a page load
- No auto-refresh occurs without viewer action — charts never jump while someone is reading the dashboard

#### PostgreSQL / MySQL Specifics
- User provides DB host, port, username, and password during setup — credentials stored encrypted (AES-256 + KMS)
- Dashmaxxing backend opens a connection directly, runs the query, returns aggregated results, then closes the connection — raw rows never leave the query execution context
- Dashmaxxing exposes a **static egress IP** via Cloud NAT — users can whitelist this single IP in their DB firewall
#### Near-Term (Post-MVP)
- BigQuery (natural fit given GCP infrastructure)
- Additional SQL databases (Snowflake, Redshift)

---

### 3.3 Dashboard & Charts

#### Chart Types (MVP)
- Bar chart
- Line chart
- Scatter plot
- Pie / donut chart
- Data table

#### AI-Generated Dashboard Layout
The initial dashboard is truly generated — not templated — based on the user's stated questions and the detected schema. The AI outputs a structured JSON config that Dashmaxxing's rendering engine builds into Dash components.

**Generation philosophy:** charts should be built for self-service analysis, not just display. The AI defaults to dimension-aware charts so viewers can slice data themselves without needing to request a new chart.

Example — user connects a Sheet with columns `date, country, bookings, revenue` and says *"I want to track booking and revenue trends and understand which countries are driving changes"*. The AI generates:

- **Chart 1:** Line chart — bookings over time, broken down by country dimension
- **Chart 2:** Line chart — revenue over time, broken down by country dimension
- **Default controls (applied to both):** date range filter, granularity toggle (daily/weekly/monthly), country dimension filter

This allows a viewer to see an overall trend and immediately filter to a specific country to isolate what's driving a change — without needing to ask an analyst for a new chart. The AI always prefers fewer, richer charts over many narrow ones.

#### Loading Behavior
- Dashboard layout renders immediately with skeleton loading states
- Each chart loads independently and asynchronously — fast charts appear first
- No chart blocks another from rendering
- Cosmetic changes (colors, fonts, axis labels) applied client-side instantly — no server round-trip

#### Drag-and-Drop Layout
Dashboard layout is fully user-configurable via drag-and-drop, powered by a custom Dash component wrapping `react-grid-layout`:
- Drag charts to reposition on a 12-column grid
- Drag chart edges/corners to resize
- Charts cannot overlap — collision detection is automatic
- Layout changes are debounced (500ms after drag stops) then saved as a new version snapshot

Grid specifications:

| Property | Value |
|---|---|
| Columns | 12 |
| Row height | 80px |
| Min chart width | 4 columns |
| Min chart height | 3 rows |
| Default chart size | 6 wide × 4 tall |
| Gutter | 12px |

#### Chart Configuration (JSON)
Each chart is defined by a single JSON config object — the single source of truth for both UI controls and the code editor. Technical users can edit this JSON directly; non-technical users interact with it through the UI and AI edit panel.

The config has two distinct layers — `data` (triggers re-fetch when changed) and `layout`/`style` (applied client-side instantly, no re-fetch):

```json
{
  "id": "chart-v1k3p9",
  "type": "line",
  "title": "Bookings Over Time",

  "data": {
    "source_id": "src-abc123",
    "x": "date",
    "y": "bookings",
    "dimension": "country",
    "aggregation": "sum",
    "filters": [],
    "transforms": [
      { "type": "rolling_average", "window": 7 }
    ]
  },

  "layout": {
    "x_axis": { "label": "Date", "granularity": "weekly" },
    "y_axis": { "label": "Bookings", "scale": "linear" },
    "legend": { "visible": true, "position": "bottom" },
    "grid": { "show_horizontal": true, "show_vertical": false }
  },

  "style": {
    "colors": ["#4F46E5", "#10B981", "#F59E0B"],
    "font_family": "Inter",
    "font_size": 13,
    "background": "#ffffff",
    "line_width": 2,
    "point_markers": false
  },

  "annotations": [
    {
      "id": "ann-xyz",
      "date_start": "2024-03-03",
      "date_end": "2024-03-03",
      "title": "Server outage",
      "tag": "infra",
      "links": ["https://notion.so/incident-42"]
    }
  ],

  "position": {
    "col": 0,
    "row": 0,
    "width": 6,
    "height": 4
  }
}
```

When the AI edits a chart, it receives this config + the user's instruction and returns a modified config. The diff is shown to the user so they can see exactly what changed.

#### Built-in Transforms
Common analytical patterns available out of the box, applied via UI or AI instruction:

| Transform | Description |
|---|---|
| `rolling_average` | N-period rolling mean. Configurable window size |
| `linear_extrapolation` | Project the trend forward N periods |
| `yoy_comparison` | Overlay same period from prior year as a second series |
| `cumulative_sum` | Replace values with running total |
| `pct_change` | Period-over-period percentage change |
| `z_score_normalization` | Normalize values for cross-metric comparison |

#### Custom Python Transforms (Pyodide)
Technical users can write their own transform functions in Python, executed entirely **client-side in the browser via Pyodide (Python compiled to WebAssembly)**. No user code ever reaches the server — zero security risk to the platform.

The transform function receives a `pandas` DataFrame and must return one. It runs after data is fetched and before the chart renders:

```python
def transform(df):
    import numpy as np

    # Example: linear extrapolation for next 30 days
    df = df.sort_values("date").reset_index(drop=True)
    x = np.arange(len(df))
    y = df["bookings"].values
    coeffs = np.polyfit(x, y, 1)

    future_x = np.arange(len(df), len(df) + 30)
    future_y = np.polyval(coeffs, future_x)
    future_dates = pd.date_range(df["date"].iloc[-1], periods=31, freq="D")[1:]

    forecast = pd.DataFrame({"date": future_dates, "bookings": future_y})
    return pd.concat([df, forecast], ignore_index=True)
```

**Available libraries:** `pandas`, `numpy`. Libraries requiring C extensions (`sklearn`, `scipy`) are not available in Pyodide without explicit compilation — not supported for MVP.

**How it fits in the config:**

```json
"data": {
  "source_id": "src-abc123",
  "x": "date",
  "y": "bookings",
  "transforms": [
    {
      "type": "custom_python",
      "code": "def transform(df):\n    ..."
    }
  ]
}
```

**Execution flow:**

```
Data fetched from source (server-side)
        ↓
Aggregated result sent to browser
        ↓
Pyodide loads in browser (one-time ~5MB load, cached after first use)
        ↓
User's transform function runs in browser memory
        ↓
Transformed DataFrame passed to Plotly for rendering
        ↓
No code or data touches the server again
```

**Constraints and guardrails:**
- Execution timeout: 10 seconds — if the function runs longer, it is cancelled and an error is shown
- Memory limit: 200MB — enforced by the browser tab's WASM memory ceiling
- The function must be named `transform` and accept/return a DataFrame — validated before execution
- Syntax errors are caught immediately in the editor with inline feedback
- Users are shown a clear warning: *"This code runs in your browser only and is never sent to Dashmaxxing servers"*
- Pyodide is ~5MB and loads once on first use, then cached by the browser. While loading, the code editor displays a *"Loading Python environment..."* indicator so users know the editor is initialising and not broken

#### Default Dashboard Controls
Every dashboard includes the following controls out of the box — applied globally across all charts:
- **Date range filter** — select a time window (e.g., last 7 days, last 30 days, custom range)
- **Granularity control** — switch time axis between daily / weekly / monthly / quarterly
- **Dimension filter** — filter by any categorical column (e.g., country, product, channel) via dropdown or multi-select

These controls are always visible at the top of the dashboard. Filter state is preserved in the URL so filtered views can be shared directly.

---

### 3.4 Edit with AI

The primary editing mechanism for Dashmaxxing. Designed to replace manual chart configuration.

#### Flow
1. User clicks any chart on the dashboard
2. A panel appears with the option **"Edit with AI"**
3. User types a natural language instruction (e.g., *"change the x-axis to weekly instead of daily"*, *"make the bars blue"*, *"add a title: Bookings by Region"*)
4. AI modifies that chart only
5. Cosmetic changes apply instantly client-side; data/aggregation changes re-query and refresh only that chart

#### What the AI Can Modify
- Chart type (e.g., bar → line)
- Axis labels, scale, and granularity
- Color scheme and individual series colors
- Font family, size, and weight
- Chart title and subtitle
- Aggregation method (sum, average, count, etc.)
- Adding or removing a data series
- Annotations (see §3.5)

#### AI Context (per request)
The AI receives, in-memory for that request only:
- Current chart configuration (type, axes, colors, filters)
- Data schema: table name, column names, and data types (no raw row data)

Schema metadata is encrypted at rest and decrypted only for the duration of the AI request. Nothing is persisted in plaintext.

---

### 3.5 Annotations

Annotations provide institutional memory — they explain *why* a number looks the way it does.

#### Features
- Annotate a **specific data point** or a **date range**
- Annotations display as markers/overlays directly on the chart
- Each annotation supports:
  - Short title (e.g., "Server outage")
  - Description text
  - One or more external links (Notion page, incident report, Slack message, any URL)
  - Root cause tag: `infra`, `marketing`, `data issue`, `external`, `other`
- Annotations tied to a date or date range **propagate across all charts on the same dashboard** that share the same time axis
- Annotations are visible to all users who have dashboard access

#### Adding Annotations
- Users can add annotations manually by clicking a data point
- Users can also instruct the AI: *"Add an annotation on March 3rd: server outage caused the drop"*

---

### 3.8 Usage Limits (MVP Free Tier)

| Limit | Value |
|---|---|
| Dashboards per org | 3 |
| Charts per dashboard | 7 |
| Editor seats per org | 2 (Admin counts as one) |
| Viewer seats | Unlimited |

**Editor** — can create dashboards, edit any dashboard in the org, and connect data sources  
**Viewer** — can view dashboards and use filters (date range, granularity, dimension); cannot edit charts, annotations, or settings

Limits are enforced at the API layer. When a limit is reached, the relevant action (e.g., "New Dashboard") is disabled in the UI with a tooltip explaining the limit. Upgrading the limit is a post-MVP concern.

#### Version History
- Every save creates a version snapshot automatically
- Each version records: editor name, timestamp, and a diff summary of what changed
- Version history panel accessible from the dashboard header
- Any version can be restored with one click
- Restoring a version creates a new version entry (non-destructive — history is never deleted)

#### Concurrent Editing
- Multiple users can view a dashboard simultaneously
- Edits are **last-write-wins** for MVP — no live co-editing conflict resolution
- If two users are editing simultaneously, a banner warns: *"[Name] is also editing this dashboard"*

---

### 3.7 Sharing & Access Control

#### Roles within an Org

| Role | Capabilities |
|---|---|
| **Admin** | Upload/connect data sources, share datasets org-wide, delete dashboards, manage members |
| **Member** | Create dashboards, edit dashboards they own, view dashboards shared with them |

#### Sharing Tiers

**Tier 1 — Org-wide**
- Any member of the same Google Workspace org can view
- Set by the dashboard owner at time of creation or later

**Tier 2 — By Email**
- Invite specific email addresses (inside or outside the org)
- Invited users receive an email with a direct link
- Access can be revoked individually at any time

**Tier 3 — Public Link**
- Anyone with the link can view — no login required
- Link-shared dashboards are **view-only**: no editing, no data source visibility
- Links are revocable (generating a new link invalidates the previous one)
- Optional password protection on the link
- Viewers see rendered charts only — not the underlying connection details or schema

#### Data Access vs Dashboard Access
These are intentionally decoupled:
- Dashboard access controls who sees the charts
- Data source access (e.g., Google Sheets permissions) is managed by the owner externally
- Viewers see the rendered output — they never interact directly with the raw data source

---

## 4. Security & Data Architecture

### 4.1 Core Principle
Raw user data never persists on Dashmaxxing servers. The platform orchestrates queries and renders results — it does not warehouse data.

### 4.2 Encryption Model
Envelope encryption is used throughout:

```
User data (schema metadata, credentials)
        ↓
Encrypted with a unique Data Encryption Key (DEK) per org
        ↓
DEK encrypted with org's Master Key (KEK) stored in Google Cloud KMS
        ↓
Only encrypted blobs stored on Dashmaxxing servers
        ↓
On authorized request → KMS releases DEK → data decrypted in memory only
```

### 4.3 What Is and Isn't Stored

| Data | Stored on Dashmaxxing Servers? | Encryption |
|---|---|---|
| DB credentials (host, password) | Yes — encrypted at rest | AES-256 + KMS |
| Schema metadata (column names, types) | Yes — encrypted at rest | AES-256 + KMS |
| Chart configurations | Yes | AES-256 + KMS |
| Google Sheets OAuth tokens | Yes — encrypted at rest | AES-256 + KMS |
| Query results | No — in-memory only | TLS 1.3 in transit |
| Raw data rows | Never | — |

### 4.4 AI Data Handling
- Schema metadata is decrypted in-memory per AI request only
- Gemini called via Vertex AI with **zero data retention** enabled — GCP's built-in policy for Vertex AI API calls
- No schema or chart data is logged or retained by the AI provider
- Plaintext schema is never written to disk or logs

### 4.5 Google Sheets Data Flow
```
Dashboard load request (authenticated user)
        ↓
Dashmaxxing fetches Sheet data using owner's OAuth token (via Google Sheets API)
        ↓
Data loaded into DuckDB in-memory for query execution
        ↓
Aggregated query result returned to frontend
        ↓
In-memory data cleared after response
```

### 4.6 Data Retention Policy
- Dashboard configurations and version history: retained until user deletes or account closes
- Google Sheets OAuth tokens: retained until user disconnects the source
- DB credentials: retained until user removes the connection
- On account closure: 30-day grace period, then hard deletion of all org data

---

## 5. Tech Stack

### 5.1 Infrastructure (GCP-First)

| Component | Technology | Rationale |
|---|---|---|
| App hosting | Google Cloud Run | Containerized, scales to zero, low ops overhead |
| Database | Cloud SQL (PostgreSQL) | Stores dashboard configs, users, versions, org metadata |
| Key management | Google Cloud KMS | Manages encryption keys, built-in audit logging |
| Background jobs | Google Cloud Tasks | Async query jobs, refresh scheduling |
| Monitoring | Google Cloud Logging + Monitoring | Native GCP observability |

### 5.2 Application

| Component | Technology | Rationale |
|---|---|---|
| Dashboard framework | Plotly Dash (Python) | Interactive charts, Python-native, flexible |
| Drag-and-drop layout | react-grid-layout (custom Dash component wrapper) | Industry standard for dashboard grid layout — used by Grafana, Retool |
| Query engine | DuckDB | In-process, fast analytical queries on fetched data |
| Auth | Google OAuth 2.0 | Zero-friction for Google Workspace users |
| Session management | Cloud Memorystore (Redis) | Server-side sessions required for multi-user safety — not cookies or in-memory |
| Data source — Sheets | Google Sheets API | Live pull, no storage needed |
| Custom Python transforms | Pyodide (Python WASM) | Client-side execution — zero server risk, pandas + numpy support |
| Encryption | AES-256-GCM | Industry standard symmetric encryption |

### 5.3 AI Layer

| Component | Technology | Rationale |
|---|---|---|
| AI model | Gemini via Vertex AI | Native GCP integration — single billing account, IAM access control, zero data retention via Vertex AI, same network as app |
| AI provider abstraction | Interface layer in code | AI provider abstracted so Gemini can be swapped for another model without rewriting chart editing logic |
| AI scope (MVP) | Chart editing + initial dashboard generation | Analysis features deferred post-MVP |
| Context sent | Chart config + schema (no raw data) | Balance of intelligence vs data sensitivity |

---

## 6. Out of Scope (MVP) — Post-MVP Backlog

| Feature | Notes |
|---|---|
| Natural language filters | "Show me only SEA last 30 days" |
| AI analysis layer | "Why did bookings drop?" |
| Live collaborative editing | Figma-style, needs CRDT or OT |
| Custom Python transforms (server-side) | Cloud Run Jobs + gVisor sandbox — full library access including sklearn, scipy. Higher infra complexity. **Post-MVP V1** |
| Anomaly detection | AI proactively flags unusual numbers |
| Audience / present mode | Slideshow view for stakeholders |
| Snapshot comparison | Week-over-week dashboard diffs |
| CSV upload | Google Sheets covers this for MVP |
| BigQuery connector | Near-term post-MVP given GCP focus |
| Self-hosted LLM option | For enterprise users who want zero data egress |
| SSO / SAML | Enterprise auth, post-MVP |
| RBAC granularity (per-dashboard roles) | Admin/Member sufficient for MVP |
| Custom org domain | e.g. analytics.acme.com pointing to Dashmaxxing — enterprise feature |

---

## 8. Folder Structure

```
dashmaxxing/
│
├── app/                                # Main Dash web server (Cloud Run)
│   ├── pages/                          # One file per route (Dash multi-page)
│   │   ├── login.py                    # Google OAuth entry point
│   │   ├── onboarding.py               # New org setup + Q&A flow
│   │   ├── dashboard.py                # Main dashboard view/edit
│   │   ├── settings.py                 # Org settings, members, data sources
│   │   └── version_history.py          # Version browser + restore
│   │
│   ├── components/                     # Reusable Dash UI components
│   │   ├── chart/
│   │   │   ├── chart_card.py           # Chart wrapper (skeleton → populated)
│   │   │   ├── chart_toolbar.py        # Edit with AI, annotate, config buttons
│   │   │   └── code_editor.py          # JSON + Pyodide Python editor panel
│   │   ├── controls/
│   │   │   ├── date_range.py           # Global date range picker
│   │   │   ├── granularity.py          # Daily/weekly/monthly toggle
│   │   │   └── dimension_filter.py     # Categorical dimension dropdown
│   │   ├── ai_panel.py                 # "Edit with AI" slide-in panel
│   │   ├── annotation_panel.py         # Annotation form + list
│   │   ├── share_modal.py              # Sharing tier controls
│   │   └── navbar.py                   # Top nav with version/save controls
│   │
│   ├── callbacks/                      # Dash callback logic
│   │   ├── auth.py                     # Login, session, invite flow
│   │   ├── chart_render.py             # Per-chart async data fetch + render
│   │   ├── ai_edit.py                  # Edit with AI request/response
│   │   ├── layout_drag.py              # Drag-and-drop position updates
│   │   ├── annotations.py              # Add/edit/delete annotations
│   │   ├── version_control.py          # Save snapshot, restore version
│   │   └── sharing.py                  # Sharing tier + link generation
│   │
│   └── app.py                          # Dash app init, server, routing
│
├── worker/                             # Background job service (Cloud Run)
│   ├── tasks/
│   │   ├── db_query.py                 # Slow DB queries (Postgres/MySQL)
│   │   └── sheets_fetch.py             # Large Google Sheets fetches
│   └── main.py                         # Cloud Tasks HTTP handler
│
├── core/                               # Shared business logic (app + worker)
│   ├── ai/
│   │   ├── provider.py                 # Abstract AI provider interface
│   │   ├── gemini.py                   # Gemini via Vertex AI implementation
│   │   ├── chart_editor.py             # Prompt builder + config diff logic
│   │   ├── dashboard_generator.py      # Onboarding Q&A → dashboard JSON
│   │   └── prompts/
│   │       ├── chart_edit.txt          # System prompt for chart editing
│   │       └── dashboard_gen.txt       # System prompt for dashboard generation
│   │
│   ├── data/
│   │   ├── connectors/
│   │   │   ├── base.py                 # Abstract connector interface
│   │   │   ├── sheets.py               # Google Sheets API connector
│   │   │   ├── postgres.py             # PostgreSQL connector
│   │   │   └── mysql.py                # MySQL connector
│   │   ├── duckdb_engine.py            # In-memory query execution
│   │   └── transforms.py               # Built-in transforms (rolling avg, YoY, etc.)
│   │
│   ├── security/
│   │   ├── encryption.py               # AES-256-GCM encrypt/decrypt helpers
│   │   ├── kms.py                      # Google Cloud KMS key management
│   │   └── session.py                  # Redis session helpers
│   │
│   ├── models/                         # SQLAlchemy ORM models
│   │   ├── org.py
│   │   ├── user.py
│   │   ├── invitation.py
│   │   ├── data_source.py
│   │   ├── dashboard.py
│   │   ├── chart.py
│   │   ├── annotation.py
│   │   ├── dashboard_version.py
│   │   └── dashboard_access.py
│   │
│   ├── schemas/                        # Pydantic validation schemas
│   │   ├── chart_config.py             # ChartConfig, DataLayer, StyleLayer, etc.
│   │   ├── dashboard.py
│   │   └── transform.py
│   │
│   └── db.py                           # SQLAlchemy engine + session factory
│
├── custom_components/                  # Custom React → Dash components
│   └── grid_layout/
│       ├── GridLayout.jsx              # react-grid-layout wrapper
│       ├── grid_layout.py              # Python Dash component class
│       └── package.json
│
├── assets/                             # Static files served by Dash
│   ├── styles.css
│   └── pyodide_runner.js               # Client-side Pyodide bootstrap + execution
│
├── migrations/                         # Alembic DB migrations
│   ├── env.py
│   └── versions/
│
├── tests/
│   ├── unit/
│   │   ├── test_chart_config.py
│   │   ├── test_transforms.py
│   │   ├── test_encryption.py
│   │   └── test_ai_prompts.py
│   ├── integration/
│   │   ├── test_sheets_connector.py
│   │   └── test_db_connectors.py
│   └── conftest.py
│
├── infra/                              # GCP infrastructure as code (Terraform)
│   ├── main.tf
│   ├── cloud_run.tf
│   ├── cloud_sql.tf
│   ├── kms.tf
│   └── networking.tf                   # Cloud NAT static IP
│
├── Dockerfile.app
├── Dockerfile.worker
├── docker-compose.yml                  # Local dev (app + worker + postgres + redis)
├── pyproject.toml                      # Dependencies + tooling config
└── .env.example                        # Env var template (never commit .env)
```

---

## 9. Resolved Decisions

| # | Question | Decision |
|---|---|---|
| 1 | AI provider | Gemini via Vertex AI — native GCP, single billing, zero data retention built-in |
| 2 | Google Sheets refresh strategy | Fetch on load; maintainer sets notification interval; viewer-triggered refresh only |
| 3 | DB connection model | Dashmaxxing backend connects directly — static egress IP via Cloud NAT; no user-side agent |
| 4 | Pricing model | Not applicable for MVP (personal portfolio project). Free tier limits: 3 dashboards, 7 charts each, 2 editors, unlimited viewers |
| 5 | Initial dashboard generation | Truly AI-generated from schema + onboarding Q&A. Dimension-first philosophy: fewer richer charts with breakdown by dimension built in |
| 6 | URL structure | Path-based routing: `dashmaxxing.com/{org-slug}/{dashboard-slug}-{nanoid}`. No subdomains for MVP |
| 7 | Dashboard ID format | Slug derived from title + 8-character NanoID suffix. Human-readable and non-guessable |
| 8 | Chart config format | Single JSON object per chart. Two-layer architecture: `data` (triggers re-fetch) and `layout`/`style` (client-side only) |
| 9 | Dashboard layout | Drag-and-drop via react-grid-layout wrapper. 12-column grid, resizable charts. Mandatory for MVP |
| 10 | Custom Python execution | Client-side via Pyodide (WASM) — pandas + numpy only, runs in browser, zero server risk. Server-side execution (full library support) deferred post-MVP |
