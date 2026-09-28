/** ISO calendar date, e.g. "2026-09-28". Always treated as a date without time zone. */
export type ISODate = string;

export type Tribe = 'Analyst' | 'Andromeda' | 'Phoenix' | 'Ursa Major';
export const TRIBES: Tribe[] = ['Analyst', 'Andromeda', 'Phoenix', 'Ursa Major'];

export interface Member {
  id: string;
  name: string;
  initials: string;
  role: string;
}

export type ProjectStatus = 'active' | 'completed';

export interface Project {
  id: string;
  /** Prefix for work item keys, e.g. "ANL" → ANL-118. */
  key: string;
  /** Short code shown on the project tile, e.g. "AT". Unique across projects. */
  code: string;
  name: string;
  client: string;
  description: string;
  tribe: Tribe;
  status: ProjectStatus;
  startDate: ISODate;
  endDate: ISODate;
  memberIds: string[];
  /** Default length for new sprints, in calendar days. */
  defaultSprintDays: number;
  /** Whether collective leave (cuti bersama) is excluded from working days. */
  countCollectiveLeave: boolean;
  createdAt: string;
}

export type SprintStatus = 'draft' | 'active' | 'completed';
export type GoalOutcome = 'achieved' | 'partial' | 'not_achieved';

export interface Sprint {
  id: string;
  projectId: string;
  /** Auto-incremented per project, never reset. Display name is "Sprint {number}". */
  number: number;
  goal: string;
  startDate: ISODate | null;
  endDate: ISODate | null;
  status: SprintStatus;
  goalOutcome: GoalOutcome | null;
  reviewNotes: string;
  startedAt: string | null;
  completedAt: string | null;
  /** Snapshot taken when the sprint closes. */
  closedSummary: { doneWeight: number; totalWeight: number; carriedOver: number } | null;
}

export type ItemType = 'story' | 'task' | 'bug';
export type ItemStatus = 'todo' | 'in_progress' | 'review' | 'done';
export type Severity = 'critical' | 'major' | 'minor';
export type ReleaseState = 'unreleased' | 'partial' | 'released';

export interface Criterion {
  id: string;
  text: string;
  done: boolean;
}

export interface Comment {
  id: string;
  authorId: string;
  text: string;
  at: string;
}

export interface WorkItem {
  id: string;
  projectId: string;
  /** Human key, e.g. "ANL-118". */
  key: string;
  type: ItemType;
  title: string;
  description: string;
  status: ItemStatus;
  weight: number | null;
  assigneeId: string | null;
  reviewerId: string | null;
  dueDate: ISODate | null;
  /** null = product backlog. */
  sprintId: string | null;
  epic: string;
  criteria: Criterion[];
  comments: Comment[];
  attachments: string[];
  severity: Severity | null;
  release: ReleaseState;
  /** Backlog ordering (lower = higher priority). */
  rank: number;
  createdAt: string;
  completedAt: string | null;
}

export type RetroKind = 'well' | 'improve' | 'action';

export interface RetroItem {
  id: string;
  projectId: string;
  sprintId: string;
  kind: RetroKind;
  text: string;
  authorId: string;
  votes: string[];
  ownerId: string | null;
  done: boolean;
  createdAt: string;
}

export interface Doc {
  id: string;
  projectId: string;
  title: string;
  url: string;
  addedBy: string;
  updatedAt: string;
}

export type HolidayKind = 'public' | 'collective';

export interface Holiday {
  id: string;
  date: ISODate;
  name: string;
  kind: HolidayKind;
}

export const STATUS_LABEL: Record<ItemStatus, string> = {
  todo: 'Not started',
  in_progress: 'In progress',
  review: 'In review',
  done: 'Done',
};

export const STATUS_ORDER: ItemStatus[] = ['todo', 'in_progress', 'review', 'done'];

export const TYPE_LABEL: Record<ItemType, string> = { story: 'Story', task: 'Task', bug: 'Bug' };

export const OUTCOME_LABEL: Record<GoalOutcome, string> = {
  achieved: 'Achieved',
  partial: 'Partially achieved',
  not_achieved: 'Not achieved',
};

export const WEIGHTS = [1, 2, 3, 5, 8, 13];
