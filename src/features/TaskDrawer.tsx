import { useEffect, useState, type CSSProperties } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { toast } from '../components/toast';
import { Avatar, ColumnIcon, Drawer, ItemStatusBadge, MenuButton } from '../components/ui';
import { tasksOf } from '../domain/hierarchy';
import { fmtDateTime, fmtDue, fmtRange } from '../domain/dates';
import { sprintName } from '../domain/sprint';
import type { ItemType, Severity, WorkItem } from '../domain/types';
import { columnOf, defaultWorkflow } from '../domain/workflow';
import { TYPE_LABEL, WEIGHTS } from '../domain/types';
import { useProjectMembers, useProjectSprints, useToday } from '../store/hooks';
import { newId, useStore } from '../store/useStore';

/** Opens whenever the URL has ?task=<id>, so tasks are deep-linkable from anywhere. */
export function TaskDrawerHost() {
  const [params, setParams] = useSearchParams();
  const id = params.get('task');
  const item = useStore((s) => (id ? s.items.find((i) => i.id === id) ?? null : null));
  const close = () => {
    const next = new URLSearchParams(params);
    next.delete('task');
    setParams(next, { replace: true });
  };
  return (
    <Drawer open={!!item} onClose={close} label={item ? `${item.key} ${item.title}` : 'Task'}>
      {item && <TaskDetail key={item.id} item={item} onClose={close} />}
    </Drawer>
  );
}

