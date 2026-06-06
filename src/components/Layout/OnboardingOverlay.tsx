/**
 * components/Layout/OnboardingOverlay.tsx
 *
 * First-launch onboarding tour with spotlight highlight.
 * Uses an SVG mask to cut a hole over the relevant UI area.
 *
 * Layout constants (must match App.tsx / index.css):
 *   Topbar  : 40px  (h-10)
 *   Sidebar : 56px  (w-14)
 *   padding : 12px  (p-3)
 *   gap     : 12px
 *   Col 1   : 280px (tasks)
 *   Col 2   : 1fr   (schedule) — calculated at runtime
 *   Col 3   : 320px (chat)
 */
import { useState, useEffect, useCallback } from "react";
import {
  ChevronRight,
  X,
  LayoutDashboard,
  ListChecks,
  Truck,
  MessageSquare,
  Settings,
} from "lucide-react";

interface OnboardingOverlayProps {
  onDone: () => void;
}

// ── Layout constants ──────────────────────────────────────────────────────────
const TOPBAR = 40;
const SIDEBAR = 56;
const PAD = 12;
const GAP = 12;
const COL1 = 280;
const COL3 = 320;
const RADIUS = 14; // border-radius of panels

// ── Highlight regions (fn of window size) ────────────────────────────────────
type Rect = { x: number; y: number; w: number; h: number };

function getHighlight(stepId: string, W: number, H: number): Rect | null {
  const contentTop = TOPBAR + PAD;
  const contentLeft = SIDEBAR + PAD;
  const contentH = H - TOPBAR - PAD * 2;

  // available width for the 3 columns
  const totalCols = W - SIDEBAR - PAD * 2 - GAP * 2;
  const col2W = totalCols - COL1 - COL3;

  const col1X = contentLeft;
  const col2X = col1X + COL1 + GAP;
  const col3X = col2X + col2W + GAP;

  switch (stepId) {
    case "welcome":
      // whole content area
      return {
        x: contentLeft,
        y: contentTop,
        w: W - contentLeft - PAD,
        h: contentH,
      };
    case "tasks":
      return { x: col1X, y: contentTop, w: COL1, h: contentH };
    case "schedule":
      return { x: col2X, y: contentTop, w: col2W, h: contentH };
    case "chat":
      return { x: col3X, y: contentTop, w: COL3, h: contentH };
    case "settings":
      // sidebar bottom area — settings + help buttons
      return { x: 4, y: H - 96, w: SIDEBAR - 8, h: 88 };
    default:
      return null;
  }
}

// ── Card placement relative to highlight ─────────────────────────────────────
function cardStyle(stepId: string, W: number, H: number): React.CSSProperties {
  const contentTop = TOPBAR + PAD;
  const contentLeft = SIDEBAR + PAD;
  const totalCols = W - SIDEBAR - PAD * 2 - GAP * 2;
  const col2W = totalCols - COL1 - COL3;
  const col2X = contentLeft + COL1 + GAP;
  const col3X = col2X + col2W + GAP;

  const CARD_W = 300;

  switch (stepId) {
    case "welcome":
      return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
    case "tasks":
      // card to the right of col1
      return {
        top: "50%",
        left: contentLeft + COL1 + GAP + 16,
        transform: "translateY(-50%)",
      };
    case "schedule":
      // card centered above col2
      return {
        top: "50%",
        left: col2X + col2W / 2 - CARD_W / 2,
        transform: "translateY(-50%)",
      };
    case "chat":
      // card to the left of col3
      return {
        top: "50%",
        left: col3X - CARD_W - 16,
        transform: "translateY(-50%)",
      };
    case "settings":
      // card to the right of sidebar, near bottom
      return { bottom: 24, left: SIDEBAR + 12 };
    default:
      return { top: "50%", left: "50%", transform: "translate(-50%,-50%)" };
  }
}

// ── Steps ─────────────────────────────────────────────────────────────────────
const STEPS = [
  {
    id: "welcome",
    icon: LayoutDashboard,
    title: "Welcome to Orbit 👋",
    desc: "Orbit is your local-first hub for managing branch schedules and delivery tasks. Everything runs on your machine — no cloud, no accounts.",
  },
  {
    id: "tasks",
    icon: ListChecks,
    title: "Tasks",
    desc: "Track all pending and completed deliveries. Add tasks, set priority levels, and mark them done as you go.",
  },
  {
    id: "schedule",
    icon: Truck,
    title: "Branch Schedules",
    desc: "View and manage your branch delivery schedule. Import from a CSV file or update entries directly.",
  },
  {
    id: "chat",
    icon: MessageSquare,
    title: "Orbit AI",
    desc: "Ask questions about your tasks and schedules in plain English. Powered by Groq — set your API key in Settings to get started.",
  },
  {
    id: "settings",
    icon: Settings,
    title: "Settings & Help",
    desc: "Add your Groq API key, toggle RAG, export data as CSV, or reset the database. The ? button opens this help guide anytime.",
  },
];

