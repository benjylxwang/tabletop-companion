import type { ViewMode } from '@tabletop/shared';

const DM_PREFIX = 'dm_';

export function shouldStripDmFields(view: ViewMode): boolean {
  return view === 'player';
}

export function stripDmFields<T>(value: T): T {
  return walk(value) as T;
}

function walk(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) {
    let changed = false;
    const next: unknown[] = new Array(value.length);
    for (let i = 0; i < value.length; i += 1) {
      const walked = walk(value[i]);
      if (walked !== value[i]) changed = true;
      next[i] = walked;
    }
    return changed ? next : value;
  }
  const src = value as Record<string, unknown>;
  let changed = false;
  const next: Record<string, unknown> = {};
  for (const key of Object.keys(src)) {
    if (key.startsWith(DM_PREFIX)) {
      changed = true;
      continue;
    }
    const walked = walk(src[key]);
    if (walked !== src[key]) changed = true;
    next[key] = walked;
  }
  return changed ? next : value;
}
