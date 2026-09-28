import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Topbar } from '../components/AppShell';
import { HealthBadge, ProgressVsTime, Sparkbars, StatTile, StatusLegend, StatusMiniBar } from '../components/charts';
import { Icon } from '../components/Icon';
import { Empty, TRIBE_STYLE, TribeBadge } from '../components/ui';
import { sprintDaysLabel, sprintName } from '../domain/sprint';
import { HEALTH_LABEL, HEALTH_ORDER, projectInsight, summarize, type Health, type ProjectInsight } from '../domain/insights';
import type { Tribe } from '../domain/types';
import { TRIBES } from '../domain/types';
import { useToday } from '../store/hooks';
import { useStore } from '../store/useStore';

type SortKey = 'health' | 'progress' | 'overdue' | 'name';

/**
 * Portfolio and tribe dashboard for PMs: which projects are on track, where work is stuck,
 * and what needs a decision. `?tribe=<name>` narrows it to one tribe.
 */
export function DashboardPage() {
  const projects = useStore((s) => s.projects);
  const sprints = useStore((s) => s.sprints);
  const items = useStore((s) => s.items);
  const holidays = useStore((s) => s.holidays);
  const today = useToday();
  const [params, setParams] = useSearchParams();
  const tribe = (TRIBES as string[]).includes(params.get('tribe') ?? '') ? (params.get('tribe') as Tribe) : null;
  const [sort, setSort] = useState<SortKey>('health');
  const [showCompleted, setShowCompleted] = useState(false);

  const insights = useMemo(
    () => projects.map((p) => projectInsight(p, sprints, items, holidays, today)),
    [projects, sprints, items, holidays, today],
  );
  const scoped = insights.filter((i) => (!tribe || i.project.tribe === tribe) && (showCompleted || i.project.status === 'active'));
  const summary = summarize(scoped);
  const pct = summary.weightTotal ? Math.round((summary.weightDone / summary.weightTotal) * 100) : 0;

  const sorted = [...scoped].sort((a, b) => {
    if (sort === 'progress') return a.progressPct - a.timePct - (b.progressPct - b.timePct);
    if (sort === 'overdue') return b.overdue.length - a.overdue.length;
    if (sort === 'name') return a.project.name.localeCompare(b.project.name);
    return HEALTH_ORDER.indexOf(a.health) - HEALTH_ORDER.indexOf(b.health) || a.progressPct - a.timePct - (b.progressPct - b.timePct);
  });
  const attention = scoped.filter((i) => i.risks.length && i.project.status === 'active').sort((a, b) => HEALTH_ORDER.indexOf(a.health) - HEALTH_ORDER.indexOf(b.health));

  const setTribe = (t: Tribe | null) => {
    const next = new URLSearchParams(params);
    if (t) next.set('tribe', t);
    else next.delete('tribe');
    setParams(next, { replace: true });
  };

  return (
    <>
      <Topbar crumbs={tribe ? [{ label: 'Dashboard', to: '/dashboard' }, { label: `Tribe ${tribe}` }] : [{ label: 'Dashboard' }]} />
      <div className="content">
        <div className="page">
          <div className="page-head">
            <div className="col" style={{ gap: 6 }}>
              <h1 className="page-title">{tribe ? `Tribe ${tribe}` : 'Dashboard'}</h1>
              <p className="muted">
                {tribe ? 'Progress and health of every project in this tribe.' : 'Progress and health across all tribes and running projects.'} Health compares
                sprint progress with elapsed working time.
              </p>
            </div>
            <label className="check" style={{ fontSize: 13 }}>
              <input type="checkbox" checked={showCompleted} onChange={(e) => setShowCompleted(e.target.checked)} /> Include completed projects
            </label>
          </div>

          <div className="seg" role="tablist" aria-label="Tribe" style={{ alignSelf: 'flex-start', flexWrap: 'wrap' }}>
            <button type="button" role="tab" aria-selected={!tribe} onClick={() => setTribe(null)}>All tribes</button>
            {TRIBES.map((t) => (
              <button key={t} type="button" role="tab" aria-selected={tribe === t} onClick={() => setTribe(t)}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: TRIBE_STYLE[t].fg }} />
                {t}
              </button>
            ))}
          </div>

          <div className="grid-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
            <StatTile icon="folder" label="Running projects" value={summary.projects} hint={`${summary.activeSprints} with an active sprint`} />
            <StatTile icon="kanban" label="Active sprint progress" value={`${pct}%`} hint={`${summary.tasksDone} of ${summary.tasksTotal} tasks · ${summary.weightDone}/${summary.weightTotal} weight`} />
            <StatTile
              icon="gauge"
              label="Project health"
              value={
                <span className="row" style={{ gap: 12, fontSize: 20 }}>
                  <span title="On track" className="row" style={{ gap: 4 }}><Icon name="checkCircle" size={16} color="var(--success)" />{summary.health.on_track}</span>
                  <span title="At risk" className="row" style={{ gap: 4 }}><Icon name="alert" size={16} color="var(--warning)" />{summary.health.at_risk}</span>
                  <span title="Off track" className="row" style={{ gap: 4 }}><Icon name="alert" size={16} color="var(--danger)" />{summary.health.off_track}</span>
                </span>
              }
              hint="on track · at risk · off track"
            />
            <StatTile icon="clock" label="Overdue tasks" value={summary.overdue} hint="past due date, not done" />
            <StatTile icon="bug" label="Open defects" value={summary.openDefects} hint={summary.criticalDefects ? `${summary.criticalDefects} critical` : 'none critical'} />
          </div>

          {!tribe && (
            <section className="col" style={{ gap: 12 }} aria-labelledby="db-tribes">
              <h2 id="db-tribes" style={{ fontSize: 16, fontWeight: 600 }}>Tribes</h2>
              <div className="grid-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
                {TRIBES.map((t) => {
                  const list = insights.filter((i) => i.project.tribe === t && i.project.status === 'active');
                  const s = summarize(list);
                  const tp = s.weightTotal ? Math.round((s.weightDone / s.weightTotal) * 100) : 0;
                  return (
                    <button
                      key={t}
                      type="button"
                      className="card"
                      onClick={() => setTribe(t)}
                      style={{ padding: 16, textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 10 }}
                      aria-label={`Open tribe ${t} dashboard`}
                    >
                      <div className="row">
                        <TribeBadge tribe={t} />
                        <span className="grow" />
                        <Icon name="chevronRight" size={16} color="var(--text-muted)" />
                      </div>
                      <div className="row" style={{ alignItems: 'baseline', gap: 8 }}>
                        <span className="num" style={{ fontSize: 24, fontWeight: 700 }}>{s.projects}</span>
                        <span className="muted" style={{ fontSize: 13 }}>running project{s.projects === 1 ? '' : 's'} · {s.activeSprints} sprint{s.activeSprints === 1 ? '' : 's'} active</span>
                      </div>
                      <HealthMix health={s.health} />
                      <div className="row muted num" style={{ fontSize: 12, gap: 14 }}>
                        <span>Sprint progress <strong style={{ color: 'var(--text)' }}>{tp}%</strong></span>
                        <span>Overdue <strong style={{ color: 'var(--text)' }}>{s.overdue}</strong></span>
                        <span>Defects <strong style={{ color: 'var(--text)' }}>{s.openDefects}</strong></span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          <section className="col" style={{ gap: 12 }} aria-labelledby="db-projects">
            <div className="row wrap">
              <h2 id="db-projects" style={{ fontSize: 16, fontWeight: 600 }}>Projects</h2>
              <span className="grow" />
              <StatusLegend />
              <label className="sr-only" htmlFor="db-sort">Sort by</label>
              <select id="db-sort" className="filter-select" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                <option value="health">Sort: Health (worst first)</option>
                <option value="progress">Sort: Most behind schedule</option>
                <option value="overdue">Sort: Most overdue</option>
                <option value="name">Sort: Name</option>
              </select>
            </div>
            {sorted.length === 0 ? (
              <Empty icon="folder" title="No running projects here" />
            ) : (
              <div className="table-wrap" style={{ overflowX: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Project</th>
                      <th scope="col">Health</th>
                      <th scope="col">Active sprint</th>
                      <th scope="col">Progress vs time</th>
                      <th scope="col">Tasks by status</th>
                      <th scope="col" style={{ textAlign: 'right' }}>Overdue</th>
                      <th scope="col" style={{ textAlign: 'right' }}>Defects</th>
                      <th scope="col">Velocity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((i) => (
                      <ProjectRow key={i.project.id} insight={i} today={today} holidays={holidays} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card" aria-labelledby="db-attn">
            <div className="card-head">
              <h2 id="db-attn" className="card-title">Needs a decision</h2>
              <span className="count-pill">{attention.length}</span>
            </div>
            {attention.length === 0 ? (
              <p className="card-body row muted"><Icon name="checkCircle" color="var(--success)" /> Every running project is on track.</p>
            ) : (
              attention.map((i, idx) => (
                <div key={i.project.id} className="row wrap" style={{ padding: '12px 20px', borderTop: idx ? '1px solid var(--border-soft)' : undefined, gap: 12 }}>
                  <HealthBadge health={i.health} />
                  <Link to={`/projects/${i.project.id}/dashboard`} style={{ fontWeight: 600, color: 'var(--text)' }}>{i.project.name}</Link>
                  <span className="muted grow" style={{ fontSize: 13 }}>{i.risks.join(' · ')}</span>
                  <Link to={`/projects/${i.project.id}/dashboard`} className="btn btn-secondary btn-sm">Open</Link>
                </div>
              ))
            )}
          </section>
        </div>
      </div>
    </>
  );
}

function HealthMix({ health }: { health: Record<Health, number> }) {
  const parts: { key: Health; color: string }[] = [
    { key: 'on_track', color: '#1E9E5A' },
    { key: 'at_risk', color: '#F79009' },
    { key: 'off_track', color: '#D92D20' },
    { key: 'no_sprint', color: '#C3C8CF' },
  ];
  const total = parts.reduce((t, p) => t + health[p.key], 0);
  if (!total) return <span className="muted" style={{ fontSize: 12 }}>No running projects</span>;
  return (
    <div className="col" style={{ gap: 6 }}>
      <div className="stack-bar" style={{ height: 8, background: 'transparent' }} role="img" aria-label={parts.map((p) => `${HEALTH_LABEL[p.key]} ${health[p.key]}`).join(', ')}>
        {parts.map((p) => (health[p.key] ? <span key={p.key} style={{ width: `${(health[p.key] / total) * 100}%`, background: p.color }} /> : null))}
      </div>
      <div className="row wrap" style={{ gap: 10, fontSize: 12 }}>
        {parts.map((p) =>
          health[p.key] ? (
            <span key={p.key} className="row" style={{ gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color }} />
              {HEALTH_LABEL[p.key]} {health[p.key]}
            </span>
          ) : null,
        )}
      </div>
    </div>
  );
}

function ProjectRow({ insight: i, today, holidays }: { insight: ProjectInsight; today: string; holidays: ReturnType<typeof useStore.getState>['holidays'] }) {
  const t = TRIBE_STYLE[i.project.tribe];
  return (
    <tr className="clickable">
      <td>
        <div className="row">
          <span className="nav-tile" style={{ background: t.bg, color: t.fg, width: 28, height: 28, fontSize: 10 }}>{i.project.code}</span>
          <div className="col" style={{ gap: 0 }}>
            <Link to={`/projects/${i.project.id}/dashboard`} style={{ fontWeight: 600, color: 'var(--text)' }}>{i.project.name}</Link>
            <span className="muted" style={{ fontSize: 12 }}>{i.project.tribe}</span>
          </div>
        </div>
      </td>
      <td><HealthBadge health={i.health} /></td>
      <td>
        {i.activeSprint ? (
          <div className="col" style={{ gap: 0 }}>
            <Link to={`/projects/${i.project.id}/sprints/${i.activeSprint.id}`} style={{ fontWeight: 600 }}>{sprintName(i.activeSprint)}</Link>
            <span className="muted" style={{ fontSize: 12 }}>{sprintDaysLabel(i.activeSprint, today, holidays, i.project.countCollectiveLeave)}</span>
          </div>
        ) : (
          <span className="muted">—</span>
        )}
      </td>
      <td>{i.activeSprint ? <ProgressVsTime progress={i.progressPct} time={i.timePct} compact /> : <span className="subtle">—</span>}</td>
      <td>
        {i.activeSprint ? (
          <div className="col" style={{ gap: 4 }}>
            <StatusMiniBar byStatus={i.byStatus} width={140} />
            <span className="muted num" style={{ fontSize: 12 }}>{i.progress.done}/{i.progress.total} done</span>
          </div>
        ) : (
          <span className="subtle">—</span>
        )}
      </td>
      <td className="num" style={{ textAlign: 'right', color: i.overdue.length ? 'var(--danger-text)' : undefined, fontWeight: i.overdue.length ? 600 : undefined }}>{i.overdue.length}</td>
      <td className="num" style={{ textAlign: 'right' }}>
        {i.openDefects}
        {i.criticalDefects > 0 && <span style={{ color: 'var(--danger-text)', fontSize: 12 }}> ({i.criticalDefects} crit.)</span>}
      </td>
      <td><Sparkbars values={i.velocity.map((v) => v.weight)} label={`${i.project.name} velocity`} /></td>
    </tr>
  );
}
