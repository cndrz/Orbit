/**
 * components/Layout/SettingsModal.tsx
 *
 * Settings modal with:
 *   - Groq API key input (persisted to localStorage)
 *   - RAG on/off toggle (persisted to localStorage)
 *   - Export all data as CSV
 *   - Clear / reset database
 */
import { useState, useEffect } from "react";
import { X, Eye, EyeOff, Download, Trash2, Key, Brain } from "lucide-react";
import { useRagContext } from "../../context/RagContext";

interface SettingsModalProps {
  onClose: () => void;
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const [groqKey, setGroqKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const { ragEnabled, setRagEnabled } = useRagContext();
  const [saved, setSaved] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);

  // Load persisted settings on mount (RAG is handled by context)
  useEffect(() => {
    const storedKey = localStorage.getItem("orbit_groq_key") ?? "";
    setGroqKey(storedKey);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  function handleSave() {
    localStorage.setItem("orbit_groq_key", groqKey.trim());
    // RAG is already persisted instantly via context
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleExportCSV() {
    try {
      // Invoke Tauri command to export — adjust command name to match your backend
      const { invoke } = await import("@tauri-apps/api/core");
      const csv: string = await invoke("export_all_csv");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `orbit-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
      alert(
        "Export failed. Make sure the export_all_csv Tauri command is implemented.",
      );
    }
  }

  async function handleClearDatabase() {
    if (!clearConfirm) {
      setClearConfirm(true);
      return;
    }
    setClearing(true);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("reset_database");
      alert(
        "Database cleared. Restart the app for changes to take full effect.",
      );
      setClearConfirm(false);
    } catch (err) {
      console.error("Clear failed:", err);
      alert(
        "Clear failed. Make sure the reset_database Tauri command is implemented.",
      );
    } finally {
      setClearing(false);
    }
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Modal */}
      <div
        className="w-[420px] bg-orbit-surface border border-orbit-border rounded-xl shadow-2xl
                      flex flex-col overflow-hidden animate-fade-in"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-orbit-border">
          <span className="font-display font-semibold text-orbit-text text-sm tracking-wide">
            Settings
          </span>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md flex items-center justify-center
                       text-orbit-muted hover:text-orbit-text hover:bg-orbit-border transition-all"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-6 px-5 py-5">
          {/* ── Groq API Key ── */}
          <section className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-orbit-subtext">
              <Key size={13} />
              <span className="text-xs font-medium uppercase tracking-wider">
                Groq API Key
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type={showKey ? "text" : "password"}
                  value={groqKey}
                  onChange={(e) => setGroqKey(e.target.value)}
                  placeholder="gsk_••••••••••••••••••••••••"
                  className="w-full h-9 px-3 pr-9 rounded-lg bg-orbit-bg border border-orbit-border
                             text-orbit-text text-xs font-mono placeholder:text-orbit-muted
                             focus:outline-none focus:border-orbit-accent transition-colors"
                />
                <button
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-orbit-muted
                             hover:text-orbit-text transition-colors"
                >
                  {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
            </div>
            <p className="text-[11px] text-orbit-muted leading-relaxed">
              Stored locally on your machine. Never sent anywhere except Groq's
              API.
            </p>
          </section>

          {/* ── RAG Toggle ── */}
          <section className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain size={13} className="text-orbit-subtext" />
              <div>
                <p className="text-xs font-medium text-orbit-text">
                  Orbit AI (RAG)
                </p>
                <p className="text-[11px] text-orbit-muted">
                  Index documents for AI context
                </p>
              </div>
            </div>
            <button
              onClick={() => setRagEnabled(!ragEnabled)}
              style={{
                width: 36,
                height: 20,
                borderRadius: 10,
                position: "relative",
                backgroundColor: ragEnabled
                  ? "var(--color-orbit-accent, #f5a623)"
                  : "var(--color-orbit-border, #333)",
                transition: "background-color 0.2s",
                flexShrink: 0,
                border: "none",
                cursor: "pointer",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: 2,
                  left: ragEnabled ? 18 : 2,
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  backgroundColor: "white",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                  transition: "left 0.2s",
                  display: "block",
                }}
              />
            </button>
          </section>

          {/* ── Divider ── */}
          <div className="border-t border-orbit-border" />

          {/* ── Data actions ── */}
          <section className="flex flex-col gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-orbit-subtext">
              Data
            </span>

            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2.5 h-9 px-3 rounded-lg border border-orbit-border
                         text-orbit-text text-xs hover:bg-orbit-border transition-all"
            >
              <Download size={13} className="text-orbit-subtext" />
              Export all data as CSV
            </button>

            <button
              onClick={handleClearDatabase}
              disabled={clearing}
              className={`flex items-center gap-2.5 h-9 px-3 rounded-lg border text-xs transition-all
                ${
                  clearConfirm
                    ? "border-red-500/60 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                    : "border-orbit-border text-orbit-muted hover:text-orbit-text hover:bg-orbit-border"
                }`}
            >
              <Trash2 size={13} />
              {clearing
                ? "Clearing…"
                : clearConfirm
                  ? "Click again to confirm — this cannot be undone"
                  : "Clear all data / reset database"}
            </button>
            {clearConfirm && (
              <button
                onClick={() => setClearConfirm(false)}
                className="text-[11px] text-orbit-muted hover:text-orbit-text text-left px-1"
              >
                Cancel
              </button>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-orbit-border">
          <button
            onClick={onClose}
            className="h-8 px-4 rounded-lg text-xs text-orbit-muted hover:text-orbit-text
                       hover:bg-orbit-border transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="h-8 px-4 rounded-lg text-xs bg-orbit-accent text-orbit-bg font-medium
                       hover:bg-orbit-accent/90 transition-all"
          >
            {saved ? "Saved ✓" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
