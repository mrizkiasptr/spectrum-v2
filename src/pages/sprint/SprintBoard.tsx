import { useMemo, useState, type DragEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { toast } from '../../components/toast';
import { Avatar, ColumnIcon, ItemStatusBadge, MenuButton, SeverityBadge, TypeBadge } from '../../components/ui';
import { fmtDue } from '../../domain/dates';
import { boardCards, tasksOf } from '../../domain/hierarchy';
import type { ItemType, WorkflowStatus, WorkItem } from '../../domain/types';
import { columnOf, firstOfCategory } from '../../domain/workflow';
import { NewItemDialog, NewTaskDialog } from '../../features/dialogs';
import { WorkflowDialog } from '../../features/WorkflowEditor';
import { useToday } from '../../store/hooks';
import { useStore } from '../../store/useStore';
import { useSprintCtx } from './SprintLayout';

const DONE_PREVIEW = 5;
type View = 'lanes' | 'flat';

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
    (next) => {
      setV(next);
      try {
        localStorage.setItem(key, next);
      } catch {
        /* ignore */
      }
    },
  ];
}

/**
 * Sprint taskboard. Default view: one lane per backlog item, its tasks in the workflow columns
 * (items not broken down yet show as a card themselves). "Columns" view: all cards per column.
 */
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
  const [view, setView] = usePref<View>('sb-view', 'lanes');
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [addTask, setAddTask] = useState<{ parentId?: string; statusId?: string } | null>(null);
  const [addItem, setAddItem] = useState(false);
  const [editingColumns, setEditingColumns] = useState(false);
  const [showAllDone, setShowAllDone] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const readOnly = sprint.status === 'completed';

  const scope = useMemo(() => allItems.filter((i) => i.sprintId === sprint.id), [allItems, sprint.id]);
  const query = q.trim().toLowerCase();
  const matches = (i: WorkItem) => !query || `${i.key} ${i.title}`.toLowerCase().includes(query);

  // Backlog items of the sprint (lanes), filtered by type; each keeps the cards that pass the filters.
  const lanes = useMemo(() => {
    return scope
      .filter((i) => i.type !== 'task' && (type === 'all' || i.type === type))
      .sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done') || a.rank - b.rank)
      .map((item) => {
        const tasks = tasksOf(scope, item.id);
        const cards = (tasks.length ? tasks : [item]).filter((c) => (!mine || c.assigneeId === me) && (matches(c) || matches(item)));
        return { item, tasks, cards };
      })
      .filter((l) => l.cards.length || (!mine && matches(l.item)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, type, mine, me, query]);

  const flatCards = useMemo(
    () =>
      boardCards(scope).filter((c) => {
        const parent = c.parentId ? scope.find((i) => i.id === c.parentId) : c;
        return (!mine || c.assigneeId === me) && (type === 'all' || parent?.type === type) && (matches(c) || (parent && matches(parent)));
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scope, mine, me, type, query],
  );

  const setMine = (on: boolean) => {
    const next = new URLSearchParams(params);
    if (on) next.set('mine', '1');
    else next.delete('mine');
    setParams(next, { replace: true });
  };

  const move = (card: WorkItem, column: WorkflowStatus) => {
    const prev = columnOf(workflow, card);
    if (prev.id === column.id) return;
    updateItem(card.id, { statusId: column.id });
    toast(`${card.key} moved to ${column.name}.`, { label: 'Undo', run: () => updateItem(card.id, { statusId: prev.id }) });
  };

  const openTask = (id: string) => {
    const next = new URLSearchParams(params);
    next.set('task', id);
    setParams(next);
  };

  /** Drop handlers for a cell; in lanes view a card only moves within its own backlog item. */
  const dropZone = (zone: string, column: WorkflowStatus, laneId?: string) => ({
    onDragOver: (e: DragEvent) => {
      if (readOnly) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (over !== zone) setOver(zone);
    },
    onDragLeave: (e: DragEvent<HTMLElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null);
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      const id = e.dataTransfer.getData('text/plain') || dragId;
      const card = allItems.find((i) => i.id === id);
      setDragId(null);
      setOver(null);
      if (!card) return;
      if (laneId && (card.parentId ?? card.id) !== laneId) {
        toast('Tasks stay with their backlog item. Drop it in its own row.');
        return;
      }
      move(card, column);
    },
  });

  const renderCard = (i: WorkItem, column: WorkflowStatus, showParent: boolean) => {
    const due = i.dueDate && i.status !== 'done' ? fmtDue(i.dueDate, today) : null;
    const assignee = members.find((m) => m.id === i.assigneeId) ?? null;
    const isTask = i.type === 'task';
    const parent = isTask ? scope.find((x) => x.id === i.parentId) : null;
    const critDone = i.criteria.filter((c) => c.done).length;
    return (
      <article
        key={i.id}
        className={`task-card ${dragId === i.id ? 'dragging' : ''} ${isTask ? 'is-task' : ''}`}
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
        <div className="col" style={{ padding: isTask ? '10px 12px 8px' : '12px 12px 10px', gap: isTask ? 6 : 8 }}>
          <div className="row" style={{ fontSize: 12 }}>
            <span className="muted num" style={{ fontWeight: 600 }}>{i.key}</span>
            {isTask ? <span className="task-chip">Task</span> : <TypeBadge type={i.type} />}
            {i.severity && i.severity !== 'minor' && <SeverityBadge severity={i.severity} />}
            <span className="grow" />
            {!readOnly && (
              <MenuButton label={`Actions for ${i.key}`} trigger={<Icon name="more" size={16} />}>
                {(close) => (
                  <>
                    <button type="button" role="menuitem" onClick={() => { close(); openTask(i.id); }}>
                      <Icon name="external" size={16} /> Open details
                    </button>
                    {!isTask && (
                      <button type="button" role="menuitem" onClick={() => { close(); setAddTask({ parentId: i.id }); }}>
                        <Icon name="plus" size={16} /> Break into tasks
                      </button>
                    )}
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
          {showParent && parent && (
            <button type="button" className="parent-link truncate" onClick={() => openTask(parent.id)} title={`${parent.key} ${parent.title}`}>
              <Icon name="layers" size={12} /> {parent.key} · {parent.title}
            </button>
          )}
          {!isTask && i.description && (
            <span className="muted" style={{ fontSize: 12, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {i.description}
            </span>
          )}
          {(due || !isTask) && (
            <div className="row" style={{ fontSize: 12 }}>
              {due && (
                <span className={`chip-date ${due.tone === 'neutral' ? '' : due.tone}`}>
                  <Icon name="calendar" size={13} /> {due.label}
                </span>
              )}
              <span className="grow" />
              {!isTask && (
                <span className="row num" style={{ gap: 4, fontWeight: 600, color: i.weight === null ? 'var(--warning-text)' : 'var(--text-2)' }}>
                  <Icon name="weight" size={13} color="var(--text-muted)" />
                  {i.weight === null ? 'No weight' : `Weight ${i.weight}`}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="row" style={{ gap: 12, padding: '6px 12px', borderTop: '1px solid var(--border-soft)', fontSize: 12, color: 'var(--text-muted)' }}>
          <Avatar member={assignee} />
          <span className="grow" />
          {i.criteria.length > 0 && (
            <span className="row num" style={{ gap: 4 }} title="Acceptance criteria done">
              <Icon name="checkCircle" size={14} /> {critDone}/{i.criteria.length}
            </span>
          )}
          {i.comments.length > 0 && <span className="row num" style={{ gap: 4 }} title="Comments"><Icon name="message" size={14} /> {i.comments.length}</span>}
          {i.attachments.length > 0 && <span className="row num" style={{ gap: 4 }} title="Attachments"><Icon name="paperclip" size={14} /> {i.attachments.length}</span>}
        </div>
      </article>
    );
  };

  const columnHead = (column: WorkflowStatus, colIdx: number, count: number) => (
    <div className="column-head" style={{ alignItems: 'flex-start' }} title="Drag cards between columns, or use the card menu">
      <ColumnIcon column={column} />
      <h2 id={`col-${column.id}`} style={{ fontSize: 14, fontWeight: 600, minWidth: 0, overflowWrap: 'break-word', hyphens: 'auto', lineHeight: 1.3 }}>{column.name}</h2>
      <span className="count-pill num">{count}</span>
      <span className="grow" />
      {!readOnly && (
        <>
          <button type="button" className="icon-btn sm" aria-label={`Add task to ${column.name}`} onClick={() => setAddTask({ statusId: column.id })}>
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
  );

  const laneCards = lanes.flatMap((l) => l.cards);
  const gridCols = `minmax(240px, 280px) repeat(${workflow.length}, minmax(236px, 1fr))`;

  return (
    <div className="page" style={{ paddingTop: 16 }}>
      <div className="row wrap" style={{ gap: 10 }}>
        <label className="search-box">
          <Icon name="search" size={16} />
          <input type="search" aria-label="Search tasks and backlog items" placeholder="Search by title or ID" value={q} onChange={(e) => setQ(e.target.value)} />
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
        <label className="sr-only" htmlFor="sb-type">Backlog item type</label>
        <select id="sb-type" className="filter-select" value={type} onChange={(e) => setType(e.target.value as ItemType | 'all')}>
          <option value="all">Items: All</option>
          <option value="story">Items: Stories</option>
          <option value="bug">Items: Bugs</option>
        </select>
        <div className="seg" role="radiogroup" aria-label="Board layout">
          <button type="button" role="radio" aria-checked={view === 'lanes'} onClick={() => setView('lanes')}>By backlog item</button>
          <button type="button" role="radio" aria-checked={view === 'flat'} onClick={() => setView('flat')}>Columns only</button>
        </div>
        <span className="grow" />
        {!readOnly && (
          <>
            <button type="button" className="btn btn-secondary btn-md" onClick={() => setEditingColumns(true)}>
              <Icon name="sliders" size={16} /> Edit columns
            </button>
            <button type="button" className="btn btn-secondary btn-md" onClick={() => setAddItem(true)}>
              <Icon name="layers" size={16} /> Add backlog item
            </button>
            <button type="button" className="btn btn-primary btn-md" onClick={() => setAddTask({ statusId: firstOfCategory(workflow, 'todo').id })}>
              <Icon name="plus" size={16} /> Add task
            </button>
          </>
        )}
      </div>

      {view === 'lanes' ? (
        <div className="taskboard" role="table" aria-label="Sprint taskboard" style={{ gridTemplateColumns: gridCols }}>
          <div className="tb-head tb-sticky" role="columnheader">
            <div className="column-head">
              <Icon name="layers" size={16} />
              <h2 style={{ fontSize: 14, fontWeight: 600 }}>Backlog item</h2>
              <span className="count-pill num">{lanes.length}</span>
            </div>
          </div>
          {workflow.map((column, colIdx) => (
            <div key={column.id} className="tb-head" role="columnheader">
              {columnHead(column, colIdx, laneCards.filter((c) => columnOf(workflow, c).id === column.id).length)}
            </div>
          ))}

          {lanes.length === 0 && (
            <div className="tb-empty" style={{ gridColumn: `1 / span ${workflow.length + 1}` }}>
              {scope.some((i) => i.type !== 'task')
                ? 'Nothing matches these filters.'
                : 'No backlog items in this sprint yet. Plan stories or bugs from the Backlog, then break them into tasks here.'}
            </div>
          )}

          {lanes.map(({ item, tasks, cards }) => {
            const isCollapsed = collapsed[item.id] ?? item.status === 'done';
            const doneTasks = tasks.filter((t) => t.status === 'done').length;
            const owner = members.find((m) => m.id === item.assigneeId) ?? null;
            return (
              <div key={item.id} className="tb-lane" role="row">
                <div className={`tb-lane-head tb-sticky ${isCollapsed ? 'collapsed' : ''}`} role="rowheader">
                  <div className="row" style={{ gap: 6, fontSize: 12 }}>
                    <button
                      type="button"
                      className="icon-btn sm"
                      aria-expanded={!isCollapsed}
                      aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${item.key}`}
                      onClick={() => setCollapsed((c) => ({ ...c, [item.id]: !isCollapsed }))}
                    >
                      <Icon name={isCollapsed ? 'chevronRight' : 'chevronDown'} size={14} />
                    </button>
                    <span className="muted num" style={{ fontWeight: 600 }}>{item.key}</span>
                    <TypeBadge type={item.type} />
                    {item.severity && item.severity !== 'minor' && <SeverityBadge severity={item.severity} />}
                  </div>
                  <button type="button" className="task-card-title" style={{ fontSize: 14 }} onClick={() => openTask(item.id)}>{item.title}</button>
                  <div className="row wrap" style={{ gap: 8, fontSize: 12 }}>
                    <ItemStatusBadge item={item} />
                    <span className="row num muted" style={{ gap: 4 }}>
                      <Icon name="weight" size={13} /> {item.weight ?? '—'}
                    </span>
                    {tasks.length > 0 && (
                      <span className="row num muted" style={{ gap: 4 }} title="Tasks done">
                        <Icon name="checkCircle" size={13} /> {doneTasks}/{tasks.length} tasks
                      </span>
                    )}
                    <span className="grow" />
                    <Avatar member={owner} title={owner ? `Owner: ${owner.name}` : 'No owner'} />
                  </div>
                  {tasks.length > 0 && (
                    <div className="tb-progress" aria-hidden="true"><span style={{ width: `${(doneTasks / tasks.length) * 100}%` }} /></div>
                  )}
                  {!readOnly && !isCollapsed && (
                    <button type="button" className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start', color: 'var(--primary-darker)', paddingLeft: 4 }} onClick={() => setAddTask({ parentId: item.id })}>
                      <Icon name="plus" size={14} /> {tasks.length ? 'Add task' : 'Break into tasks'}
                    </button>
                  )}
                </div>
                {workflow.map((column) => {
                  const zone = `${item.id}:${column.id}`;
                  const cellCards = cards.filter((c) => columnOf(workflow, c).id === column.id);
                  return (
                    <div key={column.id} role="cell" className={`tb-cell ${over === zone ? 'drop' : ''} ${isCollapsed ? 'collapsed' : ''}`} {...dropZone(zone, column, item.id)}>
                      {isCollapsed ? (
                        cellCards.length > 0 && <span className="muted num" style={{ fontSize: 12 }}>{cellCards.length}</span>
                      ) : (
                        cellCards.map((c) => renderCard(c, column, false))
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="board" style={{ overflowX: 'auto', gridTemplateColumns: `repeat(${workflow.length}, minmax(260px, 1fr))` }}>
          {workflow.map((column, colIdx) => {
            const isDone = column.category === 'done';
            const col = flatCards
              .filter((i) => columnOf(workflow, i).id === column.id)
              .sort((a, b) => (a.completedAt ?? '').localeCompare(b.completedAt ?? '') * -1 || a.rank - b.rank);
            const limited = isDone && !showAllDone ? col.slice(0, DONE_PREVIEW) : col;
            return (
              <section key={column.id} className={`column ${over === column.id ? 'drop' : ''}`} aria-labelledby={`col-${column.id}`} {...dropZone(column.id, column)}>
                {columnHead(column, colIdx, col.length)}
                {col.length === 0 && (
                  <div className="muted" style={{ fontSize: 12, padding: '16px 8px', textAlign: 'center', border: '1px dashed var(--border-strong)', borderRadius: 8 }}>
                    {dragId ? 'Drop here' : 'No tasks'}
                  </div>
                )}
                {limited.map((i) => renderCard(i, column, true))}
                {isDone && col.length > DONE_PREVIEW && (
                  <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--primary-darker)', justifyContent: 'flex-start' }} onClick={() => setShowAllDone((v) => !v)}>
                    {showAllDone ? 'Show fewer' : `Show ${col.length - DONE_PREVIEW} more done`}
                  </button>
                )}
                {!readOnly && (
                  <button type="button" className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start', color: 'var(--text-muted)' }} onClick={() => setAddTask({ statusId: column.id })}>
                    <Icon name="plus" size={16} /> Add task
                  </button>
                )}
              </section>
            );
          })}
        </div>
      )}
      {addTask && <NewTaskDialog projectId={project.id} sprintId={sprint.id} parentId={addTask.parentId} statusId={addTask.statusId} onClose={() => setAddTask(null)} />}
      {addItem && <NewItemDialog projectId={project.id} sprintId={sprint.id} onClose={() => setAddItem(false)} />}
      {editingColumns && <WorkflowDialog project={project} onClose={() => setEditingColumns(false)} />}
    </div>
  );
}
