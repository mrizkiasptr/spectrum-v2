import { beforeEach, describe, expect, it } from 'vitest';
import { boardCards, deriveStatus, normalizeItem, tasksOf } from '../domain/hierarchy';
import { progressOf } from '../domain/sprint';
import type { WorkItem } from '../domain/types';
import { migrateState, useStore } from './useStore';

const s = () => useStore.getState();
const item = (key: string) => s().items.find((i) => i.key === key)!;
const byTitle = (title: string) => s().items.find((i) => i.title === title)!;

describe('backlog items and their tasks', () => {
  beforeEach(() => s().resetDemo());

  it('derives an item’s status from its tasks', () => {
    const t = (status: WorkItem['status']) => ({ status }) as WorkItem;
    expect(deriveStatus([])).toBeNull();
    expect(deriveStatus([t('todo'), t('todo')])).toBe('todo');
    expect(deriveStatus([t('done'), t('todo')])).toBe('in_progress');
    expect(deriveStatus([t('done'), t('review')])).toBe('review');
    expect(deriveStatus([t('done'), t('done')])).toBe('done');
  });

  it('every task in the demo belongs to a backlog item in the same sprint', () => {
    const tasks = s().items.filter((i) => i.type === 'task');
    expect(tasks.length).toBeGreaterThan(0);
    for (const t of tasks) {
      const parent = s().items.find((i) => i.id === t.parentId);
      expect(parent && parent.type !== 'task').toBe(true);
      expect(t.sprintId).toBe(parent!.sprintId);
    }
  });

  it('refuses a task without a backlog item', () => {
    expect(() => s().createItem('p-at', { title: 'Orphan', type: 'task', sprintId: null })).toThrow(/backlog item/);
  });

  it('closes the item when its last task is done, and reopens it with a new task', () => {
    const parent = item('SPE-405');
    const tasks = tasksOf(s().items, parent.id);
    for (const t of tasks) s().updateItem(t.id, { status: 'done' });
    expect(item('SPE-405')).toMatchObject({ status: 'done', statusId: 'done' });
    expect(item('SPE-405').completedAt).not.toBeNull();

    s().createItem('p-spe', { title: 'Fix Safari drop target', type: 'task', sprintId: null, parentId: parent.id });
    expect(item('SPE-405').status).toBe('in_progress');
    expect(item('SPE-405').completedAt).toBeNull();
  });

  it('moves tasks with their backlog item', () => {
    const parent = item('ANL-131');
    const draft = s().sprints.find((sp) => sp.projectId === 'p-at' && sp.status === 'draft')!;
    s().moveToSprint([parent.id], draft.id);
    expect(tasksOf(s().items, parent.id).every((t) => t.sprintId === draft.id)).toBe(true);
    s().moveToSprint([parent.id], null);
    expect(tasksOf(s().items, parent.id).every((t) => t.sprintId === null)).toBe(true);
  });

  it('keeps a task in its item’s sprint even if asked to move it alone', () => {
    const task = byTitle('Chart component');
    s().updateItem(task.id, { sprintId: null });
    expect(byTitle('Chart component').sprintId).toBe(item('SPE-408').sprintId);
  });

  it('deletes tasks with their backlog item', () => {
    const parent = item('QMT-53');
    const ids = tasksOf(s().items, parent.id).map((t) => t.id);
    expect(ids.length).toBe(3);
    s().deleteItem(parent.id);
    expect(s().items.some((i) => ids.includes(i.id))).toBe(false);
  });

  it('counts progress by backlog item and shows tasks as board cards', () => {
    const sprintId = item('SPE-404').sprintId;
    const scope = s().items.filter((i) => i.sprintId === sprintId);
    const backlogItems = scope.filter((i) => i.type !== 'task');
    expect(progressOf(scope).total).toBe(backlogItems.length);
    const cards = boardCards(scope);
    expect(cards.some((c) => c.id === item('SPE-404').id)).toBe(false); // has tasks → shown as its tasks
    expect(cards.some((c) => c.id === item('SPE-407').id)).toBe(true); // no tasks yet → shown itself
  });

  it('turns standalone tasks from older data into backlog items', () => {
    const old = { id: 'x', type: 'task' } as WorkItem;
    expect(normalizeItem(old)).toMatchObject({ type: 'story', parentId: null });
    const out = migrateState({ items: [{ id: 'i', projectId: 'p', type: 'task', status: 'todo' }] });
    expect(out.items![0]).toMatchObject({ type: 'story', parentId: null });
  });
});
