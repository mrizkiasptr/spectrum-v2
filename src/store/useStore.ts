import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { addDays, diffDays, lengthInDays, todayISO } from '../domain/dates';
import { createSeed, type SeedData } from '../domain/seed';
import { nextSprintNumber, startBlocker, suggestPeriod } from '../domain/sprint';
import { nextBacklogKey, nextTaskKey, normalizeItem, rekeyTasks, syncParents } from '../domain/hierarchy';
import { defaultWorkflow, findStatus, firstOfCategory, validateWorkflow } from '../domain/workflow';
import type {
  Doc,
  GoalOutcome,
  Holiday,
  ItemStatus,
  ItemType,
  Project,
  RetroItem,
  RetroKind,
  Sprint,
  WorkflowStatus,
  WorkItem,
  Member,
} from '../domain/types';

export const newId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

export interface NewProjectInput {
  name: string;
  code: string;
  key: string;
  client: string;
  description: string;
  tribe: Project['tribe'];
  startDate: string;
  endDate: string;
}

export interface NewItemInput {
  title: string;
  type: ItemType;
  sprintId: string | null;
  status?: ItemStatus;
  /** Workflow column; takes precedence over status. */
  statusId?: string;
  weight?: number | null;
  assigneeId?: string | null;
  severity?: WorkItem['severity'];
  description?: string;
  /** Required for tasks: the backlog item they belong to (they take its sprint). */
  parentId?: string | null;
  hours?: number | null;
}

export interface CompleteSprintInput {
  outcome: GoalOutcome;
  reviewNotes: string;
  /** Where unfinished items go. */
  carryTo: 'next' | 'backlog';
}

interface Actions {
  resetDemo: () => void;
  /** Make the signed-in person the current user, adding them as a member when new. */
  signInAs: (member: Member) => void;
  toggleFavorite: (projectId: string) => void;
  markOpened: (projectId: string) => void;
  createProject: (input: NewProjectInput) => string;
  updateProject: (projectId: string, patch: Partial<Project>) => void;

  createSprint: (projectId: string) => Sprint;
  updateSprint: (sprintId: string, patch: Partial<Sprint>) => void;
  startSprint: (sprintId: string) => string | null;
  completeSprint: (sprintId: string, input: CompleteSprintInput) => { carried: number; nextSprintId: string | null };
  deleteSprint: (sprintId: string) => void;

  createItem: (projectId: string, input: NewItemInput) => WorkItem;
  updateItem: (itemId: string, patch: Partial<WorkItem>) => void;
  deleteItem: (itemId: string) => void;
  moveToSprint: (itemIds: string[], sprintId: string | null) => void;
  reorderBacklog: (itemId: string, direction: -1 | 1) => void;
  addComment: (itemId: string, text: string) => void;

  addRetro: (projectId: string, sprintId: string, kind: RetroKind, text: string) => void;
  updateRetro: (retroId: string, patch: Partial<RetroItem>) => void;
  toggleVote: (retroId: string) => void;
  deleteRetro: (retroId: string) => void;

  /** Workflow editing. Each returns an error message, or null on success. */
  addStatus: (projectId: string, status: Omit<WorkflowStatus, 'id'>) => string | null;
  updateStatus: (projectId: string, statusId: string, patch: Partial<Omit<WorkflowStatus, 'id'>>) => string | null;
  deleteStatus: (projectId: string, statusId: string, moveToId: string) => string | null;
  moveStatus: (projectId: string, statusId: string, toIndex: number) => void;

  addDoc: (projectId: string, title: string, url: string) => void;
  deleteDoc: (docId: string) => void;

  addHoliday: (h: Omit<Holiday, 'id'>) => void;
  deleteHoliday: (id: string) => void;
}

export type State = SeedData & Actions;

const fresh = () => createSeed(todayISO());

function nextItemKey(items: WorkItem[], project: Project): string {
  return nextBacklogKey(items, project.id, project.key);
}

/** Keeps completedAt and release consistent with status changes. */
function applyStatus(item: WorkItem, status: ItemStatus): WorkItem {
  if (status === item.status) return item;
  if (status === 'done') return { ...item, status, completedAt: new Date().toISOString() };
  return { ...item, status, completedAt: null, release: 'unreleased' };
}

