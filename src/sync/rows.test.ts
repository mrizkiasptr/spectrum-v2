import { describe, expect, it } from 'vitest';
import { createSeed } from '../domain/seed';
import { diff, fromRow, stableStringify, toRow } from './rows';

const seed = createSeed('2026-09-28');

describe('sync rows', () => {
  it('round-trips every entity through a table row', () => {
    const item = seed.items[0];
    expect(fromRow('items', toRow('items', item))).toEqual(item);
    expect(toRow('items', item)).toMatchObject({ id: item.id, project_id: item.projectId, sprint_id: item.sprintId });
    const p = seed.projects[0];
    expect(toRow('projects', p)).toMatchObject({ id: p.id, tribe: p.tribe, status: p.status });
    expect(fromRow('projects', toRow('projects', p))).toEqual(p);
    const m = { ...seed.members[0], email: 'Rizkia@SPE.co.id' };
    expect(toRow('members', m)).toMatchObject({ email: 'rizkia@spe.co.id', is_admin: false });
  });

  it('fingerprints ignore key order', () => {
    expect(stableStringify({ b: 1, a: { d: [1, { y: 2, x: 1 }], c: null } })).toBe(stableStringify({ a: { c: null, d: [1, { x: 1, y: 2 }] }, b: 1 }));
  });

  it('diffs against what the server has', () => {
    const [a, b, c] = seed.sprints;
    const known = new Map([a, b, c].map((s) => [s.id, stableStringify(s)]));
    const changed = { ...b, goal: 'New goal' };
    const added = { ...c, id: 's-new' };
    const d = diff(known, [a, changed, added]);
    expect(d.upserts.map((s) => s.id)).toEqual([b.id, 's-new']);
    expect(d.deletes).toEqual([c.id]);
    expect(diff(known, [a, b, c])).toEqual({ upserts: [], deletes: [] });
  });
});
