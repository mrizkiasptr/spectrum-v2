import { Fragment, useMemo, useState, type DragEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { toast } from '../../components/toast';
import { Avatar, ColumnIcon, ItemStatusBadge, MenuButton, SeverityBadge, TypeBadge } from '../../components/ui';
import { fmtDue } from '../../domain/dates';
import { boardCards, tasksOf } from '../../domain/hierarchy';
import type { ItemType, Member, WorkflowStatus, WorkItem } from '../../domain/types';
import { columnOf, firstOfCategory } from '../../domain/workflow';
import { NewItemDialog, NewTaskDialog } from '../../features/dialogs';
import { WorkflowDialog } from '../../features/WorkflowEditor';
import { useToday } from '../../store/hooks';
import { useStore } from '../../store/useStore';
import { useSprintCtx } from './SprintLayout';

const DONE_PREVIEW = 5;
type View = 'kanban' | 'list';
type Group = 'item' | 'none';

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
 * Sprint workspace. Kanban: workflow columns, grouped into one row per backlog item (default)
 * or not grouped. List: a table of backlog items with their tasks nested underneath.
 * Items not broken into tasks yet show as their own card or row.
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
  const [viewPref, setViewPref] = usePref<View>('sb-view2', 'kanban');
  const view: View = params.get('view') === 'list' ? 'list' : params.get('view') === 'kanban' ? 'kanban' : viewPref;
  const setView = (v: View) => {
    setViewPref(v);
    const next = new URLSearchParams(params);
    next.set('view', v);
    setParams(next, { replace: true });
  };
  const [group, setGroup] = usePref<Group>('sb-group', 'item');
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

  const cardMenu = (i: WorkItem, column: WorkflowStatus) =>
    !readOnly && (
      <MenuButton label={`Actions for ${i.key}`} trigger={<Icon name="more" size={16} />} className="icon-btn sm card-menu">
        {(close) => (
          <>
            <button type="button" role="menuitem" onClick={() => { close(); openTask(i.id); }}>
              <Icon name="external" size={16} /> Open details
            </button>
            {i.type !== 'task' && (
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
    );

  const dragProps = (i: WorkItem) => ({
    draggable: !readOnly,
    onDragStart: (e: DragEvent) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', i.id);
      // Defer the re-render: changing the dragged element synchronously can cancel the drag in Chromium.
      setTimeout(() => setDragId(i.id), 0);
    },
    onDragEnd: () => {
      setDragId(null);
      setOver(null);
    },
  });

  /** Compact card: key, title, then one meta row (due, weight for items, assignee). */
  const renderCard = (i: WorkItem, column: WorkflowStatus, showParent: boolean) => {
    const due = i.dueDate && i.status !== 'done' ? fmtDue(i.dueDate, today) : null;
    const assignee = members.find((m) => m.id === i.assigneeId) ?? null;
    const isTask = i.type === 'task';
    const parent = isTask ? scope.find((x) => x.id === i.parentId) : null;
    return (
      <article
        key={i.id}
        className={`kcard ${dragId === i.id ? 'dragging' : ''} ${isTask ? '' : 'is-item'}`}
        {...dragProps(i)}
        aria-label={`${i.key} ${i.title}, ${column.name}`}
      >
        <div className="kcard-top">
          <span className="kcard-key num">{i.key}</span>
          {!isTask && <TypeBadge type={i.type} />}
          {i.severity && i.severity !== 'minor' && <SeverityBadge severity={i.severity} />}
          <span className="grow" />
          {cardMenu(i, column)}
        </div>
        <button type="button" className="kcard-title" onClick={() => openTask(i.id)}>{i.title}</button>
        {showParent && parent && (
          <button type="button" className="parent-link truncate" onClick={() => openTask(parent.id)} title={`${parent.key} ${parent.title}`}>
            <Icon name="layers" size={12} /> {parent.key} · {parent.title}
          </button>
        )}
        <div className="kcard-meta">
          {due && (
            <span className={`chip-date ${due.tone === 'neutral' ? '' : due.tone}`}>
              <Icon name="calendar" size={12} /> {due.label}
            </span>
          )}
          {!isTask && (
            <span className="row num" style={{ gap: 3, color: i.weight === null ? 'var(--warning-text)' : 'var(--text-muted)' }} title="Weight">
              <Icon name="weight" size={12} /> {i.weight ?? '—'}
            </span>
          )}
          {isTask && i.weight !== null && (
            <span className="row num muted" style={{ gap: 3 }} title="Points"><Icon name="weight" size={12} /> {i.weight}</span>
          )}
          {i.hours != null && <span className="row num muted" style={{ gap: 3 }} title="Estimated hours"><Icon name="clock" size={12} /> {i.hours}h</span>}
          {i.comments.length > 0 && <span className="row num muted" style={{ gap: 3 }} title="Comments"><Icon name="message" size={12} /> {i.comments.length}</span>}
          <span className="grow" />
          <Avatar member={assignee} />
        </div>
      </article>
    );
  };

  const columnHead = (column: WorkflowStatus, colIdx: number, count: number) => (
    <div className="khead" title={column.name}>
      <ColumnIcon column={column} />
      <h2 id={`col-${column.id}`} className="khead-name">{column.name}</h2>
      <span className="count-pill num">{count}</span>
      <span className="grow" />
      {!readOnly && (
        <span className="khead-actions">
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
        </span>
      )}
    </div>
  );

  const laneCards = lanes.flatMap((l) => l.cards);
  const gridCols = `var(--lane-w) repeat(${workflow.length}, minmax(var(--col-min), 1fr))`;
  const allCollapsed = lanes.length > 0 && lanes.every((l) => collapsed[l.item.id] ?? l.item.status === 'done');

  return (
    <div className="page" style={{ paddingTop: 16, gap: 14 }}>
      <div className="board-toolbar">
        <div className="row wrap" style={{ gap: 8 }}>
          <label className="search-box" style={{ width: 220 }}>
            <Icon name="search" size={16} />
            <input type="search" aria-label="Search tasks and backlog items" placeholder="Search title or ID" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <button
            type="button"
            className="btn btn-secondary btn-md"
            aria-pressed={mine}
            onClick={() => setMine(!mine)}
            style={mine ? { borderColor: 'var(--primary)', background: 'var(--primary-subtle)', color: 'var(--primary-darker)' } : undefined}
          >
            <Avatar member={members.find((m) => m.id === me) ?? null} /> My tasks
          </button>
          <label className="sr-only" htmlFor="sb-type">Backlog item type</label>
          <select id="sb-type" className="filter-select" value={type} onChange={(e) => setType(e.target.value as ItemType | 'all')}>
            <option value="all">All items</option>
            <option value="story">Backlog</option>
            <option value="bug">Bugs</option>
          </select>
          <div className="seg" role="radiogroup" aria-label="View">
            <button type="button" role="radio" aria-checked={view === 'kanban'} onClick={() => setView('kanban')}><Icon name="kanban" size={15} /> Kanban</button>
            <button type="button" role="radio" aria-checked={view === 'list'} onClick={() => setView('list')}><Icon name="list" size={15} /> List</button>
          </div>
          {view === 'kanban' && (
            <>
              <label className="sr-only" htmlFor="sb-group">Group cards</label>
              <select id="sb-group" className="filter-select" value={group} onChange={(e) => setGroup(e.target.value as Group)}>
                <option value="item">Group: Backlog item</option>
                <option value="none">Group: None</option>
              </select>
            </>
          )}
        </div>
        {!readOnly && (
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="btn btn-secondary btn-md" onClick={() => setAddItem(true)}>
              <Icon name="layers" size={16} /> Add item
            </button>
            <button type="button" className="btn btn-primary btn-md" onClick={() => setAddTask({ statusId: firstOfCategory(workflow, 'todo').id })}>
              <Icon name="plus" size={16} /> Add task
            </button>
            <MenuButton label="Board options" trigger={<Icon name="more" size={18} />} className="icon-btn bordered" align="right">
              {(close) => (
                <>
                  <button type="button" role="menuitem" onClick={() => { close(); setEditingColumns(true); }}>
                    <Icon name="sliders" size={16} /> Edit columns
                  </button>
                  {(view === 'list' || group === 'item') && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        close();
                        setCollapsed(Object.fromEntries(lanes.map((l) => [l.item.id, !allCollapsed])));
                      }}
                    >
                      <Icon name={allCollapsed ? 'chevronDown' : 'chevronUp'} size={16} /> {allCollapsed ? 'Expand all rows' : 'Collapse all rows'}
                    </button>
                  )}
                </>
              )}
            </MenuButton>
          </div>
        )}
      </div>

      {view === 'list' ? (
        <SprintListView
          lanes={lanes}
          workflow={workflow}
          members={members}
          today={today}
          readOnly={readOnly}
          collapsed={collapsed}
          onToggle={(id, isCollapsed) => setCollapsed((c) => ({ ...c, [id]: !isCollapsed }))}
          onOpen={openTask}
          onAddTask={(parentId) => setAddTask({ parentId })}
          onUpdate={updateItem}
          emptyText={scope.some((i) => i.type !== 'task') ? 'Nothing matches these filters.' : 'No backlog items in this sprint yet. Plan backlog items from the Backlog, then break them into tasks here.'}
        />
      ) : group === 'item' ? (
        <div className="taskboard" role="table" aria-label="Sprint taskboard" style={{ gridTemplateColumns: gridCols }}>
          <div className="tb-head tb-corner" role="columnheader">
            <div className="khead">
              <Icon name="layers" size={16} />
              <h2 className="khead-name">Backlog item</h2>
              <span className="count-pill num">{lanes.length}</span>
            </div>
          </div>
          {workflow.map((column, colIdx) => (
            <div key={column.id} className="tb-head" role="columnheader">
              {columnHead(column, colIdx, laneCards.filter((c) => columnOf(workflow, c).id === column.id).length)}
            </div>
          ))}

          {lanes.length === 0 && (
            <div className="tb-empty" style={{ gridColumn: '1 / -1' }}>
              {scope.some((i) => i.type !== 'task')
                ? 'Nothing matches these filters.'
                : 'No backlog items in this sprint yet. Plan backlog items from the Backlog, then break them into tasks here.'}
            </div>
          )}

          {lanes.map(({ item, tasks, cards }) => {
            const isCollapsed = collapsed[item.id] ?? item.status === 'done';
            const doneTasks = tasks.filter((t) => t.status === 'done').length;
            const owner = members.find((m) => m.id === item.assigneeId) ?? null;
            const pct = tasks.length ? (doneTasks / tasks.length) * 100 : item.status === 'done' ? 100 : 0;
            return (
              <div key={item.id} className={`tb-lane ${isCollapsed ? 'collapsed' : ''}`} role="row">
                <div className="tb-lane-head" role="rowheader">
                  <div className="row" style={{ gap: 6 }}>
                    <button
                      type="button"
                      className="icon-btn sm"
                      aria-expanded={!isCollapsed}
                      aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${item.key}`}
                      onClick={() => setCollapsed((c) => ({ ...c, [item.id]: !isCollapsed }))}
                    >
                      <Icon name={isCollapsed ? 'chevronRight' : 'chevronDown'} size={14} />
                    </button>
                    <span className="kcard-key num">{item.key}</span>
                    <TypeBadge type={item.type} />
                    {item.severity && item.severity !== 'minor' && <SeverityBadge severity={item.severity} />}
                    <span className="grow" />
                    {!readOnly && (
                      <button type="button" className="icon-btn sm" aria-label={`Add task to ${item.key}`} title="Add task" onClick={() => setAddTask({ parentId: item.id })}>
                        <Icon name="plus" size={16} />
                      </button>
                    )}
                  </div>
                  <button type="button" className="kcard-title tb-lane-title" onClick={() => openTask(item.id)} title={item.title}>{item.title}</button>
                  {!isCollapsed && (
                    <>
                      <div className="tb-lane-meta">
                        <ItemStatusBadge item={item} />
                        <span className="row num muted" style={{ gap: 3 }} title="Weight"><Icon name="weight" size={12} /> {item.weight ?? '—'}</span>
                        <span className="grow" />
                        <Avatar member={owner} title={owner ? `Owner: ${owner.name}` : 'No owner'} />
                      </div>
                      <div className="tb-lane-progress" title={tasks.length ? `${doneTasks} of ${tasks.length} tasks done` : 'Not broken into tasks yet'}>
                        <div className="tb-progress"><span style={{ width: `${pct}%` }} /></div>
                        <span className="num">{tasks.length ? `${doneTasks}/${tasks.length}` : 'No tasks'}</span>
                      </div>
                    </>
                  )}
                </div>
                {workflow.map((column) => {
                  const zone = `${item.id}:${column.id}`;
                  const cellCards = cards.filter((c) => columnOf(workflow, c).id === column.id);
                  return (
                    <div key={column.id} role="cell" className={`tb-cell ${over === zone ? 'drop' : ''}`} {...dropZone(zone, column, item.id)}>
                      {isCollapsed
                        ? cellCards.length > 0 && <span className="tb-count num">{cellCards.length}</span>
                        : cellCards.map((c) => renderCard(c, column, false))}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="board kboard" style={{ gridTemplateColumns: `repeat(${workflow.length}, minmax(var(--col-min), 1fr))` }}>
          {workflow.map((column, colIdx) => {
            const isDone = column.category === 'done';
            const col = flatCards
              .filter((i) => columnOf(workflow, i).id === column.id)
              .sort((a, b) => (a.completedAt ?? '').localeCompare(b.completedAt ?? '') * -1 || a.rank - b.rank);
            const limited = isDone && !showAllDone ? col.slice(0, DONE_PREVIEW) : col;
            return (
              <section key={column.id} className={`column ${over === column.id ? 'drop' : ''}`} aria-labelledby={`col-${column.id}`} {...dropZone(column.id, column)}>
                {columnHead(column, colIdx, col.length)}
                {col.length === 0 && <div className="tb-empty-cell">{dragId ? 'Drop here' : 'No tasks'}</div>}
                {limited.map((i) => renderCard(i, column, true))}
                {isDone && col.length > DONE_PREVIEW && (
                  <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--primary-darker)', justifyContent: 'flex-start' }} onClick={() => setShowAllDone((v) => !v)}>
                    {showAllDone ? 'Show fewer' : `Show ${col.length - DONE_PREVIEW} more done`}
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

interface Lane {
  item: WorkItem;
  tasks: WorkItem[];
  cards: WorkItem[];
}

/** List view: backlog items as parent rows, their tasks nested; status and assignee editable inline. */
function SprintListView({
  lanes,
  workflow,
  members,
  today,
  readOnly,
  collapsed,
  onToggle,
  onOpen,
  onAddTask,
  onUpdate,
  emptyText,
}: {
  lanes: Lane[];
  workflow: WorkflowStatus[];
  members: Member[];
  today: string;
  readOnly: boolean;
  collapsed: Record<string, boolean>;
  onToggle: (id: string, isCollapsed: boolean) => void;
  onOpen: (id: string) => void;
  onAddTask: (parentId: string) => void;
  onUpdate: (id: string, patch: Partial<WorkItem>) => void;
  emptyText: string;
}) {
  const statusCell = (i: WorkItem, derived: boolean) => {
    const column = columnOf(workflow, i);
    if (derived || readOnly) {
      return (
        <span className="row" style={{ gap: 6 }} title={derived ? 'Follows its tasks' : undefined}>
          <ItemStatusBadge item={i} />
        </span>
      );
    }
    return (
      <span className="list-select">
        <span className="list-select-icon"><ColumnIcon column={column} size={14} /></span>
        <label className="sr-only" htmlFor={`ls-${i.id}`}>Status of {i.key}</label>
        <select id={`ls-${i.id}`} className="filter-select" value={column.id} onChange={(e) => onUpdate(i.id, { statusId: e.target.value })}>
          {workflow.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </span>
    );
  };

  const assigneeCell = (i: WorkItem) => {
    const m = members.find((x) => x.id === i.assigneeId) ?? null;
    if (readOnly) return <span className="row" style={{ gap: 6 }}><Avatar member={m} /> {m?.name ?? <span className="subtle">Unassigned</span>}</span>;
    return (
      <span className="row" style={{ gap: 6, minWidth: 0 }}>
        <Avatar member={m} />
        <label className="sr-only" htmlFor={`la-${i.id}`}>Assignee of {i.key}</label>
        <select id={`la-${i.id}`} title={m?.name ?? 'Unassigned'} className="filter-select list-assignee" value={i.assigneeId ?? ''} onChange={(e) => onUpdate(i.id, { assigneeId: e.target.value || null })}>
          <option value="">Unassigned</option>
          {members.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      </span>
    );
  };

  const dueCell = (i: WorkItem) => {
    if (!i.dueDate || i.status === 'done') return <span className="subtle">—</span>;
    const due = fmtDue(i.dueDate, today);
    return <span className={`chip-date ${due.tone === 'neutral' ? '' : due.tone}`}>{due.label}</span>;
  };

  if (!lanes.length) return <div className="table-wrap"><div className="tb-empty">{emptyText}</div></div>;

  return (
    <div className="table-wrap list-wrap">
      <table className="table list-view">
        <thead>
          <tr>
            <th scope="col" style={{ width: 128 }}>ID</th>
            <th scope="col">Title</th>
            <th scope="col" style={{ width: 168 }}>Status</th>
            <th scope="col" style={{ width: 176 }}>Assignee</th>
            <th scope="col" style={{ width: 96 }}>Due</th>
            <th scope="col" style={{ width: 68, textAlign: 'right' }}>Weight</th>
            <th scope="col" style={{ width: 112 }}>Tasks</th>
          </tr>
        </thead>
        <tbody>
          {lanes.map(({ item, tasks, cards }) => {
            const isCollapsed = collapsed[item.id] ?? item.status === 'done';
            const done = tasks.filter((t) => t.status === 'done').length;
            const shownTasks = tasks.length ? cards : [];
            return (
              <Fragment key={item.id}>
                <tr className="list-parent">
                  <td>
                    <span className="row" style={{ gap: 4 }}>
                      <button
                        type="button"
                        className="icon-btn sm"
                        aria-expanded={!isCollapsed}
                        aria-label={`${isCollapsed ? 'Show' : 'Hide'} tasks of ${item.key}`}
                        disabled={!tasks.length}
                        style={{ visibility: tasks.length ? 'visible' : 'hidden' }}
                        onClick={() => onToggle(item.id, isCollapsed)}
                      >
                        <Icon name={isCollapsed ? 'chevronRight' : 'chevronDown'} size={14} />
                      </button>
                      <span className="kcard-key num" style={{ fontSize: 12 }}>{item.key}</span>
                    </span>
                  </td>
                  <td>
                    <span className="row" style={{ gap: 8, minWidth: 0 }}>
                      <TypeBadge type={item.type} />
                      {item.severity && item.severity !== 'minor' && <SeverityBadge severity={item.severity} />}
                      <button type="button" className="kcard-title truncate" style={{ fontSize: 14 }} onClick={() => onOpen(item.id)}>{item.title}</button>
                    </span>
                  </td>
                  <td>{statusCell(item, tasks.length > 0)}</td>
                  <td>{assigneeCell(item)}</td>
                  <td>{dueCell(item)}</td>
                  <td className="num" style={{ textAlign: 'right', fontWeight: 600, color: item.weight === null ? 'var(--warning-text)' : undefined }}>{item.weight ?? '—'}</td>
                  <td>
                    {tasks.length ? (
                      <span className="tb-lane-progress" title={`${done} of ${tasks.length} tasks done`}>
                        <span className="tb-progress" style={{ width: 56 }}><span style={{ width: `${(done / tasks.length) * 100}%` }} /></span>
                        <span className="num">{done}/{tasks.length}</span>
                      </span>
                    ) : !readOnly ? (
                      <button type="button" className="btn-link" style={{ fontSize: 12 }} onClick={() => onAddTask(item.id)}>Break into tasks</button>
                    ) : (
                      <span className="subtle">—</span>
                    )}
                  </td>
                </tr>
                {!isCollapsed &&
                  shownTasks.map((t) => (
                    <tr key={t.id} className="list-child">
                      <td><span className="kcard-key num list-child-key">{t.key}</span></td>
                      <td>
                        <span className="row" style={{ gap: 8, minWidth: 0, paddingLeft: 18 }}>
                          <span className="list-branch" aria-hidden="true" />
                          <button type="button" className="kcard-title truncate" style={{ fontWeight: 500 }} onClick={() => onOpen(t.id)}>{t.title}</button>
                        </span>
                      </td>
                      <td>{statusCell(t, false)}</td>
                      <td>{assigneeCell(t)}</td>
                      <td>{dueCell(t)}</td>
                      <td />
                      <td />
                    </tr>
                  ))}
                {!isCollapsed && tasks.length > 0 && !readOnly && (
                  <tr className="list-child list-add">
                    <td />
                    <td colSpan={6}>
                      <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--primary-darker)', marginLeft: 18 }} onClick={() => onAddTask(item.id)}>
                        <Icon name="plus" size={14} /> Add task to {item.key}
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
  );
}
