/**
 * hooks/useSqlite.ts
 *
 * Reactive hooks that wrap the database library and provide
 * loading/error states + auto-refresh helpers to React components.
 */

import { useState, useEffect, useCallback } from "react";
import {
  getTasks,
  addTask,
  toggleTask,
  deleteTask,
  updateTaskPriority,
  getSchedules,
  getBranches,
  updateScheduleStatus,
} from "../lib/database";
import type {
  TodoTask,
  BranchSchedule,
  Branch,
  PriorityLevel,
  DeliveryStatus,
} from "../types";

// ─── useTasks ─────────────────────────────────────────────────────────────────

export interface UseTasksReturn {
  tasks: TodoTask[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  add: (content: string, priority?: PriorityLevel) => Promise<void>;
  toggle: (id: number, completed: boolean) => Promise<void>;
  remove: (id: number) => Promise<void>;
  setPriority: (id: number, priority: PriorityLevel) => Promise<void>;
}

export function useTasks(): UseTasksReturn {
  const [tasks, setTasks] = useState<TodoTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const data = await getTasks();
      setTasks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = useCallback(
    async (content: string, priority: PriorityLevel = "medium") => {
      await addTask(content, priority);
      await refresh();
    },
    [refresh]
  );

  const toggle = useCallback(
    async (id: number, completed: boolean) => {
      // Optimistic update
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, is_completed: completed ? 1 : 0 } : t))
      );
      try {
        await toggleTask(id, completed);
      } catch {
        await refresh(); // revert on failure
      }
    },
    [refresh]
  );

  const remove = useCallback(
    async (id: number) => {
      setTasks((prev) => prev.filter((t) => t.id !== id));
      await deleteTask(id);
    },
    []
  );

  const setPriority = useCallback(
    async (id: number, priority: PriorityLevel) => {
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, priority_level: priority } : t))
      );
      await updateTaskPriority(id, priority);
    },
    []
  );

  return { tasks, loading, error, refresh, add, toggle, remove, setPriority };
}

// ─── useSchedules ─────────────────────────────────────────────────────────────

export interface UseSchedulesReturn {
  schedules: BranchSchedule[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateStatus: (id: number, status: DeliveryStatus) => Promise<void>;
}

export function useSchedules(): UseSchedulesReturn {
  const [schedules, setSchedules] = useState<BranchSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const data = await getSchedules();
      setSchedules(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load schedules");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updateStatus = useCallback(
    async (id: number, status: DeliveryStatus) => {
      setSchedules((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status } : s))
      );
      await updateScheduleStatus(id, status);
    },
    []
  );

  return { schedules, loading, error, refresh, updateStatus };
}

// ─── useBranches ──────────────────────────────────────────────────────────────

export function useBranches() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBranches()
      .then(setBranches)
      .finally(() => setLoading(false));
  }, []);

  return { branches, loading };
}
