import { describe, it, expect } from 'vitest';
import { stripDmFields, shouldStripDmFields } from './stripDmFields.js';

describe('stripDmFields', () => {
  it('strips top-level dm_-prefixed keys', () => {
    expect(stripDmFields({ id: '1', dm_notes: 'secret' })).toEqual({ id: '1' });
  });

  it('strips dm_ keys nested inside objects', () => {
    const input = { id: '1', nested: { name: 'ok', dm_notes: 'secret' } };
    expect(stripDmFields(input)).toEqual({ id: '1', nested: { name: 'ok' } });
  });

  it('strips dm_ keys nested inside arrays of objects', () => {
    const input = { rows: [{ id: '1', dm_notes: 'a' }, { id: '2', dm_notes: 'b' }] };
    expect(stripDmFields(input)).toEqual({ rows: [{ id: '1' }, { id: '2' }] });
  });

  it('leaves the exact key "dm" alone (only dm_-prefixed keys are stripped)', () => {
    expect(stripDmFields({ dm: 'keep' })).toEqual({ dm: 'keep' });
  });

  it('strips even the bare "dm_" key — any dm_ prefix is treated as private', () => {
    expect(stripDmFields({ dm_: 'secret', keep: 'ok' })).toEqual({ keep: 'ok' });
  });

  it('leaves values that happen to contain "dm_" untouched', () => {
    expect(stripDmFields({ note: 'dm_only ok' })).toEqual({ note: 'dm_only ok' });
  });

  it('passes primitives through', () => {
    expect(stripDmFields('hello')).toBe('hello');
    expect(stripDmFields(42)).toBe(42);
    expect(stripDmFields(null)).toBe(null);
  });

  it('passes Date instances through untouched', () => {
    const d = new Date('2026-04-16T00:00:00Z');
    expect(stripDmFields(d)).toBe(d);
  });

  it('does not mutate a frozen input', () => {
    const input = Object.freeze({ id: '1', dm_notes: 'secret' });
    expect(() => stripDmFields(input)).not.toThrow();
    expect(input).toEqual({ id: '1', dm_notes: 'secret' });
  });

  it('returns the same reference when nothing was stripped', () => {
    const input = { id: '1', name: 'a', nested: { ok: true } };
    expect(stripDmFields(input)).toBe(input);
  });
});

describe('shouldStripDmFields', () => {
  it('returns true for player view', () => {
    expect(shouldStripDmFields('player')).toBe(true);
  });
  it('returns false for dm view', () => {
    expect(shouldStripDmFields('dm')).toBe(false);
  });
});
