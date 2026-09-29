import { Fragment, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { toast } from '../../components/toast';
import { Avatar, Empty, ItemStatusBadge, SeverityBadge, TypeBadge } from '../../components/ui';
import { tasksOf } from '../../domain/hierarchy';
import { isSprintReady, sprintName } from '../../domain/sprint';
import type { ItemType } from '../../domain/types';
import { WEIGHTS } from '../../domain/types';
import { NewItemDialog, NewTaskDialog } from '../../features/dialogs';
import { useProjectItems, useProjectSprints } from '../../store/hooks';
import { useStore } from '../../store/useStore';
import { useProjectCtx } from './ProjectLayout';

export function BacklogTab() {
  const { project } = useProjectCtx();
  const items = useProjectItems(project.id);
  const sprints = useProjectSprints(project.id);
  const members = useStore((s) => s.members);
  const updateItem = useStore((s) => s.updateItem);
  const reorder = useStore((s) => s.reorderBacklog);
  const moveToSprint = useStore((s) => s.moveToSprint);
  const [, setParams] = useSearchParams();

  const [q, setQ] = useState('');
  const [type, setType] = useState<ItemType | 'all'>('all');
  const [onlyUnestimated, setOnlyUnestimated] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [addTaskTo, setAddTaskTo] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const targets = sprints.filter((s) => s.status !== 'completed').sort((a, b) => a.number - b.number);
  const [target, setTarget] = useState<string>('');
  const targetId = target || targets.find((s) => s.status === 'draft')?.id || targets[0]?.id || '';

  const backlog = useMemo(
    () => items.filter((i) => i.sprintId === null && i.status !== 'done' && i.type !== 'task').sort((a, b) => a.rank - b.rank),
    [items],
  );
  const shown = backlog.filter(
    (i) =>
      (type === 'all' || i.type === type) &&
      (!onlyUnestimated || i.weight === null) &&
      (!q.trim() || `${i.key} ${i.title}`.toLowerCase().includes(q.trim().toLowerCase())),
  );
  const filtered = shown.length !== backlog.length;
  const allSelected = shown.length > 0 && shown.every((i) => selected.includes(i.id));
  const readyCount = backlog.filter(isSprintReady).length;
  const readyWeight = backlog.filter(isSprintReady).reduce((t, i) => t + (i.weight ?? 0), 0);

  return (
    <div className="page">
      <div className="page-head">
        <div className="col" style={{ gap: 4 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Product backlog</h2>
          <p className="muted" style={{ fontSize: 13 }}>
            {backlog.length} items · {readyCount} sprint-ready ({readyWeight} weight). Order from most to least important. Tasks go with their item into a sprint.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
          <Icon name="plus" size={18} /> Add backlog item
        </button>
      </div>

      <div className="row wrap" style={{ gap: 10 }}>
        <label className="search-box">
          <Icon name="search" size={16} />
          <input type="search" aria-label="Search backlog" placeholder="Search by title or ID" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <label className="sr-only" htmlFor="bl-type">Type</label>
        <select id="bl-type" className="filter-select" value={type} onChange={(e) => setType(e.target.value as ItemType | 'all')}>
          <option value="all">Type: All</option>
          <option value="story">Type: Backlog</option>
          <option value="bug">Type: Bug</option>
        </select>
        <label className="check" style={{ fontSize: 13, alignItems: 'center' }}>
          <input type="checkbox" checked={onlyUnestimated} onChange={(e) => setOnlyUnestimated(e.target.checked)} style={{ marginTop: 0 }} />
          Only not estimated
        </label>
      </div>

      {selected.length > 0 && (
        <div className="row wrap" style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--primary-subtle)', border: '1px solid var(--primary-border)' }} role="region" aria-label="Bulk actions">
          <strong>{selected.length} selected</strong>
          <span className="grow" />
          {targets.length ? (
            <>
              <label className="sr-only" htmlFor="bl-target">Target sprint</label>
              <select id="bl-target" className="filter-select" value={targetId} onChange={(e) => setTarget(e.target.value)}>
                {targets.map((s) => (
                  <option key={s.id} value={s.id}>{sprintName(s)} {s.status === 'draft' ? '(draft)' : '(active)'}</option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-primary btn-md"
                onClick={() => {
                  const s = targets.find((x) => x.id === targetId)!;
                  moveToSprint(selected, targetId);
                  toast(`${selected.length} item${selected.length > 1 ? 's' : ''} added to ${sprintName(s)}.`, {
                    label: 'Undo',
                    run: () => moveToSprint(selected, null),
                  });
                  setSelected([]);
                }}
              >
                Add to sprint
              </button>
            </>
          ) : (
            <span className="muted" style={{ fontSize: 13 }}>Create a sprint first to plan these items.</span>
          )}
          <button type="button" className="btn btn-ghost btn-md" onClick={() => setSelected([])}>Clear</button>
        </div>
      )}

      {shown.length === 0 ? (
        <Empty icon="layers" title={filtered ? 'No items match the filters' : 'The backlog is empty'}>
          {filtered ? <span>Try clearing the search or filters.</span> : <span>Add the backlog items and bugs the team will work on next. Break them into tasks when you refine or plan them.</span>}
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
                    checked={allSelected}
                    onChange={() => setSelected(allSelected ? [] : shown.map((i) => i.id))}
                    style={{ accentColor: 'var(--primary)' }}
                  />
                </th>
                <th scope="col" style={{ width: 84 }}>Order</th>
                <th scope="col" style={{ width: 96 }}>ID</th>
                <th scope="col">Title</th>
                <th scope="col" style={{ width: 140 }}>Weight</th>
                <th scope="col" style={{ width: 130 }}>Readiness</th>
                <th scope="col" style={{ width: 110 }}>Tasks</th>
                <th scope="col" style={{ width: 64 }}>Owner</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((i, idx) => {
                const ready = isSprintReady(i);
                const tasks = tasksOf(items, i.id);
                const expanded = !!open[i.id];
                return (
                  <Fragment key={i.id}>
                  <tr className="clickable">
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Select ${i.key}`}
                        checked={selected.includes(i.id)}
                        onChange={() => setSelected((s) => (s.includes(i.id) ? s.filter((x) => x !== i.id) : [...s, i.id]))}
                        style={{ accentColor: 'var(--primary)' }}
                      />
                    </td>
                    <td>
                      <div className="row" style={{ gap: 2 }}>
                        <button type="button" className="icon-btn sm" aria-label={`Move ${i.key} up`} disabled={filtered || idx === 0} onClick={() => reorder(i.id, -1)}>
                          <Icon name="chevronUp" size={16} />
                        </button>
                        <button type="button" className="icon-btn sm" aria-label={`Move ${i.key} down`} disabled={filtered || idx === shown.length - 1} onClick={() => reorder(i.id, 1)}>
                          <Icon name="chevronDown" size={16} />
                        </button>
                      </div>
                    </td>
                    <td className="muted num">{i.key}</td>
                    <td>
                      <div className="row">
                        <TypeBadge type={i.type} />
                        {i.severity && <SeverityBadge severity={i.severity} />}
                        <button type="button" className="task-card-title truncate" onClick={() => setParams({ task: i.id })}>{i.title}</button>
                      </div>
                    </td>
                    <td>
                      <label className="sr-only" htmlFor={`w-${i.id}`}>Weight for {i.key}</label>
                      <select
                        id={`w-${i.id}`}
                        className="filter-select"
                        style={{ height: 32, width: 120, color: i.weight === null ? 'var(--warning-text)' : undefined }}
                        value={i.weight ?? ''}
                        onChange={(e) => updateItem(i.id, { weight: e.target.value ? Number(e.target.value) : null })}
                      >
                        <option value="">Estimate…</option>
                        {WEIGHTS.map((w) => <option key={w} value={w}>{w}</option>)}
                      </select>
                    </td>
                    <td>
                      {ready ? (
                        <span className="badge success sm"><Icon name="check" size={11} strokeWidth={3} /> Ready</span>
                      ) : (
                        <span className="badge sm" title={i.weight === null ? 'Needs a weight' : 'Needs acceptance criteria'}>
                          {i.weight === null ? 'Needs weight' : 'Needs criteria'}
                        </span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        aria-expanded={expanded}
                        aria-label={`${expanded ? 'Hide' : 'Show'} tasks of ${i.key}`}
                        onClick={() => setOpen((o) => ({ ...o, [i.id]: !expanded }))}
                        style={{ paddingLeft: 6, color: tasks.length ? 'var(--text-2)' : 'var(--text-muted)' }}
                      >
                        <Icon name={expanded ? 'chevronDown' : 'chevronRight'} size={14} /> {tasks.length || 'None'}
                      </button>
                    </td>
                    <td><Avatar member={members.find((m) => m.id === i.assigneeId) ?? null} /></td>
                  </tr>
                  {expanded && tasks.map((t) => (
                    <tr key={t.id} className="subrow">
                      <td />
                      <td />
                      <td className="muted num">{t.key}</td>
                      <td colSpan={3}>
                        <div className="row" style={{ paddingLeft: 12 }}>
                          <Icon name="chevronRight" size={12} color="var(--text-subtle)" />
                          <span className="task-chip">Task</span>
                          <button type="button" className="task-card-title truncate" onClick={() => setParams({ task: t.id })}>{t.title}</button>
                        </div>
                      </td>
                      <td><ItemStatusBadge item={t} /></td>
                      <td><Avatar member={members.find((m) => m.id === t.assigneeId) ?? null} /></td>
                    </tr>
                  ))}
                  {expanded && (
                    <tr className="subrow">
                      <td colSpan={2} />
                      <td colSpan={6}>
                        <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--primary-darker)', paddingLeft: 12 }} onClick={() => setAddTaskTo(i.id)}>
                          <Icon name="plus" size={14} /> {tasks.length ? 'Add task' : 'Break into tasks'}
                        </button>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {filtered && shown.length > 0 && <p className="muted" style={{ fontSize: 12 }}>Clear filters to reorder the backlog.</p>}
      {adding && <NewItemDialog projectId={project.id} sprintId={null} onClose={() => setAdding(false)} />}
      {addTaskTo && <NewTaskDialog projectId={project.id} sprintId={null} parentId={addTaskTo} onClose={() => setAddTaskTo(null)} />}
    </div>
  );
}
