# 🪐 Orbit

> A local-first, AI-powered desktop tracking utility. Manage branch delivery schedules, to-do tasks, and query your data with an AI assistant — all running privately on your machine.

---

## Architecture Overview

```
User Input
    │
    ▼
React UI (Tauri Webview)
    │
    ├─► SQLite (via @tauri-apps/plugin-sql)
    │       Local structured storage — branches, schedules, tasks
    │
    ├─► @xenova/transformers  [LOCAL CPU]
    │       Embeds text → 384-dim vectors (all-MiniLM-L6-v2)
    │       In-memory cosine-similarity search (RAG)
    │
    └─► Groq API  [CLOUD — LLM only]
            Receives: system prompt + RAG context + user message
            Returns: streamed Llama 3 response
```

---

## Prerequisites

| Tool | Min Version | Install |
|------|-------------|---------|
| Node.js | 20+ | https://nodejs.org |
| Rust | 1.77+ | https://rustup.rs |
| Tauri CLI v2 | 2.x | `cargo install tauri-cli --version "^2"` |
| System libs | — | [Tauri prerequisites](https://tauri.app/v2/guides/getting-started/prerequisites) |

---

## Quick Start

### 1. Clone and install dependencies

```bash
git clone <your-repo>
cd orbit

npm install
```

### 2. Configure your Groq API key

```bash
cp .env.local.example .env.local
# Edit .env.local and set VITE_GROQ_API_KEY=gsk_...
```

Get a free key at https://console.groq.com

### 3. Run in development mode

```bash
npm run tauri dev
```

This starts the Vite dev server on `localhost:1420` and launches the Tauri desktop window.
The SQLite database is created automatically at first launch.

### 4. Build for production

```bash
npm run tauri build
```

Produces a native installer in `src-tauri/target/release/bundle/`.

---

## npm Packages — What Each Does

```bash
# Core UI
npm install react react-dom
npm install lucide-react

# Tauri v2 JS API + SQL plugin
npm install @tauri-apps/api@^2
npm install @tauri-apps/plugin-sql@^2

# Local embeddings (runs on CPU, no server needed)
npm install @xenova/transformers

# Cloud LLM (Groq — fast inference)
npm install groq-sdk

# CSV parsing
npm install papaparse
npm install --save-dev @types/papaparse

# Build tooling
npm install --save-dev vite @vitejs/plugin-react typescript
npm install --save-dev tailwindcss postcss autoprefixer
npm install --save-dev @tauri-apps/cli@^2
npm install --save-dev @types/react @types/react-dom
```

---

## Project Structure

```
orbit/
├── src/                        # React + TypeScript frontend
│   ├── components/
│   │   ├── TaskList/
│   │   │   └── TaskList.tsx    # Column 1: todo list with priority
│   │   ├── ScheduleGrid/
│   │   │   └── ScheduleGrid.tsx # Column 2: spreadsheet-style table
│   │   ├── ChatPanel/
│   │   │   └── ChatPanel.tsx   # Column 3: AI chat with RAG
│   │   └── Layout/
│   │       └── Sidebar.tsx     # Left nav sidebar
│   ├── hooks/
│   │   ├── useSqlite.ts        # Reactive hooks over SQLite
│   │   ├── useLocalRAG.ts      # Transformers.js embedding + search
│   │   └── useGroqChat.ts      # Streaming Groq chat + RAG injection
│   ├── lib/
│   │   ├── database.ts         # SQLite schema, queries, seed data
│   │   └── csvIngestion.ts     # PapaParse CSV → SQLite batch insert
│   ├── types/
│   │   └── index.ts            # All shared TypeScript interfaces
│   ├── App.tsx                 # Root layout (3-column dashboard)
│   ├── main.tsx                # React entry point
│   └── index.css               # Tailwind + Orbit design tokens
│
├── src-tauri/                  # Rust / Tauri backend
│   ├── src/
│   │   ├── main.rs             # Entry point
│   │   └── lib.rs              # Tauri builder, SQL plugin, migrations
│   ├── capabilities/
│   │   └── default.json        # Tauri v2 permission grants
│   ├── Cargo.toml
│   ├── build.rs
│   └── tauri.conf.json         # Window config, bundle settings
│
├── index.html                  # HTML entry with Google Fonts
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
├── package.json
└── .env.local.example          # API key template
```

---

## Database Schema

```sql
-- Company branches
CREATE TABLE branches (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    branch_name     TEXT    NOT NULL UNIQUE,
    location_region TEXT    NOT NULL
);

-- Delivery schedules (FK → branches)
CREATE TABLE branch_schedules (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    branch_id           INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    delivery_timestamp  TEXT    NOT NULL,   -- ISO 8601
    cargo_details       TEXT    NOT NULL,
    status              TEXT    NOT NULL DEFAULT 'pending'
        CHECK(status IN ('pending','in_transit','delivered','cancelled'))
);

-- To-do tasks
CREATE TABLE todo_tasks (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    task_content   TEXT    NOT NULL,
    is_completed   INTEGER NOT NULL DEFAULT 0,
    priority_level TEXT    NOT NULL DEFAULT 'medium'
        CHECK(priority_level IN ('low','medium','high'))
);
```

---

## CSV Import Format

To bulk-import delivery schedules, use **Import CSV** in the Schedule panel.

```csv
branch_name,location_region,delivery_timestamp,cargo_details,status
Manila Central,NCR,2025-08-01T09:00:00,Electronics – 50 units,pending
Cebu South,Visayas,2025-08-02T14:00:00,Frozen goods – 3 pallets,in_transit
```

- `branch_name` and `location_region` are upserted automatically
- `delivery_timestamp` must be ISO 8601 parseable
- `status` defaults to `pending` if omitted or invalid

---

## RAG Pipeline (how local AI context works)

1. **On startup**, all schedule rows are converted to natural-language strings and embedded using `Xenova/all-MiniLM-L6-v2` (384-dim sentence embeddings, ~23MB, cached after first download).
2. **When you send a message**, the query is also embedded and cosine-similarity search finds the top-K most relevant schedule rows.
3. **Those rows** are injected as context before your question in the Groq prompt.
4. **Groq Llama 3** answers with full awareness of your local data — without the raw data ever being stored on Groq's servers unnecessarily.

Toggle **RAG ON/OFF** in the chat header to compare grounded vs. base responses.

---

## Extending the App

| Feature | Where to add |
|---------|-------------|
| New SQLite table | `src/lib/database.ts` + `src-tauri/src/lib.rs` migrations |
| New DB query | Add to `database.ts`, expose via `useSqlite.ts` hook |
| Persist RAG embeddings | Add IndexedDB layer to `useLocalRAG.ts` |
| Different LLM model | Change `GROQ_MODEL` in `useGroqChat.ts` |
| New dashboard column | Add component, adjust grid in `App.tsx` |

---

## Design System

Orbit uses a custom Tailwind theme (`tailwind.config.js`):

| Token | Value | Use |
|-------|-------|-----|
| `orbit-bg` | `#0D0F14` | App background |
| `orbit-surface` | `#13161D` | Elevated surface |
| `orbit-panel` | `#191C26` | Card / panel |
| `orbit-border` | `#252836` | Borders |
| `orbit-accent` | `#F59E0B` | Primary accent (amber) |
| `orbit-success` | `#10B981` | Delivered / ok states |
| `orbit-danger` | `#EF4444` | Errors / cancelled |
| `orbit-info` | `#6366F1` | AI / info |

Fonts: **Syne** (display/headings) · **DM Sans** (body) · **JetBrains Mono** (code/badges)
