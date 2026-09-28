import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icon, type IconName } from '../../components/Icon';
import { ItemStatusBadge, SprintStatusBadge } from '../../components/ui';
import { fmtDue, fmtRange } from '../../domain/dates';
import { attentionFor, isSprintReady, progressOf, sprintDaysLabel, sprintName } from '../../domain/sprint';
import { STATUS_ORDER } from '../../domain/types';
import { useProjectItems, useProjectSprints, useToday } from '../../store/hooks';
import { useStore } from '../../store/useStore';
import { useProjectCtx } from './ProjectLayout';

const STACK = [
  { key: 'done', label: 'Done', color: '#0561B6' },
  { key: 'review', label: 'In review', color: '#3D95EA' },
  { key: 'in_progress', label: 'In progress', color: '#9CC8F3' },
  { key: 'todo', label: 'Not started', color: '#E5E7EB' },
] as const;

export function OverviewTab() {
  const { project } = useProjectCtx();
  const sprints = useProjectSprints(project.id);
  const items = useProjectItems(project.id);
  const allSprints = useStore((s) => s.sprints);
  const holidays = useStore((s) => s.holidays);
  const retro = useStore((s) => s.retro);
  const me = useStore((s) => s.currentUserId);
  const today = useToday();
  const [, setParams] = useSearchParams();

  const active = sprints.find((s) => s.status === 'active') ?? null;
  const sprintItems = active ? items.filter((i) => i.sprintId === active.id) : [];
  const p = progressOf(sprintItems);
  const attention = useMemo(
    () => attentionFor(project, allSprints, items, holidays, today),
    [project, allSprints, items, holidays, today],
  );
  const backlog = items.filter((i) => i.sprintId === null && i.status !== 'done');
  const done = items.filter((i) => i.status === 'done');
  const released = done.filter((i) => i.release === 'released').length;
  const partial = done.filter((i) => i.release === 'partial').length;
  const openDefects = items.filter((i) => i.type === 'bug' && i.status !== 'done');
  const openActions = retro.filter((r) => r.projectId === project.id && r.kind === 'action' && !r.done).length;
  const mine = sprintItems
    .filter((i) => i.assigneeId === me)
    .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));
  const completed = sprints.filter((s) => s.status === 'completed');
  const achieved = completed.filter((s) => s.goalOutcome === 'achieved').length;
  const velocity = completed.slice(0, 3).map((s) => s.closedSummary?.doneWeight ?? 0);
  const avgVelocity = velocity.length ? Math.round(velocity.reduce((a, b) => a + b, 0) / velocity.length) : null;

  const base = `/projects/${project.id}`;

  return (
    <div className="page">
      <div className="grid-3" style={{ gap: 20, alignItems: 'start' }}>
        <section className="card" style={{ gridColumn: 'span 2' }} aria-labelledby="ov-sprint">
          {active ? (
            <>
              <div className="card-head">
                <div className="row">
                  <h2 id="ov-sprint" className="card-title">{sprintName(active)}</h2>
                  <SprintStatusBadge status="active" />
                </div>
                <span className="muted num" style={{ fontSize: 13 }}>
                  {fmtRange(active.startDate, active.endDate)} · <strong style={{ color: 'var(--text)' }}>{sprintDaysLabel(active, today, holidays, project.countCollectiveLeave)}</strong>
                </span>
              </div>
              <div className="card-body col" style={{ gap: 18 }}>
                <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
                  <span className="tile" style={{ width: 32, height: 32, background: 'var(--primary-subtle)', color: 'var(--primary-darker)' }}>
                    <Icon name="target" size={18} />
                  </span>
                  <div className="col" style={{ gap: 2 }}>
                    <span className="muted" style={{ fontSize: 12, fontWeight: 500 }}>Sprint goal</span>
                    <span style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.45 }}>{active.goal || 'No sprint goal was set.'}</span>
                  </div>
                </div>
                <div className="row" style={{ alignItems: 'flex-end', gap: 12 }}>
                  <span className="num" style={{ fontSize: 36, fontWeight: 700, lineHeight: 1 }}>{p.pct}%</span>
                  <span className="muted" style={{ paddingBottom: 3 }}>{p.done} of {p.total} tasks done · {p.doneWeight} of {p.totalWeight} weight</span>
                </div>
                <div
                  className="stack-bar"
                  role="img"
                  aria-label={STACK.map((s) => `${s.label} ${p.byStatus[s.key]}`).join(', ')}
                >
                  {STACK.map((s) => p.byStatus[s.key] > 0 && <div key={s.key} style={{ width: `${(p.byStatus[s.key] / Math.max(p.total, 1)) * 100}%`, background: s.color }} />)}
                </div>
                <div className="row wrap" style={{ gap: 18, fontSize: 13 }}>
                  {STACK.map((s) => (
                    <span key={s.key} className="row num" style={{ gap: 6 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, boxShadow: s.key === 'todo' ? 'inset 0 0 0 1px #C3C8CF' : undefined }} />
                      {s.label} {p.byStatus[s.key]}
                    </span>
                  ))}
                  <span className="grow" />
                  <Link to={`${base}/sprints/${active.id}/report`} className="btn btn-secondary btn-md">Report</Link>
                  <Link to={`${base}/sprints/${active.id}`} className="btn btn-primary btn-md"><Icon name="kanban" size={16} /> Open board</Link>
                </div>
              </div>
            </>
          ) : (
            <div className="card-body col" style={{ gap: 12, alignItems: 'flex-start' }}>
              <h2 id="ov-sprint" className="card-title">No active sprint</h2>
              <p className="muted">
                {project.status === 'completed'
                  ? 'This project is completed. Sprint history stays available in the Sprints tab.'
                  : sprints.some((s) => s.status === 'draft')
                    ? 'A draft sprint is waiting. Add a goal, dates, and tasks, then start it.'
                    : 'Plan the first sprint when the backlog has enough sprint-ready items.'}
              </p>
              {project.status === 'active' && (
                <Link to={`${base}/sprints${sprints.some((s) => s.status === 'draft') ? '' : '?new=1'}`} className="btn btn-primary btn-md">
                  {sprints.some((s) => s.status === 'draft') ? 'Go to draft sprint' : 'Plan a sprint'}
                </Link>
              )}
            </div>
          )}
        </section>

        <section className="card" aria-labelledby="ov-attn">
          <div className="card-head">
            <h2 id="ov-attn" className="card-title">Needs attention</h2>
            <span className="count-pill">{attention.length}</span>
          </div>
          {attention.length === 0 ? (
            <div className="card-body row muted">
              <Icon name="checkCircle" color="var(--success)" /> All clear. Nothing needs your attention.
            </div>
          ) : (
            <div>
              {attention.map((a, i) => (
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
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="grid-3" style={{ gap: 20 }}>
        <MetricCard
          title="Backlog"
          to={`${base}/backlog`}
          a={{ label: 'Open items', value: backlog.length, icon: 'layers', hint: `${backlog.filter((i) => i.weight === null).length} not estimated` }}
          b={{ label: 'Sprint-ready', value: backlog.filter(isSprintReady).length, icon: 'checkCircle', hint: 'weight + acceptance criteria' }}
        />
        <MetricCard
          title="Releases"
          to={`${base}/releases`}
          a={{ label: 'Increment done', value: done.length, icon: 'box', hint: 'backlog items' }}
          b={{ label: 'Released', value: released, icon: 'check', hint: `${partial} partial · ${done.length - released - partial} waiting` }}
        />
        <MetricCard
          title="Quality & delivery"
          to={`${base}/defects`}
          a={{ label: 'Open defects', value: openDefects.length, icon: 'bug', hint: openDefects.some((d) => d.severity === 'critical') ? 'includes critical' : 'none critical' }}
          b={{
            label: avgVelocity !== null ? 'Avg. velocity' : 'Retro actions',
            value: avgVelocity ?? openActions,
            icon: avgVelocity !== null ? 'chart' : 'message',
            hint: avgVelocity !== null ? `last ${velocity.length} sprints · goals met ${achieved}/${completed.length}` : 'open action items',
          }}
        />
      </div>

      {active && (
        <section className="col" style={{ gap: 12 }} aria-labelledby="ov-mine">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2 id="ov-mine" style={{ fontSize: 16, fontWeight: 600 }}>My tasks in {sprintName(active)}</h2>
            <Link to={`${base}/sprints/${active.id}?mine=1`} style={{ fontSize: 13, fontWeight: 600 }}>View on board</Link>
          </div>
          {mine.length === 0 ? (
            <p className="muted">You have no tasks in this sprint.</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col" style={{ width: 100 }}>ID</th>
                    <th scope="col">Task</th>
                    <th scope="col" style={{ width: 160 }}>Status</th>
                    <th scope="col" style={{ width: 90 }}>Weight</th>
                    <th scope="col" style={{ width: 170 }}>Due</th>
                  </tr>
                </thead>
                <tbody>
                  {mine.map((i) => {
                    const due = i.dueDate && i.status !== 'done' ? fmtDue(i.dueDate, today) : null;
                    return (
                      <tr key={i.id} className="clickable">
                        <td className="muted num">{i.key}</td>
                        <td>
                          <button type="button" className="task-card-title" onClick={() => setParams({ task: i.id })}>{i.title}</button>
                        </td>
                        <td><ItemStatusBadge item={i} /></td>
                        <td className="num">{i.weight ?? '—'}</td>
                        <td>{due ? <span className={`chip-date ${due.tone === 'neutral' ? '' : due.tone}`}>{due.label}</span> : <span className="subtle">—</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function MetricCard({
  title,
  to,
  a,
  b,
}: {
  title: string;
  to: string;
  a: { label: string; value: number; icon: IconName; hint: string };
  b: { label: string; value: number; icon: IconName; hint: string };
}) {
  return (
    <section className="card">
      <div className="card-head" style={{ padding: '10px 16px' }}>
        <h2 style={{ fontSize: 14, fontWeight: 600 }}>{title}</h2>
        <Link to={to} aria-label={`Open ${title}`} className="icon-btn sm"><Icon name="chevronRight" size={16} /></Link>
      </div>
      <div className="metric-grid">
        {[a, b].map((m) => (
          <div key={m.label} className="metric">
            <span className="metric-label">{m.label}</span>
            <span className="metric-value"><Icon name={m.icon} size={18} color="var(--text-muted)" />{m.value}</span>
            <span className="metric-label">{m.hint}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
