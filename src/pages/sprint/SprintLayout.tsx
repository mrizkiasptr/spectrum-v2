import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import { Topbar } from '../../components/AppShell';
import { Icon, type IconName } from '../../components/Icon';
import { toast } from '../../components/toast';
import { OutcomeBadge, Progress, SprintStatusBadge } from '../../components/ui';
import { fmtRange } from '../../domain/dates';
import { progressOf, sprintDaysLabel, sprintName, startBlocker } from '../../domain/sprint';
import type { Project, Sprint } from '../../domain/types';
import { CompleteSprintDialog } from '../../features/dialogs';
import { SprintSetupDialog } from '../../features/SprintSetupDialog';
import { useProject, useToday } from '../../store/hooks';
import { useStore } from '../../store/useStore';
import { NotFound } from '../misc';
import { tribePath } from '../TribePage';

export interface SprintCtx {
  project: Project;
  sprint: Sprint;
}
export const useSprintCtx = () => useOutletContext<SprintCtx>();

const TABS: { to: string; label: string; icon: IconName }[] = [
  { to: '', label: 'Board', icon: 'kanban' },
  { to: 'list', label: 'Task list', icon: 'list' },
  { to: 'report', label: 'Report', icon: 'chart' },
  { to: 'review', label: 'Review', icon: 'target' },
  { to: 'retro', label: 'Retro', icon: 'message' },
];

export function SprintLayout() {
  const { projectId, sprintId } = useParams();
  const project = useProject(projectId);
  const sprint = useStore((s) => s.sprints.find((x) => x.id === sprintId && x.projectId === projectId) ?? null);
  const allItems = useStore((s) => s.items);
  const allSprints = useStore((s) => s.sprints);
  const holidays = useStore((s) => s.holidays);
  const startSprint = useStore((s) => s.startSprint);
  const markOpened = useStore((s) => s.markOpened);
  const today = useToday();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState(false);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    if (params.get('complete') === '1') {
      setCompleting(true);
      const next = new URLSearchParams(params);
      next.delete('complete');
      setParams(next, { replace: true });
    }
  }, [params, setParams]);

  useEffect(() => {
    if (projectId && project) markOpened(projectId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, !!project]);

  if (!project || !sprint) return <NotFound what="sprint" />;

  const items = allItems.filter((i) => i.sprintId === sprint.id);
  const p = progressOf(items);
  const base = `/projects/${project.id}/sprints/${sprint.id}`;
  const section = TABS.find((t) => t.to && location.pathname.endsWith(`/${t.to}`));
  const blocker = sprint.status === 'draft' ? startBlocker(sprint, allSprints, allItems) : null;

  return (
    <>
      <Topbar
        crumbs={[
          { label: 'Project Board', to: '/projects' },
          { label: `Tribe ${project.tribe}`, to: tribePath(project.tribe) },
          { label: project.name, to: `/projects/${project.id}` },
          { label: 'Sprints', to: `/projects/${project.id}/sprints` },
          { label: sprintName(sprint), to: base },
          ...(section ? [{ label: section.label }] : []),
        ]}
      />
      <div className="content">
        <div className="project-head" style={{ paddingTop: 18, gap: 12 }}>
          <div className="row" style={{ alignItems: 'flex-start', gap: 20 }}>
            <div className="col grow" style={{ gap: 6 }}>
              <div className="row wrap">
                <h1 style={{ fontSize: 22, fontWeight: 700 }}>{sprintName(sprint)}</h1>
                <SprintStatusBadge status={sprint.status} />
                {sprint.goalOutcome && <OutcomeBadge outcome={sprint.goalOutcome} />}
                <span className="muted num" style={{ fontSize: 13 }}>
                  {fmtRange(sprint.startDate, sprint.endDate)}
                  {sprint.startDate && (
                    <>
                      {' · '}
                      <strong style={{ color: 'var(--text)', fontWeight: 600 }}>{sprintDaysLabel(sprint, today, holidays, project.countCollectiveLeave)}</strong>
                    </>
                  )}
                </span>
              </div>
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <Icon name="target" size={16} color="var(--primary-darker)" style={{ marginTop: 2 }} />
                <span className="muted">Goal:</span>
                {sprint.goal ? (
                  <span style={{ fontWeight: 600 }}>{sprint.goal}</span>
                ) : (
                  <button type="button" className="btn-link" onClick={() => setEditing(true)}>Add a sprint goal</button>
                )}
              </div>
            </div>
            <div className="col" style={{ width: 200, gap: 6, paddingTop: 4 }}>
              <div className="row num" style={{ justifyContent: 'space-between', fontSize: 12 }}>
                <span className="muted">{p.done} / {p.total} tasks</span>
                <strong>{p.pct}%</strong>
              </div>
              <Progress pct={p.pct} label="Sprint progress" />
            </div>
            {sprint.status !== 'completed' && (
              <button type="button" className="btn btn-secondary btn-md" onClick={() => setEditing(true)}>
                <Icon name="pen" size={16} /> Edit
              </button>
            )}
            {sprint.status === 'active' && (
              <button type="button" className="btn btn-secondary btn-md" onClick={() => setCompleting(true)}>Complete sprint</button>
            )}
            {sprint.status === 'draft' && (
              <button
                type="button"
                className="btn btn-primary btn-md"
                disabled={!!blocker}
                title={blocker ?? undefined}
                onClick={() => {
                  const err = startSprint(sprint.id);
                  toast(err ?? `${sprintName(sprint)} started.`);
                }}
              >
                Start sprint
              </button>
            )}
          </div>
          {sprint.status === 'draft' && blocker && (
            <div className="alert warning" style={{ marginBottom: 4 }}>
              <Icon name="info" size={16} color="var(--warning-text)" style={{ marginTop: 2 }} />
              <span>This sprint is a draft. {blocker}</span>
            </div>
          )}
          <nav aria-label="Sprint sections" className="tabs">
            {TABS.map((t) => (
              <NavLink key={t.label} to={t.to ? `${base}/${t.to}` : base} end className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}>
                <Icon name={t.icon} size={16} />
                {t.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <Outlet context={{ project, sprint } satisfies SprintCtx} />
      </div>
      {editing && <SprintSetupDialog sprint={sprint} onClose={() => setEditing(false)} />}
      {completing && sprint.status === 'active' && <CompleteSprintDialog sprint={sprint} onClose={() => setCompleting(false)} />}
    </>
  );
}
