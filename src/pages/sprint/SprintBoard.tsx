import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { toast } from '../../components/toast';
import { Avatar, ColumnIcon, MenuButton, SeverityBadge, TypeBadge } from '../../components/ui';
import { fmtDue } from '../../domain/dates';
import type { ItemType, WorkflowStatus, WorkItem } from '../../domain/types';
import { columnOf, firstOfCategory } from '../../domain/workflow';
import { NewItemDialog } from '../../features/dialogs';
import { WorkflowDialog } from '../../features/WorkflowEditor';
import { useToday } from '../../store/hooks';
import { useStore } from '../../store/useStore';
import { useSprintCtx } from './SprintLayout';

const DONE_PREVIEW = 5;

export function SprintBoard() {
  const { project, sprint } = useSprintCtx();
  const allItems = useStore((s) => s.items);
  const members = useStore((s) => s.members);
  const me = useStore((s) => s.currentUserId);
  const updateItem = useStore((s) => s.updateItem);
  const moveStatus = useStore((s) => s.moveStatus);
  const workflow = project.workflow;
  const today = useToday();
  const [params, setParams] = useSearchParams();
  const mine = params.get('mine') === '1';
  const [q, setQ] = useState('');
  const [type, setType] = useState<ItemType | 'all'>('all');
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [addTo, setAddTo] = useState<string | null>(null);
  const [editingColumns, setEditingColumns] = useState(false);
  const [showAllDone, setShowAllDone] = useState(false);
  const readOnly = sprint.status === 'completed';

  const items = useMemo(
    () =>
      allItems
        .filter((i) => i.sprintId === sprint.id)
        .filter((i) => !mine || i.assigneeId === me)
        .filter((i) => type === 'all' || i.type === type)
        .filter((i) => !q.trim() || `${i.key} ${i.title}`.toLowerCase().includes(q.trim().toLowerCase())),
    [allItems, sprint.id, mine, me, type, q],
  );

  const setMine = (on: boolean) => {
    const next = new URLSearchParams(params);
    if (on) next.set('mine', '1');
    else next.delete('mine');
    setParams(next, { replace: true });
  };

  const move = (item: WorkItem, column: WorkflowStatus) => {
    const prev = columnOf(workflow, item);
    if (prev.id === column.id) return;
    updateItem(item.id, { statusId: column.id });
    toast(`${item.key} moved to ${column.name}.`, { label: 'Undo', run: () => updateItem(item.id, { statusId: prev.id }) });
  };

  const openTask = (id: string) => {
    const next = new URLSearchParams(params);
    next.set('task', id);
    setParams(next);
  };

  return (
    <div className="page" style={{ paddingTop: 16 }}>
      <div className="row wrap" style={{ gap: 10 }}>
        <label className="search-box">
          <Icon name="search" size={16} />
          <input type="search" aria-label="Search tasks" placeholder="Search by title or task ID" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <button
          type="button"
          className="btn btn-secondary btn-md"
          aria-pressed={mine}
          onClick={() => setMine(!mine)}
          style={mine ? { borderColor: 'var(--primary)', background: 'var(--primary-subtle)', color: 'var(--primary-darker)' } : undefined}
        >
          <Avatar member={members.find((m) => m.id === me) ?? null} /> Only my tasks
        </button>
        <label className="sr-only" htmlFor="sb-type">Type</label>
        <select id="sb-type" className="filter-select" value={type} onChange={(e) => setType(e.target.value as ItemType | 'all')}>
          <option value="all">Type: All</option>
          <option value="story">Type: Story</option>
          <option value="task">Type: Task</option>
          <option value="bug">Type: Bug</option>
        </select>
        <span className="grow" />
        {!readOnly && (
          <>
            <button type="button" className="btn btn-secondary btn-md" onClick={() => setEditingColumns(true)}>
              <Icon name="sliders" size={16} /> Edit columns
            </button>
            <button type="button" className="btn btn-primary btn-md" onClick={() => setAddTo(firstOfCategory(workflow, 'todo').id)}>
              <Icon name="plus" size={16} /> Add task
            </button>
          </>
        )}
      </div>

      <div className="board" style={{ overflowX: 'auto', gridTemplateColumns: `repeat(${workflow.length}, minmax(260px, 1fr))` }}>
        {workflow.map((column, colIdx) => {
          const isDone = column.category === 'done';
          const col = items
            .filter((i) => columnOf(workflow, i).id === column.id)
            .sort((a, b) => (a.completedAt ?? '').localeCompare(b.completedAt ?? '') * -1 || a.rank - b.rank);
          const limited = isDone && !showAllDone ? col.slice(0, DONE_PREVIEW) : col;
          return (
            <section
              key={column.id}
              className={`column ${over === column.id ? 'drop' : ''}`}
              aria-labelledby={`col-${column.id}`}
              onDragOver={(e) => {
                if (readOnly) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (over !== column.id) setOver(column.id);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData('text/plain') || dragId;
                const item = allItems.find((i) => i.id === id);
                if (item) move(item, column);
                setDragId(null);
                setOver(null);
              }}
            >
              <div className="column-head" style={{ alignItems: 'flex-start' }} title="Drag cards between columns, or use the card menu">
                <ColumnIcon column={column} />
                <h2 id={`col-${column.id}`} style={{ fontSize: 14, fontWeight: 600, minWidth: 0, overflowWrap: 'anywhere', lineHeight: 1.3 }}>{column.name}</h2>
                <span className="count-pill num">{col.length}</span>
                <span className="grow" />
                {!readOnly && (
                  <>
                    <button type="button" className="icon-btn sm" aria-label={`Add task to ${column.name}`} onClick={() => setAddTo(column.id)}>
                      <Icon name="plus" size={16} />
                    </button>
                    <MenuButton label={`Column options for ${column.name}`} trigger={<Icon name="more" size={16} />}>
                      {(close) => (
                        <>
                          <button type="button" role="menuitem" onClick={() => { close(); setEditingColumns(true); }}>
                            <Icon name="pen" size={16} /> Rename or edit columns
                          </button>
                          <button type="button" role="menuitem" disabled={colIdx === 0} onClick={() => { close(); moveStatus(project.id, column.id, colIdx - 1); }}>
                            <Icon name="chevronLeft" size={16} /> Move column left
                          </button>
                          <button type="button" role="menuitem" disabled={colIdx === workflow.length - 1} onClick={() => { close(); moveStatus(project.id, column.id, colIdx + 1); }}>
                            <Icon name="chevronRight" size={16} /> Move column right
                          </button>
                        </>
                      )}
                    </MenuButton>
                  </>
                )}
              </div>
              {col.length === 0 && (
                <div className="muted" style={{ fontSize: 12, padding: '16px 8px', textAlign: 'center', border: '1px dashed var(--border-strong)', borderRadius: 8 }}>
                  {dragId ? 'Drop here' : 'No tasks'}
                </div>
              )}
              {limited.map((i) => {
                const due = i.dueDate && i.status !== 'done' ? fmtDue(i.dueDate, today) : null;
                const assignee = members.find((m) => m.id === i.assigneeId) ?? null;
                const critDone = i.criteria.filter((c) => c.done).length;
                return (
                  <article
                    key={i.id}
                    className={`task-card ${dragId === i.id ? 'dragging' : ''}`}
                    draggable={!readOnly}
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', i.id);
                      // Defer the re-render: changing the dragged element synchronously can cancel the drag in Chromium.
                      setTimeout(() => setDragId(i.id), 0);
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setOver(null);
                    }}
                    aria-label={`${i.key} ${i.title}, ${column.name}`}
                  >
                    <div className="col" style={{ padding: '12px 12px 10px', gap: 8 }}>
                      <div className="row" style={{ fontSize: 12 }}>
                        <span className="muted num" style={{ fontWeight: 600 }}>{i.key}</span>
                        <TypeBadge type={i.type} />
                        {i.severity && i.severity !== 'minor' && <SeverityBadge severity={i.severity} />}
                        <span className="grow" />
                        {!readOnly && (
                          <MenuButton label={`Actions for ${i.key}`} trigger={<Icon name="more" size={16} />}>
                            {(close) => (
                              <>
                                <button type="button" role="menuitem" onClick={() => { close(); openTask(i.id); }}>
                                  <Icon name="external" size={16} /> Open details
                                </button>
                                <div className="menu-sep" />
                                {workflow.filter((w) => w.id !== column.id).map((w) => (
                                  <button key={w.id} type="button" role="menuitem" onClick={() => { close(); move(i, w); }}>
                                    <ColumnIcon column={w} size={14} /> Move to {w.name}
                                  </button>
                                ))}
                                {i.assigneeId !== me && (
                                  <>
                                    <div className="menu-sep" />
                                    <button type="button" role="menuitem" onClick={() => { close(); updateItem(i.id, { assigneeId: me }); toast(`${i.key} assigned to you.`); }}>
                                      <Icon name="userPlus" size={16} /> Assign to me
                                    </button>
                                  </>
                                )}
                              </>
                            )}
                          </MenuButton>
                        )}
                      </div>
                      <button type="button" className="task-card-title" onClick={() => openTask(i.id)}>{i.title}</button>
                      {i.description && (
                        <span className="muted" style={{ fontSize: 12, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {i.description}
                        </span>
                      )}
                      <div className="row" style={{ fontSize: 12 }}>
                        {due && (
                          <span className={`chip-date ${due.tone === 'neutral' ? '' : due.tone}`}>
                            <Icon name="calendar" size={13} /> {due.label}
                          </span>
                        )}
                        <span className="grow" />
                        <span className="row num" style={{ gap: 4, fontWeight: 600, color: i.weight === null ? 'var(--warning-text)' : 'var(--text-2)' }}>
                          <Icon name="weight" size={13} color="var(--text-muted)" />
                          {i.weight === null ? 'No weight' : `Weight ${i.weight}`}
                        </span>
                      </div>
                    </div>
                    <div className="row" style={{ gap: 12, padding: '8px 12px', borderTop: '1px solid var(--border-soft)', fontSize: 12, color: 'var(--text-muted)' }}>
                      <Avatar member={assignee} />
                      <span className="grow" />
                      {i.criteria.length > 0 && (
                        <span className="row num" style={{ gap: 4 }} title="Acceptance criteria done">
                          <Icon name="checkCircle" size={14} /> {critDone}/{i.criteria.length}
                        </span>
                      )}
                      <span className="row num" style={{ gap: 4 }} title="Comments"><Icon name="message" size={14} /> {i.comments.length}</span>
                      <span className="row num" style={{ gap: 4 }} title="Attachments"><Icon name="paperclip" size={14} /> {i.attachments.length}</span>
                    </div>
                  </article>
                );
              })}
              {isDone && col.length > DONE_PREVIEW && (
                <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--primary-darker)', justifyContent: 'flex-start' }} onClick={() => setShowAllDone((v) => !v)}>
                  {showAllDone ? 'Show fewer' : `Show ${col.length - DONE_PREVIEW} more done tasks`}
                </button>
              )}
              {!readOnly && (
                <button type="button" className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start', color: 'var(--text-muted)' }} onClick={() => setAddTo(column.id)}>
                  <Icon name="plus" size={16} /> Add task
                </button>
              )}
            </section>
          );
        })}
      </div>
      {addTo && <NewItemDialog projectId={project.id} sprintId={sprint.id} statusId={addTo} onClose={() => setAddTo(null)} />}
      {editingColumns && <WorkflowDialog project={project} onClose={() => setEditingColumns(false)} />}
    </div>
  );
}
