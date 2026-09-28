import { diffDays, holidaysFor, workingDays } from './dates';
import { progressOf, type Progress } from './sprint';
import type { Holiday, ISODate, ItemStatus, Member, Project, Sprint, WorkItem } from './types';

/** Project health, from the active sprint's progress against its elapsed working time. */
export type Health = 'on_track' | 'at_risk' | 'off_track' | 'no_sprint' | 'completed';

export const HEALTH_LABEL: Record<Health, string> = {
  on_track: 'On track',
  at_risk: 'At risk',
  off_track: 'Off track',
  no_sprint: 'No active sprint',
  completed: 'Completed',
};

/** Worst first, for sorting and roll-ups. */
export const HEALTH_ORDER: Health[] = ['off_track', 'at_risk', 'no_sprint', 'on_track', 'completed'];

/** Progress may trail elapsed time by this many points and still be on track. */
export const ON_TRACK_TOLERANCE = 10;
export const AT_RISK_TOLERANCE = 25;

export interface ProjectInsight {
  project: Project;
  activeSprint: Sprint | null;
  progress: Progress;
  /** Share of work done in the active sprint (by weight when estimated, else by task count). */
  progressPct: number;
  /** Share of the active sprint's working days already elapsed. */
  timePct: number;
  health: Health;
  risks: string[];
  overdue: WorkItem[];
  openDefects: number;
  criticalDefects: number;
  /** Delivered weight of the last completed sprints, oldest first. */
  velocity: { sprint: Sprint; weight: number }[];
  avgVelocity: number | null;
  goals: { achieved: number; closed: number };
  byStatus: Record<ItemStatus, number>;
}

export function sprintTimePct(sprint: Sprint, today: ISODate, holidays: Map<ISODate, Holiday>): number {
  if (!sprint.startDate || !sprint.endDate) return 0;
  if (diffDays(today, sprint.startDate) > 0) return 0;
  if (diffDays(sprint.endDate, today) > 0) return 100;
  const total = workingDays(sprint.startDate, sprint.endDate, holidays).workingDays;
  if (!total) return 100;
  const elapsed = workingDays(sprint.startDate, today, holidays).workingDays;
  return Math.min(100, Math.round((elapsed / total) * 100));
}

export function projectInsight(
  project: Project,
  sprints: Sprint[],
  items: WorkItem[],
  holidayList: Holiday[],
  today: ISODate,
): ProjectInsight {
  const holidays = holidaysFor(holidayList, project.countCollectiveLeave);
  const mine = items.filter((i) => i.projectId === project.id);
  const projectSprints = sprints.filter((s) => s.projectId === project.id);
  const activeSprint = projectSprints.find((s) => s.status === 'active') ?? null;
  const scope = activeSprint ? mine.filter((i) => i.sprintId === activeSprint.id) : [];
  const progress = progressOf(scope);
  const progressPct = progress.totalWeight > 0 ? Math.round((progress.doneWeight / progress.totalWeight) * 100) : progress.pct;
  const timePct = activeSprint ? sprintTimePct(activeSprint, today, holidays) : 0;

  const overdue = mine.filter((i) => i.status !== 'done' && i.dueDate && diffDays(i.dueDate, today) > 0 && i.sprintId !== null);
  const bugs = mine.filter((i) => i.type === 'bug' && i.status !== 'done');
  const criticalDefects = bugs.filter((b) => b.severity === 'critical').length;

  const completed = projectSprints
    .filter((s) => s.status === 'completed')
    .sort((a, b) => a.number - b.number);
  const velocity = completed.slice(-5).map((s) => ({ sprint: s, weight: s.closedSummary?.doneWeight ?? 0 }));
  const avgVelocity = velocity.length ? Math.round(velocity.reduce((t, v) => t + v.weight, 0) / velocity.length) : null;
  const goals = { achieved: completed.filter((s) => s.goalOutcome === 'achieved').length, closed: completed.length };

  const risks: string[] = [];
  let health: Health;
  if (project.status === 'completed') health = 'completed';
  else if (!activeSprint) health = 'no_sprint';
  else {
    const gap = timePct - progressPct;
    const ended = activeSprint.endDate ? diffDays(activeSprint.endDate, today) > 0 : false;
    if (ended) {
      health = 'off_track';
      risks.push('Sprint end date has passed');
    } else if (gap > AT_RISK_TOLERANCE) health = 'off_track';
    else if (gap > ON_TRACK_TOLERANCE) health = 'at_risk';
    else health = 'on_track';
    if (!ended && gap > ON_TRACK_TOLERANCE) risks.push(`${gap} pts behind the sprint timeline`);
    if (criticalDefects && health === 'on_track') health = 'at_risk';
  }
  if (overdue.length) risks.push(`${overdue.length} overdue task${overdue.length === 1 ? '' : 's'}`);
  if (criticalDefects) risks.push(`${criticalDefects} critical defect${criticalDefects === 1 ? '' : 's'} open`);
  if (project.status === 'active' && diffDays(project.endDate, today) > 0) risks.push('Project end date has passed');
  if (project.status === 'active' && !activeSprint) risks.push('No sprint running');

  return {
    project,
    activeSprint,
    progress,
    progressPct,
    timePct,
    health,
    risks,
    overdue,
    openDefects: bugs.length,
    criticalDefects,
    velocity,
    avgVelocity,
    goals,
    byStatus: progress.byStatus,
  };
}

export interface GroupSummary {
  projects: number;
  activeSprints: number;
  health: Record<Health, number>;
  tasksDone: number;
  tasksTotal: number;
  weightDone: number;
  weightTotal: number;
  overdue: number;
  openDefects: number;
  criticalDefects: number;
}

export function summarize(insights: ProjectInsight[]): GroupSummary {
  const health = { on_track: 0, at_risk: 0, off_track: 0, no_sprint: 0, completed: 0 } as Record<Health, number>;
  const s: GroupSummary = {
    projects: insights.length, activeSprints: 0, health, tasksDone: 0, tasksTotal: 0, weightDone: 0, weightTotal: 0,
    overdue: 0, openDefects: 0, criticalDefects: 0,
  };
  for (const i of insights) {
    health[i.health]++;
    if (i.activeSprint) s.activeSprints++;
    s.tasksDone += i.progress.done;
    s.tasksTotal += i.progress.total;
    s.weightDone += i.progress.doneWeight;
    s.weightTotal += i.progress.totalWeight;
    s.overdue += i.overdue.length;
    s.openDefects += i.openDefects;
    s.criticalDefects += i.criticalDefects;
  }
  return s;
}

export interface Workload {
  member: Member | null;
  openTasks: number;
  openWeight: number;
  doneWeight: number;
}

/** Work per person in the given sprint scope, most open weight first. */
export function workloadOf(scope: WorkItem[], members: Member[]): Workload[] {
  const map = new Map<string, Workload>();
  for (const i of scope) {
    const key = i.assigneeId ?? '';
    const w = map.get(key) ?? { member: members.find((m) => m.id === i.assigneeId) ?? null, openTasks: 0, openWeight: 0, doneWeight: 0 };
    if (i.status === 'done') w.doneWeight += i.weight ?? 0;
    else {
      w.openTasks++;
      w.openWeight += i.weight ?? 0;
    }
    map.set(key, w);
  }
  return [...map.values()].sort((a, b) => b.openWeight - a.openWeight || b.openTasks - a.openTasks);
}
