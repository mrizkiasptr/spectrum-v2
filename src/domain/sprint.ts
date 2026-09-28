import { addDays, diffDays, fmtDate, holidaysFor, isWeekend, lengthInDays, workingDays, workingDaysLeft } from './dates';
import type { Holiday, ISODate, ItemStatus, Project, Sprint, WorkItem } from './types';

export const MAX_GOAL_LENGTH = 120;
export const RECOMMENDED_SPRINT_DAYS = 14;
export const SPRINT_LENGTH_PRESETS = [7, 14, 21, 28];

export function sprintName(s: Pick<Sprint, 'number'>): string {
  return `Sprint ${s.number}`;
}

export function itemWeight(i: Pick<WorkItem, 'weight'>): number {
  return i.weight ?? 0;
}

export interface Progress {
  total: number;
  done: number;
  pct: number;
  byStatus: Record<ItemStatus, number>;
  totalWeight: number;
  doneWeight: number;
}

export function progressOf(items: WorkItem[]): Progress {
  const byStatus: Record<ItemStatus, number> = { todo: 0, in_progress: 0, review: 0, done: 0 };
  let totalWeight = 0;
  let doneWeight = 0;
  for (const i of items) {
    byStatus[i.status]++;
    totalWeight += itemWeight(i);
    if (i.status === 'done') doneWeight += itemWeight(i);
  }
  const total = items.length;
  const done = byStatus.done;
  return { total, done, pct: total ? Math.round((done / total) * 100) : 0, byStatus, totalWeight, doneWeight };
}

export interface PeriodCheck {
  errors: string[];
  warnings: string[];
}

/**
 * Validates a sprint period. Errors block saving; warnings are advisory only
 * (teams are free to pick any length, but >1 month and non-working start days get flagged).
 */
export function checkPeriod(
  start: ISODate,
  end: ISODate,
  others: Sprint[],
  holidays: Map<ISODate, Holiday>,
): PeriodCheck {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!start || !end) {
    errors.push('Choose a start and end date.');
    return { errors, warnings };
  }
  if (diffDays(start, end) < 0) {
    errors.push('End date must be on or after the start date.');
    return { errors, warnings };
  }
  for (const o of others) {
    if (!o.startDate || !o.endDate) continue;
    const overlaps = diffDays(o.startDate, end) >= 0 && diffDays(start, o.endDate) >= 0;
    if (overlaps) {
      errors.push(
        `Overlaps with ${sprintName(o)} (${fmtDate(o.startDate)} – ${fmtDate(o.endDate)}). Start on ${fmtDate(addDays(o.endDate, 1))} or later.`,
      );
    }
  }
  const h = holidays.get(start);
  if (h) {
    warnings.push(`The start date is a holiday (${h.name}). Sprint Planning usually happens on day one, so consider the next working day.`);
  } else if (isWeekend(start)) {
    warnings.push('The start date falls on a weekend. Sprint Planning usually happens on day one, so consider the next working day.');
  }
  const len = lengthInDays(start, end);
  if (len > 31) {
    warnings.push(
      `A ${len}-day sprint is longer than one month. You can still save it, but long sprints blur the goal and delay feedback. Consider splitting it.`,
    );
  }
  return { errors, warnings };
}

export interface ReadinessCheck {
  key: 'goal' | 'dates' | 'items';
  label: string;
  ok: boolean;
}

export function readiness(sprint: Sprint, items: WorkItem[]): { ready: boolean; checks: ReadinessCheck[] } {
  const checks: ReadinessCheck[] = [
    { key: 'goal', label: 'Sprint goal', ok: sprint.goal.trim().length > 0 },
    { key: 'dates', label: 'Dates', ok: !!sprint.startDate && !!sprint.endDate },
    { key: 'items', label: 'At least 1 task', ok: items.some((i) => i.sprintId === sprint.id) },
  ];
  return { ready: checks.every((c) => c.ok), checks };
}

