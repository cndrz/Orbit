// src-tauri/src/lib.rs

use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // SQL migrations are also handled in TypeScript (runMigrations),
    // but you can add Rust-side migrations here for extra safety.
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_base_tables",
            sql: "
                PRAGMA journal_mode=WAL;
                PRAGMA foreign_keys=ON;

                CREATE TABLE IF NOT EXISTS branches (
                    id              INTEGER PRIMARY KEY AUTOINCREMENT,
                    branch_name     TEXT    NOT NULL UNIQUE,
                    location_region TEXT    NOT NULL
                );

                CREATE TABLE IF NOT EXISTS branch_schedules (
                    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
                    branch_id           INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
                    delivery_timestamp  TEXT    NOT NULL,
                    cargo_details       TEXT    NOT NULL,
                    status              TEXT    NOT NULL DEFAULT 'pending'
                        CHECK(status IN ('pending','in_transit','delivered','cancelled'))
                );

                CREATE TABLE IF NOT EXISTS todo_tasks (
                    id             INTEGER PRIMARY KEY AUTOINCREMENT,
                    task_content   TEXT    NOT NULL,
                    is_completed   INTEGER NOT NULL DEFAULT 0 CHECK(is_completed IN (0,1)),
                    priority_level TEXT    NOT NULL DEFAULT 'medium'
                        CHECK(priority_level IN ('low','medium','high'))
                );
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
