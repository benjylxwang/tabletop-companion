import { useEffect } from 'react';

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return target.isContentEditable;
}

// Ctrl+Shift+G (or Cmd+Shift+G on mac) — toggles the hidden dev generator.
// Deliberately no visible button; DM-only at the API layer.
// Suppressed while focus is in an editable element so the shortcut doesn't
// surprise users mid-typing (flagged by cubic review).
export function useDevGeneratorShortcut(onTrigger: () => void): void {
  useEffect(() => {
    function handle(e: KeyboardEvent) {
      if (!e.shiftKey) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key.toLowerCase() !== 'g') return;
      if (isEditableTarget(e.target)) return;
      e.preventDefault();
      onTrigger();
    }
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [onTrigger]);
}
