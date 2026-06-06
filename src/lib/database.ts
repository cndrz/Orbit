/**
 * lib/database.ts
 *
 * Wraps @tauri-apps/plugin-sql to provide a typed, Promise-based
 * interface for all Orbit database operations.
 *
 * Schema is managed entirely by the Rust-side plugin migrations in lib.rs.
 */

import Database from "@tauri-apps/plugin-sql";
import type {
  Branch,
  BranchSchedule,
  TodoTask,
  PriorityLevel,
  DeliveryStatus,
  ScheduleCsvRow,
} from "../types";

// ─── Singleton connection ─────────────────────────────────────────────────────

let _db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (_db) return _db;
  _db = await Database.load("sqlite:orbit.db");
  return _db;
}

// ─── Branch queries ───────────────────────────────────────────────────────────

export async function getBranches(): Promise<Branch[]> {
  const db = await getDb();
  return db.select<Branch[]>("SELECT * FROM branches ORDER BY branch_name;");
}

export async function upsertBranch(
  branchName: string,
  locationRegion: string,
): Promise<number> {
  const db = await getDb();
  await db.execute(
    `INSERT OR IGNORE INTO branches (branch_name, location_region) VALUES ($1, $2)`,
    [branchName, locationRegion],
  );
  const [{ id }] = await db.select<[{ id: number }]>(
    "SELECT id FROM branches WHERE branch_name = $1",
    [branchName],
  );
  return id;
}

// ─── Schedule queries ─────────────────────────────────────────────────────────

export async function getSchedules(): Promise<BranchSchedule[]> {
  const db = await getDb();
  return db.select<BranchSchedule[]>(`
    SELECT
      bs.*,
      b.branch_name,
      b.location_region
    FROM branch_schedules bs
    JOIN branches b ON b.id = bs.branch_id
    ORDER BY bs.delivery_timestamp DESC;
  `);
}

export async function updateScheduleStatus(
  id: number,
  status: DeliveryStatus,
): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE branch_schedules SET status = $1 WHERE id = $2", [
    status,
    id,
  ]);
}

export async function ingestScheduleCsv(rows: ScheduleCsvRow[]): Promise<void> {
  const db = await getDb();
  await db.execute("BEGIN;");
  try {
    for (const row of rows) {
      const branchId = await upsertBranch(row.branch_name, row.location_region);
      await db.execute(
        `INSERT INTO branch_schedules
           (branch_id, delivery_timestamp, cargo_details, status)
         VALUES ($1, $2, $3, $4)`,
        [
          branchId,
          row.delivery_timestamp,
          row.cargo_details,
          row.status ?? "pending",
        ],
      );
    }
    await db.execute("COMMIT;");
    console.log(`[DB] Ingested ${rows.length} schedule rows from CSV.`);
  } catch (err) {
    await db.execute("ROLLBACK;");
    console.error("[DB] CSV ingestion failed, rolled back:", err);
    throw err;
  }
}

// ─── Todo queries ─────────────────────────────────────────────────────────────

export async function getTasks(): Promise<TodoTask[]> {
  const db = await getDb();
  return db.select<TodoTask[]>(
    "SELECT * FROM todo_tasks ORDER BY is_completed ASC, priority_level DESC, id ASC;",
  );
}

export async function addTask(
  content: string,
  priority: PriorityLevel = "medium",
): Promise<TodoTask> {
  const db = await getDb();
  await db.execute(
    "INSERT INTO todo_tasks (task_content, priority_level) VALUES ($1, $2)",
    [content, priority],
  );
  const [task] = await db.select<[TodoTask]>(
    "SELECT * FROM todo_tasks WHERE rowid = last_insert_rowid();",
  );
  return task;
}

export async function toggleTask(
  id: number,
  completed: boolean,
): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE todo_tasks SET is_completed = $1 WHERE id = $2", [
    completed ? 1 : 0,
    id,
  ]);
}

export async function deleteTask(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM todo_tasks WHERE id = $1", [id]);
}

export async function updateTaskPriority(
  id: number,
  priority: PriorityLevel,
): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE todo_tasks SET priority_level = $1 WHERE id = $2", [
    priority,
    id,
  ]);
}
