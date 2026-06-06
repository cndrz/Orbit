/**
 * App.tsx
 *
 * Root component. Renders the Orbit dashboard with a view switcher:
 *   - dashboard → all 3 columns
 *   - tasks     → TaskList full width
 *   - schedule  → ScheduleGrid full width
 *   - chat      → ChatPanel full width
 *
 * Also manages the SettingsModal state.
 */
import { useState } from "react";
import { Sidebar } from "./components/Layout/Sidebar";
import { TaskList } from "./components/TaskList/TaskList";
import { ScheduleGrid } from "./components/ScheduleGrid/ScheduleGrid";
import { ChatPanel } from "./components/ChatPanel/ChatPanel";
import { SettingsModal } from "./components/Layout/SettingsModal";
import { HelpModal } from "./components/Layout/HelpModal";
import {
  OnboardingOverlay,
  shouldShowOnboarding,
  resetOnboarding,
} from "./components/Layout/OnboardingOverlay";
import { RagProvider } from "./context/RagContext";

// ─── Column wrapper ───────────────────────────────────────────────────────────
function Column({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`orbit-panel flex flex-col overflow-hidden animate-fade-in ${className}`}
    >
      {children}
    </div>
  );
}

// ─── Topbar ───────────────────────────────────────────────────────────────────
function Topbar() {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-PH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return (
    <header
      className="h-10 flex items-center justify-between px-4 flex-shrink-0
                        border-b border-orbit-border bg-orbit-surface/60"
    >
      <span className="font-display font-bold text-orbit-accent tracking-wide text-sm">
        orbit
      </span>
      <div className="flex items-center gap-4">
        <span className="text-orbit-subtext text-xs">{dateStr}</span>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-orbit-success animate-pulse-soft" />
          <span className="text-[10px] text-orbit-subtext font-mono">
            local-first
          </span>
        </div>
      </div>
    </header>
  );
}

// ─── View renderer ────────────────────────────────────────────────────────────
function MainContent({ activeTab }: { activeTab: string }) {
  if (activeTab === "tasks") {
    return (
      <main className="flex-1 p-3 overflow-hidden">
        <Column className="h-full">
          <TaskList />
        </Column>
      </main>
    );
  }

  if (activeTab === "schedule") {
    return (
      <main className="flex-1 p-3 overflow-hidden">
        <Column className="h-full">
          <ScheduleGrid />
        </Column>
      </main>
    );
  }

  if (activeTab === "chat") {
    return (
      <main className="flex-1 p-3 overflow-hidden">
        <Column className="h-full">
          <ChatPanel />
        </Column>
      </main>
    );
  }

  // dashboard — default 3-column layout
  return (
    <main
      className="flex-1 grid gap-3 p-3 overflow-hidden"
      style={{ gridTemplateColumns: "280px 1fr 320px" }}
    >
      <Column>
        <TaskList />
      </Column>
      <Column>
        <ScheduleGrid />
      </Column>
      <Column>
        <ChatPanel />
      </Column>
    </main>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [onboarding, setOnboarding] = useState(() => shouldShowOnboarding());

  function handleReplayOnboarding() {
    resetOnboarding();
    setOnboarding(true);
  }

  return (
    <RagProvider>
      <div className="flex flex-col h-screen overflow-hidden bg-orbit-bg text-orbit-text">
        <Topbar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onSettingsOpen={() => setSettingsOpen(true)}
            onHelpOpen={() => setHelpOpen(true)}
          />
          <MainContent activeTab={activeTab} />
        </div>

        {settingsOpen && (
          <SettingsModal onClose={() => setSettingsOpen(false)} />
        )}

        {helpOpen && (
          <HelpModal
            onClose={() => setHelpOpen(false)}
            onStartOnboarding={handleReplayOnboarding}
          />
        )}

        {onboarding && (
          <OnboardingOverlay onDone={() => setOnboarding(false)} />
        )}
      </div>
    </RagProvider>
  );
}
