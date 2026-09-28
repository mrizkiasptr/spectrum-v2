import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { Avatar, Empty, SeverityBadge, ItemStatusBadge } from '../../components/ui';
import { fmtDate } from '../../domain/dates';
import { sprintName } from '../../domain/sprint';
import type { Severity } from '../../domain/types';
import { NewItemDialog } from '../../features/dialogs';
import { useProjectItems, useProjectSprints } from '../../store/hooks';
import { useStore } from '../../store/useStore';
import { useProjectCtx } from './ProjectLayout';

const SEV_RANK: Record<Severity, number> = { critical: 0, major: 1, minor: 2 };

export function DefectsTab() {
  const { project } = useProjectCtx();
  const items = useProjectItems(project.id);
  const sprints = useProjectSprints(project.id);
  const members = useStore((s) => s.members);
  const moveToSprint = useStore((s) => s.moveToSprint);
  const [, setParams] = useSearchParams();
  const [state, setState] = useState<'open' | 'fixed' | 'all'>('open');
  const [severity, setSeverity] = useState<Severity | 'all'>('all');
  const [adding, setAdding] = useState(false);

  const active = sprints.find((s) => s.status === 'active');
  const bugs = items
    .filter((i) => i.type === 'bug')
    .filter((i) => (state === 'all' ? true : state === 'open' ? i.status !== 'done' : i.status === 'done'))
    .filter((i) => severity === 'all' || i.severity === severity)
    .sort((a, b) => SEV_RANK[a.severity ?? 'minor'] - SEV_RANK[b.severity ?? 'minor'] || a.key.localeCompare(b.key));
  const openCount = items.filter((i) => i.type === 'bug' && i.status !== 'done').length;

  return (
    <div className="page">
      <div className="page-head">
        <div className="col" style={{ gap: 4 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Defects</h2>
          <p className="muted" style={{ fontSize: 13 }}>{openCount} open. Defects are bugs on the backlog or a sprint, so they flow through the same board.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
          <Icon name="plus" size={18} /> Report defect
        </button>
      </div>
      <div className="row wrap">
        <div className="seg" role="tablist" aria-label="Defect state">
          {(['open', 'fixed', 'all'] as const).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={state === k} onClick={() => setState(k)}>
              {k === 'open' ? 'Open' : k === 'fixed' ? 'Fixed' : 'All'}
            </button>
          ))}
        </div>
        <label className="sr-only" htmlFor="df-sev">Severity</label>
        <select id="df-sev" className="filter-select" value={severity} onChange={(e) => setSeverity(e.target.value as Severity | 'all')}>
          <option value="all">Severity: All</option>
          <option value="critical">Severity: Critical</option>
          <option value="major">Severity: Major</option>
          <option value="minor">Severity: Minor</option>
        </select>
      </div>
      {bugs.length === 0 ? (
        <Empty icon="bug" title={state === 'open' ? 'No open defects' : 'No defects found'}>
          <span>{state === 'open' ? 'Nice. Report one when QA or users find an issue.' : 'Try another filter.'}</span>
        </Empty>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col" style={{ width: 96 }}>ID</th>
                <th scope="col">Defect</th>
                <th scope="col" style={{ width: 110 }}>Severity</th>
                <th scope="col" style={{ width: 150 }}>Status</th>
                <th scope="col" style={{ width: 160 }}>Where</th>
                <th scope="col" style={{ width: 64 }}>Owner</th>
              </tr>
            </thead>
            <tbody>
              {bugs.map((b) => {
                const s = sprints.find((x) => x.id === b.sprintId);
                return (
                  <tr key={b.id} className="clickable">
                    <td className="muted num">{b.key}</td>
                    <td>
                      <div className="col" style={{ gap: 2 }}>
                        <button type="button" className="task-card-title" onClick={() => setParams({ task: b.id })}>{b.title}</button>
                        <span className="muted" style={{ fontSize: 12 }}>Reported {fmtDate(b.createdAt.slice(0, 10))}</span>
                      </div>
                    </td>
                    <td>{b.severity && <SeverityBadge severity={b.severity} />}</td>
                    <td><ItemStatusBadge item={b} /></td>
                    <td>
                      {s ? (
                        sprintName(s)
                      ) : active && b.status !== 'done' ? (
                        <button type="button" className="btn-link" style={{ fontSize: 13 }} onClick={() => moveToSprint([b.id], active.id)}>
                          Add to {sprintName(active)}
                        </button>
                      ) : (
                        <span className="subtle">Backlog</span>
                      )}
                    </td>
                    <td><Avatar member={members.find((m) => m.id === b.assigneeId) ?? null} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {adding && <NewItemDialog projectId={project.id} sprintId={null} defaultType="bug" onClose={() => setAdding(false)} />}
    </div>
  );
}
