import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { toast } from '../../components/toast';
import { Empty, MenuButton, OutcomeBadge, Progress, SprintStatusBadge } from '../../components/ui';
import { fmtRange } from '../../domain/dates';
import { progressOf, readiness, sprintDaysLabel, sprintName, startBlocker } from '../../domain/sprint';
import type { Sprint } from '../../domain/types';
import { CompleteSprintDialog } from '../../features/dialogs';
import { SprintSetupDialog } from '../../features/SprintSetupDialog';
import { useProjectItems, useProjectSprints, useToday } from '../../store/hooks';
import { useStore } from '../../store/useStore';
import { useProjectCtx } from './ProjectLayout';

export function SprintsTab() {
  const { project } = useProjectCtx();
  const sprints = useProjectSprints(project.id);
  const items = useProjectItems(project.id);
  const allSprints = useStore((s) => s.sprints);
  const holidays = useStore((s) => s.holidays);
  const createSprint = useStore((s) => s.createSprint);
  const startSprint = useStore((s) => s.startSprint);
  const deleteSprint = useStore((s) => s.deleteSprint);
  const today = useToday();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [setupId, setSetupId] = useState<string | null>(null);
  const [completeId, setCompleteId] = useState<string | null>(null);
  const [year, setYear] = useState<string>('all');
  const [open, setOpen] = useState({ active: true, draft: true, completed: true });
  const handled = useRef<string | null>(null);

  // Deep links from the overview: ?new=1 creates a draft, ?setup=<id> opens its setup dialog.
  useEffect(() => {
    const key = params.toString();
    if (handled.current === key) return;
    handled.current = key;
    if (params.get('new') === '1') {
      const s = createSprint(project.id);
      setSetupId(s.id);
      setParams({}, { replace: true });
    } else if (params.get('setup')) {
      setSetupId(params.get('setup'));
      setParams({}, { replace: true });
    }
  }, [params, project.id, createSprint, setParams]);

  const years = [...new Set(sprints.map((s) => s.startDate?.slice(0, 4)).filter(Boolean))].sort().reverse() as string[];
  const inYear = (s: Sprint) => year === 'all' || !s.startDate || s.startDate.startsWith(year);
  const active = sprints.filter((s) => s.status === 'active' && inYear(s));
  const drafts = sprints.filter((s) => s.status === 'draft' && inYear(s)).sort((a, b) => a.number - b.number);
  const completed = sprints.filter((s) => s.status === 'completed' && inYear(s));
  const setupSprint = sprints.find((s) => s.id === setupId) ?? null;
  const completeSprint = sprints.find((s) => s.id === completeId) ?? null;
  const scope = (s: Sprint) => items.filter((i) => i.sprintId === s.id);

  const newSprint = () => {
    const s = createSprint(project.id);
    setSetupId(s.id);
  };

  return (
    <div className="page">
      <div className="page-head">
        <div className="col" style={{ gap: 4 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Sprints</h2>
          <p className="muted" style={{ fontSize: 13 }}>
            Sprints are numbered automatically. Default length: {project.defaultSprintDays} days (change it in Settings or when setting up a sprint).
          </p>
        </div>
        <div className="row">
          {years.length > 1 && (
            <>
              <label className="sr-only" htmlFor="sp-year">Year</label>
              <select id="sp-year" className="filter-select" value={year} onChange={(e) => setYear(e.target.value)}>
                <option value="all">Year: All</option>
                {years.map((y) => <option key={y} value={y}>Year: {y}</option>)}
              </select>
            </>
          )}
          {project.status === 'active' && (
            <button type="button" className="btn btn-primary" onClick={newSprint}>
              <Icon name="plus" size={18} /> New sprint
            </button>
          )}
        </div>
      </div>

      {sprints.length === 0 && (
        <Empty icon="refresh" title="No sprints yet">
          <span>Create the first sprint, give it a goal, and pull sprint-ready items from the backlog.</span>
          <button type="button" className="btn btn-primary btn-md" onClick={newSprint}>New sprint</button>
        </Empty>
      )}

      {active.length > 0 && (
        <Group title="Active" tone="active" count={active.length} open={open.active} onToggle={() => setOpen((o) => ({ ...o, active: !o.active }))}>
          {active.map((s) => {
            const p = progressOf(scope(s));
            return (
              <Row key={s.id}>
                <Link to={`/projects/${project.id}/sprints/${s.id}`} style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{sprintName(s)}</Link>
                <span style={{ lineHeight: 1.45 }}>{s.goal || <span className="muted">No goal</span>}</span>
                <div className="col num" style={{ gap: 2, fontSize: 13 }}>
                  <span>{fmtRange(s.startDate, s.endDate)}</span>
                  <span className="muted">{sprintDaysLabel(s, today, holidays, project.countCollectiveLeave)}</span>
                </div>
                <div className="col" style={{ gap: 6 }}>
                  <div className="row num" style={{ justifyContent: 'space-between', fontSize: 12 }}>
                    <span className="muted">{p.done} / {p.total} tasks</span>
                    <strong>{p.pct}%</strong>
                  </div>
                  <Progress pct={p.pct} label={`${sprintName(s)} progress`} />
                </div>
                <div className="row" style={{ justifyContent: 'flex-end' }}>
                  <Link to={`/projects/${project.id}/sprints/${s.id}`} className="btn btn-primary btn-md">Open board</Link>
                  <MenuButton label={`More actions for ${sprintName(s)}`} trigger={<Icon name="more" size={16} />}>
                    {(close) => (
                      <>
                        <button type="button" role="menuitem" onClick={() => { close(); setSetupId(s.id); }}>
                          <Icon name="pen" size={16} /> Edit goal &amp; dates
                        </button>
                        <button type="button" role="menuitem" onClick={() => { close(); setCompleteId(s.id); }}>
                          <Icon name="checkCircle" size={16} /> Complete sprint
                        </button>
                      </>
                    )}
                  </MenuButton>
                </div>
              </Row>
            );
          })}
        </Group>
      )}

      {(drafts.length > 0 || project.status === 'active') && sprints.length > 0 && (
        <Group title="Planned" tone="draft" count={drafts.length} open={open.draft} onToggle={() => setOpen((o) => ({ ...o, draft: !o.draft }))}>
          {drafts.length === 0 && (
            <div className="row muted" style={{ padding: '6px 12px', fontSize: 13 }}>
              No sprint planned yet.
              <button type="button" className="btn-link" onClick={newSprint}>Plan the next sprint</button>
            </div>
          )}
          {drafts.map((s) => {
            const r = readiness(s, items);
            const blocker = startBlocker(s, allSprints, items);
            const count = scope(s).length;
            return (
              <div key={s.id} className="col" style={{ gap: 10 }}>
                <Row>
                  <div className="col" style={{ gap: 4 }}>
                    <span style={{ fontSize: 15, fontWeight: 700 }}>{sprintName(s)}</span>
                    <SprintStatusBadge status="draft" />
                  </div>
                  <span style={{ lineHeight: 1.45 }}>{s.goal || <span className="muted">No goal yet</span>}</span>
                  <div className="col num" style={{ gap: 2, fontSize: 13 }}>
                    <span>{fmtRange(s.startDate, s.endDate)}</span>
                    {s.startDate && <span className="muted">{sprintDaysLabel(s, today, holidays, project.countCollectiveLeave)}</span>}
                  </div>
                  <div className="col" style={{ gap: 2, fontSize: 13 }}>
                    <span className="num">{count} task{count === 1 ? '' : 's'} · {scope(s).reduce((t, i) => t + (i.weight ?? 0), 0)} weight</span>
                    <Link to={`/projects/${project.id}/backlog`} style={{ fontSize: 12, fontWeight: 600 }}>Add from backlog</Link>
                  </div>
                  <div className="row" style={{ justifyContent: 'flex-end' }}>
                    {r.ready ? (
                      <button
                        type="button"
                        className="btn btn-primary btn-md"
                        disabled={!!blocker}
                        title={blocker ?? undefined}
                        onClick={() => {
                          const err = startSprint(s.id);
                          if (err) toast(err);
                          else {
                            toast(`${sprintName(s)} started.`);
                            navigate(`/projects/${project.id}/sprints/${s.id}`);
                          }
                        }}
                      >
                        Start sprint
                      </button>
                    ) : (
                      <button type="button" className="btn btn-secondary btn-md" onClick={() => setSetupId(s.id)}>Set up</button>
                    )}
                    <MenuButton label={`More actions for ${sprintName(s)}`} trigger={<Icon name="more" size={16} />}>
                      {(close) => (
                        <>
                          <button type="button" role="menuitem" onClick={() => { close(); setSetupId(s.id); }}>
                            <Icon name="pen" size={16} /> Edit goal &amp; dates
                          </button>
                          <Link role="menuitem" to={`/projects/${project.id}/sprints/${s.id}`} onClick={close}>
                            <Icon name="kanban" size={16} /> View planned tasks
                          </Link>
                          <div className="menu-sep" />
                          <button
                            type="button"
                            role="menuitem"
                            className="danger"
                            onClick={() => {
                              close();
                              if (window.confirm(`Delete ${sprintName(s)}? Its ${count} task${count === 1 ? '' : 's'} will return to the backlog.`)) {
                                deleteSprint(s.id);
                                toast(`${sprintName(s)} deleted. Tasks moved to the backlog.`);
                              }
                            }}
                          >
                            <Icon name="trash" size={16} /> Delete draft
                          </button>
                        </>
                      )}
                    </MenuButton>
                  </div>
                </Row>
                {!r.ready || blocker ? (
                  <div className="row wrap" style={{ gap: 16, margin: '0 12px', padding: '10px 12px', borderRadius: 6, background: 'var(--warning-subtle)', border: '1px solid var(--warning-border)', fontSize: 13 }}>
                    <strong className="row" style={{ gap: 6 }}>
                      <Icon name="alert" size={16} color="var(--warning-text)" />
                      Ready to start: {r.checks.filter((c) => c.ok).length} of {r.checks.length}
                    </strong>
                    {r.checks.map((c) => (
                      <span key={c.key} className="row" style={{ gap: 6, color: c.ok ? 'var(--text)' : 'var(--text-muted)' }}>
                        {c.ok ? <Icon name="check" size={14} color="var(--success)" strokeWidth={3} /> : <span style={{ width: 12, height: 12, borderRadius: 999, border: '2px solid var(--text-subtle)' }} />}
                        {c.label}
                      </span>
                    ))}
                    {r.ready && blocker && <span className="muted">{blocker}</span>}
                  </div>
                ) : null}
              </div>
            );
          })}
        </Group>
      )}

      {sprints.length > 0 && (
        <Group title="Completed" tone="completed" count={completed.length} open={open.completed} onToggle={() => setOpen((o) => ({ ...o, completed: !o.completed }))}>
          {completed.length === 0 ? (
            <p className="muted" style={{ fontSize: 13, padding: '0 12px' }}>
              No sprints closed yet. After the Review, each sprint shows its goal outcome, velocity, and carried-over tasks.
            </p>
          ) : (
            completed.map((s) => (
              <Row key={s.id}>
                <Link to={`/projects/${project.id}/sprints/${s.id}/review`} style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{sprintName(s)}</Link>
                <span className="muted" style={{ lineHeight: 1.45 }}>{s.goal || 'No goal'}</span>
                <span className="num" style={{ fontSize: 13 }}>{fmtRange(s.startDate, s.endDate)}</span>
                <div className="col" style={{ gap: 2, fontSize: 13 }}>
                  <span className="num">Velocity {s.closedSummary?.doneWeight ?? 0} of {s.closedSummary?.totalWeight ?? 0}</span>
                  {!!s.closedSummary?.carriedOver && <span className="muted">{s.closedSummary.carriedOver} carried over</span>}
                </div>
                <div className="row" style={{ justifyContent: 'flex-end' }}>
                  {s.goalOutcome && <OutcomeBadge outcome={s.goalOutcome} />}
                </div>
              </Row>
            ))
          )}
        </Group>
      )}

      {setupSprint && <SprintSetupDialog sprint={setupSprint} onClose={() => setSetupId(null)} />}
      {completeSprint && <CompleteSprintDialog sprint={completeSprint} onClose={() => setCompleteId(null)} />}
    </div>
  );
}

function Group({
  title,
  tone,
  count,
  open,
  onToggle,
  children,
}: {
  title: string;
  tone: 'active' | 'draft' | 'completed';
  count: number;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const style =
    tone === 'active'
      ? { background: 'var(--success-subtle)', color: 'var(--success-text)' }
      : tone === 'draft'
        ? { background: 'var(--surface-sunken)', color: 'var(--text-2)' }
        : { background: 'var(--primary-subtle)', color: 'var(--primary-darker)' };
  const id = `grp-${tone}`;
  return (
    <section className="card" style={{ padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }} aria-labelledby={id}>
      <div className="row">
        <button type="button" className="icon-btn sm" aria-expanded={open} aria-controls={`${id}-body`} aria-label={`${open ? 'Collapse' : 'Expand'} ${title}`} onClick={onToggle}>
          <Icon name={open ? 'chevronDown' : 'chevronRight'} size={16} />
        </button>
        <h3 id={id} className="row" style={{ ...style, gap: 6, height: 26, padding: '0 10px', borderRadius: 6, fontSize: 13, fontWeight: 600 }}>{title}</h3>
        <span className="muted" style={{ fontSize: 12 }}>{count} sprint{count === 1 ? '' : 's'}</span>
      </div>
      {open && (
        <div id={`${id}-body`} className="col" style={{ gap: 6 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '120px minmax(0,2.4fr) 1.2fr 1.4fr 220px', gap: 16, padding: '0 12px 8px', borderBottom: '1px solid var(--border-soft)', fontSize: 12 }} className="muted">
            <span>Sprint</span>
            <span>Sprint goal</span>
            <span>Dates</span>
            <span>{tone === 'completed' ? 'Delivery' : tone === 'draft' ? 'Planned work' : 'Progress'}</span>
            <span />
          </div>
          {children}
        </div>
      )}
    </section>
  );
}

function Row({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '120px minmax(0,2.4fr) 1.2fr 1.4fr 220px', gap: 16, alignItems: 'center', padding: '8px 12px' }}>
      {children}
    </div>
  );
}
