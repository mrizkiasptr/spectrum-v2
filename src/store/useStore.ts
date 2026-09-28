import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { addDays, diffDays, lengthInDays, todayISO } from '../domain/dates';
import { createSeed, type SeedData } from '../domain/seed';
import { nextSprintNumber, startBlocker, suggestPeriod } from '../domain/sprint';
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
  WorkItem,
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
  weight?: number | null;
  assigneeId?: string | null;
  severity?: WorkItem['severity'];
  description?: string;
}

export interface CompleteSprintInput {
  outcome: GoalOutcome;
  reviewNotes: string;
  /** Where unfinished items go. */
  carryTo: 'next' | 'backlog';
}

interface Actions {
  resetDemo: () => void;
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

  addDoc: (projectId: string, title: string, url: string) => void;
  deleteDoc: (docId: string) => void;

  addHoliday: (h: Omit<Holiday, 'id'>) => void;
  deleteHoliday: (id: string) => void;
}

export type State = SeedData & Actions;

const fresh = () => createSeed(todayISO());

function nextItemKey(items: WorkItem[], project: Project): string {
  const max = items
    .filter((i) => i.projectId === project.id)
    .reduce((m, i) => Math.max(m, Number(i.key.split('-').pop()) || 0), 0);
  return `${project.key}-${max + 1}`;
}

/** Keeps completedAt and release consistent with status changes. */
function applyStatus(item: WorkItem, status: ItemStatus): WorkItem {
  if (status === item.status) return item;
  if (status === 'done') return { ...item, status, completedAt: new Date().toISOString() };
  return { ...item, status, completedAt: null, release: 'unreleased' };
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...fresh(),

      resetDemo: () => set(fresh()),

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
        const scope = s.items.filter((i) => i.sprintId === sprintId);
        const open = scope.filter((i) => i.status !== 'done');
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
          items: st.items.map((i) =>
            i.sprintId === sprintId && i.status !== 'done' ? { ...i, sprintId: nextSprintId } : i,
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
        const status = input.status ?? 'todo';
        const item: WorkItem = {
          id: newId('i'),
          projectId,
          key: nextItemKey(s.items, project),
          type: input.type,
          title: input.title.trim(),
          description: input.description ?? '',
          status,
          weight: input.weight ?? null,
          assigneeId: input.assigneeId ?? null,
          reviewerId: null,
          dueDate: null,
          sprintId: input.sprintId,
          epic: '',
          criteria: [],
          comments: [],
          attachments: [],
          severity: input.type === 'bug' ? (input.severity ?? 'major') : null,
          release: 'unreleased',
          rank: maxRank + 1,
          createdAt: new Date().toISOString(),
          completedAt: status === 'done' ? new Date().toISOString() : null,
        };
        set((st) => ({ items: [...st.items, item] }));
        return item;
      },

      updateItem: (itemId, patch) =>
        set((s) => ({
          items: s.items.map((i) => {
            if (i.id !== itemId) return i;
            const { status, ...rest } = patch;
            const next = { ...i, ...rest };
            return status ? applyStatus(next, status) : next;
          }),
        })),

      deleteItem: (itemId) => set((s) => ({ items: s.items.filter((i) => i.id !== itemId) })),

      moveToSprint: (itemIds, sprintId) =>
        set((s) => ({ items: s.items.map((i) => (itemIds.includes(i.id) ? { ...i, sprintId } : i)) })),

      reorderBacklog: (itemId, direction) =>
        set((s) => {
          const item = s.items.find((i) => i.id === itemId);
          if (!item) return {};
          const list = s.items
            .filter((i) => i.projectId === item.projectId && i.sprintId === null && i.status !== 'done')
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
      version: 1,
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
