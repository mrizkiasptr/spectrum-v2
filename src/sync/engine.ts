import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { create } from 'zustand';
import { toast } from '../components/toast';
import { useStore } from '../store/useStore';
import { COLLECTIONS, TABLE, diff, fromRow, stableStringify, toRow, type Collection, type EntityOf, type Row } from './rows';

export type SyncState = 'off' | 'loading' | 'saved' | 'saving' | 'offline' | 'error';

interface SyncStatus {
  state: SyncState;
  /** Set once the first load from the workspace finished. */
  loaded: boolean;
  lastSavedAt: number | null;
  message: string | null;
}

/** Live sync status for the UI. */
export const useSync = create<SyncStatus>(() => ({ state: 'off', loaded: false, lastSavedAt: null, message: null }));

type Known = Record<Collection, Map<string, string>>;
type Queue = Record<Collection, { up: Map<string, unknown>; del: Set<string> }>;

const emptyKnown = (): Known => Object.fromEntries(COLLECTIONS.map((c) => [c, new Map()])) as unknown as Known;
const emptyQueue = (): Queue => Object.fromEntries(COLLECTIONS.map((c) => [c, { up: new Map(), del: new Set() }])) as unknown as Queue;

const online = () => typeof navigator === 'undefined' || navigator.onLine !== false;

const PERMISSION_CODES = new Set(['42501', 'PGRST301', '401', '403']);

/**
 * Keeps the local store and the Supabase workspace in step:
 * loads everything the person can see, writes local changes back (debounced, retried),
 * and applies teammates' changes as they arrive over Realtime. Last write wins per entity.
 */
export class SyncEngine {
  private known = emptyKnown();
  private queue = emptyQueue();
  private applyingRemote = false;
  private unsubscribe: (() => void) | null = null;
  private channel: RealtimeChannel | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private flushing = false;
  private retryMs = 1000;
  private stopped = false;
  private onOnline = () => this.schedule(0);

  constructor(
    private readonly db: SupabaseClient,
    /** Collections this person may write; others are read-only for them (RLS enforces it too). */
    private readonly writable: (c: Collection) => boolean,
  ) {}

  async start(): Promise<void> {
    useSync.setState({ state: 'loading', message: null });
    await this.loadAll();
    this.unsubscribe = useStore.subscribe((s, prev) => {
      if (this.applyingRemote) return;
      for (const c of COLLECTIONS) if (s[c] !== prev[c]) this.enqueue(c);
    });
    this.listen();
    if (typeof window !== 'undefined') window.addEventListener('online', this.onOnline);
  }

  stop() {
    this.stopped = true;
    this.unsubscribe?.();
    if (this.channel) void this.db.removeChannel(this.channel);
    if (this.timer) clearTimeout(this.timer);
    if (typeof window !== 'undefined') window.removeEventListener('online', this.onOnline);
    useSync.setState({ state: 'off', loaded: false, message: null });
  }

  /** Reads every table the person can see and replaces the local lists with it. */
  async loadAll(): Promise<void> {
    const results = await Promise.all(
      COLLECTIONS.map(async (c) => {
        const rows: Row[] = [];
        // PostgREST caps responses (1000 rows by default), so page through.
        for (let from = 0; ; from += 1000) {
          const { data, error } = await this.db.from(TABLE[c]).select('*').order('id').range(from, from + 999);
          if (error) throw error;
          rows.push(...((data ?? []) as Row[]));
          if (!data || data.length < 1000) break;
        }
        return [c, rows] as const;
      }),
    ).catch((err) => {
      useSync.setState({ state: online() ? 'error' : 'offline', message: String(err?.message ?? err) });
      throw err;
    });

    const patch: Partial<Record<Collection, unknown[]>> = {};
    for (const [c, rows] of results) {
      const list = rows.map((r) => fromRow(c, r));
      this.known[c] = new Map(list.map((e) => [e.id, stableStringify(e)]));
      patch[c] = list;
    }
    this.applyingRemote = true;
    useStore.setState(patch as never);
    this.applyingRemote = false;
    this.queue = emptyQueue();
    useSync.setState({ state: 'saved', loaded: true, message: null });
  }

  /** Pushes every local list as-is (used to seed an empty workspace). */
  pushEverything() {
    for (const c of COLLECTIONS) this.enqueue(c);
  }

