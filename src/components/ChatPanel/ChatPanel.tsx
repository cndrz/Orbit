/**
 * components/ChatPanel/ChatPanel.tsx
 *
 * Column 3: Floating AI assistant powered by Groq + local RAG.
 * RAG toggle is now sourced from RagContext (shared with SettingsModal).
 */

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  Bot,
  User,
  Trash2,
  Loader2,
  Cpu,
  AlertCircle,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import { useGroqChat } from "../../hooks/useGroqChat";
import { useLocalRAG } from "../../hooks/useLocalRAG";
import { useSchedules } from "../../hooks/useSqlite";
import { useRagContext } from "../../context/RagContext";
import type { ChatMessage } from "../../types";

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  return (
    <div
      className={`flex gap-2.5 animate-slide-up ${isUser ? "flex-row-reverse" : "flex-row"}`}
    >
      <div
        className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5
          ${isUser ? "bg-orbit-accent/20 text-orbit-accent" : "bg-orbit-info/20 text-orbit-info"}`}
      >
        {isUser ? <User size={11} /> : <Bot size={11} />}
      </div>
      <div
        className={`max-w-[82%] rounded-xl px-3 py-2 text-xs leading-relaxed
          ${
            isUser
              ? "bg-orbit-accent/15 text-orbit-text border border-orbit-accent/20 rounded-tr-none"
              : "bg-orbit-panel text-orbit-text border border-orbit-border rounded-tl-none"
          }`}
      >
        {msg.streaming && msg.content === "" ? (
          <span className="flex items-center gap-1.5 text-orbit-subtext">
            <Loader2 size={10} className="animate-spin" /> Thinking…
          </span>
        ) : (
          <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>
        )}
        {msg.streaming && msg.content !== "" && (
          <span className="inline-block w-0.5 h-3 bg-orbit-accent ml-0.5 animate-pulse-soft" />
        )}
      </div>
    </div>
  );
}

// ─── RAG indicator ────────────────────────────────────────────────────────────

function RagBadge({
  documentCount,
  modelLoading,
  modelProgress,
  modelError,
}: {
  documentCount: number;
  modelLoading: boolean;
  modelProgress: number;
  modelError: string | null;
}) {
  if (modelError)
    return (
      <span className="flex items-center gap-1 text-[10px] text-orbit-danger">
        <AlertCircle size={9} />
        RAG error
      </span>
    );
  if (modelLoading)
    return (
      <span className="flex items-center gap-1 text-[10px] text-orbit-subtext">
        <Loader2 size={9} className="animate-spin" />
        Loading model {modelProgress}%
      </span>
    );
  return (
    <span className="flex items-center gap-1 text-[10px] text-orbit-success">
      <Cpu size={9} />
      {documentCount} docs indexed
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ChatPanel() {
  const { messages, isStreaming, error, sendMessage, clearMessages } =
    useGroqChat();
  const rag = useLocalRAG();
  const { schedules } = useSchedules();
  const { ragEnabled, setRagEnabled } = useRagContext(); // ← shared context

  const [input, setInput] = useState("");
  const [ragIndexed, setRagIndexed] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!ragIndexed && schedules.length > 0 && !rag.modelLoading) {
      const docs = schedules.map((s) => ({
        id: `schedule-${s.id}`,
        text:
          `Branch: ${s.branch_name} (${s.location_region}). ` +
          `Delivery: ${new Date(s.delivery_timestamp).toLocaleString()}. ` +
          `Cargo: ${s.cargo_details}. Status: ${s.status}.`,
        metadata: { type: "schedule", id: s.id },
      }));
      rag.addDocuments(docs).then(() => setRagIndexed(true));
    }
  }, [schedules, ragIndexed, rag]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");

    let context: string | undefined;
    if (ragEnabled && rag.documentCount > 0) {
      try {
        context = await rag.buildContext(text, 4);
      } catch {
        /* continue without */
      }
    }
    await sendMessage(text, context);
  }, [input, isStreaming, ragEnabled, rag, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }
  };

  const SUGGESTIONS = [
    "Summarize pending deliveries",
    "Which branches are in transit?",
    "List high priority tasks",
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-orbit-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-orbit-info/20 flex items-center justify-center">
            <Sparkles size={12} className="text-orbit-info" />
          </div>
          <div>
            <h2 className="font-display font-bold text-sm tracking-wide text-orbit-text">
              Orbit AI
            </h2>
            <RagBadge
              documentCount={rag.documentCount}
              modelLoading={rag.modelLoading}
              modelProgress={rag.modelProgress}
              modelError={rag.modelError}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* RAG toggle — now synced via context */}
          <button
            onClick={() => setRagEnabled(!ragEnabled)}
            title={
              ragEnabled
                ? "RAG on — click to disable"
                : "RAG off — click to enable"
            }
            className={`orbit-tag border transition-all text-[10px] cursor-pointer
              ${
                ragEnabled
                  ? "bg-orbit-info/10 text-orbit-info border-orbit-info/20"
                  : "bg-orbit-border text-orbit-subtext border-orbit-border"
              }`}
          >
            <Cpu size={9} />
            RAG {ragEnabled ? "ON" : "OFF"}
          </button>

          {messages.length > 0 && (
            <button
              onClick={clearMessages}
              className="orbit-btn-ghost p-1.5"
              title="Clear conversation"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-4 text-center px-4">
            <div className="w-12 h-12 rounded-2xl bg-orbit-info/10 flex items-center justify-center">
              <Bot size={22} className="text-orbit-info" />
            </div>
            <div>
              <p className="text-orbit-text text-sm font-medium mb-1">
                Ask Orbit anything
              </p>
              <p className="text-orbit-subtext text-xs leading-relaxed">
                I can answer questions about your branch schedules and tasks
                using local AI — no data leaves your machine.
              </p>
            </div>
            <div className="flex flex-col gap-1.5 w-full">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="text-left text-xs px-3 py-2 rounded-lg border border-orbit-border
                             text-orbit-subtext hover:text-orbit-text hover:border-orbit-muted
                             hover:bg-orbit-border/30 transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)
        )}

        {error && (
          <div
            className="flex items-start gap-2 text-orbit-danger text-xs bg-orbit-danger/10
                          border border-orbit-danger/20 rounded-lg p-3"
          >
            <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="relative">
        {messages.length > 3 && (
          <button
            onClick={() =>
              bottomRef.current?.scrollIntoView({ behavior: "smooth" })
            }
            className="absolute bottom-1 right-3 orbit-btn-ghost p-1 text-orbit-subtext opacity-0 hover:opacity-100 transition-opacity"
          >
            <ChevronDown size={13} />
          </button>
        )}
      </div>

      {/* Input */}
      <div className="px-3 pb-3 pt-2 border-t border-orbit-border flex-shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask about schedules, tasks… (Enter to send)"
            rows={1}
            className="orbit-input flex-1 text-xs resize-none overflow-hidden leading-relaxed"
            style={{ minHeight: "36px" }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className="orbit-btn-primary p-2 flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isStreaming ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Send size={14} />
            )}
          </button>
        </div>
        <p className="text-[10px] text-orbit-muted mt-1.5 text-center">
          Powered by Groq · Embeddings run locally via Transformers.js
        </p>
      </div>
    </div>
  );
}
