import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useOutletContext, useParams } from 'react-router-dom';
import { Topbar } from '../../components/AppShell';
import { Icon, type IconName } from '../../components/Icon';
import { toast } from '../../components/toast';
import { AvatarStack, Dialog, TRIBE_STYLE, TribeBadge } from '../../components/ui';
import { fmtRange } from '../../domain/dates';
import type { Project } from '../../domain/types';
import { useProject, useProjectItems } from '../../store/hooks';
import { useStore } from '../../store/useStore';
import { NotFound } from '../misc';

const TABS: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '', label: 'Overview', icon: 'gauge', end: true },
  { to: 'dashboard', label: 'Dashboard', icon: 'chart' },
  { to: 'backlog', label: 'Backlog', icon: 'layers' },
  { to: 'sprints', label: 'Sprints', icon: 'refresh' },
  { to: 'releases', label: 'Releases', icon: 'box' },
  { to: 'defects', label: 'Defects', icon: 'bug' },
  { to: 'retro', label: 'Retro', icon: 'message' },
  { to: 'docs', label: 'Docs', icon: 'file' },
  { to: 'settings', label: 'Settings', icon: 'sliders' },
];

export interface ProjectCtx {
  project: Project;
}
export const useProjectCtx = () => useOutletContext<ProjectCtx>();

export function ProjectLayout() {
  const { projectId } = useParams();
  const project = useProject(projectId);
  const items = useProjectItems(projectId);
  const favorites = useStore((s) => s.favorites);
  const toggleFavorite = useStore((s) => s.toggleFavorite);
  const markOpened = useStore((s) => s.markOpened);
  const location = useLocation();
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (projectId && project) markOpened(projectId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, !!project]);

  if (!project) return <NotFound what="project" />;

  const fav = favorites.includes(project.id);
  const t = TRIBE_STYLE[project.tribe];
  const section = TABS.find((x) => x.to && location.pathname.includes(`/${x.to}`));
  const counts: Record<string, number> = {
    backlog: items.filter((i) => i.sprintId === null && i.status !== 'done').length,
    defects: items.filter((i) => i.type === 'bug' && i.status !== 'done').length,
  };

  return (
    <>
      <Topbar
        crumbs={[
          { label: 'Project Board', to: '/projects' },
          { label: project.name, to: `/projects/${project.id}` },
          ...(section ? [{ label: section.label }] : []),
        ]}
      />
      <div className="content">
        <div className="project-head">
          <div className="row" style={{ gap: 14 }}>
            <div className="tile" style={{ background: t.bg, color: t.fg }}>{project.code}</div>
            <div className="col grow" style={{ gap: 2 }}>
              <div className="row">
                <h1 style={{ fontSize: 22, fontWeight: 700 }}>{project.name}</h1>
                <button
                  type="button"
                  className="icon-btn sm"
                  aria-pressed={fav}
                  aria-label={fav ? `Remove ${project.name} from favorites` : `Add ${project.name} to favorites`}
                  onClick={() => toggleFavorite(project.id)}
                  style={{ color: fav ? '#B45309' : undefined }}
                >
                  <Icon name="star" size={16} fill={fav ? '#F5A524' : 'none'} />
                </button>
                {project.status === 'completed' && <span className="badge info">Completed</span>}
              </div>
              <div className="row wrap muted" style={{ fontSize: 13, gap: 8 }}>
                {project.description && <span>{project.description}</span>}
                <span aria-hidden="true">·</span>
                <TribeBadge tribe={project.tribe} />
                <span className="num">{fmtRange(project.startDate, project.endDate)}</span>
              </div>
            </div>
            <AvatarStack ids={project.memberIds} max={4} />
            <button type="button" className="btn btn-secondary btn-md" onClick={() => setSharing(true)}>Share</button>
            <NavLink to={`/projects/${project.id}/settings#members`} className="btn btn-secondary btn-md">
              <Icon name="userPlus" size={16} /> Invite
            </NavLink>
          </div>
          <nav aria-label="Project sections" className="tabs">
            {TABS.map((tab) => (
              <NavLink key={tab.label} to={tab.to ? `/projects/${project.id}/${tab.to}` : `/projects/${project.id}`} end={tab.end} className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}>
                <Icon name={tab.icon} size={16} />
                {tab.label}
                {counts[tab.to] ? <span className="count-pill">{counts[tab.to]}</span> : null}
              </NavLink>
            ))}
          </nav>
        </div>
        <Outlet context={{ project } satisfies ProjectCtx} />
      </div>
      <Dialog open={sharing} onClose={() => setSharing(false)} title={`Share ${project.name}`}>
        <div className="field">
          <label className="field-label" htmlFor="share-url">Project link</label>
          <div className="row">
            <input id="share-url" className="input grow" readOnly value={`${window.location.origin}/projects/${project.id}`} />
            <button
              type="button"
              className="btn btn-primary"
              onClick={() =>
                navigator.clipboard?.writeText(`${window.location.origin}/projects/${project.id}`).then(
                  () => toast('Link copied.'),
                  () => toast('Couldn’t copy the link. Select it and copy manually.'),
                )
              }
            >
              Copy
            </button>
          </div>
          <span className="field-hint">Only project members can open it. Add people from Settings › Members.</span>
        </div>
      </Dialog>
    </>
  );
}