  private enqueue(c: Collection) {
    if (!this.writable(c)) return;
    const list = useStore.getState()[c] as { id: string }[];
    const { upserts, deletes } = diff(this.known[c], list);
    const q = this.queue[c];
    for (const e of upserts) {
      q.up.set(e.id, e);
      q.del.delete(e.id);
    }
    for (const id of deletes) {
      q.del.add(id);
      q.up.delete(id);
    }
    if (upserts.length || deletes.length) this.schedule(400);
  }

  private schedule(ms: number) {
    if (this.stopped) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), ms);
  }

  private pending() {
    return COLLECTIONS.some((c) => this.queue[c].up.size || this.queue[c].del.size);
  }

  private async flush() {
    if (this.flushing || this.stopped || !this.pending()) return;
    if (!online()) {
      useSync.setState({ state: 'offline', message: 'You’re offline. Changes are kept and will sync when you’re back.' });
      return;
    }
    this.flushing = true;
    useSync.setState({ state: 'saving' });
    try {
      // Parents first for upserts, children first for deletes.
      for (const c of COLLECTIONS) {
        const q = this.queue[c];
        if (!q.up.size) continue;
        const batch = [...q.up.values()] as EntityOf[typeof c][];
        const { error } = await this.db.from(TABLE[c]).upsert(batch.map((e) => toRow(c, e)));
        if (error) throw error;
        for (const e of batch) {
          this.known[c].set(e.id, stableStringify(e));
          if (q.up.get(e.id) === e) q.up.delete(e.id);
        }
      }
      for (const c of [...COLLECTIONS].reverse()) {
        const q = this.queue[c];
        if (!q.del.size) continue;
        const ids = [...q.del];
        const { data, error } = await this.db.from(TABLE[c]).delete().in('id', ids).select('id');
        if (error) throw error;
        // RLS hides rows it won't delete instead of failing, so compare what was actually removed.
        if ((data ?? []).length < ids.length) throw { code: '42501', message: 'delete not permitted' };
        for (const id of ids) {
          this.known[c].delete(id);
          q.del.delete(id);
        }
      }
      this.retryMs = 1000;
      useSync.setState({ state: 'saved', lastSavedAt: Date.now(), message: null });
    } catch (err) {
      const e = err as { code?: string; message?: string; status?: number };
      if (PERMISSION_CODES.has(String(e.code)) || PERMISSION_CODES.has(String(e.status))) {
        toast('You don’t have access to change that. Showing the latest saved data.');
        this.queue = emptyQueue();
        await this.loadAll().catch(() => undefined);
      } else {
        useSync.setState({
          state: online() ? 'error' : 'offline',
          message: online() ? 'Couldn’t save. Retrying…' : 'You’re offline. Changes will sync when you’re back.',
        });
        this.schedule(this.retryMs);
        this.retryMs = Math.min(this.retryMs * 2, 30000);
      }
    } finally {
      this.flushing = false;
      if (this.pending() && useSync.getState().state === 'saved') this.schedule(0);
    }
  }

  private listen() {
    const byTable = Object.fromEntries(COLLECTIONS.map((c) => [TABLE[c], c])) as Record<string, Collection>;
    let ch = this.db.channel('workspace');
    for (const table of Object.keys(byTable)) {
      ch = ch.on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
        const c = byTable[table];
        if (payload.eventType === 'DELETE') this.applyRemote(c, (payload.old as Row).id, null);
        else this.applyRemote(c, (payload.new as Row).id, fromRow(c, payload.new as Row));
      });
    }
    // Tribe or admin access changed: what this person may see changed, so reload.
    ch = ch.on('postgres_changes', { event: '*', schema: 'public', table: 'tribe_access' }, () => void this.loadAll().catch(() => undefined));
    this.channel = ch.subscribe();
  }

  private applyRemote<C extends Collection>(c: C, id: string, entity: EntityOf[C] | null) {
    const fp = entity ? stableStringify(entity) : null;
    if ((this.known[c].get(id) ?? null) === fp) return; // our own echo
    // A local edit still waiting to be saved wins over the incoming version.
    if (this.queue[c].up.has(id) || this.queue[c].del.has(id)) return;
    if (fp) this.known[c].set(id, fp);
    else this.known[c].delete(id);
    const list = useStore.getState()[c] as { id: string }[];
    const next = entity ? (list.some((e) => e.id === id) ? list.map((e) => (e.id === id ? entity : e)) : [...list, entity]) : list.filter((e) => e.id !== id);
    this.applyingRemote = true;
    useStore.setState({ [c]: next } as never);
    this.applyingRemote = false;
  }
}
