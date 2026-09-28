import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { HealthBadge, ProgressVsTime, Sparkbars, StatusMiniBar } from '../components/charts';
import { Icon } from '../components/Icon';
import { TRIBE_STYLE } from '../components/ui';
import { HEALTH_LABEL, HEALTH_ORDER, projectInsight, summarize, type Health, type ProjectInsight } from '../domain/insights';
import { sprintDaysLabel, sprintName } from '../domain/sprint';
import type { Tribe } from '../domain/types';
import { TRIBES } from '../domain/types';
import { useToday } from '../store/hooks';
import { useStore } from '../store/useStore';

export const tribePath = (t: Tribe) => `/projects/tribe/${encodeURIComponent(t)}`;

export function useInsights() {
  const projects = useStore((s) => s.projects);
  const sprints = useStore((s) => s.sprints);
  const items = useStore((s) => s.items);
  const holidays = useStore((s) => s.holidays);
  const today = useToday();
  return useMemo(() => projects.map((p) => projectInsight(p, sprints, items, holidays, today)), [projects, sprints, items, holidays, today]);
}

const HEALTH_DOT: Record<Health, string> = {
  on_track: '#1E9E5A',
  at_risk: '#F79009',
  off_track: '#D92D20',
  no_sprint: '#C3C8CF',
  completed: '#3D95EA',
};

/** Project Board landing: one card per tribe with its health and running projects. Opens the tribe page. */
export function TribeCards({ insights }: { insights: ProjectInsight[] }) {
  return (
    <div className="grid-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
      {TRIBES.map((t) => {
        const all = insights.filter((i) => i.project.tribe === t);
        const list = all.filter((i) => i.project.status === 'active');
        const s = summarize(list);
        const tp = s.weightTotal ? Math.round((s.weightDone / s.weightTotal) * 100) : 0;
        const ts = TRIBE_STYLE[t];
        const shown = [...list].sort((x, y) => HEALTH_ORDER.indexOf(x.health) - HEALTH_ORDER.indexOf(y.health)).slice(0, 4);
        return (
          <Link
            key={t}
            to={tribePath(t)}
            className="card tribe-card"
            style={{ padding: 20, color: 'var(--text)', textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: 14 }}
            aria-label={`Open tribe ${t}: ${s.projects} running projects`}
          >
            <div className="row" style={{ gap: 12 }}>
              <div className="tile" style={{ background: ts.bg, color: ts.fg }}><Icon name="users" size={20} /></div>
              <div className="col grow" style={{ gap: 2 }}>
                <span style={{ fontSize: 16, fontWeight: 700 }}>Tribe {t}</span>
                <span className="muted" style={{ fontSize: 13 }}>
                  {s.projects} running project{s.projects === 1 ? '' : 's'} · {s.activeSprints} sprint{s.activeSprints === 1 ? '' : 's'} active
                  {all.length > list.length ? ` · ${all.length - list.length} completed` : ''}
                </span>
              </div>
              <Icon name="chevronRight" size={18} color="var(--text-muted)" />
            </div>
            <HealthMix health={s.health} />
            <div className="col" style={{ gap: 6, minHeight: 20 }}>
              {shown.map((i) => (
                <span key={i.project.id} className="row" style={{ gap: 8, fontSize: 13 }}>
                  <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 999, background: HEALTH_DOT[i.health], flex: 'none' }} />
                  <span className="truncate grow">{i.project.name}</span>
                  <span className="muted" style={{ fontSize: 12 }}>{HEALTH_LABEL[i.health]}</span>
                </span>
              ))}
              {list.length > shown.length && <span className="muted" style={{ fontSize: 12 }}>+{list.length - shown.length} more</span>}
            </div>
            <div className="row muted num" style={{ fontSize: 12, gap: 14, marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--border-soft)' }}>
              <span>Sprint progress <strong style={{ color: 'var(--text)' }}>{s.activeSprints ? `${tp}%` : '—'}</strong></span>
              <span>Overdue <strong style={{ color: 'var(--text)' }}>{s.overdue}</strong></span>
              <span>Defects <strong style={{ color: 'var(--text)' }}>{s.openDefects}</strong></span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export function HealthMix({ health }: { health: Record<Health, number> }) {
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

export function ProjectRow({ insight: i, today, holidays }: { insight: ProjectInsight; today: string; holidays: ReturnType<typeof useStore.getState>['holidays'] }) {
  const t = TRIBE_STYLE[i.project.tribe];
  return (
    <tr className="clickable">
      <td>
        <div className="row">
          <span className="nav-tile" style={{ background: t.bg, color: t.fg, width: 28, height: 28, fontSize: 10 }}>{i.project.code}</span>
          <div className="col" style={{ gap: 0 }}>
            <Link to={`/projects/${i.project.id}`} style={{ fontWeight: 600, color: 'var(--text)' }}>{i.project.name}</Link>
            <span className="muted truncate" style={{ fontSize: 12 }}>{i.project.client}</span>
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
