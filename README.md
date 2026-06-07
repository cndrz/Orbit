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

## Setup

```bash
# Clone the repo and install JS dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

## Getting Started

1. Launch Orbit.
2. Click the gear icon (sidebar bottom) to open Settings.
3. Enter your [Groq API key](https://console.groq.com) (free tier works).
4. Start managing tasks and chatting with the agent.

## Agent Tools

The Orbit Agent can perform actions via tool calls:

| Tool | Description |
|------|-------------|
| `add_task` | Create a new task (with category, priority, due date, tags) |
| `create_category` | Create a new task category with a color |
| `toggle_task` | Mark a task done or undone |
| `delete_task` | Delete a task |
| `delete_category` | Delete a category (tasks become uncategorized) |
| `get_tasks` | Get the full current task list |
| `get_categories` | Get all categories with colors |

The agent always sees your current tasks in context. Optionally include imported data using the checkbox under the chat input.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1` | Dashboard view |
| `2` | Tasks view |
| `3` | Data Viewer view |
| `4` | Agent view |
| `?` | Open help modal |
| `Esc` | Close modal / Open Settings |

## Project Structure

```
orbit/
├── src/                 # Frontend (HTML/CSS/JS)
│   ├── index.html       # Main layout and modals
│   ├── style.css        # All styling
│   └── app.js           # All logic (tasks, data, agent, navigation)
├── src-tauri/           # Tauri backend (Rust)
│   ├── src/             # Rust source
│   ├── tauri.conf.json  # Tauri configuration
│   └── Cargo.toml       # Rust dependencies
└── package.json         # JS dependencies
```

## License

MIT
