import type { ItemStatus, WorkflowStatus, WorkItem } from './types';
import { DEFAULT_WORKFLOW } from './types';

export const MAX_STATUS_NAME = 30;

export function defaultWorkflow(): WorkflowStatus[] {
  return DEFAULT_WORKFLOW.map((s) => ({ ...s }));
}

export function findStatus(workflow: WorkflowStatus[], id: string): WorkflowStatus | undefined {
  return workflow.find((s) => s.id === id);
}

/** First column with the given category, falling back to the first/last column. */
export function firstOfCategory(workflow: WorkflowStatus[], category: ItemStatus): WorkflowStatus {
  return (
    workflow.find((s) => s.category === category) ??
    (category === 'done' ? workflow[workflow.length - 1] : workflow[0])
  );
}

/** The column an item shows in, even if its stored column was removed. */
export function columnOf(workflow: WorkflowStatus[], item: Pick<WorkItem, 'status' | 'statusId'>): WorkflowStatus {
  return findStatus(workflow, item.statusId) ?? firstOfCategory(workflow, item.status);
}

export function statusIndex(workflow: WorkflowStatus[], item: Pick<WorkItem, 'status' | 'statusId'>): number {
  return workflow.indexOf(columnOf(workflow, item));
}

/**
 * Rules that keep sprints and reports working:
 * - at least two columns,
 * - at least one column that counts as Done,
 * - names are required, short, and unique.
 * Returns an error message, or null when the workflow is valid.
 */
export function validateWorkflow(workflow: WorkflowStatus[]): string | null {
  if (workflow.length < 2) return 'Keep at least two statuses.';
  if (!workflow.some((s) => s.category === 'done')) return 'Keep at least one status that counts as Done.';
  const names = new Set<string>();
  for (const s of workflow) {
    const n = s.name.trim().toLowerCase();
    if (!n) return 'Every status needs a name.';
    if (n.length > MAX_STATUS_NAME) return `Status names can be up to ${MAX_STATUS_NAME} characters.`;
    if (names.has(n)) return `There is already a status named "${s.name.trim()}".`;
    names.add(n);
  }
  return null;
}
