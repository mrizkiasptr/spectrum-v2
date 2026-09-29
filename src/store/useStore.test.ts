import { beforeEach, describe, expect, it } from 'vitest';
import { addDays, todayISO } from '../domain/dates';
import { useStore } from './useStore';

const s = () => useStore.getState();

describe('store', () => {
  beforeEach(() => s().resetDemo());

  it('creates items with the next project key', () => {
    const max = Math.max(...s().items.filter((i) => i.projectId === 'p-at' && i.type !== 'task').map((i) => Number(i.key.split('-')[1])));
    const item = s().createItem('p-at', { title: 'New analysis', type: 'story', sprintId: null });
    expect(item.key).toBe(`ANL-${max + 1}`);
    expect(s().items.find((i) => i.id === item.id)?.sprintId).toBeNull();
  });

  it('tracks completion time and resets release when reopened', () => {
    const item = s().items.find((i) => i.key === 'ANL-101')!;
    expect(item.release).toBe('released');
    s().updateItem(item.id, { status: 'in_progress' });
    const reopened = s().items.find((i) => i.id === item.id)!;
    expect(reopened.completedAt).toBeNull();
    expect(reopened.release).toBe('unreleased');
    s().updateItem(item.id, { status: 'done' });
    expect(s().items.find((i) => i.id === item.id)!.completedAt).not.toBeNull();
  });

  it('completes a sprint and carries unfinished work to the next draft', () => {
    const active = s().sprints.find((sp) => sp.projectId === 'p-at' && sp.status === 'active')!;
    const draft = s().sprints.find((sp) => sp.projectId === 'p-at' && sp.status === 'draft')!;
    const openItems = s().items.filter((i) => i.sprintId === active.id && i.type !== 'task' && i.status !== 'done');
    const open = openItems.length;
    const openTasks = s().items.filter((i) => openItems.some((o) => o.id === i.parentId)).length;

    const res = s().completeSprint(active.id, { outcome: 'partial', reviewNotes: 'ok', carryTo: 'next' });
    expect(res).toEqual({ carried: open, nextSprintId: draft.id });
    const closed = s().sprints.find((sp) => sp.id === active.id)!;
    expect(closed.status).toBe('completed');
    expect(closed.goalOutcome).toBe('partial');
    expect(closed.closedSummary?.carriedOver).toBe(open);
    expect(s().items.filter((i) => i.sprintId === draft.id && i.type !== 'task')).toHaveLength(open);
    // Tasks travel with their backlog item.
    expect(s().items.filter((i) => i.sprintId === draft.id && i.type === 'task')).toHaveLength(openTasks);
  });

  it('creates a draft sprint when carrying over and none exists', () => {
    const active = s().sprints.find((sp) => sp.projectId === 'p-spe' && sp.status === 'active')!;
    const res = s().completeSprint(active.id, { outcome: 'not_achieved', reviewNotes: '', carryTo: 'next' });
    const next = s().sprints.find((sp) => sp.id === res.nextSprintId)!;
    expect(next.number).toBe(17);
    expect(next.status).toBe('draft');
  });

  it('moves unfinished work back to the backlog when asked', () => {
    const active = s().sprints.find((sp) => sp.projectId === 'p-at' && sp.status === 'active')!;
    const res = s().completeSprint(active.id, { outcome: 'achieved', reviewNotes: '', carryTo: 'backlog' });
    expect(res.nextSprintId).toBeNull();
    expect(s().items.filter((i) => i.sprintId === active.id && i.status !== 'done')).toHaveLength(0);
  });

  it('refuses to start a sprint that is not ready', () => {
    const draft = s().sprints.find((sp) => sp.projectId === 'p-at' && sp.status === 'draft')!;
    expect(s().startSprint(draft.id)).toMatch(/Complete Sprint 1/);
  });

  it('reorders the backlog', () => {
    const backlog = () =>
      s().items.filter((i) => i.projectId === 'p-at' && i.sprintId === null).sort((a, b) => a.rank - b.rank).map((i) => i.key);
    const before = backlog();
    const second = s().items.find((i) => i.key === before[1])!;
    s().reorderBacklog(second.id, -1);
    expect(backlog().slice(0, 2)).toEqual([before[1], before[0]]);
  });

  it('moves an early-started sprint to begin today, keeping its length', () => {
    const active = s().sprints.find((sp) => sp.projectId === 'p-at' && sp.status === 'active')!;
    s().completeSprint(active.id, { outcome: 'achieved', reviewNotes: '', carryTo: 'next' });
    const draft = s().sprints.find((sp) => sp.projectId === 'p-at' && sp.status === 'draft')!;
    const start = addDays(todayISO(), 10);
    s().updateSprint(draft.id, { goal: 'Goal', startDate: start, endDate: addDays(start, 13) });
    expect(s().startSprint(draft.id)).toBeNull();
    const started = s().sprints.find((sp) => sp.id === draft.id)!;
    expect(started.status).toBe('active');
    expect(started.startDate).toBe(todayISO());
    expect(started.endDate).toBe(addDays(todayISO(), 13));
  });
});
