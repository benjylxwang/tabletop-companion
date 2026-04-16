import React, { createContext, useContext, useState } from 'react';
import type { ViewMode } from '@tabletop/shared';

interface ViewModeContextValue {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  isPlayerView: boolean;
}

const ViewModeContext = createContext<ViewModeContextValue | null>(null);

const STORAGE_KEY = 'tabletop-view-mode';

function loadStoredMode(): ViewMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'player' || stored === 'dm') return stored;
  } catch {
    // localStorage unavailable
  }
  return 'dm';
}

export function ViewModeProvider({ children }: { children: React.ReactNode }) {
  const [viewMode, setViewModeState] = useState<ViewMode>(loadStoredMode);

  function setViewMode(mode: ViewMode) {
    setViewModeState(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // localStorage unavailable
    }
  }

  return (
    <ViewModeContext.Provider value={{ viewMode, setViewMode, isPlayerView: viewMode === 'player' }}>
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode(): ViewModeContextValue {
  const ctx = useContext(ViewModeContext);
  if (!ctx) throw new Error('useViewMode must be used within ViewModeProvider');
  return ctx;
}
