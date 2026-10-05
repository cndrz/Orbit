# Orbit

A local-first productivity desktop app with task management, data viewer, and an AI agent powered by Groq.

Built with vanilla JS, SQLite (via Tauri), and Groq's LLM API. Everything stays on your machine.

## Features

- **Task Management** — Create, organize, prioritize, tag, and filter tasks. Group them into categories with custom colors. Drag-delete, collapse/expand, mark done/undone.
- **Data Viewer** — Import CSV, XLSX, or XLS files. Search/filter across all columns. Data persists locally in SQLite.
- **AI Agent** — Chat with an agent (llama-3.3-70b) that knows your tasks and can act on them. The agent can add tasks, create categories, mark things done, and more — all through natural language.
- **Local-First** — No servers, no accounts, no sync. Your data stays in a local SQLite database.
- **Dark/Light Theme** — Toggle in Settings.
- **Keyboard Shortcuts** — `1` `2` `3` `4` to switch views, `?` for help.

## Tech Stack

| Layer      | Technology |
|------------|------------|
| Frontend   | Vanilla JS, CSS, HTML (no frameworks, no build step) |
| Backend    | Tauri 2 (Rust) |
| Database   | SQLite via `tauri-plugin-sql` |
| AI         | Groq API (OpenAI-compatible) |
| Parsing    | SheetJS (XLSX) |

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) (stable)
- [Tauri CLI](https://v2.tauri.app/start/cli/): `npm i -g @tauri-apps/cli`

## License

MIT
