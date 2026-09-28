import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { Topbar } from '../components/AppShell';
import { StatTile } from '../components/charts';
import { Icon } from '../components/Icon';
import { summarize } from '../domain/insights';
import { TRIBES } from '../domain/types';
import type { Project } from '../domain/types';
import { NewProjectDialog } from '../features/dialogs';
import { useStore } from '../store/useStore';
import { useSync } from '../sync/engine';
import { TribeCards, useInsights } from './tribe-parts';

/** Project Board landing: tribes first. A tribe opens its dashboard and projects. */
export function ProjectBoardPage() {
  const projects = useStore((s) => s.projects);
  const recent = useStore((s) => s.recent);
  const insights = useInsights();
  const [creating, setCreating] = useState(false);
  const auth = useAuth();
  const { loaded } = useSync();
  const { access } = auth;
  const tribes = access.isAdmin ? TRIBES : TRIBES.filter((t) => access.tribes.includes(t) || projects.some((p) => p.tribe === t));
  const canCreate = access.isAdmin || access.tribes.length > 0;
  const emptyWorkspace = auth.workspace && loaded && projects.length === 0;

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
            {canCreate && (
              <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
                <Icon name="plus" size={18} /> New project
              </button>
            )}
          </div>

          {emptyWorkspace && (
            <div className="card col" style={{ padding: 28, gap: 12, alignItems: 'flex-start' }}>
              <span className="auth-badge"><Icon name={access.isAdmin ? 'folder' : 'shield'} size={22} /></span>
              {access.isAdmin ? (
                <>
                  <h2 style={{ fontSize: 18, fontWeight: 700 }}>Your team workspace is empty</h2>
                  <p className="muted" style={{ maxWidth: 560 }}>
                    Start with the demo projects to try things with your team, or create your first real project. Then give people access in
                    Administration › People &amp; access.
                  </p>
                  <div className="row" style={{ gap: 10 }}>
                    <button type="button" className="btn btn-secondary btn-md" onClick={() => auth.importDemoData()}>Import demo projects</button>
                    <button type="button" className="btn btn-primary btn-md" onClick={() => setCreating(true)}><Icon name="plus" size={16} /> Create first project</button>
                  </div>
                </>
              ) : canCreate ? (
                <>
                  <h2 style={{ fontSize: 18, fontWeight: 700 }}>No projects in your tribe yet</h2>
                  <p className="muted">You can create the first one for {access.tribes.join(', ')}.</p>
                  <button type="button" className="btn btn-primary btn-md" onClick={() => setCreating(true)}><Icon name="plus" size={16} /> New project</button>
                </>
              ) : (
                <>
                  <h2 style={{ fontSize: 18, fontWeight: 700 }}>You don’t have access to any projects yet</h2>
                  <p className="muted" style={{ maxWidth: 560 }}>
                    Ask a SPEctrum admin to add you to a tribe or a project. You’re signed in as <strong style={{ color: 'var(--text)' }}>{auth.profile?.email}</strong>.
                  </p>
                </>
              )}
            </div>
          )}

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

          {!emptyWorkspace && <>
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
            <TribeCards insights={insights} tribes={tribes} />
          </section>
          </>}
        </div>
      </div>
      {creating && <NewProjectDialog onClose={() => setCreating(false)} />}
    </>
  );
}
