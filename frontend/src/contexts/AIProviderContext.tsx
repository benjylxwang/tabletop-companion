import React, { createContext, useContext, useState } from 'react';
import type { AIProvider } from '@tabletop/shared';

interface AIProviderContextValue {
  provider: AIProvider;
  setProvider: (p: AIProvider) => void;
}

const AIProviderContext = createContext<AIProviderContextValue | null>(null);

const STORAGE_KEY = 'tabletop-ai-provider';

function loadStoredProvider(): AIProvider {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'deepinfra' || stored === 'anthropic') return stored;
  } catch {
    // localStorage unavailable
  }
  return 'anthropic';
}

export function AIProviderProvider({ children }: { children: React.ReactNode }) {
  const [provider, setProviderState] = useState<AIProvider>(loadStoredProvider);

  function setProvider(p: AIProvider) {
    setProviderState(p);
    try {
      localStorage.setItem(STORAGE_KEY, p);
    } catch {
      // localStorage unavailable
    }
  }

  return (
    <AIProviderContext.Provider value={{ provider, setProvider }}>
      {children}
    </AIProviderContext.Provider>
  );
}

export function useAIProvider(): AIProviderContextValue {
  const ctx = useContext(AIProviderContext);
  if (!ctx) throw new Error('useAIProvider must be used within AIProviderProvider');
  return ctx;
}
