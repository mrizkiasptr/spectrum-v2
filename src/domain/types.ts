/** ISO calendar date, e.g. "2026-09-28". Always treated as a date without time zone. */
export type ISODate = string;

export type Tribe = 'Analyst' | 'Andromeda' | 'Phoenix' | 'Ursa Major';
export const TRIBES: Tribe[] = ['Analyst', 'Andromeda', 'Phoenix', 'Ursa Major'];

export interface Member {
  id: string;
  name: string;
  initials: string;
  role: string;
  /** Workspace fields (Supabase): sign-in email, linked auth user, admin flag. */
  email?: string | null;
  userId?: string | null;
  isAdmin?: boolean;
}

export type ProjectStatus = 'active' | 'completed';

/**
 * A board column. Teams name, color, order, and add columns freely; the category
 * tells the system what the column means for progress, burndown, and releases.
 */
export interface WorkflowStatus {
  id: string;
  name: string;
  category: ItemStatus;
  color: string;
}

export const STATUS_COLORS: { name: string; value: string }[] = [
  { name: 'Gray', value: '#6B7280' },
  { name: 'Blue', value: '#0779E4' },
  { name: 'Orange', value: '#DC6803' },
  { name: 'Purple', value: '#7C3AED' },
  { name: 'Teal', value: '#0D9488' },
  { name: 'Pink', value: '#DB2777' },
  { name: 'Green', value: '#1E9E5A' },
];

export const DEFAULT_WORKFLOW: WorkflowStatus[] = [
  { id: 'todo', name: 'Not started', category: 'todo', color: '#6B7280' },
  { id: 'in_progress', name: 'In progress', category: 'in_progress', color: '#0779E4' },
  { id: 'review', name: 'In review', category: 'review', color: '#DC6803' },
  { id: 'done', name: 'Done', category: 'done', color: '#1E9E5A' },
];

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
  /** Board columns in display order. */
  workflow: WorkflowStatus[];
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
  /** Category of the current column; drives progress, burndown, and releases. */
  status: ItemStatus;
  /** The project workflow column the item sits in. */
  statusId: string;
  /** Points. Backlog items' points drive velocity; task points are informational. */
  weight: number | null;
  /** Estimated hours of work (optional). */
  hours?: number | null;
  assigneeId: string | null;
  reviewerId: string | null;
  dueDate: ISODate | null;
  /** null = product backlog. Tasks always share their backlog item's sprint. */
  sprintId: string | null;
  /** Tasks only: the backlog item (story or bug) this task is part of. */
  parentId: string | null;
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

/** Labels for status categories (what a column counts as). */
export const STATUS_LABEL: Record<ItemStatus, string> = {
  todo: 'Not started',
  in_progress: 'In progress',
  review: 'In review',
  done: 'Done',
};

export const STATUS_ORDER: ItemStatus[] = ['todo', 'in_progress', 'review', 'done'];

/** 'story' is the stored id for a regular backlog item; the product calls it "Backlog". */
export const TYPE_LABEL: Record<ItemType, string> = { story: 'Backlog', task: 'Task', bug: 'Bug' };

export const OUTCOME_LABEL: Record<GoalOutcome, string> = {
  achieved: 'Achieved',
  partial: 'Partially achieved',
  not_achieved: 'Not achieved',
};

export const WEIGHTS = [1, 2, 3, 5, 8, 13];