// ── Rounded rect SVG path helper ─────────────────────────────────────────────
function roundedRectPath(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  return [
    `M ${x + r} ${y}`,
    `H ${x + w - r}`,
    `Q ${x + w} ${y} ${x + w} ${y + r}`,
    `V ${y + h - r}`,
    `Q ${x + w} ${y + h} ${x + w - r} ${y + h}`,
    `H ${x + r}`,
    `Q ${x} ${y + h} ${x} ${y + h - r}`,
    `V ${y + r}`,
    `Q ${x} ${y} ${x + r} ${y}`,
    `Z`,
  ].join(" ");
}

// ── Component ─────────────────────────────────────────────────────────────────
export function OnboardingOverlay({ onDone }: OnboardingOverlayProps) {
  const [step, setStep] = useState(0);
  const [exiting, setExiting] = useState(false);
  const [size, setSize] = useState({
    w: window.innerWidth,
    h: window.innerHeight,
  });

  // Track window size
  useEffect(() => {
    const onResize = () =>
      setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const Icon = current.icon;

  const finish = useCallback(() => {
    setExiting(true);
    localStorage.setItem("orbit_onboarding_done", "true");
    setTimeout(onDone, 300);
  }, [onDone]);

  const next = useCallback(() => {
    if (isLast) finish();
    else setStep((s) => s + 1);
  }, [isLast, finish]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight" || e.key === "Enter") next();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [next, finish]);

  const { w, h } = size;
  const highlight = getHighlight(current.id, w, h);

  // SVG mask: full rect minus the spotlight hole
  const fullRect = `M 0 0 H ${w} V ${h} H 0 Z`;
  const holeRect = highlight
    ? roundedRectPath(
        highlight.x,
        highlight.y,
        highlight.w,
        highlight.h,
        RADIUS,
      )
    : "";

  return (
    <div
      className={`fixed inset-0 z-[60] transition-opacity duration-300 ${exiting ? "opacity-0" : "opacity-100"}`}
      style={{ pointerEvents: "all" }}
    >
      {/* SVG spotlight mask */}
      <svg
        className="absolute inset-0 w-full h-full"
        style={{ pointerEvents: "none" }}
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
      >
        <path
          fillRule="evenodd"
          fill="rgba(0,0,0,0.72)"
          d={holeRect ? `${fullRect} ${holeRect}` : fullRect}
          style={{ transition: "d 0.35s cubic-bezier(0.4,0,0.2,1)" }}
        />
        {/* Accent ring around the spotlight */}
        {highlight && (
          <rect
            x={highlight.x - 1}
            y={highlight.y - 1}
            width={highlight.w + 2}
            height={highlight.h + 2}
            rx={RADIUS + 1}
            fill="none"
            stroke="rgba(245,158,11,0.5)"
            strokeWidth="1.5"
          />
        )}
      </svg>

      {/* Floating card */}
      <div
        key={step}
        className="absolute w-[300px] bg-orbit-surface border border-orbit-border rounded-xl shadow-2xl
                   p-5 flex flex-col gap-4 animate-fade-in"
        style={cardStyle(current.id, w, h)}
      >
        {/* Progress dots + close */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-all duration-300
                  ${i === step ? "w-5 bg-orbit-accent" : "w-1.5 bg-orbit-border"}`}
              />
            ))}
          </div>
          <button
            onClick={finish}
            className="w-6 h-6 rounded-md flex items-center justify-center
                       text-orbit-muted hover:text-orbit-text hover:bg-orbit-border transition-all"
          >
            <X size={12} />
          </button>
        </div>

        {/* Icon + text */}
        <div className="flex gap-3 items-start">
          <div className="w-9 h-9 rounded-lg bg-orbit-accent/15 flex items-center justify-center flex-shrink-0">
            <Icon size={16} className="text-orbit-accent" />
          </div>
          <div>
            <p className="text-sm font-semibold text-orbit-text mb-1">
              {current.title}
            </p>
            <p className="text-[11px] text-orbit-muted leading-relaxed">
              {current.desc}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-[10px] text-orbit-muted">
            {step + 1} / {STEPS.length}
          </span>
          <button
            onClick={next}
            className="flex items-center gap-1.5 h-8 px-4 rounded-lg text-xs
                       bg-orbit-accent text-orbit-bg font-medium hover:bg-orbit-accent/90 transition-all"
          >
            {isLast ? "Get started" : "Next"}
            {!isLast && <ChevronRight size={12} />}
          </button>
        </div>
      </div>
    </div>
  );
}

export function shouldShowOnboarding(): boolean {
  return localStorage.getItem("orbit_onboarding_done") !== "true";
}

export function resetOnboarding(): void {
  localStorage.removeItem("orbit_onboarding_done");
}
