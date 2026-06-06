/**
 * components/TaskList/TaskList.tsx
 */

import { useState, useRef } from "react";
import {
  CheckCircle2,
  Circle,
  Trash2,
  Plus,
  Loader2,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";
import { useTasks } from "../../hooks/useSqlite";
import type { PriorityLevel, TodoTask } from "../../types";

// ─── Priority badge ───────────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<
  PriorityLevel,
  { label: string; className: string }
> = {
  high: {
    label: "High",
    className: "bg-red-500/15 text-red-400 border border-red-500/20",
  },
  medium: {
    label: "Med",
    className: "bg-amber-500/15 text-amber-400 border border-amber-500/20",
  },
  low: {
    label: "Low",
    className: "bg-slate-500/15 text-slate-400 border border-slate-500/20",
  },
};

function PriorityBadge({
  priority,
  onChange,
}: {
  priority: PriorityLevel;
  onChange: (p: PriorityLevel) => void;
}) {
  const [open, setOpen] = useState(false);
  const cfg = PRIORITY_CONFIG[priority];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`orbit-tag ${cfg.className} cursor-pointer gap-0.5 hover:brightness-125 transition-all`}
      >
        {cfg.label}
        <ChevronDown size={10} />
      </button>
      {open && (
        <div
          className="absolute left-0 top-full mt-1 z-20 orbit-panel py-1 min-w-[88px]"
          onMouseLeave={() => setOpen(false)}
        >
          {(["high", "medium", "low"] as PriorityLevel[]).map((p) => (
            <button
              key={p}
              onClick={() => {
                onChange(p);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-orbit-border transition-colors ${
                p === priority ? "text-orbit-accent" : "text-orbit-text"
              }`}
            >
              {PRIORITY_CONFIG[p].label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Task row ─────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  onToggle,
  onDelete,
  onPriority,
}: {
  task: TodoTask;
  onToggle: (id: number, completed: boolean) => void;
  onDelete: (id: number) => void;
  onPriority: (id: number, p: PriorityLevel) => void;
}) {
  const done = task.is_completed === 1;

  return (
    <div
      className={`group flex items-start gap-3 px-3 py-2.5 rounded-lg transition-all duration-150
        hover:bg-orbit-border/40 ${done ? "opacity-50" : ""}`}
    >
      <button
        onClick={() => onToggle(task.id, !done)}
        className={`mt-0.5 flex-shrink-0 transition-colors ${
          done
            ? "text-orbit-success"
            : "text-orbit-muted hover:text-orbit-accent"
        }`}
      >
        {done ? <CheckCircle2 size={16} /> : <Circle size={16} />}
      </button>

      <div className="flex-1 min-w-0">
        <p
          className={`text-sm leading-snug ${done ? "line-through text-orbit-subtext" : "text-orbit-text"}`}
        >
          {task.task_content}
        </p>
        <div className="mt-1.5">
          <PriorityBadge
            priority={task.priority_level}
            onChange={(p) => onPriority(task.id, p)}
          />
        </div>
      </div>

      <button
        onClick={() => onDelete(task.id)}
        className="opacity-0 group-hover:opacity-100 text-orbit-subtext hover:text-orbit-danger
                   transition-all flex-shrink-0 mt-0.5"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

// ─── Add task form ────────────────────────────────────────────────────────────

function AddTaskForm({
  onAdd,
}: {
  onAdd: (text: string, p: PriorityLevel) => void;
}) {
  const [text, setText] = useState("");
  const [priority, setPriority] = useState<PriorityLevel>("medium");
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onAdd(trimmed, priority);
    setText("");
    inputRef.current?.focus();
  };

  return (
    <div className="p-3 border-t border-orbit-border space-y-2">
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="New task…"
        className="orbit-input w-full text-xs py-1.5"
      />
      <div className="flex gap-2">
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as PriorityLevel)}
          className="orbit-input text-xs py-1.5 flex-1 cursor-pointer"
        >
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <button
          onClick={submit}
          disabled={!text.trim()}
          className="orbit-btn-primary px-4 py-1.5 gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus size={14} />
          Add
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TaskList() {
  const { tasks, loading, error, add, toggle, remove, setPriority } =
    useTasks();

  const pending = tasks.filter((t) => t.is_completed === 0);
  const completed = tasks.filter((t) => t.is_completed === 1);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-orbit-border flex-shrink-0">
        <div>
          <h2 className="font-display font-bold text-sm tracking-wide text-orbit-text">
            Tasks
          </h2>
          <p className="text-orbit-subtext text-xs mt-0.5">
            {pending.length} pending · {completed.length} done
          </p>
        </div>
        <span className="orbit-tag bg-orbit-accent/10 text-orbit-accent border border-orbit-accent/20">
          {tasks.length}
        </span>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center h-full text-orbit-subtext gap-2">
            <Loader2 size={14} className="animate-spin" />
            <span className="text-xs">Loading…</span>
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-orbit-danger text-xs p-3">
            <AlertTriangle size={14} />
            {error}
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center text-orbit-subtext text-xs mt-8">
            No tasks yet. Add one below.
          </div>
        ) : (
          <>
            {pending.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onToggle={toggle}
                onDelete={remove}
                onPriority={setPriority}
              />
            ))}

            {completed.length > 0 && (
              <>
                <div className="px-3 py-2 mt-2">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-orbit-muted">
                    Completed
                  </span>
                </div>
                {completed.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onToggle={toggle}
                    onDelete={remove}
                    onPriority={setPriority}
                  />
                ))}
              </>
            )}
          </>
        )}
      </div>

      {/* Add form */}
      <AddTaskForm onAdd={add} />
    </div>
  );
}
