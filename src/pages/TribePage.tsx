import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Topbar } from '../components/AppShell';
import { HealthBadge, StatTile } from '../components/charts';
import { Icon } from '../components/Icon';
import { TRIBE_STYLE } from '../components/ui';
import { HEALTH_ORDER, summarize } from '../domain/insights';
import type { Tribe } from '../domain/types';
import { TRIBES } from '../domain/types';
import { NewProjectDialog } from '../features/dialogs';
import { NotFound } from './misc';
import { ProjectList } from './ProjectList';
import { tribePath, useInsights } from './tribe-parts';

/** Tribe dashboard: health and progress of every project in one tribe, and what needs a decision. */
export function TribePage() {
  const params = useParams();
  const navigate = useNavigate();
  const insights = useInsights();
  const [creating, setCreating] = useState(false);
  const tribe = TRIBES.find((t) => t === params.tribe);
  if (!tribe) return <NotFound what="tribe" />;

  const inTribe = insights.filter((i) => i.project.tribe === tribe);
  const scoped = inTribe.filter((i) => i.project.status === 'active');
  const summary = summarize(scoped);
  const pct = summary.weightTotal ? Math.round((summary.weightDone / summary.weightTotal) * 100) : 0;
  const ts = TRIBE_STYLE[tribe];

  const attention = scoped.filter((i) => i.risks.length && i.project.status === 'active').sort((a, b) => HEALTH_ORDER.indexOf(a.health) - HEALTH_ORDER.indexOf(b.health));

  return (
    <>
      <Topbar crumbs={[{ label: 'Project Board', to: '/projects' }, { label: `Tribe ${tribe}` }]} />
      <div className="content">
        <div className="page">
          <div className="page-head">
            <div className="row" style={{ gap: 14 }}>
              <div className="tile" style={{ background: ts.bg, color: ts.fg }}><Icon name="users" size={20} /></div>
              <div className="col" style={{ gap: 4 }}>
                <h1 className="page-title">Tribe {tribe}</h1>
                <p className="muted">Running projects in this tribe and how their sprints are going. Pick a project to see its dashboard and sprints.</p>
              </div>
            </div>
            <div className="row" style={{ gap: 10 }}>
              <label className="sr-only" htmlFor="tr-switch">Switch tribe</label>
              <select id="tr-switch" className="filter-select" value={tribe} onChange={(e) => navigate(tribePath(e.target.value as Tribe))}>
                {TRIBES.map((t) => <option key={t} value={t}>Tribe: {t}</option>)}
              </select>
              <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
                <Icon name="plus" size={18} /> New project
              </button>
            </div>
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

          <ProjectList tribe={tribe} insights={insights} />

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
                  <Link to={`/projects/${i.project.id}`} style={{ fontWeight: 600, color: 'var(--text)' }}>{i.project.name}</Link>
                  <span className="muted grow" style={{ fontSize: 13 }}>{i.risks.join(' · ')}</span>
                  <Link to={`/projects/${i.project.id}`} className="btn btn-secondary btn-sm">Open</Link>
                </div>
              ))
            )}
          </section>
        </div>
      </div>
      {creating && <NewProjectDialog tribe={tribe} onClose={() => setCreating(false)} />}
    </>
  );
}
