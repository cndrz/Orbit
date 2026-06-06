/**
 * components/Layout/HelpModal.tsx
 *
 * Tabbed help modal with:
 *   - Getting Started
 *   - Features Overview
 *   - FAQ / Troubleshooting
 */
import { useState, useEffect } from "react";
import { X, BookOpen, Layers, HelpCircle, ChevronRight } from "lucide-react";

interface HelpModalProps {
  onClose: () => void;
  onStartOnboarding?: () => void;
}

const TABS = [
  { id: "start", label: "Getting Started", icon: BookOpen },
  { id: "features", label: "Features Overview", icon: Layers },
  { id: "faq", label: "FAQ / Troubleshooting", icon: HelpCircle },
];

function GettingStarted({
  onStartOnboarding,
  onClose,
}: {
  onStartOnboarding?: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <p className="text-xs text-orbit-subtext leading-relaxed">
        Orbit is a <strong className="text-orbit-text">local-first</strong>{" "}
        desktop app for managing branch schedules and delivery tasks — with a
        built-in AI assistant powered by Groq. All your data stays on your
        machine.
      </p>

      <div className="flex flex-col gap-3">
        {[
          {
            step: "1",
            title: "Set your Groq API key",
            desc: "Open Settings (gear icon) and paste your Groq API key. This enables the AI chat panel.",
          },
          {
            step: "2",
            title: "Import your schedule",
            desc: "In the Schedule view, use Import CSV to load your branch delivery schedule.",
          },
          {
            step: "3",
            title: "Add tasks",
            desc: "Switch to the Tasks view and hit + Add to create and track pending deliveries.",
          },
          {
            step: "4",
            title: "Ask Orbit AI",
            desc: "Open the AI Chat view and ask anything about your schedules or tasks — it answers using your local data.",
          },
        ].map(({ step, title, desc }) => (
          <div key={step} className="flex gap-3">
            <div
              className="w-6 h-6 rounded-full bg-orbit-accent/15 text-orbit-accent flex items-center
                            justify-center text-[11px] font-bold flex-shrink-0 mt-0.5"
            >
              {step}
            </div>
            <div>
              <p className="text-xs font-medium text-orbit-text">{title}</p>
              <p className="text-[11px] text-orbit-muted leading-relaxed mt-0.5">
                {desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      {onStartOnboarding && (
        <button
          onClick={() => {
            onClose();
            onStartOnboarding();
          }}
          className="flex items-center gap-2 self-start h-8 px-4 rounded-lg text-xs
                     bg-orbit-accent text-orbit-bg font-medium hover:bg-orbit-accent/90 transition-all"
        >
          Replay onboarding tour <ChevronRight size={12} />
        </button>
      )}
    </div>
  );
}

function FeaturesOverview() {
  const features = [
    {
      name: "Dashboard",
      desc: "See all three panels at once — Tasks, Schedule, and AI Chat side by side.",
    },
    {
      name: "Tasks",
      desc: "Create, prioritize, and track delivery tasks. Set priority levels and mark them done.",
    },
    {
      name: "Branch Schedules",
      desc: "View and manage branch delivery schedules. Import from CSV or update individual entries.",
    },
    {
      name: "Orbit AI",
      desc: "Ask natural-language questions about your data. Powered by Groq with optional RAG (document indexing) for richer answers.",
    },
    {
      name: "Local-first",
      desc: "Everything is stored in a local SQLite database. No cloud sync, no accounts, no data leaving your machine.",
    },
    {
      name: "CSV Export",
      desc: "Export all your tasks and schedules as a CSV from the Settings panel anytime.",
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      {features.map(({ name, desc }) => (
        <div
          key={name}
          className="p-3 rounded-lg bg-orbit-bg border border-orbit-border"
        >
          <p className="text-xs font-medium text-orbit-accent mb-1">{name}</p>
          <p className="text-[11px] text-orbit-muted leading-relaxed">{desc}</p>
        </div>
      ))}
    </div>
  );
}

function FAQ() {
  const [open, setOpen] = useState<string | null>(null);

  const items = [
    {
      q: "The AI chat isn't responding — what do I do?",
      a: "Make sure you've set a valid Groq API key in Settings. The key should start with gsk_. If it's set correctly, check your internet connection — Groq's API requires outbound access.",
    },
    {
      q: "Tasks say 'Failed to load tasks' on startup.",
      a: "This usually means the local database hasn't been initialized yet. Try restarting the app. If it persists, use Settings → Clear all data to reset the database.",
    },
    {
      q: "How do I import a schedule?",
      a: "In the Schedule view, click the Import CSV button in the top-right. Your CSV should have columns matching the expected format: branch, date, time, status.",
    },
    {
      q: "What does RAG do and should I turn it on?",
      a: "RAG (Retrieval-Augmented Generation) lets Orbit AI index your documents so it can reference them when answering questions. Turn it on if you want richer, data-aware answers. It runs fully locally via embeddings.",
    },
    {
      q: "Can I use Orbit without a Groq API key?",
      a: "Yes — Tasks and Schedule work fully offline with no API key. Only the AI Chat panel requires a Groq key.",
    },
    {
      q: "How do I reset everything and start fresh?",
      a: "Go to Settings → Clear all data / reset database. This wipes all tasks, schedules, and indexed documents. Your API key setting is kept.",
    },
  ];

  return (
    <div className="flex flex-col gap-2">
      {items.map(({ q, a }) => (
        <div
          key={q}
          className="rounded-lg border border-orbit-border overflow-hidden"
        >
          <button
            onClick={() => setOpen(open === q ? null : q)}
            className="w-full flex items-center justify-between px-3 py-2.5 text-left
                       hover:bg-orbit-border/50 transition-colors"
          >
            <span className="text-xs font-medium text-orbit-text pr-4">
              {q}
            </span>
            <ChevronRight
              size={13}
              className={`text-orbit-muted flex-shrink-0 transition-transform duration-200
                ${open === q ? "rotate-90" : ""}`}
            />
          </button>
          {open === q && (
            <div className="px-3 pb-3 pt-1 bg-orbit-bg">
              <p className="text-[11px] text-orbit-muted leading-relaxed">
                {a}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function HelpModal({ onClose, onStartOnboarding }: HelpModalProps) {
  const [activeTab, setActiveTab] = useState("start");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-[500px] max-h-[80vh] bg-orbit-surface border border-orbit-border rounded-xl
                      shadow-2xl flex flex-col overflow-hidden animate-fade-in"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-orbit-border flex-shrink-0">
          <span className="font-display font-semibold text-orbit-text text-sm tracking-wide">
            Help
          </span>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md flex items-center justify-center
                       text-orbit-muted hover:text-orbit-text hover:bg-orbit-border transition-all"
          >
            <X size={14} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-orbit-border flex-shrink-0">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-[11px] font-medium transition-all border-b-2 -mb-px
                ${
                  activeTab === id
                    ? "text-orbit-accent border-orbit-accent"
                    : "text-orbit-muted border-transparent hover:text-orbit-text"
                }`}
            >
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {activeTab === "start" && (
            <GettingStarted
              onStartOnboarding={onStartOnboarding}
              onClose={onClose}
            />
          )}
          {activeTab === "features" && <FeaturesOverview />}
          {activeTab === "faq" && <FAQ />}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-5 py-4 border-t border-orbit-border flex-shrink-0">
          <button
            onClick={onClose}
            className="h-8 px-4 rounded-lg text-xs bg-orbit-accent text-orbit-bg font-medium
                       hover:bg-orbit-accent/90 transition-all"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
