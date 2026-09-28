import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSeed } from '../domain/seed';
import { useStore } from '../store/useStore';
import { SyncEngine, useSync } from './engine';
import { toRow, type Collection, type Row } from './rows';

type Handler = (payload: { eventType: string; new: Row; old: Row }) => void;

/** In-memory stand-in for the bits of supabase-js the engine uses. */
function fakeDb(tables: Record<string, Row[]>) {
  const calls: { op: string; table: string; rows?: Row[]; ids?: string[] }[] = [];
  const handlers: Record<string, Handler> = {};
  let failNext: { code: string; message: string } | null = null;
  const db = {
    from(table: string) {
      return {
        select: () => ({
          order: () => ({
            range: async (from: number, to: number) => ({ data: (tables[table] ?? []).slice(from, to + 1), error: null }),
          }),
        }),
        upsert: async (rows: Row[]) => {
          if (failNext) {
            const error = failNext;
            failNext = null;
            return { error };
          }
          calls.push({ op: 'upsert', table, rows });
          const t = (tables[table] ??= []);
          for (const r of rows) {
            const i = t.findIndex((x) => x.id === r.id);
            if (i >= 0) t[i] = r;
            else t.push(r);
          }
          return { error: null };
        },
        delete: () => ({
          in: (_col: string, ids: string[]) => ({
            select: async () => {
              calls.push({ op: 'delete', table, ids });
              const gone = (tables[table] ?? []).filter((r) => ids.includes(r.id));
              tables[table] = (tables[table] ?? []).filter((r) => !ids.includes(r.id));
              return { data: gone.map((r) => ({ id: r.id })), error: null };
            },
          }),
        }),
      };
    },
    channel() {
      const ch = {
        on(_kind: string, filter: { table: string }, cb: Handler) {
          handlers[filter.table] = cb;
          return ch;
        },
        subscribe: () => ch,
      };
      return ch;
    },
    removeChannel: async () => undefined,
  };
  return {
    db: db as unknown as SupabaseClient,
    calls,
    tables,
    emit: (table: string, payload: Parameters<Handler>[0]) => handlers[table](payload),
    failOnce: (code: string) => (failNext = { code, message: code }),
  };
}

const seed = createSeed('2026-09-28');
const rowsOf = <C extends Collection>(c: C, list: unknown[]) => list.map((e) => toRow(c, e as never));

describe('SyncEngine', () => {
  let engine: SyncEngine | null = null;
  beforeEach(() => {
    vi.useFakeTimers();
    useStore.setState({ members: [], projects: [], sprints: [], items: [], retro: [], docs: [], holidays: [] });
  });
  afterEach(() => {
    engine?.stop();
    engine = null;
    vi.useRealTimers();
  });

  const start = async (tables: Record<string, Row[]>, writable: (c: Collection) => boolean = () => true) => {
    const f = fakeDb(tables);
    engine = new SyncEngine(f.db, writable);
    await engine.start();
    return f;
  };

  it('loads the workspace into the store', async () => {
    await start({ projects: rowsOf('projects', seed.projects), sprints: rowsOf('sprints', seed.sprints), work_items: rowsOf('items', seed.items) });
    const s = useStore.getState();
    expect(s.projects).toEqual(seed.projects);
    expect(s.items).toHaveLength(seed.items.length);
    expect(useSync.getState()).toMatchObject({ state: 'saved', loaded: true });
  });

  it('writes local changes back, debounced, and only what changed', async () => {
    const f = await start({ projects: rowsOf('projects', seed.projects), sprints: rowsOf('sprints', seed.sprints) });
    const sprint = seed.sprints.find((s) => s.status === 'draft')!;
    useStore.getState().updateSprint(sprint.id, { goal: 'Ship the tribe dashboard' });
    useStore.getState().updateSprint(sprint.id, { goal: 'Ship the tribe dashboard to PMs' });
    expect(f.calls).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(500);
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0]).toMatchObject({ op: 'upsert', table: 'sprints' });
    expect(f.calls[0].rows!.map((r) => r.id)).toEqual([sprint.id]);
    expect((f.tables.sprints.find((r) => r.id === sprint.id)!.data as { goal: string }).goal).toBe('Ship the tribe dashboard to PMs');
  });

  it('deletes removed entities', async () => {
    const draft = seed.sprints.find((s) => s.status === 'draft')!;
    const f = await start({ projects: rowsOf('projects', seed.projects), sprints: rowsOf('sprints', seed.sprints) });
    useStore.getState().deleteSprint(draft.id);
    await vi.advanceTimersByTimeAsync(500);
    expect(f.calls.some((c) => c.op === 'delete' && c.table === 'sprints' && c.ids!.includes(draft.id))).toBe(true);
  });

  it('applies teammates’ changes without writing them back', async () => {
    const f = await start({ projects: rowsOf('projects', seed.projects) });
    const p = { ...seed.projects[0], name: 'Renamed by a teammate' };
    f.emit('projects', { eventType: 'UPDATE', new: toRow('projects', p), old: { id: p.id } });
    expect(useStore.getState().projects.find((x) => x.id === p.id)!.name).toBe('Renamed by a teammate');
    await vi.advanceTimersByTimeAsync(500);
    expect(f.calls).toHaveLength(0);
    f.emit('projects', { eventType: 'DELETE', new: { id: '' }, old: { id: p.id } });
    expect(useStore.getState().projects.some((x) => x.id === p.id)).toBe(false);
  });

  it('skips collections the person may not write', async () => {
    const f = await start({ holidays: rowsOf('holidays', seed.holidays) }, (c) => c !== 'holidays');
    useStore.getState().addHoliday({ date: '2026-12-31', name: 'New Year’s Eve', kind: 'collective' });
    await vi.advanceTimersByTimeAsync(500);
    expect(f.calls).toHaveLength(0);
  });

  it('reloads the server copy when a write is refused', async () => {
    const f = await start({ projects: rowsOf('projects', seed.projects) });
    f.failOnce('42501');
    useStore.getState().updateProject(seed.projects[0].id, { name: 'Not allowed' });
    await vi.advanceTimersByTimeAsync(500);
    expect(useStore.getState().projects.find((p) => p.id === seed.projects[0].id)!.name).toBe(seed.projects[0].name);
  });

  it('retries after a network error', async () => {
    const f = await start({ projects: rowsOf('projects', seed.projects) });
    f.failOnce('500');
    useStore.getState().updateProject(seed.projects[0].id, { name: 'Eventually saved' });
    await vi.advanceTimersByTimeAsync(500);
    expect(useSync.getState().state).toBe('error');
    await vi.advanceTimersByTimeAsync(1500);
    expect(useSync.getState().state).toBe('saved');
    expect((f.tables.projects.find((r) => r.id === seed.projects[0].id)!.data as { name: string }).name).toBe('Eventually saved');
  });
});
