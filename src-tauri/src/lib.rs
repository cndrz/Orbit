use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_orbit_tables",
            sql: "
                PRAGMA journal_mode=WAL;
                PRAGMA foreign_keys=ON;

                -- App settings (key-value store)
                CREATE TABLE IF NOT EXISTS settings (
                    key   TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                );

                -- Task categories
                CREATE TABLE IF NOT EXISTS categories (
                    id         INTEGER PRIMARY KEY AUTOINCREMENT,
                    name       TEXT    NOT NULL,
                    color      TEXT    NOT NULL DEFAULT '#F59E0B',
                    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
                );

                -- Tasks
                CREATE TABLE IF NOT EXISTS tasks (
                    id          INTEGER PRIMARY KEY AUTOINCREMENT,
                    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
                    content     TEXT    NOT NULL,
                    is_done     INTEGER NOT NULL DEFAULT 0,
                    priority    TEXT    NOT NULL DEFAULT 'medium'
                                  CHECK(priority IN ('low','medium','high')),
                    due_date    TEXT,
                    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
                );

                -- Tags
                CREATE TABLE IF NOT EXISTS tags (
                    id   INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL UNIQUE
                );

                -- Task <-> Tag join
                CREATE TABLE IF NOT EXISTS task_tags (
                    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                    tag_id  INTEGER NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
                    PRIMARY KEY (task_id, tag_id)
                );

                -- Imported data files (metadata only)
                CREATE TABLE IF NOT EXISTS imported_files (
                    id          INTEGER PRIMARY KEY AUTOINCREMENT,
                    filename    TEXT    NOT NULL,
                    imported_at TEXT    NOT NULL DEFAULT (datetime('now'))
                );

                -- Imported data rows (generic key-value per cell)
                CREATE TABLE IF NOT EXISTS imported_data (
                    id      INTEGER PRIMARY KEY AUTOINCREMENT,
                    file_id INTEGER NOT NULL REFERENCES imported_files(id) ON DELETE CASCADE,
                    row_idx INTEGER NOT NULL,
                    col_key TEXT    NOT NULL,
                    value   TEXT
                );

                CREATE INDEX IF NOT EXISTS idx_imported_data_file
                    ON imported_data(file_id, row_idx);
            ",
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:orbit.db", migrations)
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
