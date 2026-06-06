/**
 * hooks/useLocalRAG.ts
 *
 * Local Retrieval-Augmented Generation pipeline using @xenova/transformers.
 *
 * ALL embedding work runs on the client CPU — no network calls.
 * Only the final enriched prompt is sent to Groq.
 *
 * Pipeline:
 *   1. Load the 'Xenova/all-MiniLM-L6-v2' feature-extraction model (once).
 *   2. embed(text) → Float32Array  (384-dim vector)
 *   3. addDocument(id, text)       → stores embedding in memory
 *   4. search(query, topK)         → returns nearest neighbours by cosine sim
 *   5. buildContext(query, topK)   → formats top results as a prompt prefix
 */

import { useState, useRef, useCallback } from "react";
import type { EmbeddedDocument, RagSearchResult } from "../types";

// ─── Types ────────────────────────────────────────────────────────────────────

type FeatureExtractionPipeline = (
  text: string,
  options?: { pooling?: string; normalize?: boolean }
) => Promise<{ data: Float32Array }>;

export interface UseLocalRAGReturn {
  /** true while the model is downloading / warming up */
  modelLoading: boolean;
  /** Download progress 0–100 */
  modelProgress: number;
  modelError: string | null;
  /** Number of documents in the local vector store */
  documentCount: number;
  /** Embed a single text string */
  embed: (text: string) => Promise<number[]>;
  /** Add a document to the in-memory vector store */
  addDocument: (id: string, text: string, metadata?: Record<string, unknown>) => Promise<void>;
  /** Bulk-load documents (e.g. from DB rows) */
  addDocuments: (
    docs: Array<{ id: string; text: string; metadata?: Record<string, unknown> }>
  ) => Promise<void>;
  /** Clear the vector store */
  clearDocuments: () => void;
  /** Search for nearest neighbours */
  search: (query: string, topK?: number) => Promise<RagSearchResult[]>;
  /** Build a context string suitable for injection into an LLM prompt */
  buildContext: (query: string, topK?: number) => Promise<string>;
}

// ─── Cosine similarity ────────────────────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useLocalRAG(): UseLocalRAGReturn {
  const [modelLoading, setModelLoading] = useState(false);
  const [modelProgress, setModelProgress] = useState(0);
  const [modelError, setModelError] = useState<string | null>(null);
  const [documentCount, setDocumentCount] = useState(0);

  // In-memory vector store (not persisted across sessions — add IndexedDB later)
  const store = useRef<EmbeddedDocument[]>([]);
  // Lazy-loaded pipeline singleton
  const pipelineRef = useRef<FeatureExtractionPipeline | null>(null);

  // ── Load model ──────────────────────────────────────────────────────────────
  const loadModel = useCallback(async (): Promise<FeatureExtractionPipeline> => {
    if (pipelineRef.current) return pipelineRef.current;

    setModelLoading(true);
    setModelError(null);

    try {
      // Dynamic import keeps @xenova/transformers out of the initial bundle.
      // Vite is configured with optimizeDeps.exclude for this package.
      const { pipeline, env } = await import("@xenova/transformers");

      // Allow remote model download; set to false for fully offline use
      // after the first run (model is cached in the browser's Cache API)
      env.allowRemoteModels = true;
      env.useBrowserCache = true;

      const pipe = await pipeline(
        "feature-extraction",
        "Xenova/all-MiniLM-L6-v2",
        {
          progress_callback: (progress: { progress?: number }) => {
            if (progress?.progress != null) {
              setModelProgress(Math.round(progress.progress));
            }
          },
        }
      );

      pipelineRef.current = pipe as unknown as FeatureExtractionPipeline;
      console.log("[RAG] Model loaded: Xenova/all-MiniLM-L6-v2");
      return pipelineRef.current;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Model load failed";
      setModelError(msg);
      console.error("[RAG] Model load error:", err);
      throw err;
    } finally {
      setModelLoading(false);
    }
  }, []);

  // ── Embed ───────────────────────────────────────────────────────────────────
  const embed = useCallback(async (text: string): Promise<number[]> => {
    const pipe = await loadModel();
    const output = await pipe(text, { pooling: "mean", normalize: true });
    const vector = Array.from(output.data);
    console.log(`[RAG] Embedded "${text.slice(0, 40)}…" → dim=${vector.length}`);
    return vector;
  }, [loadModel]);

  // ── Add single document ─────────────────────────────────────────────────────
  const addDocument = useCallback(
    async (
      id: string,
      text: string,
      metadata?: Record<string, unknown>
    ): Promise<void> => {
      const embedding = await embed(text);
      // Replace if same id exists
      store.current = store.current.filter((d) => d.id !== id);
      store.current.push({ id, text, embedding, metadata });
      setDocumentCount(store.current.length);
    },
    [embed]
  );

  // ── Bulk add ────────────────────────────────────────────────────────────────
  const addDocuments = useCallback(
    async (
      docs: Array<{ id: string; text: string; metadata?: Record<string, unknown> }>
    ): Promise<void> => {
      console.log(`[RAG] Embedding ${docs.length} documents…`);
      for (const doc of docs) {
        await addDocument(doc.id, doc.text, doc.metadata);
      }
      console.log(`[RAG] Vector store now has ${store.current.length} documents.`);
    },
    [addDocument]
  );

  // ── Clear ────────────────────────────────────────────────────────────────────
  const clearDocuments = useCallback(() => {
    store.current = [];
    setDocumentCount(0);
  }, []);

  // ── Search ───────────────────────────────────────────────────────────────────
  const search = useCallback(
    async (query: string, topK = 5): Promise<RagSearchResult[]> => {
      if (store.current.length === 0) {
        console.warn("[RAG] Vector store is empty. Add documents first.");
        return [];
      }

      const queryEmbedding = await embed(query);

      const scored: RagSearchResult[] = store.current.map((doc) => ({
        document: doc,
        score: cosineSimilarity(queryEmbedding, doc.embedding),
      }));

      scored.sort((a, b) => b.score - a.score);
      const results = scored.slice(0, topK);

      console.log(
        "[RAG] Top results:",
        results.map((r) => ({ id: r.document.id, score: r.score.toFixed(4) }))
      );

      return results;
    },
    [embed]
  );

  // ── Build LLM context string ─────────────────────────────────────────────────
  const buildContext = useCallback(
    async (query: string, topK = 5): Promise<string> => {
      const results = await search(query, topK);
      if (results.length === 0) return "";

      const lines = results.map(
        (r, i) =>
          `[${i + 1}] (score: ${r.score.toFixed(3)}) ${r.document.text}`
      );

      return [
        "--- Relevant local context ---",
        ...lines,
        "--- End of context ---",
      ].join("\n");
    },
    [search]
  );

  return {
    modelLoading,
    modelProgress,
    modelError,
    documentCount,
    embed,
    addDocument,
    addDocuments,
    clearDocuments,
    search,
    buildContext,
  };
}
