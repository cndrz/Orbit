// ─── Database entity types ────────────────────────────────────────────────────

export interface Branch {
  id: number;
  branch_name: string;
  location_region: string;
}

export type DeliveryStatus = "pending" | "in_transit" | "delivered" | "cancelled";

export interface BranchSchedule {
  id: number;
  branch_id: number;
  /** ISO 8601 timestamp string from SQLite */
  delivery_timestamp: string;
  cargo_details: string;
  status: DeliveryStatus;
  /** Joined field — populated by queries that JOIN branches */
  branch_name?: string;
  location_region?: string;
}

export type PriorityLevel = "low" | "medium" | "high";

export interface TodoTask {
  id: number;
  task_content: string;
  is_completed: 0 | 1; // SQLite stores booleans as 0/1
  priority_level: PriorityLevel;
}

// ─── CSV row shape (after PapaParse) ─────────────────────────────────────────

export interface ScheduleCsvRow {
  branch_name: string;
  location_region: string;
  delivery_timestamp: string;
  cargo_details: string;
  status: DeliveryStatus;
}

// ─── RAG / Embedding types ────────────────────────────────────────────────────

export interface EmbeddedDocument {
  id: string;
  text: string;
  embedding: number[];
  metadata?: Record<string, unknown>;
}

export interface RagSearchResult {
  document: EmbeddedDocument;
  score: number;
}

// ─── Chat types ───────────────────────────────────────────────────────────────

export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  /** Unix ms timestamp */
  timestamp: number;
  /** Whether this message is still being streamed */
  streaming?: boolean;
}