/** Moves an item to a workflow column, updating its category accordingly. */
function toColumn(item: WorkItem, column: WorkflowStatus): WorkItem {
  return applyStatus({ ...item, statusId: column.id }, column.category);
}

function workflowOf(projects: Project[], projectId: string): WorkflowStatus[] {
  return projects.find((p) => p.id === projectId)?.workflow ?? defaultWorkflow();
}

/** Keeps backlog items in step with their tasks (status, sprint) after any item change. */
function synced(projects: Project[], items: WorkItem[]): WorkItem[] {
  return syncParents(items, (pid) => workflowOf(projects, pid));
}

const LIST_KEYS = ['members', 'projects', 'sprints', 'items', 'retro', 'docs', 'holidays', 'favorites', 'recent'] as const;

/**
 * Makes persisted data safe to render, whatever version wrote it:
 * missing lists fall back to the defaults, every project gets a workflow,
 * and every item gets a workflow column. v1 had four fixed statuses.
 */
export function migrateState(persisted: unknown, _version?: number, fallback: Partial<SeedData> = {}): Partial<SeedData> {
  const src = persisted && typeof persisted === 'object' ? (persisted as Partial<SeedData>) : {};
  const st: Partial<SeedData> = { ...src };
  for (const k of LIST_KEYS) {
    if (!Array.isArray(st[k])) (st as Record<string, unknown>)[k] = fallback[k] ?? [];
  }
  st.projects = st.projects!.map((p) => ({
    ...p,
    workflow: Array.isArray(p.workflow) && p.workflow.some((w) => w.category === 'done') ? p.workflow : defaultWorkflow(),
    memberIds: Array.isArray(p.memberIds) ? p.memberIds : [],
  }));
  st.items = rekeyTasks(st.items!.map((i) =>
    normalizeItem({
      ...i,
      statusId: i.statusId ?? i.status ?? 'todo',
      status: i.status ?? 'todo',
      criteria: Array.isArray(i.criteria) ? i.criteria : [],
      comments: Array.isArray(i.comments) ? i.comments : [],
      attachments: Array.isArray(i.attachments) ? i.attachments : [],
    }),
  ));
  if (typeof st.currentUserId !== 'string') st.currentUserId = fallback.currentUserId;
  return st;
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...fresh(),

      resetDemo: () => set((s) => {
        const next = fresh();
        const me = s.members.find((m) => m.id === s.currentUserId);
        if (me && !next.members.some((m) => m.id === me.id)) next.members = [...next.members, me];
        return { ...next, currentUserId: me ? me.id : next.currentUserId };
      }),

      signInAs: (member) =>
        set((s) => ({
          members: s.members.some((m) => m.id === member.id) ? s.members.map((m) => (m.id === member.id ? member : m)) : [...s.members, member],
          currentUserId: member.id,
        })),

      toggleFavorite: (projectId) =>
        set((s) => ({
          favorites: s.favorites.includes(projectId)
            ? s.favorites.filter((f) => f !== projectId)
            : [...s.favorites, projectId],
        })),

      markOpened: (projectId) =>
        set((s) => ({ recent: [projectId, ...s.recent.filter((r) => r !== projectId)].slice(0, 5) })),

      createProject: (input) => {
        const id = newId('p');
        const project: Project = {
          id,
          ...input,
          status: 'active',
          memberIds: [get().currentUserId],
          workflow: defaultWorkflow(),
          defaultSprintDays: 14,
          countCollectiveLeave: true,
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ projects: [project, ...s.projects], favorites: [...s.favorites, id] }));
        return id;
      },

      updateProject: (projectId, patch) =>
        set((s) => ({ projects: s.projects.map((p) => (p.id === projectId ? { ...p, ...patch } : p)) })),

      createSprint: (projectId) => {
        const s = get();
        const project = s.projects.find((p) => p.id === projectId)!;
        const period = suggestPeriod(project, s.sprints, todayISO());
        const sprint: Sprint = {
          id: newId('s'),
          projectId,
          number: nextSprintNumber(s.sprints, projectId),
          goal: '',
          startDate: period.startDate,
          endDate: period.endDate,
          status: 'draft',
          goalOutcome: null,
          reviewNotes: '',
          startedAt: null,
          completedAt: null,
          closedSummary: null,
        };
        set((st) => ({ sprints: [...st.sprints, sprint] }));
        return sprint;
      },

      updateSprint: (sprintId, patch) =>
        set((s) => ({ sprints: s.sprints.map((sp) => (sp.id === sprintId ? { ...sp, ...patch } : sp)) })),

      startSprint: (sprintId) => {
        const s = get();
        const sprint = s.sprints.find((sp) => sp.id === sprintId);
        if (!sprint) return 'Sprint not found.';
        const blocker = startBlocker(sprint, s.sprints, s.items);
        if (blocker) return blocker;
        // Starting early moves the sprint to begin today, keeping its length.
        const today = todayISO();
        let dates = {};
        if (sprint.startDate && sprint.endDate && diffDays(today, sprint.startDate) > 0) {
          const len = lengthInDays(sprint.startDate, sprint.endDate);
          dates = { startDate: today, endDate: addDays(today, len - 1) };
        }
        set((st) => ({
          sprints: st.sprints.map((sp) =>
            sp.id === sprintId ? { ...sp, ...dates, status: 'active', startedAt: new Date().toISOString() } : sp,
          ),
        }));
        return null;
      },

      completeSprint: (sprintId, input) => {
        const s = get();
        const sprint = s.sprints.find((sp) => sp.id === sprintId)!;
        // Backlog items carry over with all their tasks; tasks never move on their own.
        const scope = s.items.filter((i) => i.sprintId === sprintId && i.type !== 'task');
        const open = scope.filter((i) => i.status !== 'done');
        const openIds = new Set(open.map((i) => i.id));
        let nextSprintId: string | null = null;
        let sprints = s.sprints;
        if (input.carryTo === 'next' && open.length) {
          const draft = s.sprints
            .filter((sp) => sp.projectId === sprint.projectId && sp.status === 'draft')
            .sort((a, b) => a.number - b.number)[0];
          if (draft) nextSprintId = draft.id;
          else {
            const created = get().createSprint(sprint.projectId);
            nextSprintId = created.id;
            sprints = get().sprints;
          }
        }
        const doneWeight = scope.filter((i) => i.status === 'done').reduce((t, i) => t + (i.weight ?? 0), 0);
        const totalWeight = scope.reduce((t, i) => t + (i.weight ?? 0), 0);
        set((st) => ({
          sprints: sprints.map((sp) =>
            sp.id === sprintId
              ? {
                  ...sp,
                  status: 'completed',
                  goalOutcome: input.outcome,
                  reviewNotes: input.reviewNotes,
                  completedAt: new Date().toISOString(),
                  closedSummary: { doneWeight, totalWeight, carriedOver: open.length },
                }
              : sp,
          ),
          items: synced(
            st.projects,
            st.items.map((i) => (openIds.has(i.id) ? { ...i, sprintId: nextSprintId } : i)),
          ),
        }));
        return { carried: open.length, nextSprintId };
      },

      deleteSprint: (sprintId) =>
        set((s) => ({
          sprints: s.sprints.filter((sp) => sp.id !== sprintId),
          items: s.items.map((i) => (i.sprintId === sprintId ? { ...i, sprintId: null } : i)),
        })),

      createItem: (projectId, input) => {
        const s = get();
        const project = s.projects.find((p) => p.id === projectId)!;
        const maxRank = s.items.filter((i) => i.projectId === projectId).reduce((m, i) => Math.max(m, i.rank), 0);
        const parent = input.type === 'task' ? s.items.find((i) => i.id === input.parentId && i.type !== 'task') : undefined;
        if (input.type === 'task' && !parent) throw new Error('A task needs a backlog item.');
        const column =
          (input.statusId && findStatus(project.workflow, input.statusId)) || firstOfCategory(project.workflow, input.status ?? 'todo');
        const status = column.category;
        const item: WorkItem = {
          id: newId('i'),
          projectId,
          key: parent ? nextTaskKey(s.items, parent) : nextItemKey(s.items, project),
          type: input.type,
          title: input.title.trim(),
          description: input.description ?? '',
          status,
          statusId: column.id,
          weight: input.weight ?? null,
          hours: input.hours ?? null,
          assigneeId: input.assigneeId ?? null,
          reviewerId: null,
          dueDate: null,
          sprintId: parent ? parent.sprintId : input.sprintId,
          parentId: parent?.id ?? null,
          epic: parent?.epic ?? '',
          criteria: [],
          comments: [],
          attachments: [],
          severity: input.type === 'bug' ? (input.severity ?? 'major') : null,
          release: 'unreleased',
          rank: maxRank + 1,
          createdAt: new Date().toISOString(),
          completedAt: status === 'done' ? new Date().toISOString() : null,
        };
        set((st) => ({ items: synced(st.projects, [...st.items, item]) }));
        return item;
      },

      updateItem: (itemId, patch) =>
        set((s) => ({
          items: synced(s.projects, s.items.map((i) => {
            if (i.id !== itemId) return i;
            const { status, statusId, ...rest } = patch;
            const next = { ...i, ...rest };
            const workflow = workflowOf(s.projects, i.projectId);
            if (statusId) {
              const column = findStatus(workflow, statusId);
              return column ? toColumn(next, column) : next;
            }
            if (status && status !== i.status) return toColumn(next, firstOfCategory(workflow, status));
            return next;
          })),
        })),

      // Deleting a backlog item deletes its tasks.
      deleteItem: (itemId) =>
        set((s) => ({ items: synced(s.projects, s.items.filter((i) => i.id !== itemId && i.parentId !== itemId)) })),

      // Moving a backlog item moves its tasks with it.
      moveToSprint: (itemIds, sprintId) =>
        set((s) => ({ items: synced(s.projects, s.items.map((i) => (itemIds.includes(i.id) ? { ...i, sprintId } : i))) })),

      reorderBacklog: (itemId, direction) =>
        set((s) => {
          const item = s.items.find((i) => i.id === itemId);
          if (!item) return {};
          const list = s.items
            .filter((i) => i.projectId === item.projectId && i.sprintId === null && i.status !== 'done' && i.type !== 'task')
            .sort((a, b) => a.rank - b.rank);
          const idx = list.findIndex((i) => i.id === itemId);
          const swap = list[idx + direction];
          if (!swap) return {};
          return {
            items: s.items.map((i) =>
              i.id === item.id ? { ...i, rank: swap.rank } : i.id === swap.id ? { ...i, rank: item.rank } : i,
            ),
          };
        }),

      addComment: (itemId, text) =>
        set((s) => ({
          items: s.items.map((i) =>
            i.id === itemId
              ? {
                  ...i,
                  comments: [
                    ...i.comments,
                    { id: newId('cm'), authorId: s.currentUserId, text: text.trim(), at: new Date().toISOString() },
                  ],
                }
              : i,
          ),
        })),

      addRetro: (projectId, sprintId, kind, text) =>
        set((s) => ({
          retro: [
            ...s.retro,
            {
              id: newId('r'),
              projectId,
              sprintId,
              kind,
              text: text.trim(),
              authorId: s.currentUserId,
              votes: [],
              ownerId: kind === 'action' ? s.currentUserId : null,
              done: false,
              createdAt: new Date().toISOString(),
            },
          ],
        })),

      updateRetro: (retroId, patch) =>
        set((s) => ({ retro: s.retro.map((r) => (r.id === retroId ? { ...r, ...patch } : r)) })),

      toggleVote: (retroId) =>
        set((s) => ({
          retro: s.retro.map((r) =>
            r.id === retroId
              ? {
                  ...r,
                  votes: r.votes.includes(s.currentUserId)
                    ? r.votes.filter((v) => v !== s.currentUserId)
                    : [...r.votes, s.currentUserId],
                }
              : r,
          ),
        })),

      deleteRetro: (retroId) => set((s) => ({ retro: s.retro.filter((r) => r.id !== retroId) })),

      addStatus: (projectId, status) => {
        const workflow = workflowOf(get().projects, projectId);
        const column: WorkflowStatus = { ...status, name: status.name.trim(), id: newId('st') };
        // New columns land before the first Done column unless they are Done themselves.
        const doneAt = workflow.findIndex((w) => w.category === 'done');
        const at = column.category === 'done' || doneAt < 0 ? workflow.length : doneAt;
        const next = [...workflow.slice(0, at), column, ...workflow.slice(at)];
        const error = validateWorkflow(next);
        if (error) return error;
        get().updateProject(projectId, { workflow: next });
        return null;
      },

      updateStatus: (projectId, statusId, patch) => {
        const workflow = workflowOf(get().projects, projectId);
        const current = findStatus(workflow, statusId);
        if (!current) return 'Status not found.';
        const updated = { ...current, ...patch, name: (patch.name ?? current.name).trim() };
        const next = workflow.map((w) => (w.id === statusId ? updated : w));
        const error = validateWorkflow(next);
        if (error) return error;
        set((s) => ({
          projects: s.projects.map((p) => (p.id === projectId ? { ...p, workflow: next } : p)),
          items:
            updated.category === current.category
              ? s.items
              : synced(s.projects, s.items.map((i) => (i.projectId === projectId && i.statusId === statusId ? toColumn(i, updated) : i))),
        }));
        return null;
      },

      deleteStatus: (projectId, statusId, moveToId) => {
        const workflow = workflowOf(get().projects, projectId);
        const target = findStatus(workflow, moveToId);
        if (!target || moveToId === statusId) return 'Choose another status for its tasks.';
        const next = workflow.filter((w) => w.id !== statusId);
        const error = validateWorkflow(next);
        if (error) return error;
        set((s) => ({
          projects: s.projects.map((p) => (p.id === projectId ? { ...p, workflow: next } : p)),
          items: synced(s.projects, s.items.map((i) => (i.projectId === projectId && i.statusId === statusId ? toColumn(i, target) : i))),
        }));
        return null;
      },

      moveStatus: (projectId, statusId, toIndex) => {
        const workflow = workflowOf(get().projects, projectId);
        const from = workflow.findIndex((w) => w.id === statusId);
        if (from < 0 || toIndex < 0 || toIndex >= workflow.length || from === toIndex) return;
        const next = [...workflow];
        const [moved] = next.splice(from, 1);
        next.splice(toIndex, 0, moved);
        get().updateProject(projectId, { workflow: next });
      },

      addDoc: (projectId, title, url) =>
        set((s) => ({
          docs: [
            { id: newId('d'), projectId, title: title.trim(), url: url.trim(), addedBy: s.currentUserId, updatedAt: new Date().toISOString() } as Doc,
            ...s.docs,
          ],
        })),

      deleteDoc: (docId) => set((s) => ({ docs: s.docs.filter((d) => d.id !== docId) })),

      addHoliday: (h) =>
        set((s) => ({ holidays: [...s.holidays, { ...h, id: newId('h') }].sort((a, b) => a.date.localeCompare(b.date)) })),

      deleteHoliday: (id) => set((s) => ({ holidays: s.holidays.filter((h) => h.id !== id) })),
    }),
    {
      name: 'spectrum-v2',
      version: 2,
      migrate: (persisted, version) => migrateState(persisted, version) as State,
      // Normalize on every load, not only on version bumps, so old or partial data never blanks the app.
      merge: (persisted, current) => ({ ...current, ...migrateState(persisted, 2, current) }),
      partialize: (s) => ({
        currentUserId: s.currentUserId,
        members: s.members,
        projects: s.projects,
        sprints: s.sprints,
        items: s.items,
        retro: s.retro,
        docs: s.docs,
        holidays: s.holidays,
        favorites: s.favorites,
        recent: s.recent,
      }),
    },
  ),
);

/** Convenience selectors. */
export const useMember = (id: string | null) => useStore((s) => (id ? s.members.find((m) => m.id === id) ?? null : null));
