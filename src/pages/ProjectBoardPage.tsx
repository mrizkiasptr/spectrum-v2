import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Topbar } from '../components/AppShell';
import { Icon } from '../components/Icon';
import { AvatarStack, Empty, Progress, TRIBE_STYLE, TribeBadge } from '../components/ui';
import { diffDays, fmtDate, fmtRange } from '../domain/dates';
import { progressOf, sprintDaysLabel, sprintName } from '../domain/sprint';
import type { Project, Sprint, Tribe } from '../domain/types';
import { TRIBES } from '../domain/types';
import { NewProjectDialog } from '../features/dialogs';
import { useToday } from '../store/hooks';
import { useStore } from '../store/useStore';
import { TribeCards, useInsights } from './TribePage';

type Group = 'all' | 'favorites' | 'mine';
type StatusFilter = 'active' | 'completed' | 'all';

function usePref<T extends string>(key: string, initial: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => {
    try {
      return (localStorage.getItem(key) as T) || initial;
    } catch {
      return initial;
    }
  });
  return [
    v,
    (next: T) => {
      setV(next);
      try {
        localStorage.setItem(key, next);
      } catch {
        /* ignore */
      }
    },
  ];
}

export function ProjectBoardPage() {
  const projects = useStore((s) => s.projects);
  const sprints = useStore((s) => s.sprints);
  const items = useStore((s) => s.items);
  const favorites = useStore((s) => s.favorites);
  const recent = useStore((s) => s.recent);
  const me = useStore((s) => s.currentUserId);
  const holidays = useStore((s) => s.holidays);
  const toggleFavorite = useStore((s) => s.toggleFavorite);
  const today = useToday();

  const [group, setGroup] = usePref<Group>('pb-group', 'all');
  const [status, setStatus] = usePref<StatusFilter>('pb-status', 'active');
  const [tribe, setTribe] = usePref<Tribe | 'all'>('pb-tribe', 'all');
  const [view, setView] = usePref<'grid' | 'list'>('pb-view', 'grid');
  const [q, setQ] = useState('');
  const insights = useInsights();
  const [creating, setCreating] = useState(false);

  const inGroup = (p: Project, g: Group) => (g === 'favorites' ? favorites.includes(p.id) : g === 'mine' ? p.memberIds.includes(me) : true);
  const inOthers = (p: Project) =>
    (status === 'all' || p.status === status) &&
    (tribe === 'all' || p.tribe === tribe) &&
    (!q.trim() || `${p.name} ${p.client} ${p.code}`.toLowerCase().includes(q.trim().toLowerCase()));

  const list = useMemo(
    () =>
      projects
        .filter((p) => inGroup(p, group) && inOthers(p))
        .sort((a, b) => Number(favorites.includes(b.id)) - Number(favorites.includes(a.id)) || a.name.localeCompare(b.name)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projects, favorites, group, status, tribe, q, me],
  );

  const activeSprint = (p: Project) => sprints.find((s) => s.projectId === p.id && s.status === 'active') ?? null;
  const recentProjects = recent.map((id) => projects.find((p) => p.id === id)).filter((p): p is Project => !!p);
  const filtersOn = status !== 'active' || tribe !== 'all' || !!q.trim();

  return (
    <>
      <Topbar crumbs={[{ label: 'Project Board' }]} />
      <div className="content">
        <div className="page">
          <div className="page-head">
            <div className="col" style={{ gap: 6 }}>
              <h1 className="page-title">Project Board</h1>
              <p className="muted">Pick a tribe to see its dashboard, or a project to see its dashboard and sprints. Click a sprint to jump straight to its board.</p>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
              <Icon name="plus" size={18} /> New project
            </button>
          </div>

          <section className="col" style={{ gap: 12 }} aria-labelledby="pb-tribes">
            <h2 id="pb-tribes" style={{ fontSize: 16, fontWeight: 600 }}>Tribes</h2>
            <TribeCards insights={insights} />
          </section>

          <h2 style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>Projects</h2>
          <div className="row wrap" style={{ gap: 10 }}>
            <div className="seg" role="tablist" aria-label="Project groups">
              {([['all', 'All'], ['favorites', 'Favorites'], ['mine', 'My projects']] as const).map(([k, label]) => (
                <button key={k} type="button" role="tab" aria-selected={group === k} onClick={() => setGroup(k)}>
                  {label}
                  <span className="count-pill">{projects.filter((p) => inGroup(p, k) && inOthers(p)).length}</span>
                </button>
              ))}
            </div>
            <span className="grow" />
            <label className="search-box">
              <Icon name="search" size={16} />
              <input type="search" aria-label="Search projects" placeholder="Search projects or clients" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
            <label className="sr-only" htmlFor="pb-status">Status</label>
            <select id="pb-status" className="filter-select" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
              <option value="active">Status: Active</option>
              <option value="completed">Status: Completed</option>
              <option value="all">Status: All</option>
            </select>
            <label className="sr-only" htmlFor="pb-tribe">Tribe</label>
            <select id="pb-tribe" className="filter-select" value={tribe} onChange={(e) => setTribe(e.target.value as Tribe | 'all')}>
              <option value="all">Tribe: All</option>
              {TRIBES.map((t) => <option key={t} value={t}>Tribe: {t}</option>)}
            </select>
            <div className="seg icons" aria-label="View">
              <button type="button" aria-label="Grid view" aria-pressed={view === 'grid'} onClick={() => setView('grid')}><Icon name="grid" size={16} /></button>
              <button type="button" aria-label="List view" aria-pressed={view === 'list'} onClick={() => setView('list')}><Icon name="list" size={16} /></button>
            </div>
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

          {list.length === 0 ? (
            <Empty icon={group === 'favorites' ? 'star' : 'folder'} title={group === 'favorites' && !filtersOn ? 'No favorite projects yet' : 'No projects match'}>
              {group === 'favorites' && !filtersOn ? (
                <span>Star a project to see it here and in the sidebar.</span>
              ) : (
                <button type="button" className="btn btn-secondary btn-md" onClick={() => { setStatus('all'); setTribe('all'); setQ(''); setGroup('all'); }}>
                  Clear filters
                </button>
              )}
            </Empty>
          ) : view === 'grid' ? (
            <div className="grid-3">
              {list.map((p) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  sprint={activeSprint(p)}
                  favorite={favorites.includes(p.id)}
                  onToggleFavorite={() => toggleFavorite(p.id)}
                  pct={(() => {
                    const s = activeSprint(p);
                    return s ? progressOf(items.filter((i) => i.sprintId === s.id)).pct : 0;
                  })()}
                  daysLabel={(() => {
                    const s = activeSprint(p);
                    return s ? sprintDaysLabel(s, today, holidays, p.countCollectiveLeave) : '';
                  })()}
                  endPassed={p.status === 'active' && diffDays(p.endDate, today) > 0}
                  draftNeedsSetup={sprints.some((s) => s.projectId === p.id && s.status === 'draft' && (!s.goal || !s.startDate))}
                />
              ))}
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col" style={{ width: 44 }}><span className="sr-only">Favorite</span></th>
                    <th scope="col">Project</th>
                    <th scope="col">Active sprint</th>
                    <th scope="col" style={{ width: 180 }}>Progress</th>
                    <th scope="col">Tribe</th>
                    <th scope="col">Period</th>
                    <th scope="col">Team</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((p) => {
                    const s = activeSprint(p);
                    const pr = s ? progressOf(items.filter((i) => i.sprintId === s.id)) : null;
                    const fav = favorites.includes(p.id);
                    return (
                      <tr key={p.id} className="clickable">
                        <td>
                          <button type="button" className="icon-btn sm" aria-pressed={fav} aria-label={fav ? `Remove ${p.name} from favorites` : `Add ${p.name} to favorites`} onClick={() => toggleFavorite(p.id)} style={{ color: fav ? '#B45309' : undefined }}>
                            <Icon name="star" size={16} fill={fav ? '#F5A524' : 'none'} />
                          </button>
                        </td>
                        <td>
                          <div className="row">
                            <span className="nav-tile" style={{ background: TRIBE_STYLE[p.tribe].bg, color: TRIBE_STYLE[p.tribe].fg, width: 28, height: 28, fontSize: 10 }}>{p.code}</span>
                            <div className="col" style={{ gap: 0 }}>
                              <Link to={`/projects/${p.id}`} style={{ fontWeight: 600, color: 'var(--text)' }}>{p.name}</Link>
                              <span className="muted" style={{ fontSize: 12 }}>{p.client}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          {s ? <Link to={`/projects/${p.id}/sprints/${s.id}`} style={{ fontWeight: 600 }}>{sprintName(s)}</Link> : <span className="muted">{p.status === 'completed' ? 'Project completed' : 'No active sprint'}</span>}
                        </td>
                        <td>{pr ? <div className="row"><div className="grow"><Progress pct={pr.pct} /></div><span className="num" style={{ fontWeight: 700, fontSize: 12 }}>{pr.pct}%</span></div> : <span className="subtle">—</span>}</td>
                        <td><TribeBadge tribe={p.tribe} /></td>
                        <td className="num muted">{fmtRange(p.startDate, p.endDate)}</td>
                        <td><AvatarStack ids={p.memberIds} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      {creating && <NewProjectDialog onClose={() => setCreating(false)} />}
    </>
  );
}

function ProjectCard({
  project: p,
  sprint,
  favorite,
  onToggleFavorite,
  pct,
  daysLabel,
  endPassed,
  draftNeedsSetup,
}: {
  project: Project;
  sprint: Sprint | null;
  favorite: boolean;
  onToggleFavorite: () => void;
  pct: number;
  daysLabel: string;
  endPassed: boolean;
  draftNeedsSetup: boolean;
}) {
  const t = TRIBE_STYLE[p.tribe];
  const alert = endPassed ? 'Project end date has passed' : sprint && draftNeedsSetup ? 'Next sprint has no goal or dates yet' : null;
  return (
    <article className="card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="row" style={{ alignItems: 'flex-start', gap: 12, padding: '16px 16px 14px' }}>
        <div className="tile" style={{ background: t.bg, color: t.fg }}>{p.code}</div>
        <div className="col grow" style={{ gap: 2 }}>
          <Link to={`/projects/${p.id}`} style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{p.name}</Link>
          <span className="muted truncate" style={{ fontSize: 13 }}>{p.client}</span>
        </div>
        <button
          type="button"
          className="icon-btn sm"
          aria-pressed={favorite}
          aria-label={favorite ? `Remove ${p.name} from favorites` : `Add ${p.name} to favorites`}
          onClick={onToggleFavorite}
          style={{ color: favorite ? '#B45309' : undefined, marginTop: -4, marginRight: -6 }}
        >
          <Icon name="star" size={18} fill={favorite ? '#F5A524' : 'none'} />
        </button>
      </div>
      <div className="col" style={{ padding: '0 16px 14px', gap: 10 }}>
        {sprint ? (
          <Link
            to={`/projects/${p.id}/sprints/${sprint.id}`}
            aria-label={`Open ${p.name} ${sprintName(sprint)} board, ${pct} percent done`}
            className="col"
            style={{ gap: 8, padding: 12, borderRadius: 8, background: 'var(--surface-muted)', border: '1px solid var(--border-soft)', color: 'var(--text)', textDecoration: 'none' }}
          >
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="row" style={{ gap: 6, fontSize: 13, fontWeight: 700 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--success)' }} />
                {sprintName(sprint)}
              </span>
              <span className="muted" style={{ fontSize: 12 }}>{daysLabel}</span>
            </div>
            <span className="truncate" style={{ fontSize: 12, color: 'var(--text-2)' }}>{sprint.goal || 'No sprint goal'}</span>
            <div className="row"><div className="grow"><Progress pct={pct} /></div><span className="num" style={{ fontSize: 12, fontWeight: 700 }}>{pct}%</span></div>
          </Link>
        ) : p.status === 'completed' ? (
          <div className="row muted" style={{ padding: 12, borderRadius: 8, background: 'var(--surface-muted)', fontSize: 13, minHeight: 58 }}>
            <Icon name="checkCircle" size={16} color="var(--success)" /> Project completed · {fmtDate(p.endDate)}
          </div>
        ) : (
          <div className="row" style={{ justifyContent: 'space-between', padding: 12, borderRadius: 8, border: '1px dashed var(--border-strong)', fontSize: 13, minHeight: 58 }}>
            <span className="muted">No active sprint</span>
            <Link to={`/projects/${p.id}/sprints?new=1`} style={{ fontWeight: 600 }}>Plan a sprint</Link>
          </div>
        )}
        {alert && (
          <div className="row" style={{ fontSize: 12, gap: 8 }}>
            <Icon name="alert" size={14} color="var(--warning)" strokeWidth={2.5} /> {alert}
          </div>
        )}
      </div>
      <div className="row" style={{ marginTop: 'auto', padding: '12px 16px', borderTop: '1px solid var(--border-soft)' }}>
        <TribeBadge tribe={p.tribe} />
        <span className="row muted num" style={{ gap: 4, fontSize: 12 }}>
          <Icon name="calendar" size={13} /> {fmtRange(p.startDate, p.endDate)}
        </span>
        <span className="grow" />
        <AvatarStack ids={p.memberIds} />
      </div>
    </article>
  );
}