function TaskDetail({ item, onClose }: { item: WorkItem; onClose: () => void }) {
  const update = useStore((s) => s.updateItem);
  const del = useStore((s) => s.deleteItem);
  const addComment = useStore((s) => s.addComment);
  const moveToSprint = useStore((s) => s.moveToSprint);
  const allMembers = useStore((s) => s.members);
  const projectMembers = useProjectMembers(item.projectId);
  const sprints = useProjectSprints(item.projectId);
  const today = useToday();
  const navigate = useNavigate();
  const [title, setTitle] = useState(item.title);
  const [desc, setDesc] = useState(item.description);
  const [newCrit, setNewCrit] = useState('');
  const [comment, setComment] = useState('');
  const [tab, setTab] = useState<'comments' | 'history'>('comments');
  const [newTask, setNewTask] = useState('');
  const allItems = useStore((s) => s.items);
  const createItem = useStore((s) => s.createItem);
  const [, setParams] = useSearchParams();
  const isTask = item.type === 'task';
  const parent = isTask ? allItems.find((i) => i.id === item.parentId) ?? null : null;
  const tasks = isTask ? [] : tasksOf(allItems, item.id);
  const openItem = (id: string) => setParams((p) => { const n = new URLSearchParams(p); n.set('task', id); return n; });

  useEffect(() => setTitle(item.title), [item.title]);
  useEffect(() => setDesc(item.description), [item.description]);

  const sprint = sprints.find((s) => s.id === item.sprintId) ?? null;
  const workflow = useStore((s) => s.projects.find((p) => p.id === item.projectId)?.workflow) ?? defaultWorkflow();
  const column = columnOf(workflow, item);
  const openSprints = sprints.filter((s) => s.status !== 'completed');
  const member = (id: string | null) => allMembers.find((m) => m.id === id) ?? null;
  const critDone = item.criteria.filter((c) => c.done).length;
  const due = item.dueDate ? fmtDue(item.dueDate, today) : null;

  const set = (patch: Partial<WorkItem>) => update(item.id, patch);

  return (
    <>
      <div className="row" style={{ height: 56, flexShrink: 0, padding: '0 16px 0 24px', borderBottom: '1px solid var(--border)' }}>
        <span className="muted" style={{ fontSize: 13 }}>{sprint ? sprintName(sprint) : 'Backlog'}</span>
        <Icon name="chevronRight" size={14} color="var(--text-subtle)" />
        {parent && (
          <>
            <button type="button" className="btn-link num" style={{ fontSize: 13 }} onClick={() => openItem(parent.id)}>{parent.key}</button>
            <Icon name="chevronRight" size={14} color="var(--text-subtle)" />
          </>
        )}
        <span className="num" style={{ fontSize: 13, fontWeight: 600 }}>{item.key}</span>
        <span className="grow" />
        <button
          type="button"
          className="icon-btn bordered"
          aria-label="Copy task link"
          onClick={() => {
            const url = `${window.location.origin}${window.location.pathname}?task=${item.id}`;
            navigator.clipboard?.writeText(url).then(
              () => toast('Link copied.'),
              () => toast('Couldn’t copy the link. Copy it from the address bar instead.'),
            );
          }}
        >
          <Icon name="link" size={16} />
        </button>
        <MenuButton label="More actions" trigger={<Icon name="more" size={16} />} className="icon-btn bordered">
          {(close) => (
            <>
              {!isTask && openSprints.filter((s) => s.id !== item.sprintId).map((s) => (
                <button key={s.id} type="button" role="menuitem" onClick={() => { close(); moveToSprint([item.id], s.id); toast(`${item.key} moved to ${sprintName(s)}.`); }}>
                  <Icon name="arrowRight" size={16} /> Move to {sprintName(s)}
                </button>
              ))}
              {!isTask && item.sprintId && (
                <button type="button" role="menuitem" onClick={() => { close(); moveToSprint([item.id], null); toast(`${item.key} moved to the backlog.`); }}>
                  <Icon name="layers" size={16} /> Move to backlog
                </button>
              )}
              {!isTask && <div className="menu-sep" />}
              <button
                type="button"
                role="menuitem"
                className="danger"
                onClick={() => {
                  close();
                  const withTasks = tasks.length ? ` and its ${tasks.length} task${tasks.length > 1 ? 's' : ''}` : '';
                  if (window.confirm(`Delete ${item.key} "${item.title}"${withTasks}?`)) {
                    const snapshot = [item, ...tasks];
                    del(item.id);
                    onClose();
                    toast(`${item.key} deleted.`, {
                      label: 'Undo',
                      run: () => useStore.setState((s) => ({ items: [...s.items, ...snapshot] })),
                    });
                  }
                }}
              >
                <Icon name="trash" size={16} /> {isTask ? 'Delete task' : 'Delete item'}
              </button>
            </>
          )}
        </MenuButton>
        <button type="button" className="icon-btn bordered" aria-label="Close" onClick={onClose}>
          <Icon name="close" size={16} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div className="col" style={{ gap: 12 }}>
          <div className="row wrap">
            <label className="sr-only" htmlFor="td-status">Status</label>
            <div className="row" style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 10, display: 'flex', pointerEvents: 'none' }}><ColumnIcon column={column} size={14} /></span>
              <select
                id="td-status"
                className="filter-select"
                style={{ paddingLeft: 30, height: 32, borderRadius: 999 }}
                value={column.id}
                disabled={tasks.length > 0}
                title={tasks.length ? 'Follows its tasks: done when every task is done' : undefined}
                onChange={(e) => set({ statusId: e.target.value })}
              >
                {workflow.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            {isTask ? (
              <span className="task-chip" style={{ fontSize: 12, padding: '4px 10px', borderRadius: 999 }}>Task</span>
            ) : (
              <>
                <label className="sr-only" htmlFor="td-type">Type</label>
                <select id="td-type" className="filter-select" style={{ height: 32, borderRadius: 999 }} value={item.type} onChange={(e) => {
                  const type = e.target.value as ItemType;
                  set({ type, severity: type === 'bug' ? item.severity ?? 'major' : null });
                }}>
                  {(['story', 'bug'] as ItemType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                </select>
              </>
            )}
            {tasks.length > 0 && <span className="muted" style={{ fontSize: 12 }}>Status follows its tasks</span>}
            {item.type === 'bug' && (
              <>
                <label className="sr-only" htmlFor="td-sev">Severity</label>
                <select id="td-sev" className="filter-select" style={{ height: 32, borderRadius: 999 }} value={item.severity ?? 'major'} onChange={(e) => set({ severity: e.target.value as Severity })}>
                  <option value="critical">Critical</option>
                  <option value="major">Major</option>
                  <option value="minor">Minor</option>
                </select>
              </>
            )}
          </div>
          <label className="sr-only" htmlFor="td-title">Title</label>
          <textarea
            id="td-title"
            className="textarea"
            rows={1}
            style={{ minHeight: 0, border: '1px solid transparent', padding: '4px 6px', marginLeft: -6, fontSize: 22, fontWeight: 700, lineHeight: 1.35, resize: 'none', fieldSizing: 'content' } as CSSProperties}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              const t = title.trim();
              if (!t) setTitle(item.title);
              else if (t !== item.title) set({ title: t });
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                (e.target as HTMLTextAreaElement).blur();
              }
            }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '120px minmax(0,1fr)', gap: '10px 12px', alignItems: 'center', fontSize: 13 }}>
          <label className="muted" htmlFor="td-assignee">Assignee</label>
          <div className="row">
            <Avatar member={member(item.assigneeId)} />
            <select id="td-assignee" className="filter-select grow" value={item.assigneeId ?? ''} onChange={(e) => set({ assigneeId: e.target.value || null })}>
              <option value="">Unassigned</option>
              {projectMembers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <label className="muted" htmlFor="td-reviewer">Reviewer</label>
          <div className="row">
            <Avatar member={member(item.reviewerId)} title="No reviewer" />
            <select id="td-reviewer" className="filter-select grow" value={item.reviewerId ?? ''} onChange={(e) => set({ reviewerId: e.target.value || null })}>
              <option value="">No reviewer</option>
              {projectMembers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <label className="muted" htmlFor="td-due">Due date</label>
          <div className="row">
            <input id="td-due" type="date" className="input input-sm" style={{ width: 170 }} value={item.dueDate ?? ''} onChange={(e) => set({ dueDate: e.target.value || null })} />
            {due && item.status !== 'done' && <span className={`chip-date ${due.tone === 'neutral' ? '' : due.tone}`}>{due.label}</span>}
          </div>
          {isTask ? (
            <>
              <span className="muted">Backlog item</span>
              {parent ? (
                <button type="button" className="parent-link" style={{ fontSize: 13 }} onClick={() => openItem(parent.id)}>
                  <Icon name="layers" size={14} /> <strong className="num">{parent.key}</strong> · <span className="truncate">{parent.title}</span>
                </button>
              ) : (
                <span className="subtle">—</span>
              )}
              <span className="muted">Sprint</span>
              <span>{sprint ? `${sprintName(sprint)} (follows ${parent?.key ?? 'its item'})` : `Backlog (follows ${parent?.key ?? 'its item'})`}</span>
              <label className="muted" htmlFor="td-weight">Point</label>
              <select id="td-weight" className="filter-select" style={{ width: 170 }} value={item.weight ?? ''} onChange={(e) => set({ weight: e.target.value ? Number(e.target.value) : null })}>
                <option value="">No points</option>
                {WEIGHTS.map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
              <label className="muted" htmlFor="td-hours">Estimate</label>
              <HoursInput value={item.hours ?? null} onChange={(hours) => set({ hours })} />
            </>
          ) : (
          <>
          <label className="muted" htmlFor="td-weight">Point</label>
          <select id="td-weight" className="filter-select" style={{ width: 170 }} value={item.weight ?? ''} onChange={(e) => set({ weight: e.target.value ? Number(e.target.value) : null })}>
            <option value="">Not estimated</option>
            {WEIGHTS.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
          <label className="muted" htmlFor="td-hours">Estimate</label>
          <HoursInput value={item.hours ?? null} onChange={(hours) => set({ hours })} />
          <label className="muted" htmlFor="td-sprint">Sprint</label>
          <div className="row">
            <select id="td-sprint" className="filter-select" style={{ width: 170 }} value={item.sprintId ?? ''} onChange={(e) => set({ sprintId: e.target.value || null })}>
              <option value="">Backlog</option>
              {sprints.filter((s) => s.status !== 'completed' || s.id === item.sprintId).map((s) => (
                <option key={s.id} value={s.id}>{sprintName(s)}{s.status === 'draft' ? ' (draft)' : s.status === 'completed' ? ' (completed)' : ''}</option>
              ))}
            </select>
            {sprint && (
              <button type="button" className="btn-link" style={{ fontSize: 13 }} onClick={() => navigate(`/projects/${item.projectId}/sprints/${sprint.id}`)}>
                {fmtRange(sprint.startDate, sprint.endDate)}
              </button>
            )}
          </div>
          <label className="muted" htmlFor="td-epic">Epic</label>
          <input id="td-epic" className="input input-sm" placeholder="e.g. QRISAN Refund" defaultValue={item.epic} onBlur={(e) => e.target.value !== item.epic && set({ epic: e.target.value.trim() })} />
          </>
          )}
        </div>

        {!isTask && (
          <section className="col" style={{ gap: 10 }} aria-labelledby="td-tasks">
            <div className="row">
              <h3 id="td-tasks" style={{ fontSize: 14, fontWeight: 600 }}>Tasks</h3>
              <span className="muted num" style={{ fontSize: 12 }}>{tasks.filter((t) => t.status === 'done').length} / {tasks.length}</span>
            </div>
            {tasks.length === 0 && <p className="muted" style={{ fontSize: 13 }}>Not broken down yet. Add the tasks the team needs to get this item done.</p>}
            {tasks.map((t) => (
              <div key={t.id} className="row" style={{ gap: 8, padding: '6px 8px', borderRadius: 8, background: 'var(--surface-muted)' }}>
                <span className="muted num" style={{ fontSize: 12, fontWeight: 600, width: 64 }}>{t.key}</span>
                <button type="button" className="task-card-title grow truncate" style={{ fontSize: 13 }} onClick={() => openItem(t.id)}>{t.title}</button>
                <ItemStatusBadge item={t} />
                <Avatar member={member(t.assigneeId)} />
              </div>
            ))}
            <form
              className="row"
              onSubmit={(e) => {
                e.preventDefault();
                if (!newTask.trim()) return;
                const t = createItem(item.projectId, { title: newTask, type: 'task', sprintId: item.sprintId, parentId: item.id });
                toast(`${t.key} added to ${item.key}.`);
                setNewTask('');
              }}
            >
              <label className="sr-only" htmlFor="td-new-task">New task</label>
              <input id="td-new-task" className="input input-sm grow" placeholder="Add a task…" value={newTask} onChange={(e) => setNewTask(e.target.value)} />
              <button type="submit" className="btn btn-secondary btn-md" disabled={!newTask.trim()}>Add</button>
            </form>
          </section>
        )}

        <section className="col" style={{ gap: 8, paddingTop: 16, borderTop: '1px solid var(--border-soft)' }}>
          <label htmlFor="td-desc" style={{ fontWeight: 600 }}>Description</label>
          <textarea
            id="td-desc"
            className="textarea"
            placeholder="What needs to be done and why?"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            onBlur={() => desc !== item.description && set({ description: desc })}
          />
        </section>

        {!isTask && <section className="col" style={{ gap: 10 }}>
          <div className="row">
            <h3 style={{ fontSize: 14, fontWeight: 600 }}>Acceptance criteria</h3>
            <span className="muted num" style={{ fontSize: 12 }}>{critDone} / {item.criteria.length}</span>
            <div className="grow">
              {item.criteria.length > 0 && (
                <div className="progress" style={{ height: 4 }}>
                  <span style={{ width: `${(critDone / item.criteria.length) * 100}%`, background: 'var(--success)' }} />
                </div>
              )}
            </div>
          </div>
          {item.criteria.length === 0 && <p className="muted" style={{ fontSize: 13 }}>No criteria yet. Items need at least one to be sprint-ready.</p>}
          {item.criteria.map((c) => (
            <div key={c.id} className="row" style={{ alignItems: 'flex-start' }}>
              <label className="check grow" style={{ fontSize: 13, lineHeight: 1.5 }}>
                <input
                  type="checkbox"
                  checked={c.done}
                  onChange={() => set({ criteria: item.criteria.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x)) })}
                />
                <span style={{ color: c.done ? 'var(--text-muted)' : undefined, textDecoration: c.done ? 'line-through' : undefined }}>{c.text}</span>
              </label>
              <button type="button" className="icon-btn sm" aria-label={`Remove criterion: ${c.text}`} onClick={() => set({ criteria: item.criteria.filter((x) => x.id !== c.id) })}>
                <Icon name="close" size={14} />
              </button>
            </div>
          ))}
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newCrit.trim()) return;
              set({ criteria: [...item.criteria, { id: newId('c'), text: newCrit.trim(), done: false }] });
              setNewCrit('');
            }}
          >
            <label className="sr-only" htmlFor="td-crit">New acceptance criterion</label>
            <input id="td-crit" className="input input-sm grow" placeholder="Add a criterion and press Enter" value={newCrit} onChange={(e) => setNewCrit(e.target.value)} />
            <button type="submit" className="btn btn-secondary btn-md" disabled={!newCrit.trim()}>Add</button>
          </form>
        </section>}

        <section className="col" style={{ gap: 10 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600 }}>Attachments</h3>
          <div className="row wrap">
            {item.attachments.map((a) => (
              <span key={a} className="row" style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}>
                <Icon name="file" size={16} color="var(--text-muted)" />
                {a}
                <button type="button" className="icon-btn sm" aria-label={`Remove ${a}`} onClick={() => set({ attachments: item.attachments.filter((x) => x !== a) })}>
                  <Icon name="close" size={12} />
                </button>
              </span>
            ))}
            <label className="btn btn-secondary btn-md" style={{ cursor: 'pointer' }}>
              <Icon name="paperclip" size={16} /> Attach file
              <input
                type="file"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) set({ attachments: [...item.attachments, f.name] });
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        </section>

        <section className="col" style={{ gap: 12 }}>
          <div role="tablist" className="row" style={{ gap: 16, borderBottom: '1px solid var(--border)' }}>
            {(['comments', 'history'] as const).map((t) => (
              <button
                key={t}
                role="tab"
                type="button"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                style={{
                  border: 0, background: 'none', padding: '0 2px 8px', cursor: 'pointer', fontSize: 13,
                  borderBottom: `2px solid ${tab === t ? 'var(--primary)' : 'transparent'}`,
                  color: tab === t ? 'var(--primary-darker)' : 'var(--text-muted)', fontWeight: tab === t ? 600 : 500,
                }}
              >
                {t === 'comments' ? `Comments ${item.comments.length}` : 'History'}
              </button>
            ))}
          </div>
          {tab === 'comments' ? (
            <>
              {item.comments.length === 0 && <p className="muted" style={{ fontSize: 13 }}>No comments yet.</p>}
              {item.comments.map((c) => (
                <div key={c.id} className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
                  <Avatar member={member(c.authorId)} size="md" />
                  <div className="col" style={{ gap: 2 }}>
                    <span className="muted" style={{ fontSize: 12 }}>
                      <strong style={{ color: 'var(--text)' }}>{member(c.authorId)?.name ?? 'Unknown'}</strong> · {fmtDateTime(c.at)}
                    </span>
                    <span style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{c.text}</span>
                  </div>
                </div>
              ))}
            </>
          ) : (
            <ul className="muted" style={{ fontSize: 13, margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <li>Created {fmtDateTime(item.createdAt)}</li>
              {item.completedAt && <li>Marked done {fmtDateTime(item.completedAt)}</li>}
              <li>Currently in {column.name}{sprint ? ` · ${sprintName(sprint)}` : ' · backlog'}</li>
            </ul>
          )}
        </section>
      </div>

      <form
        className="row"
        style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', gap: 10 }}
        onSubmit={(e) => {
          e.preventDefault();
          if (!comment.trim()) return;
          addComment(item.id, comment);
          setComment('');
          setTab('comments');
        }}
      >
        <Avatar member={member(useStore.getState().currentUserId)} size="md" />
        <label className="sr-only" htmlFor="td-comment">Write a comment</label>
        <input id="td-comment" className="input grow" placeholder="Write a comment" value={comment} onChange={(e) => setComment(e.target.value)} />
        <button type="submit" className="btn btn-primary" disabled={!comment.trim()}>Send</button>
      </form>
    </>
  );
}

/** Hours estimate: saved on blur; empty clears it. */
function HoursInput({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const [text, setText] = useState(value === null ? '' : String(value));
  useEffect(() => setText(value === null ? '' : String(value)), [value]);
  const commit = () => {
    const t = text.trim().replace(',', '.');
    const n = t === '' ? null : Number(t);
    if (n === null || (Number.isFinite(n) && n >= 0 && n <= 999)) {
      const rounded = n === null ? null : Math.round(n * 4) / 4;
      if (rounded !== value) onChange(rounded);
      setText(rounded === null ? '' : String(rounded));
    } else setText(value === null ? '' : String(value));
  };
  return (
    <div className="row" style={{ gap: 8 }}>
      <input
        id="td-hours"
        className="input input-sm"
        style={{ width: 96 }}
        inputMode="decimal"
        placeholder="0"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
      <span className="muted">hours</span>
    </div>
  );
}
