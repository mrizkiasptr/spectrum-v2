import type { ItemStatus, WorkflowStatus, WorkItem } from './types';

/**
 * Backlog items (stories and bugs) are what the team plans, estimates, and puts into a sprint.
 * Tasks are how a backlog item gets done: every task belongs to one backlog item and follows it
 * between the backlog and sprints. Weight and acceptance criteria live on the backlog item.
 */

export const isTask = (i: WorkItem) => i.type === 'task';
export const isBacklogItem = (i: WorkItem) => i.type !== 'task';

export const backlogItemsOf = (items: WorkItem[]) => items.filter(isBacklogItem);

export function tasksOf(items: WorkItem[], parentId: string): WorkItem[] {
  return items.filter((i) => i.parentId === parentId).sort((a, b) => a.rank - b.rank || a.createdAt.localeCompare(b.createdAt));
}

/**
 * A backlog item's status once it has tasks: done when every task is done, not started while none
 * has started, in review when the only open work is in review, otherwise in progress.
 */
export function deriveStatus(tasks: WorkItem[]): ItemStatus | null {
  if (!tasks.length) return null;
  if (tasks.every((t) => t.status === 'done')) return 'done';
  if (tasks.every((t) => t.status === 'todo')) return 'todo';
  const open = tasks.filter((t) => t.status !== 'done');
  if (open.every((t) => t.status === 'review')) return 'review';
  return 'in_progress';
}

/** Cards on the sprint board: tasks, plus backlog items that haven't been broken into tasks yet. */
export function boardCards(scope: WorkItem[]): WorkItem[] {
  const withTasks = new Set(scope.filter((i) => isTask(i) && i.parentId).map((i) => i.parentId));
  return scope.filter((i) => isTask(i) || !withTasks.has(i.id));
}

/**
 * Brings every backlog item that has tasks in line with them: status (and a column of that
 * category), completion time, and sprint (tasks always sit in their item's sprint).
 */
export function syncParents(items: WorkItem[], workflowOf: (projectId: string) => WorkflowStatus[]): WorkItem[] {
  const children = new Map<string, WorkItem[]>();
  for (const i of items) if (isTask(i) && i.parentId) (children.get(i.parentId) ?? children.set(i.parentId, []).get(i.parentId)!).push(i);
  if (!children.size) return items;
  const parents = new Map(items.filter((i) => children.has(i.id)).map((i) => [i.id, i]));
  let changed = false;
  const out = items.map((i) => {
    if (isTask(i) && i.parentId) {
      const parent = parents.get(i.parentId);
      if (parent && parent.sprintId !== i.sprintId) {
        changed = true;
        return { ...i, sprintId: parent.sprintId };
      }
      return i;
    }
    const tasks = children.get(i.id);
    const status = tasks && deriveStatus(tasks);
    if (!status || status === i.status) return i;
    changed = true;
    const workflow = workflowOf(i.projectId);
    const column = workflow.find((w) => w.category === status) ?? { id: status };
    const completedAt =
      status === 'done' ? tasks!.reduce<string | null>((m, t) => (t.completedAt && (!m || t.completedAt > m) ? t.completedAt : m), null) ?? new Date().toISOString() : null;
    return { ...i, status, statusId: column.id, completedAt, release: status === 'done' ? i.release : 'unreleased' };
  });
  return changed ? out : items;
}

/** Data from older versions had standalone tasks; they become backlog items (stories). */
export function normalizeItem(i: WorkItem): WorkItem {
  const parentId = typeof i.parentId === 'string' ? i.parentId : null;
  if (i.type === 'task' && !parentId) return { ...i, type: 'story', parentId: null };
  return i.parentId === parentId ? i : { ...i, parentId };
}

/** Sequence number of a backlog item key: "ADV-12" → 12. Task keys ("ADV-12.3") aren't backlog numbers. */
export function backlogNumber(key: string): number {
  const n = key.split('-').pop() ?? '';
  return /^\d+$/.test(n) ? Number(n) : 0;
}

/** Next key for a backlog item: tasks don't use up backlog numbers. */
export function nextBacklogKey(items: WorkItem[], projectId: string, prefix: string): string {
  const max = items.filter((i) => i.projectId === projectId && i.type !== 'task').reduce((m, i) => Math.max(m, backlogNumber(i.key)), 0);
  return `${prefix}-${max + 1}`;
}

const taskSuffix = (parentKey: string, key: string): number | null => {
  if (!key.startsWith(`${parentKey}.`)) return null;
  const n = key.slice(parentKey.length + 1);
  return /^\d+$/.test(n) ? Number(n) : null;
};

/** Tasks are numbered under their backlog item: ADV-1 → ADV-1.1, ADV-1.2, … */
export function nextTaskKey(items: WorkItem[], parent: WorkItem): string {
  const max = items.filter((i) => i.parentId === parent.id).reduce((m, t) => Math.max(m, taskSuffix(parent.key, t.key) ?? 0), 0);
  return `${parent.key}.${max + 1}`;
}

/**
 * Gives tasks that don't carry their item's key yet (older data used the project counter) a key
 * under their item, in creation order. Deterministic, so every client arrives at the same keys.
 */
export function rekeyTasks(items: WorkItem[]): WorkItem[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const next = new Map<string, number>();
  for (const t of items) {
    const parent = t.parentId ? byId.get(t.parentId) : undefined;
    const n = parent ? taskSuffix(parent.key, t.key) : null;
    if (parent && n !== null) next.set(parent.id, Math.max(next.get(parent.id) ?? 0, n));
  }
  const pending = items
    .filter((t) => t.type === 'task' && t.parentId && byId.has(t.parentId) && taskSuffix(byId.get(t.parentId)!.key, t.key) === null)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.rank - b.rank || a.id.localeCompare(b.id));
  if (!pending.length) return items;
  const keys = new Map<string, string>();
  for (const t of pending) {
    const parent = byId.get(t.parentId!)!;
    const n = (next.get(parent.id) ?? 0) + 1;
    next.set(parent.id, n);
    keys.set(t.id, `${parent.key}.${n}`);
  }
  return items.map((i) => (keys.has(i.id) ? { ...i, key: keys.get(i.id)! } : i));
}
