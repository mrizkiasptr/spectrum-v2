import { describe, expect, it } from 'vitest';
import { createSeed } from './seed';
import {
  attentionFor,
  burndown,
  checkPeriod,
  nextSprintNumber,
  progressOf,
  readiness,
  startBlocker,
  suggestPeriod,
} from './sprint';
import type { Sprint } from './types';

const TODAY = '2026-09-28';

function sprint(p: Partial<Sprint>): Sprint {
  return {
    id: 's', projectId: 'p', number: 1, goal: '', startDate: null, endDate: null, status: 'draft',
    goalOutcome: null, reviewNotes: '', startedAt: null, completedAt: null, closedSummary: null, ...p,
  };
}

describe('checkPeriod', () => {
  const other = sprint({ id: 'o', number: 1, startDate: '2026-09-14', endDate: '2026-09-30', status: 'active' });

  it('blocks end before start and overlaps', () => {
    expect(checkPeriod('2026-10-10', '2026-10-01', [], new Map()).errors).toHaveLength(1);
    const r = checkPeriod('2026-09-30', '2026-10-13', [other], new Map());
    expect(r.errors[0]).toMatch(/Overlaps with Sprint 1/);
    expect(r.errors[0]).toMatch(/1 Oct 2026/);
  });

  it('allows any length but warns above one month', () => {
    const r = checkPeriod('2026-10-01', '2026-11-15', [other], new Map());
    expect(r.errors).toEqual([]);
    expect(r.warnings[0]).toMatch(/46-day sprint/);
  });

  it('warns when starting on a weekend or holiday', () => {
    expect(checkPeriod('2026-10-03', '2026-10-16', [], new Map()).warnings[0]).toMatch(/weekend/);
    const h = new Map([['2026-12-25', { id: 'h', date: '2026-12-25', name: 'Christmas Day', kind: 'public' as const }]]);
    expect(checkPeriod('2026-12-25', '2027-01-07', [], h).warnings[0]).toMatch(/Christmas Day/);
  });
});

describe('sprint lifecycle', () => {
  const seed = createSeed(TODAY);
  const atSprints = seed.sprints.filter((s) => s.projectId === 'p-at');
  const active = atSprints.find((s) => s.status === 'active')!;
  const draft = atSprints.find((s) => s.status === 'draft')!;

  it('numbers sprints per project without resetting', () => {
    expect(nextSprintNumber(seed.sprints, 'p-at')).toBe(3);
    expect(nextSprintNumber(seed.sprints, 'p-spe')).toBe(17);
    expect(nextSprintNumber(seed.sprints, 'p-new')).toBe(1);
  });

  it('suggests the day after the latest sprint, using the project default length', () => {
    const p = { id: 'p-mantap', defaultSprintDays: 14 };
    const last = seed.sprints.find((s) => s.projectId === 'p-mantap' && s.number === 6)!;
    const period = suggestPeriod(p, seed.sprints, TODAY);
    expect(period.startDate > last.endDate!).toBe(true);
    expect(suggestPeriod({ id: 'p-new', defaultSprintDays: 7 }, seed.sprints, TODAY)).toEqual({
      startDate: TODAY,
      endDate: '2026-10-04',
    });
  });

  it('requires goal, dates and at least one task before starting', () => {
    const r = readiness(draft, seed.items);
    expect(r.ready).toBe(false);
    expect(r.checks.filter((c) => !c.ok).map((c) => c.key)).toEqual(['goal', 'dates', 'items']);
  });

  it('blocks starting while another sprint is active', () => {
    const ready = { ...draft, goal: 'x', startDate: '2026-10-01', endDate: '2026-10-14' };
    const items = [...seed.items, { ...seed.items[0], id: 'n', sprintId: draft.id }];
    expect(startBlocker(ready, seed.sprints, items)).toMatch(/Complete Sprint 1/);
    const others = seed.sprints.map((s) => (s.id === active.id ? { ...s, status: 'completed' as const } : s));
    expect(startBlocker(ready, others, items)).toBeNull();
  });

  it('computes progress by count and weight', () => {
    const p = progressOf(seed.items.filter((i) => i.sprintId === active.id));
    expect(p.total).toBe(18);
    expect(p.done).toBe(10);
    expect(p.pct).toBe(56);
    expect(p.doneWeight).toBeLessThan(p.totalWeight);
  });

  it('burns down only completed work and leaves future days empty', () => {
    const points = burndown(active, seed.items, TODAY);
    expect(points[0].remaining).toBeGreaterThan(points[points.length - 3].remaining!);
    expect(points[points.length - 1].remaining).toBeNull();
    expect(points[points.length - 1].ideal).toBe(0);
  });

  it('surfaces actionable attention items', () => {
    const project = seed.projects.find((p) => p.id === 'p-at')!;
    const list = attentionFor(project, seed.sprints, seed.items, seed.holidays, TODAY);
    expect(list.map((a) => a.id)).toContain(`draft-${draft.id}`);
    expect(list.every((a) => a.action.to.startsWith('/projects/p-at'))).toBe(true);

    const spe = seed.projects.find((p) => p.id === 'p-spe')!;
    const speList = attentionFor(spe, seed.sprints, seed.items, seed.holidays, TODAY).map((a) => a.id);
    expect(speList).toContain('project-end');
    expect(speList).toContain('critical');
  });
});
