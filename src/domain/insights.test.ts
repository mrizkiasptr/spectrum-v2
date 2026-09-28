import { describe, expect, it } from 'vitest';
import { projectInsight, sprintTimePct, summarize, workloadOf } from './insights';
import { createSeed } from './seed';
import type { Sprint } from './types';

const TODAY = '2026-09-28';
const seed = createSeed(TODAY);
const insight = (id: string) =>
  projectInsight(seed.projects.find((p) => p.id === id)!, seed.sprints, seed.items, seed.holidays, TODAY);

describe('insights', () => {
  it('measures elapsed working time of a sprint', () => {
    const s = { startDate: '2026-09-21', endDate: '2026-10-02' } as Sprint; // Mon–Fri x2 = 10 working days
    expect(sprintTimePct(s, '2026-09-20', new Map())).toBe(0);
    expect(sprintTimePct(s, '2026-09-25', new Map())).toBe(50);
    expect(sprintTimePct(s, '2026-10-05', new Map())).toBe(100);
  });

  it('rates health from progress against time', () => {
    const at = insight('p-at');
    expect(at.activeSprint?.number).toBe(1);
    expect(at.timePct).toBeGreaterThan(at.progressPct);
    expect(['at_risk', 'off_track']).toContain(at.health);
    expect(at.risks.join(' ')).toMatch(/behind the sprint timeline/);

    expect(insight('p-kaltim').health).toBe('no_sprint');
    expect(insight('p-specva').health).toBe('completed');
  });

  it('flags critical defects and a passed project end date', () => {
    const spe = insight('p-spe');
    expect(spe.criticalDefects).toBe(1);
    expect(spe.health).not.toBe('on_track');
    expect(spe.risks).toContain('Project end date has passed');
    expect(spe.velocity.map((v) => v.sprint.number)).toEqual([14, 15]);
    expect(spe.avgVelocity).toBe(24);
    expect(spe.goals).toEqual({ achieved: 1, closed: 2 });
  });

  it('rolls projects up into a tribe summary', () => {
    const list = ['p-mantap', 'p-kaltim'].map(insight);
    const s = summarize(list);
    expect(s.projects).toBe(2);
    expect(s.activeSprints).toBe(1);
    expect(s.health.no_sprint).toBe(1);
    expect(s.tasksTotal).toBe(list[0].progress.total);
  });

  it('computes workload per person', () => {
    const at = insight('p-at');
    const scope = seed.items.filter((i) => i.sprintId === at.activeSprint!.id);
    const w = workloadOf(scope, seed.members);
    expect(w[0].openWeight).toBeGreaterThanOrEqual(w[w.length - 1].openWeight);
    expect(w.reduce((t, x) => t + x.openTasks, 0)).toBe(scope.filter((i) => i.status !== 'done').length);
  });
});
