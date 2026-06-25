"use client";

import * as React from "react";

export interface StudioWorkbenchContextValue {
  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;
}

const StudioWorkbenchContext = React.createContext<StudioWorkbenchContextValue | null>(null);

export function StudioWorkbenchProvider({
  value,
  children,
}: {
  value: StudioWorkbenchContextValue;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <StudioWorkbenchContext.Provider value={value}>
      {children}
    </StudioWorkbenchContext.Provider>
  );
}

export function useStudioWorkbenchSession(): StudioWorkbenchContextValue {
  const ctx = React.useContext(StudioWorkbenchContext);
  if (!ctx) {
    throw new Error("useStudioWorkbenchSession must be used within StudioWorkbenchProvider");
  }
  return ctx;
}

/** Optional hook for components that may render outside the provider during tests. */
export function useStudioWorkbenchSessionOptional(): StudioWorkbenchContextValue | null {
  return React.useContext(StudioWorkbenchContext);
}
