import { useEffect } from 'react';

// Ctrl+Shift+G (or Cmd+Shift+G on mac) — toggles the hidden dev generator.
// Deliberately no visible button; DM-only at the API layer.
export function useDevGeneratorShortcut(onTrigger: () => void): void {
  useEffect(() => {
    function handle(e: KeyboardEvent) {
      if (!e.shiftKey) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key.toLowerCase() !== 'g') return;
      e.preventDefault();
      onTrigger();
    }
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [onTrigger]);
}
