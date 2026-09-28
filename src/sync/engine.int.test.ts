/// <reference types="node" />
/**
 * Integration test: SyncEngine + supabase-js against a real PostgREST + Postgres with the
 * migrations and RLS applied. Skipped unless SB_IT_REST points at PostgREST, e.g.
 *   SB_IT_REST=http://localhost:3001 SB_IT_JWT_SECRET=... npx vitest run src/sync/engine.int.test.ts
 * See supabase/tests/README.md for the local setup.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createHmac } from 'node:crypto';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createSeed } from '../domain/seed';
import { useStore } from '../store/useStore';
import { SyncEngine } from './engine';

const REST = process.env.SB_IT_REST;
const SECRET = process.env.SB_IT_JWT_SECRET ?? '';
const ADMIN = '00000000-0000-0000-0000-00000000000a';
const TRIBE_LEAD = '00000000-0000-0000-0000-00000000000b';

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
function jwt(sub: string, email: string) {
  const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, email, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}`;
  return `${body}.${createHmac('sha256', SECRET).update(body).digest('base64url')}`;
}

describe.skipIf(!REST)('SyncEngine ↔ PostgREST (RLS)', () => {
  let proxy: http.Server;
  let base = '';
  const empty = { members: [], projects: [], sprints: [], items: [], retro: [], docs: [], holidays: [] };

  beforeAll(async () => {
    // supabase-js calls <url>/rest/v1/...; plain PostgREST serves at the root.
    proxy = http.createServer((req, res) => {
      const target = new URL(req.url!.replace(/^\/rest\/v1/, ''), REST);
      const up = http.request(target, { method: req.method, headers: { ...req.headers, host: target.host } }, (r) => {
        res.writeHead(r.statusCode ?? 500, r.headers);
        r.pipe(res);
      });
      req.pipe(up);
    });
    await new Promise<void>((r) => proxy.listen(0, r));
    base = `http://localhost:${(proxy.address() as AddressInfo).port}`;
  });
  afterAll(() => proxy.close());

  const clientFor = (sub: string, email: string): SupabaseClient =>
    createClient(base, jwt('anon', 'anon'), {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${jwt(sub, email)}` } },
    });

  const settle = () => new Promise((r) => setTimeout(r, 900));

  it('admin links, seeds the workspace, and edits', async () => {
    const db = clientFor(ADMIN, 'admin@spe.id');
    const { data: me, error } = await db.rpc('link_member', { p_name: 'Admin Person', p_initials: 'AP' });
    expect(error).toBeNull();
    expect(me.id).toBe('m-a');

    useStore.setState(empty);
    const engine = new SyncEngine(db, () => true);
    await engine.start();
    const seed = createSeed('2026-09-28');
    useStore.setState({ members: [...useStore.getState().members, ...seed.members], projects: seed.projects, sprints: seed.sprints, items: seed.items, retro: seed.retro, docs: seed.docs, holidays: seed.holidays });
    await settle();
    const { count } = await db.from('work_items').select('id', { count: 'exact', head: true });
    expect(count).toBe(seed.items.length);

    const draft = seed.sprints.find((s) => s.status === 'draft')!;
    useStore.getState().updateSprint(draft.id, { goal: 'Saved through PostgREST' });
    useStore.getState().deleteSprint(seed.sprints.filter((s) => s.status === 'draft').at(-1)!.id);
    await settle();
    const { data: row } = await db.from('sprints').select('data').eq('id', draft.id).single();
    expect((row!.data as { goal: string }).goal).toBe('Saved through PostgREST');
    engine.stop();
  });

  it('tribe lead links by email, sees only its tribe, and cannot edit', async () => {
    const db = clientFor(TRIBE_LEAD, 'tribe@spe.id');
    const { data: me } = await db.rpc('link_member', { p_name: 'x', p_initials: 'x' });
    expect(me.id).toBe('m-t');

    useStore.setState(empty);
    const engine = new SyncEngine(db, (c) => c !== 'members' && c !== 'holidays');
    await engine.start();
    const projects = useStore.getState().projects;
    expect(projects.length).toBeGreaterThan(0);
    expect(new Set(projects.map((p) => p.tribe))).toEqual(new Set(['Phoenix']));
    expect(useStore.getState().items.every((i) => projects.some((p) => p.id === i.projectId))).toBe(true);

    const p = projects[0];
    useStore.getState().updateProject(p.id, { name: 'Hijacked' });
    await settle();
    // Refused by RLS → engine reloads the server copy.
    expect(useStore.getState().projects.find((x) => x.id === p.id)!.name).toBe(p.name);

    const item = useStore.getState().items[0];
    useStore.getState().deleteItem(item.id);
    await settle();
    expect(useStore.getState().items.some((i) => i.id === item.id)).toBe(true);
    engine.stop();
  });
});