export function startBlocker(sprint: Sprint, sprints: Sprint[], items: WorkItem[]): string | null {
  if (sprint.status !== 'draft') return 'Only draft sprints can be started.';
  const active = sprints.find((s) => s.projectId === sprint.projectId && s.status === 'active');
  if (active) return `Complete ${sprintName(active)} before starting another sprint.`;
  const r = readiness(sprint, items);
  if (!r.ready) {
    const missing = r.checks.filter((c) => !c.ok).map((c) => c.label.toLowerCase());
    return `Missing: ${missing.join(', ')}.`;
  }
  return null;
}

export function nextSprintNumber(sprints: Sprint[], projectId: string): number {
  return sprints.filter((s) => s.projectId === projectId).reduce((m, s) => Math.max(m, s.number), 0) + 1;
}

/** Suggested dates for a new sprint: the day after the latest sprint ends (never in the past). */
export function suggestPeriod(
  project: Pick<Project, 'id' | 'defaultSprintDays'>,
  sprints: Sprint[],
  today: ISODate,
): { startDate: ISODate; endDate: ISODate } {
  const ends = sprints
    .filter((s) => s.projectId === project.id && s.endDate)
    .map((s) => s.endDate as ISODate)
    .sort();
  const last = ends[ends.length - 1];
  let start = last ? addDays(last, 1) : today;
  if (diffDays(today, start) < 0) start = today;
  return { startDate: start, endDate: addDays(start, project.defaultSprintDays - 1) };
}

export interface BurndownPoint {
  date: ISODate;
  ideal: number;
  remaining: number | null;
}

/** Remaining weight per calendar day. Future days have remaining = null. */
export function burndown(sprint: Sprint, items: WorkItem[], today: ISODate): BurndownPoint[] {
  if (!sprint.startDate || !sprint.endDate) return [];
  const len = lengthInDays(sprint.startDate, sprint.endDate);
  const scope = items.filter((i) => i.sprintId === sprint.id);
  const total = scope.reduce((s, i) => s + Math.max(itemWeight(i), 1), 0);
  const points: BurndownPoint[] = [];
  for (let d = 0; d < len; d++) {
    const date = addDays(sprint.startDate, d);
    const ideal = len === 1 ? 0 : Math.round((total - (total * d) / (len - 1)) * 10) / 10;
    const inFuture = diffDays(today, date) > 0 && sprint.status !== 'completed';
    let remaining: number | null = null;
    if (!inFuture) {
      const burned = scope
        .filter((i) => i.completedAt && i.completedAt.slice(0, 10) <= date)
        .reduce((s, i) => s + Math.max(itemWeight(i), 1), 0);
      remaining = total - burned;
    }
    points.push({ date, ideal, remaining });
  }
  return points;
}

export interface Attention {
  id: string;
  tone: 'warning' | 'info' | 'danger';
  title: string;
  body: string;
  action: { label: string; to: string };
}

