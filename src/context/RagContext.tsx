/**
 * context/RagContext.tsx
 *
 * Single source of truth for the RAG enabled/disabled toggle.
 * Persisted to localStorage. Consumed by ChatPanel and SettingsModal.
 */
import { createContext, useContext, useState, useEffect } from "react";

interface RagContextValue {
  ragEnabled: boolean;
  setRagEnabled: (val: boolean) => void;
}

const RagContext = createContext<RagContextValue>({
  ragEnabled: true,
  setRagEnabled: () => {},
});

export function RagProvider({ children }: { children: React.ReactNode }) {
  const [ragEnabled, setRagEnabledState] = useState<boolean>(() => {
    const stored = localStorage.getItem("orbit_rag_enabled");
    return stored === null ? true : stored === "true";
  });

  function setRagEnabled(val: boolean) {
    setRagEnabledState(val);
    localStorage.setItem("orbit_rag_enabled", String(val));
  }

  return (
    <RagContext.Provider value={{ ragEnabled, setRagEnabled }}>
      {children}
    </RagContext.Provider>
  );
}

export function useRagContext() {
  return useContext(RagContext);
}
