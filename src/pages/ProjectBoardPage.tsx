import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Topbar } from '../components/AppShell';
import { StatTile } from '../components/charts';
import { Icon } from '../components/Icon';
import { summarize } from '../domain/insights';
import type { Project } from '../domain/types';
import { NewProjectDialog } from '../features/dialogs';
import { useStore } from '../store/useStore';
import { TribeCards, useInsights } from './tribe-parts';

/** Project Board landing: tribes first. A tribe opens its dashboard and projects. */
export function ProjectBoardPage() {
  const projects = useStore((s) => s.projects);
  const recent = useStore((s) => s.recent);
  const insights = useInsights();
  const [creating, setCreating] = useState(false);

  const running = insights.filter((i) => i.project.status === 'active');
  const s = summarize(running);
  const recentProjects = recent.map((id) => projects.find((p) => p.id === id)).filter((p): p is Project => !!p);

  return (
    <>
      <Topbar crumbs={[{ label: 'Project Board' }]} />
      <div className="content">
        <div className="page">
          <div className="page-head">
            <div className="col" style={{ gap: 6 }}>
              <h1 className="page-title">Project Board</h1>
              <p className="muted">Pick a tribe to see its dashboard and projects.</p>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
              <Icon name="plus" size={18} /> New project
            </button>
          </div>

          {recentProjects.length > 0 && (
            <div className="row wrap" style={{ fontSize: 13 }}>
              <span className="row muted" style={{ gap: 6 }}><Icon name="refresh" size={16} /> Recently opened:</span>
              {recentProjects.map((p, i) => (
                <span key={p.id} className="row" style={{ gap: 8 }}>
                  {i > 0 && <span className="subtle">·</span>}
                  <Link to={`/projects/${p.id}`} style={{ fontWeight: 600 }}>{p.name}</Link>
                </span>
              ))}
            </div>
          )}

          <div className="grid-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
            <StatTile icon="folder" label="Running projects" value={s.projects} hint={`${s.activeSprints} with an active sprint`} />
            <StatTile
              icon="gauge"
              label="Project health"
              value={
                <span className="row" style={{ gap: 12, fontSize: 20 }}>
                  <span title="On track" className="row" style={{ gap: 4 }}><Icon name="checkCircle" size={16} color="var(--success)" />{s.health.on_track}</span>
                  <span title="At risk" className="row" style={{ gap: 4 }}><Icon name="alert" size={16} color="var(--warning)" />{s.health.at_risk}</span>
                  <span title="Off track" className="row" style={{ gap: 4 }}><Icon name="alert" size={16} color="var(--danger)" />{s.health.off_track}</span>
                </span>
              }
              hint="on track · at risk · off track"
            />
            <StatTile icon="clock" label="Overdue tasks" value={s.overdue} hint="past due date, not done" />
            <StatTile icon="bug" label="Open defects" value={s.openDefects} hint={s.criticalDefects ? `${s.criticalDefects} critical` : 'none critical'} />
          </div>

          <section className="col" style={{ gap: 12 }} aria-labelledby="pb-tribes">
            <h2 id="pb-tribes" style={{ fontSize: 16, fontWeight: 600 }}>Tribes</h2>
            <TribeCards insights={insights} />
          </section>
        </div>
      </div>
      {creating && <NewProjectDialog onClose={() => setCreating(false)} />}
    </>
  );
}