/** Actionable issues for the project overview. Every item carries a next step. */
export function attentionFor(
  project: Project,
  sprints: Sprint[],
  items: WorkItem[],
  holidayList: Holiday[],
  today: ISODate,
): Attention[] {
  const out: Attention[] = [];
  const base = `/projects/${project.id}`;
  const holidays = holidaysFor(holidayList, project.countCollectiveLeave);
  const mine = sprints.filter((s) => s.projectId === project.id);
  const active = mine.find((s) => s.status === 'active');
  const drafts = mine.filter((s) => s.status === 'draft').sort((a, b) => a.number - b.number);

  if (project.status === 'active' && diffDays(project.endDate, today) > 0) {
    out.push({
      id: 'project-end',
      tone: 'warning',
      title: 'Project end date has passed',
      body: `Ended ${fmtDate(project.endDate)}. Extend it or mark the project as completed.`,
      action: { label: 'Update project', to: `${base}/settings` },
    });
  }

  if (active?.endDate) {
    const open = items.filter((i) => i.sprintId === active.id && i.status !== 'done').length;
    const left = workingDaysLeft(today, active.endDate, holidays);
    if (diffDays(active.endDate, today) > 0) {
      out.push({
        id: 'sprint-overdue',
        tone: 'danger',
        title: `${sprintName(active)} ended ${fmtDate(active.endDate)}`,
        body: `${open} task${open === 1 ? '' : 's'} still open. Complete the sprint to record the outcome.`,
        action: { label: 'Complete sprint', to: `${base}/sprints/${active.id}?complete=1` },
      });
    } else if (left <= 3 && open > 0) {
      out.push({
        id: 'sprint-open',
        tone: 'info',
        title: `${open} task${open === 1 ? '' : 's'} still open`,
        body: `Decide before ${fmtDate(active.endDate)}: carry over to the next sprint or move back to the backlog.`,
        action: { label: 'Review tasks', to: `${base}/sprints/${active.id}` },
      });
    }
  }

  const nextDraft = drafts[0];
  if (nextDraft) {
    const r = readiness(nextDraft, items);
    if (!r.ready) {
      const missing = r.checks.filter((c) => !c.ok).map((c) => c.label.toLowerCase());
      out.push({
        id: `draft-${nextDraft.id}`,
        tone: 'warning',
        title: `${sprintName(nextDraft)} isn't ready to start`,
        body: `Missing ${missing.join(', ')}.`,
        action: { label: 'Set up sprint', to: `${base}/sprints?setup=${nextDraft.id}` },
      });
    }
  } else if (active && project.status === 'active') {
    out.push({
      id: 'no-next',
      tone: 'info',
      title: 'No next sprint planned',
      body: 'Plan the next sprint before this one ends so the team can start without a gap.',
      action: { label: 'Plan sprint', to: `${base}/sprints?new=1` },
    });
  }

  const critical = items.filter(
    (i) => i.projectId === project.id && i.type === 'bug' && i.severity === 'critical' && i.status !== 'done',
  ).length;
  if (critical) {
    out.push({
      id: 'critical',
      tone: 'danger',
      title: `${critical} critical defect${critical === 1 ? '' : 's'} open`,
      body: 'Critical defects should be triaged into the current sprint.',
      action: { label: 'View defects', to: `${base}/defects` },
    });
  }

  const unestimated = items.filter(
    (i) => i.projectId === project.id && i.sprintId === null && i.status !== 'done' && i.weight === null,
  ).length;
  if (unestimated) {
    out.push({
      id: 'unestimated',
      tone: 'info',
      title: `${unestimated} backlog item${unestimated === 1 ? '' : 's'} without weight`,
      body: 'Estimate them during refinement so they can be planned into a sprint.',
      action: { label: 'Open backlog', to: `${base}/backlog` },
    });
  }
  return out;
}

/** Backlog items are "sprint-ready" when they have a weight and at least one acceptance criterion. */
export function isSprintReady(i: WorkItem): boolean {
  return i.weight !== null && i.criteria.length > 0;
}

export function sprintDaysLabel(sprint: Sprint, today: ISODate, holidayList: Holiday[], countCollective: boolean): string {
  if (!sprint.startDate || !sprint.endDate) return 'Dates not set';
  const holidays = holidaysFor(holidayList, countCollective);
  if (sprint.status === 'completed') return `Closed ${fmtDate(sprint.completedAt?.slice(0, 10) ?? sprint.endDate)}`;
  if (diffDays(today, sprint.startDate) > 0) return `Starts ${fmtDate(sprint.startDate)}`;
  if (diffDays(sprint.endDate, today) > 0) return `Ended ${fmtDate(sprint.endDate)}`;
  const left = workingDaysLeft(today, sprint.endDate, holidays);
  return `${left} working day${left === 1 ? '' : 's'} left`;
}

export function periodSummary(start: ISODate, end: ISODate, holidays: Map<ISODate, Holiday>) {
  return workingDays(start, end, holidays);
}
