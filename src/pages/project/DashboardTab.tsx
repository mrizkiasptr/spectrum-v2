import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BarChart, HealthBadge, ProgressVsTime, StatTile } from '../../components/charts';
import { Icon } from '../../components/Icon';
import { Avatar, ColumnIcon, Empty, ItemStatusBadge } from '../../components/ui';
import { fmtDue, fmtRange } from '../../domain/dates';
import { projectInsight, workloadOf } from '../../domain/insights';
import { progressOf, sprintDaysLabel, sprintName } from '../../domain/sprint';
import { columnOf } from '../../domain/workflow';
import { useToday } from '../../store/hooks';
import { useStore } from '../../store/useStore';
import { useProjectCtx } from './ProjectLayout';

/** Project dashboard: health, delivery trend, where work sits, who carries it, and what is late. */
export function DashboardTab() {
  const { project } = useProjectCtx();
  const sprints = useStore((s) => s.sprints);
  const items = useStore((s) => s.items);
  const members = useStore((s) => s.members);
  const holidays = useStore((s) => s.holidays);
  const today = useToday();
  const [, setParams] = useSearchParams();

  const insight = useMemo(() => projectInsight(project, sprints, items, holidays, today), [project, sprints, items, holidays, today]);
  const active = insight.activeSprint;
  const scope = useMemo(() => (active ? items.filter((i) => i.sprintId === active.id) : []), [items, active]);
  const workload = useMemo(() => workloadOf(scope, members), [scope, members]);
  const base = `/projects/${project.id}`;

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
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Project dashboard</h2>
        <HealthBadge health={insight.health} />
        {insight.risks.length > 0 && <span className="muted" style={{ fontSize: 13 }}>{insight.risks.join(' · ')}</span>}
        <span className="grow" />
        <Link to={`/dashboard?tribe=${encodeURIComponent(project.tribe)}`} className="btn btn-secondary btn-md">
          <Icon name="gauge" size={16} /> Tribe {project.tribe} dashboard
        </Link>
      </div>

      <div className="grid-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        <StatTile
          icon="kanban"
          label={active ? `${sprintName(active)} progress` : 'Active sprint'}
          value={active ? `${insight.progressPct}%` : '—'}
          hint={active ? `${insight.progress.doneWeight}/${insight.progress.totalWeight} weight · ${insight.progress.done}/${insight.progress.total} tasks` : 'No sprint running'}
        />
        <StatTile icon="clock" label="Sprint time elapsed" value={active ? `${insight.timePct}%` : '—'} hint={active ? sprintDaysLabel(active, today, holidays, project.countCollectiveLeave) : '—'} />
        <StatTile icon="chart" label="Avg. velocity" value={insight.avgVelocity ?? '—'} hint={insight.velocity.length ? `weight per sprint, last ${insight.velocity.length}` : 'no completed sprints yet'} />
        <StatTile icon="target" label="Sprint goals met" value={insight.goals.closed ? `${insight.goals.achieved}/${insight.goals.closed}` : '—'} hint="completed sprints" />
        <StatTile icon="clock" label="Overdue tasks" value={insight.overdue.length} hint="in sprints, past due" />
        <StatTile icon="bug" label="Open defects" value={insight.openDefects} hint={insight.criticalDefects ? `${insight.criticalDefects} critical` : 'none critical'} />
      </div>

      {active && (
        <section className="card" aria-labelledby="pd-pace">
          <div className="card-head">
            <h3 id="pd-pace" className="card-title">{sprintName(active)} pace</h3>
            <span className="muted num" style={{ fontSize: 13 }}>{fmtRange(active.startDate, active.endDate)}</span>
          </div>
          <div className="card-body col" style={{ gap: 10 }}>
            <ProgressVsTime progress={insight.progressPct} time={insight.timePct} />
            <p className="muted" style={{ fontSize: 12 }}>
              The dark tick marks where progress would be if work kept pace with elapsed working days. Up to 10 pts behind is on track; more than 25 is off track.
            </p>
          </div>
        </section>
      )}

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
