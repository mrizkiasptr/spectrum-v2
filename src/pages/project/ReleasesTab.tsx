import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { toast } from '../../components/toast';
import { Empty, TypeBadge } from '../../components/ui';
import { fmtDate } from '../../domain/dates';
import { sprintName } from '../../domain/sprint';
import type { ReleaseState } from '../../domain/types';
import { useProjectItems, useProjectSprints } from '../../store/hooks';
import { useStore } from '../../store/useStore';
import { useProjectCtx } from './ProjectLayout';

const LABEL: Record<ReleaseState, string> = { unreleased: 'Not released', partial: 'Partially released', released: 'Released' };

export function ReleasesTab() {
  const { project } = useProjectCtx();
  const items = useProjectItems(project.id);
  const sprints = useProjectSprints(project.id);
  const updateItem = useStore((s) => s.updateItem);
  const [, setParams] = useSearchParams();
  const [filter, setFilter] = useState<ReleaseState | 'all'>('unreleased');
  const [selected, setSelected] = useState<string[]>([]);

  const done = items.filter((i) => i.status === 'done' && i.type !== 'task').sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
  const counts = { unreleased: 0, partial: 0, released: 0 } as Record<ReleaseState, number>;
  done.forEach((i) => counts[i.release]++);
  const shown = done.filter((i) => filter === 'all' || i.release === filter);

  const bulk = (release: ReleaseState) => {
    selected.forEach((id) => updateItem(id, { release }));
    toast(`${selected.length} item${selected.length > 1 ? 's' : ''} marked ${LABEL[release].toLowerCase()}.`);
    setSelected([]);
  };

  return (
    <div className="page">
      <div className="col" style={{ gap: 4 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Releases</h2>
        <p className="muted" style={{ fontSize: 13 }}>
          Done backlog items form the increment. Track which parts have reached production.
        </p>
      </div>
      <div className="grid-3">
        {(Object.keys(LABEL) as ReleaseState[]).map((k) => (
          <button
            key={k}
            type="button"
            className="card"
            aria-pressed={filter === k}
            onClick={() => setFilter(filter === k ? 'all' : k)}
            style={{ padding: 16, textAlign: 'left', cursor: 'pointer', borderColor: filter === k ? 'var(--primary)' : undefined, boxShadow: filter === k ? '0 0 0 1px var(--primary)' : undefined }}
          >
            <div className="muted" style={{ fontSize: 12 }}>{LABEL[k]}</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700 }}>{counts[k]}</div>
          </button>
        ))}
      </div>

      {selected.length > 0 && (
        <div className="row wrap" role="region" aria-label="Bulk actions" style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--primary-subtle)', border: '1px solid var(--primary-border)' }}>
          <strong>{selected.length} selected</strong>
          <span className="grow" />
          <button type="button" className="btn btn-primary btn-md" onClick={() => bulk('released')}>Mark released</button>
          <button type="button" className="btn btn-secondary btn-md" onClick={() => bulk('partial')}>Mark partial</button>
          <button type="button" className="btn btn-secondary btn-md" onClick={() => bulk('unreleased')}>Mark not released</button>
          <button type="button" className="btn btn-ghost btn-md" onClick={() => setSelected([])}>Clear</button>
        </div>
      )}

      {shown.length === 0 ? (
        <Empty icon="box" title={done.length ? 'Nothing in this group' : 'No finished work yet'}>
          <span>{done.length ? 'Pick another group above.' : 'Items appear here once they are marked done on a sprint board.'}</span>
        </Empty>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col" style={{ width: 44 }}>
                  <input
                    type="checkbox"
                    aria-label="Select all shown items"
                    checked={shown.every((i) => selected.includes(i.id))}
                    onChange={(e) => setSelected(e.target.checked ? shown.map((i) => i.id) : [])}
                    style={{ accentColor: 'var(--primary)' }}
                  />
                </th>
                <th scope="col" style={{ width: 96 }}>ID</th>
                <th scope="col">Item</th>
                <th scope="col" style={{ width: 120 }}>Sprint</th>
                <th scope="col" style={{ width: 120 }}>Done on</th>
                <th scope="col" style={{ width: 200 }}>Release</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((i) => {
                const s = sprints.find((x) => x.id === i.sprintId);
                return (
                  <tr key={i.id} className="clickable">
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Select ${i.key}`}
                        checked={selected.includes(i.id)}
                        onChange={() => setSelected((x) => (x.includes(i.id) ? x.filter((y) => y !== i.id) : [...x, i.id]))}
                        style={{ accentColor: 'var(--primary)' }}
                      />
                    </td>
                    <td className="muted num">{i.key}</td>
                    <td>
                      <div className="row">
                        <TypeBadge type={i.type} />
                        <button type="button" className="task-card-title truncate" onClick={() => setParams({ task: i.id })}>{i.title}</button>
                      </div>
                    </td>
                    <td>{s ? sprintName(s) : <span className="subtle">Backlog</span>}</td>
                    <td className="num muted">{fmtDate(i.completedAt?.slice(0, 10))}</td>
                    <td>
                      <label className="sr-only" htmlFor={`rel-${i.id}`}>Release status for {i.key}</label>
                      <div className="row">
                        <Icon
                          name={i.release === 'released' ? 'checkCircle' : i.release === 'partial' ? 'info' : 'box'}
                          size={16}
                          color={i.release === 'released' ? 'var(--success)' : i.release === 'partial' ? 'var(--warning)' : 'var(--text-subtle)'}
                        />
                        <select id={`rel-${i.id}`} className="filter-select" style={{ height: 32 }} value={i.release} onChange={(e) => updateItem(i.id, { release: e.target.value as ReleaseState })}>
                          {(Object.keys(LABEL) as ReleaseState[]).map((k) => <option key={k} value={k}>{LABEL[k]}</option>)}
                        </select>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
