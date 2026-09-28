import { beforeEach, describe, expect, it } from 'vitest';
import { progressOf } from '../domain/sprint';
import { columnOf, defaultWorkflow, validateWorkflow } from '../domain/workflow';
import { migrateState, useStore } from './useStore';

const s = () => useStore.getState();
const workflow = (id = 'p-at') => s().projects.find((p) => p.id === id)!.workflow;
const item = (key: string) => s().items.find((i) => i.key === key)!;

describe('workflow rules', () => {
  it('requires two statuses, a Done status, and unique names', () => {
    const wf = defaultWorkflow();
    expect(validateWorkflow(wf)).toBeNull();
    expect(validateWorkflow(wf.slice(0, 1))).toMatch(/two statuses/);
    expect(validateWorkflow(wf.slice(0, 3))).toMatch(/Done/);
    expect(validateWorkflow([...wf, { ...wf[0], id: 'x' }])).toMatch(/already a status named/);
    expect(validateWorkflow([...wf, { ...wf[0], id: 'x', name: ' ' }])).toMatch(/needs a name/);
  });

  it('falls back to a column of the same category when the stored column is gone', () => {
    const wf = defaultWorkflow();
    expect(columnOf(wf, { status: 'review', statusId: 'deleted' }).id).toBe('review');
  });
});

describe('workflow editing', () => {
  beforeEach(() => s().resetDemo());

  it('adds a status before Done by default', () => {
    expect(s().addStatus('p-at', { name: 'Ready for UAT', category: 'review', color: '#7C3AED' })).toBeNull();
    expect(workflow().map((w) => w.name)).toEqual(['Not started', 'In progress', 'In review', 'Ready for UAT', 'Done']);
    expect(s().addStatus('p-at', { name: 'done', category: 'done', color: '#1E9E5A' })).toMatch(/already a status/);
  });

  it('reorders columns', () => {
    s().moveStatus('p-at', 'review', 0);
    expect(workflow().map((w) => w.id)).toEqual(['review', 'todo', 'in_progress', 'done']);
  });

  it('moves items into a custom column and keeps progress by category', () => {
    s().addStatus('p-at', { name: 'Ready for UAT', category: 'review', color: '#7C3AED' });
    const uat = workflow().find((w) => w.name === 'Ready for UAT')!;
    s().updateItem(item('ANL-118').id, { statusId: uat.id });
    expect(item('ANL-118')).toMatchObject({ statusId: uat.id, status: 'review' });

    s().updateStatus('p-at', uat.id, { category: 'done' });
    expect(item('ANL-118').status).toBe('done');
    expect(item('ANL-118').completedAt).not.toBeNull();
    const sprintItems = s().items.filter((i) => i.sprintId === item('ANL-118').sprintId);
    expect(progressOf(sprintItems).byStatus.done).toBe(11);
  });

  it('deletes a status by moving its tasks elsewhere', () => {
    const inReview = s().items.filter((i) => i.projectId === 'p-at' && i.statusId === 'review').length;
    expect(inReview).toBeGreaterThan(0);
    expect(s().deleteStatus('p-at', 'review', 'in_progress')).toBeNull();
    expect(workflow().some((w) => w.id === 'review')).toBe(false);
    expect(s().items.filter((i) => i.projectId === 'p-at' && i.statusId === 'review')).toHaveLength(0);
  });

  it('refuses to delete the last Done status', () => {
    expect(s().deleteStatus('p-at', 'done', 'review')).toMatch(/Done/);
    expect(workflow().some((w) => w.id === 'done')).toBe(true);
  });

  it('creates new tasks in the requested column', () => {
    const created = s().createItem('p-spe', { title: 'QA pass', type: 'task', sprintId: null, statusId: 'qa' });
    expect(created).toMatchObject({ statusId: 'qa', status: 'review' });
    const plain = s().createItem('p-spe', { title: 'Backlog item', type: 'task', sprintId: null });
    expect(plain).toMatchObject({ statusId: 'todo', status: 'todo' });
  });

  it('migrates v1 data to the default workflow', () => {
    const v1 = {
      projects: [{ id: 'p', name: 'Old' }],
      items: [{ id: 'i', projectId: 'p', status: 'review' }],
    };
    const out = migrateState(v1, 1);
    expect(out.projects![0].workflow).toHaveLength(4);
    expect(out.items![0].statusId).toBe('review');
  });

  it('repairs missing or malformed saved data instead of crashing', () => {
    const fallback = { members: [], sprints: [], currentUserId: 'u-mr' };
    expect(migrateState(null, 2, fallback)).toMatchObject({ projects: [], items: [], currentUserId: 'u-mr' });
    const out = migrateState({ projects: [{ id: 'p', workflow: [] }], items: [{ id: 'i' }] }, 2, fallback);
    expect(out.projects![0].workflow.some((w) => w.category === 'done')).toBe(true);
    expect(out.items![0]).toMatchObject({ status: 'todo', statusId: 'todo', criteria: [], comments: [] });
  });
});
