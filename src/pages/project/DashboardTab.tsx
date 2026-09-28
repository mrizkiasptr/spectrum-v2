import { useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { BarChart, HealthBadge, ProgressVsTime, StatTile, StatusLegend, StatusMiniBar } from '../../components/charts';
import { Icon } from '../../components/Icon';
import { Avatar, ColumnIcon, Empty, ItemStatusBadge, OutcomeBadge, SprintStatusBadge } from '../../components/ui';
import { fmtDue, fmtRange } from '../../domain/dates';
import { projectInsight, workloadOf } from '../../domain/insights';
import { attentionFor, isSprintReady, progressOf, sprintDaysLabel, sprintName } from '../../domain/sprint';
import type { Sprint } from '../../domain/types';
import { columnOf } from '../../domain/workflow';
import { tribePath } from '../TribePage';
import { useToday } from '../../store/hooks';
import { useStore } from '../../store/useStore';
import { useProjectCtx } from './ProjectLayout';

/** Project landing page: health, the running sprint, every sprint in the project, delivery trend, workload, and what is late. */
export function DashboardTab() {
  const { project } = useProjectCtx();
  const sprints = useStore((s) => s.sprints);
  const items = useStore((s) => s.items);
  const members = useStore((s) => s.members);
  const holidays = useStore((s) => s.holidays);
  const today = useToday();
  const [, setParams] = useSearchParams();
  const navigate = useNavigate();

  const insight = useMemo(() => projectInsight(project, sprints, items, holidays, today), [project, sprints, items, holidays, today]);
  const active = insight.activeSprint;
  const scope = useMemo(() => (active ? items.filter((i) => i.sprintId === active.id) : []), [items, active]);
  const workload = useMemo(() => workloadOf(scope, members), [scope, members]);
  const base = `/projects/${project.id}`;
  const attention = useMemo(() => attentionFor(project, sprints, items, holidays, today), [project, sprints, items, holidays, today]);
  const mine = items.filter((i) => i.projectId === project.id);
  const backlog = mine.filter((i) => i.sprintId === null && i.status !== 'done');
  const projectSprints = sprints
    .filter((x) => x.projectId === project.id)
    .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || (a.status === 'completed' ? b.number - a.number : a.number - b.number));

  const velocityData = [
    ...insight.velocity.map((v) => ({
      label: sprintName(v.sprint),
      value: v.weight,
      hint: v.sprint.goalOutcome ? `goal ${v.sprint.goalOutcome.replace('_', ' ')}` : undefined,
    })),
    ...(active ? [{ label: `${sprintName(active)} *`, value: progressOf(scope).doneWeight, partial: true }] : []),
  ];

  const columns = project.workflow.map((w) => ({ column: w, count: scope.filter((i) => columnOf(project.workflow, i).id === w.id).length }));
  const maxCol = Math.max(1, ...columns.map((c) => c.count));
  const maxLoad = Math.max(1, ...workload.map((w) => w.openWeight + w.doneWeight));

  return (
    <div className="page">
      <div className="row wrap" style={{ gap: 12 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Project health</h2>
        <HealthBadge health={insight.health} />
        {insight.risks.length > 0 && <span className="muted" style={{ fontSize: 13 }}>{insight.risks.join(' · ')}</span>}
        <span className="grow" />
        <Link to={tribePath(project.tribe)} className="btn btn-secondary btn-md">
          <Icon name="users" size={16} /> Tribe {project.tribe}
        </Link>
      </div>

      <div className="grid-3" style={{ gap: 20, alignItems: 'start' }}>
        <section className="card" style={{ gridColumn: 'span 2' }} aria-labelledby="pd-sprint">
          {active ? (
            <>
              <div className="card-head">
                <div className="row">
                  <h3 id="pd-sprint" className="card-title">{sprintName(active)}</h3>
                  <SprintStatusBadge status="active" />
                </div>
                <span className="muted num" style={{ fontSize: 13 }}>
                  {fmtRange(active.startDate, active.endDate)} · <strong style={{ color: 'var(--text)' }}>{sprintDaysLabel(active, today, holidays, project.countCollectiveLeave)}</strong>
                </span>
              </div>
              <div className="card-body col" style={{ gap: 16 }}>
                <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
                  <span className="tile" style={{ width: 32, height: 32, background: 'var(--primary-subtle)', color: 'var(--primary-darker)' }}>
                    <Icon name="target" size={18} />
                  </span>
                  <div className="col" style={{ gap: 2 }}>
                    <span className="muted" style={{ fontSize: 12, fontWeight: 500 }}>Sprint goal</span>
                    <span style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.45 }}>{active.goal || 'No sprint goal was set.'}</span>
                  </div>
                </div>
                <ProgressVsTime progress={insight.progressPct} time={insight.timePct} />
                <div className="row wrap" style={{ gap: 12 }}>
                  <StatusMiniBar byStatus={insight.byStatus} width={180} />
                  <span className="muted num" style={{ fontSize: 12 }}>{insight.progress.done}/{insight.progress.total} tasks · {insight.progress.doneWeight}/{insight.progress.totalWeight} weight</span>
                  <span className="grow" />
                  <Link to={`${base}/sprints/${active.id}/report`} className="btn btn-secondary btn-md">Report</Link>
                  <Link to={`${base}/sprints/${active.id}`} className="btn btn-primary btn-md"><Icon name="kanban" size={16} /> Open board</Link>
                </div>
                <p className="muted" style={{ fontSize: 12 }}>
                  The dark tick marks where progress should be if work kept pace with elapsed working days. Up to 10 pts behind is on track; more than 25 is off track.
                </p>
              </div>
            </>
          ) : (
            <div className="card-body col" style={{ gap: 12, alignItems: 'flex-start' }}>
              <h3 id="pd-sprint" className="card-title">No active sprint</h3>
              <p className="muted">
                {project.status === 'completed'
                  ? 'This project is completed. Sprint history stays available below.'
                  : projectSprints.some((x) => x.status === 'draft')
                    ? 'A draft sprint is waiting. Add a goal, dates, and tasks, then start it.'
                    : 'Plan the first sprint when the backlog has enough sprint-ready items.'}
              </p>
              {project.status === 'active' && (
                <Link to={`${base}/sprints${projectSprints.some((x) => x.status === 'draft') ? '' : '?new=1'}`} className="btn btn-primary btn-md">
                  {projectSprints.some((x) => x.status === 'draft') ? 'Go to draft sprint' : 'Plan a sprint'}
                </Link>
              )}
            </div>
          )}
        </section>

        <section className="card" aria-labelledby="pd-attn">
          <div className="card-head">
            <h3 id="pd-attn" className="card-title">Needs attention</h3>
            <span className="count-pill">{attention.length}</span>
          </div>
          {attention.length === 0 ? (
            <div className="card-body row muted">
              <Icon name="checkCircle" color="var(--success)" /> All clear.
            </div>
          ) : (
            attention.map((a, i) => (
              <div key={a.id} className="row" style={{ alignItems: 'flex-start', gap: 12, padding: '14px 20px', borderTop: i ? '1px solid var(--border-soft)' : undefined }}>
                <Icon
                  name={a.tone === 'info' ? 'info' : 'alert'}
                  size={18}
                  color={a.tone === 'danger' ? 'var(--danger)' : a.tone === 'warning' ? 'var(--warning)' : 'var(--primary-darker)'}
                  style={{ marginTop: 2 }}
                />
                <div className="col" style={{ gap: 4 }}>
                  <strong style={{ fontWeight: 600 }}>{a.title}</strong>
                  <span className="muted" style={{ fontSize: 13 }}>{a.body}</span>
                  <Link to={a.action.to} style={{ fontSize: 13, fontWeight: 600 }}>{a.action.label}</Link>
                </div>
              </div>
            ))
          )}
        </section>
      </div>

      <div className="grid-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        <StatTile icon="chart" label="Avg. velocity" value={insight.avgVelocity ?? '—'} hint={insight.velocity.length ? `weight per sprint, last ${insight.velocity.length}` : 'no completed sprints yet'} />
        <StatTile icon="target" label="Sprint goals met" value={insight.goals.closed ? `${insight.goals.achieved}/${insight.goals.closed}` : '—'} hint="completed sprints" />
        <StatTile icon="layers" label="Backlog" value={backlog.length} hint={`${backlog.filter(isSprintReady).length} sprint-ready`} />
        <StatTile icon="clock" label="Overdue tasks" value={insight.overdue.length} hint="in sprints, past due" />
        <StatTile icon="bug" label="Open defects" value={insight.openDefects} hint={insight.criticalDefects ? `${insight.criticalDefects} critical` : 'none critical'} />
      </div>

      <section className="col" style={{ gap: 12 }} aria-labelledby="pd-sprints">
        <div className="row wrap">
          <h2 id="pd-sprints" style={{ fontSize: 16, fontWeight: 600 }}>Sprints</h2>
          <span className="count-pill">{projectSprints.length}</span>
          <span className="grow" />
          <StatusLegend />
          <Link to={`${base}/sprints`} className="btn btn-secondary btn-sm">Manage sprints</Link>
        </div>
        {projectSprints.length === 0 ? (
          <Empty icon="refresh" title="No sprints yet">
            <Link to={`${base}/sprints?new=1`} className="btn btn-primary btn-sm">Plan a sprint</Link>
          </Empty>
        ) : (
          <div className="table-wrap" style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th scope="col" style={{ width: 200 }}>Sprint</th>
                  <th scope="col" style={{ width: 180 }}>Dates</th>
                  <th scope="col">Goal</th>
                  <th scope="col" style={{ width: 160 }}>Tasks</th>
                  <th scope="col" style={{ width: 100, textAlign: 'right' }}>Delivered</th>
                  <th scope="col" style={{ width: 170 }}>Goal outcome</th>
                </tr>
              </thead>
              <tbody>
                {projectSprints.map((sp) => (
                  <SprintRow key={sp.id} sprint={sp} scope={mine.filter((i) => i.sprintId === sp.id)} onOpen={() => navigate(`${base}/sprints/${sp.id}`)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <section className="card" aria-labelledby="pd-velocity">
          <div className="card-head">
            <h3 id="pd-velocity" className="card-title">Velocity</h3>
            <span className="muted" style={{ fontSize: 12 }}>Delivered weight per sprint</span>
          </div>
          <div className="card-body">
            {velocityData.length ? (
              <>
                <BarChart data={velocityData} unit="weight" ariaLabel={`Velocity: ${velocityData.map((d) => `${d.label} ${d.value}`).join(', ')}`} />
                {active && <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>* Hatched bar: {sprintName(active)} is still running; the value is delivered so far.</p>}
              </>
            ) : (
              <Empty icon="chart" title="No sprint data yet" />
            )}
          </div>
        </section>

        <section className="card" aria-labelledby="pd-columns">
          <div className="card-head">
            <h3 id="pd-columns" className="card-title">Where work sits</h3>
            <span className="muted" style={{ fontSize: 12 }}>{active ? `${sprintName(active)} by board column` : 'No active sprint'}</span>
          </div>
          <div className="card-body col" style={{ gap: 10 }}>
            {active ? (
              columns.map(({ column, count }) => (
                <div key={column.id} className="row" style={{ gap: 10 }} title={`${column.name}: ${count} task${count === 1 ? '' : 's'}`}>
                  <span className="row truncate" style={{ width: 140, gap: 6, fontSize: 13 }}>
                    <ColumnIcon column={column} size={14} />
                    {column.name}
                  </span>
                  <div className="grow" style={{ height: 10, borderRadius: 4, background: 'var(--surface-sunken)' }}>
                    <div style={{ width: `${(count / maxCol) * 100}%`, height: '100%', borderRadius: 4, background: column.color }} />
                  </div>
                  <span className="num" style={{ width: 28, textAlign: 'right', fontWeight: 600 }}>{count}</span>
                </div>
              ))
            ) : (
              <Empty icon="kanban" title="No active sprint">
                <Link to={`${base}/sprints`} className="btn btn-secondary btn-sm">Go to sprints</Link>
              </Empty>
            )}
          </div>
        </section>
      </div>

      {active && (
        <section className="card" aria-labelledby="pd-workload">
          <div className="card-head">
            <h3 id="pd-workload" className="card-title">Workload in {sprintName(active)}</h3>
            <div className="row" style={{ gap: 14, fontSize: 12 }}>
              <span className="row" style={{ gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: '#0561B6' }} />Delivered weight</span>
              <span className="row" style={{ gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: '#9CC8F3' }} />Open weight</span>
            </div>
          </div>
          <div className="card-body col" style={{ gap: 10 }}>
            {workload.map((w) => (
              <div key={w.member?.id ?? 'none'} className="row" style={{ gap: 10 }} title={`${w.member?.name ?? 'Unassigned'}: ${w.doneWeight} delivered, ${w.openWeight} open (${w.openTasks} tasks)`}>
                <span className="row truncate" style={{ width: 200, gap: 8, fontSize: 13 }}>
                  <Avatar member={w.member} />
                  {w.member?.name ?? 'Unassigned'}
                </span>
                <div className="grow row" style={{ gap: 2, height: 12 }}>
                  {w.doneWeight > 0 && <span style={{ width: `${(w.doneWeight / maxLoad) * 100}%`, height: '100%', borderRadius: 3, background: '#0561B6' }} />}
                  {w.openWeight > 0 && <span style={{ width: `${(w.openWeight / maxLoad) * 100}%`, height: '100%', borderRadius: 3, background: '#9CC8F3' }} />}
                </div>
                <span className="muted num" style={{ width: 150, textAlign: 'right', fontSize: 12 }}>
                  {w.doneWeight} done · {w.openWeight} open ({w.openTasks})
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="col" style={{ gap: 12 }} aria-labelledby="pd-overdue">
        <h3 id="pd-overdue" style={{ fontSize: 16, fontWeight: 600 }}>Overdue tasks</h3>
        {insight.overdue.length === 0 ? (
          <p className="muted row"><Icon name="checkCircle" color="var(--success)" /> Nothing overdue.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col" style={{ width: 100 }}>ID</th>
                  <th scope="col">Task</th>
                  <th scope="col" style={{ width: 170 }}>Status</th>
                  <th scope="col" style={{ width: 200 }}>Assignee</th>
                  <th scope="col" style={{ width: 170 }}>Due</th>
                </tr>
              </thead>
              <tbody>
                {insight.overdue.map((i) => {
                  const m = members.find((x) => x.id === i.assigneeId) ?? null;
                  return (
                    <tr key={i.id} className="clickable">
                      <td className="muted num">{i.key}</td>
                      <td><button type="button" className="task-card-title" onClick={() => setParams({ task: i.id })}>{i.title}</button></td>
                      <td><ItemStatusBadge item={i} /></td>
                      <td><span className="row"><Avatar member={m} /> {m?.name ?? 'Unassigned'}</span></td>
                      <td><span className="chip-date danger">{fmtDue(i.dueDate!, today).label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

const STATUS_RANK: Record<Sprint['status'], number> = { active: 0, draft: 1, completed: 2 };

function SprintRow({ sprint, scope, onOpen }: { sprint: Sprint; scope: ReturnType<typeof useStore.getState>['items']; onOpen: () => void }) {
  const p = progressOf(scope);
  const delivered = sprint.status === 'completed' ? sprint.closedSummary?.doneWeight ?? p.doneWeight : p.doneWeight;
  const planned = sprint.status === 'completed' ? sprint.closedSummary?.totalWeight ?? p.totalWeight : p.totalWeight;
  return (
    <tr className="clickable" onClick={onOpen}>
      <td>
        <div className="row" style={{ gap: 8, whiteSpace: 'nowrap' }}>
          <Link to={`/projects/${sprint.projectId}/sprints/${sprint.id}`} onClick={(e) => e.stopPropagation()} style={{ fontWeight: 600 }}>{sprintName(sprint)}</Link>
          <SprintStatusBadge status={sprint.status} />
        </div>
      </td>
      <td className="muted num" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{sprint.startDate && sprint.endDate ? fmtRange(sprint.startDate, sprint.endDate) : 'Not set'}</td>
      <td><span className="truncate" style={{ display: 'block', maxWidth: 260, fontSize: 13 }} title={sprint.goal}>{sprint.goal || <span className="subtle">No goal yet</span>}</span></td>
      <td>
        {p.total ? (
          <div className="col" style={{ gap: 4 }}>
            <StatusMiniBar byStatus={p.byStatus} width={130} />
            <span className="muted num" style={{ fontSize: 12 }}>{p.done}/{p.total} done</span>
          </div>
        ) : (
          <span className="subtle">No tasks</span>
        )}
      </td>
      <td className="num" style={{ textAlign: 'right' }}>{planned ? <><strong>{delivered}</strong><span className="muted">/{planned}</span></> : <span className="subtle">—</span>}</td>
      <td>{sprint.goalOutcome ? <OutcomeBadge outcome={sprint.goalOutcome} /> : <span className="subtle">{sprint.status === 'completed' ? 'Not recorded' : '—'}</span>}</td>
    </tr>
  );
}
