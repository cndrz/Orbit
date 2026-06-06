/**
 * components/Layout/Sidebar.tsx
 *
 * Narrow left sidebar — nav icons act as a view switcher.
 * Settings button opens the SettingsModal via onSettingsOpen.
 */
import {
  LayoutDashboard,
  ListChecks,
  Truck,
  MessageSquare,
  Settings,
  HelpCircle,
} from "lucide-react";

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onSettingsOpen: () => void;
  onHelpOpen: () => void;
}

const NAV_ITEMS = [
  { id: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { id: "tasks", icon: ListChecks, label: "Tasks" },
  { id: "schedule", icon: Truck, label: "Schedule" },
  { id: "chat", icon: MessageSquare, label: "AI Chat" },
];

export function Sidebar({
  activeTab,
  onTabChange,
  onSettingsOpen,
  onHelpOpen,
}: SidebarProps) {
  return (
    <aside
      className="w-14 flex-shrink-0 flex flex-col items-center py-4 gap-2
                       border-r border-orbit-border bg-orbit-surface"
    >
      {/* Logo */}
      <div
        className="w-8 h-8 rounded-xl bg-orbit-accent flex items-center justify-center mb-4
                      shadow-orbit-glow"
      >
        <span className="font-display font-bold text-orbit-bg text-xs">O</span>
      </div>

      {/* Nav */}
      {NAV_ITEMS.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          onClick={() => onTabChange(id)}
          title={label}
          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all
            ${
              activeTab === id
                ? "bg-orbit-accent/15 text-orbit-accent"
                : "text-orbit-muted hover:text-orbit-text hover:bg-orbit-border"
            }`}
        >
          <Icon size={16} />
        </button>
      ))}

      {/* Spacer + Help + Settings */}
      <div className="flex-1" />
      <button
        onClick={onHelpOpen}
        title="Help"
        className="w-9 h-9 rounded-lg flex items-center justify-center
                   text-orbit-muted hover:text-orbit-text hover:bg-orbit-border transition-all"
      >
        <HelpCircle size={16} />
      </button>
      <button
        onClick={onSettingsOpen}
        title="Settings"
        className="w-9 h-9 rounded-lg flex items-center justify-center
                   text-orbit-muted hover:text-orbit-text hover:bg-orbit-border transition-all"
      >
        <Settings size={16} />
      </button>
    </aside>
  );
}
