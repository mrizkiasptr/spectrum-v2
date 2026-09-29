import { useAuth } from '../auth/AuthProvider';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { toast } from '../components/toast';
import { Dialog, StatusIcon } from '../components/ui';
import { addDays, todayISO } from '../domain/dates';
import { nextSprintNumber, progressOf, sprintName } from '../domain/sprint';
import type { GoalOutcome, ItemType, Severity, Sprint } from '../domain/types';
import type { Tribe } from '../domain/types';
import { OUTCOME_LABEL, TRIBES, TYPE_LABEL, WEIGHTS } from '../domain/types';
import { useProjectMembers } from '../store/hooks';
import { useStore } from '../store/useStore';

/* ---------- Complete sprint ---------- */

export function CompleteSprintDialog({ sprint, onClose }: { sprint: Sprint; onClose: () => void }) {
  const allItems = useStore((s) => s.items);
  const items = useMemo(() => allItems.filter((i) => i.sprintId === sprint.id), [allItems, sprint.id]);
  const sprints = useStore((s) => s.sprints);
  const complete = useStore((s) => s.completeSprint);
  const [outcome, setOutcome] = useState<GoalOutcome | null>(null);
  const [carryTo, setCarryTo] = useState<'next' | 'backlog'>('next');
  const [notes, setNotes] = useState(sprint.reviewNotes);
  const p = progressOf(items);
  const open = items.filter((i) => i.status !== 'done' && i.type !== 'task');
  const nextDraft = sprints
    .filter((s) => s.projectId === sprint.projectId && s.status === 'draft')
    .sort((a, b) => a.number - b.number)[0];
  const nextLabel = nextDraft ? sprintName(nextDraft) : `a new Sprint ${nextSprintNumber(sprints, sprint.projectId)}`;

  return (
    <Dialog
      open
      onClose={onClose}
      wide
      title={`Complete ${sprintName(sprint)}`}
      subtitle="Record the sprint outcome from your Sprint Review."
      footer={
        <>
          <span className="grow muted" style={{ fontSize: 12 }}>{outcome ? '' : 'Choose a goal outcome to continue.'}</span>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!outcome}
            onClick={() => {
              const res = complete(sprint.id, { outcome: outcome!, reviewNotes: notes, carryTo });
              toast(
                `${sprintName(sprint)} completed.${res.carried ? ` ${res.carried} task${res.carried > 1 ? 's' : ''} moved to ${carryTo === 'next' ? nextLabel.replace('a new ', '') : 'the backlog'}.` : ''}`,
              );
              onClose();
            }}
          >
            Complete sprint
          </button>
        </>
      }
    >
      <div className="grid-3" style={{ gap: 12 }}>
        <div className="card" style={{ padding: 14 }}>
          <div className="muted" style={{ fontSize: 12 }}>Tasks done</div>
          <div className="num" style={{ fontSize: 22, fontWeight: 700 }}>{p.done} / {p.total}</div>
        </div>
        <div className="card" style={{ padding: 14 }}>
          <div className="muted" style={{ fontSize: 12 }}>Weight delivered</div>
          <div className="num" style={{ fontSize: 22, fontWeight: 700 }}>{p.doneWeight} / {p.totalWeight}</div>
        </div>
        <div className="card" style={{ padding: 14 }}>
          <div className="muted" style={{ fontSize: 12 }}>Still open</div>
          <div className="num" style={{ fontSize: 22, fontWeight: 700 }}>{open.length}</div>
        </div>
      </div>

      <fieldset style={{ border: 0, margin: 0, padding: 0 }} className="col">
        <legend className="field-label" style={{ marginBottom: 6 }}>
          Was the sprint goal met? <span className="req">*</span>
        </legend>
        <p className="muted" style={{ fontSize: 13, marginBottom: 6 }}>
          <Icon name="target" size={14} style={{ verticalAlign: -2 }} /> {sprint.goal || 'No goal was set for this sprint.'}
        </p>
        <div className="row wrap">
          {(Object.keys(OUTCOME_LABEL) as GoalOutcome[]).map((o) => (
            <label key={o} className="check" style={{ padding: '10px 14px', border: `1px solid ${outcome === o ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 8, background: outcome === o ? 'var(--primary-subtle)' : '#fff' }}>
              <input type="radio" name="outcome" checked={outcome === o} onChange={() => setOutcome(o)} />
              <span style={{ fontWeight: 600 }}>{OUTCOME_LABEL[o]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {open.length > 0 && (
        <fieldset style={{ border: 0, margin: 0, padding: 0 }} className="col">
          <legend className="field-label" style={{ marginBottom: 6 }}>
            Where should the {open.length} unfinished backlog item{open.length > 1 ? 's' : ''} (with their tasks) go?
          </legend>
          <label className="check">
            <input type="radio" name="carry" checked={carryTo === 'next'} onChange={() => setCarryTo('next')} />
            <span>Carry over to {nextLabel}</span>
          </label>
          <label className="check">
            <input type="radio" name="carry" checked={carryTo === 'backlog'} onChange={() => setCarryTo('backlog')} />
            <span>Move back to the product backlog for re-prioritisation</span>
          </label>
          <ul style={{ listStyle: 'none', margin: '6px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
            {open.map((i) => (
              <li key={i.id} className="row" style={{ fontSize: 13 }}>
                <StatusIcon status={i.status} size={14} />
                <span className="muted num" style={{ width: 72 }}>{i.key}</span>
                <span className="truncate">{i.title}</span>
              </li>
            ))}
          </ul>
        </fieldset>
      )}

      <div className="field">
        <label className="field-label" htmlFor="cs-notes">Review notes</label>
        <textarea id="cs-notes" className="textarea" placeholder="What was demoed, stakeholder feedback, what changed in the backlog" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
    </Dialog>
  );
}

/* ---------- New project ---------- */

export function NewProjectDialog({ onClose, tribe }: { onClose: () => void; tribe?: Tribe }) {
  const { access } = useAuth();
  const allowed = access.isAdmin ? TRIBES : TRIBES.filter((t) => access.tribes.includes(t));
  const projects = useStore((s) => s.projects);
  const create = useStore((s) => s.createProject);
  const navigate = useNavigate();
  const today = todayISO();
  const [f, setF] = useState({
    name: '', code: '', key: '', client: '', description: '', tribe: tribe && allowed.includes(tribe) ? tribe : allowed[0] ?? TRIBES[0], startDate: today, endDate: addDays(today, 364),
  });
  const [touched, setTouched] = useState(false);
  const up = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const codeTaken = projects.some((p) => p.code.toLowerCase() === f.code.trim().toLowerCase());
  const keyTaken = projects.some((p) => p.key.toLowerCase() === f.key.trim().toLowerCase());
  const errors = {
    name: !f.name.trim() ? 'Enter a project name.' : '',
    code: !/^[A-Za-z0-9]{2,3}$/.test(f.code.trim()) ? 'Use 2–3 letters or numbers.' : codeTaken ? 'Another project already uses this code.' : '',
    key: !/^[A-Za-z]{2,5}$/.test(f.key.trim()) ? 'Use 2–5 letters.' : keyTaken ? 'Another project already uses this key.' : '',
    dates: f.endDate < f.startDate ? 'End date must be after the start date.' : '',
  };
  const ok = !Object.values(errors).some(Boolean);

  const autoCodes = (name: string) => {
    const words = name.trim().split(/\s+/).filter(Boolean);
    const code = words.slice(0, 2).map((w) => w[0]).join('').toUpperCase();
    const key = name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();
    return { code, key };
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="New project"
      footer={
        <>
          <span className="grow" />
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setTouched(true);
              if (!ok) return;
              const id = create({ ...f, name: f.name.trim(), code: f.code.trim().toUpperCase(), key: f.key.trim().toUpperCase(), client: f.client.trim(), description: f.description.trim() });
              toast(`${f.name.trim()} created. Plan the first sprint when your backlog is ready.`);
              onClose();
              navigate(`/projects/${id}`);
            }}
          >
            Create project
          </button>
        </>
      }
    >
      <div className="field">
        <label className="field-label" htmlFor="np-name">Project name <span className="req">*</span></label>
        <input
          id="np-name"
          data-autofocus
          className="input"
          value={f.name}
          onChange={(e) => {
            const name = e.target.value;
            setF((x) => {
              const prev = autoCodes(x.name);
              const next = autoCodes(name);
              return {
                ...x,
                name,
                code: !x.code || x.code === prev.code ? next.code : x.code,
                key: !x.key || x.key === prev.key ? next.key : x.key,
              };
            });
          }}
        />
        {touched && errors.name && <span className="field-error">{errors.name}</span>}
      </div>
      <div className="grid-2" style={{ gap: 12 }}>
        <div className="field">
          <label className="field-label" htmlFor="np-code">Short code <span className="req">*</span></label>
          <input id="np-code" className="input" maxLength={3} value={f.code} onChange={up('code')} aria-describedby="np-code-hint" />
          <span id="np-code-hint" className={touched && errors.code ? 'field-error' : 'field-hint'}>{(touched && errors.code) || 'Shown on the project tile, e.g. AT.'}</span>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="np-key">Task key <span className="req">*</span></label>
          <input id="np-key" className="input" maxLength={5} value={f.key} onChange={up('key')} aria-describedby="np-key-hint" />
          <span id="np-key-hint" className={touched && errors.key ? 'field-error' : 'field-hint'}>{(touched && errors.key) || `Task IDs look like ${(f.key || 'KEY').toUpperCase()}-1.`}</span>
        </div>
      </div>
      <div className="grid-2" style={{ gap: 12 }}>
        <div className="field">
          <label className="field-label" htmlFor="np-client">Client or owner</label>
          <input id="np-client" className="input" value={f.client} onChange={up('client')} />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="np-tribe">Tribe</label>
          <select id="np-tribe" className="input" value={f.tribe} onChange={up('tribe')}>
            {allowed.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
      </div>
      <div className="grid-2" style={{ gap: 12 }}>
        <div className="field">
          <label className="field-label" htmlFor="np-start">Start date</label>
          <input id="np-start" type="date" className="input" value={f.startDate} onChange={up('startDate')} />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="np-end">End date</label>
          <input id="np-end" type="date" className="input" value={f.endDate} onChange={up('endDate')} />
          {touched && errors.dates && <span className="field-error">{errors.dates}</span>}
        </div>
      </div>
      <div className="field">
        <label className="field-label" htmlFor="np-desc">Description</label>
        <textarea id="np-desc" className="textarea" value={f.description} onChange={up('description')} />
      </div>
    </Dialog>
  );
}

/* ---------- New task ---------- */

const BACKLOG_TYPES: ItemType[] = ['story', 'bug'];

/** New backlog item (story or bug), in the product backlog or planned straight into a sprint. */
export function NewItemDialog({
  projectId,
  sprintId,
  defaultType = 'story',
  statusId,
  onClose,
}: {
  projectId: string;
  sprintId: string | null;
  defaultType?: ItemType;
  statusId?: string;
  onClose: () => void;
}) {
  const create = useStore((s) => s.createItem);
  const sprint = useStore((s) => s.sprints.find((sp) => sp.id === sprintId) ?? null);
  const members = useProjectMembers(projectId);
  const column = useStore((s) => s.projects.find((p) => p.id === projectId)?.workflow.find((w) => w.id === statusId));
  const [title, setTitle] = useState('');
  const [type, setType] = useState<ItemType>(defaultType === 'task' ? 'story' : defaultType);
  const [weight, setWeight] = useState<number | null>(null);
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [severity, setSeverity] = useState<Severity>('major');
  const [another, setAnother] = useState(false);

  const submit = () => {
    if (!title.trim()) return;
    const item = create(projectId, { title, type, sprintId, weight, assigneeId, severity, statusId });
    toast(`${item.key} added to ${sprint ? sprintName(sprint) : 'the backlog'}.`);
    if (another) {
      setTitle('');
      document.getElementById('ni-title')?.focus();
    } else onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={type === 'bug' && !sprintId ? 'Report a defect' : 'Add backlog item'}
      subtitle={sprint ? `Planned into ${sprintName(sprint)}${column ? ` · ${column.name}` : ''}` : 'To the product backlog. Break it into tasks once it’s planned.'}
      footer={
        <>
          <label className="check grow" style={{ fontSize: 13 }}>
            <input type="checkbox" checked={another} onChange={(e) => setAnother(e.target.checked)} />
            Add another after this
          </label>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" disabled={!title.trim()} onClick={submit}>Add</button>
        </>
      }
    >
      <form className="col" style={{ gap: 16 }} onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <div className="field">
          <label className="field-label" htmlFor="ni-title">Title <span className="req">*</span></label>
          <input id="ni-title" data-autofocus className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={type === 'bug' ? 'What’s broken?' : 'What should users be able to do?'} />
        </div>
        <div className="grid-2" style={{ gap: 12 }}>
          <div className="field">
            <label className="field-label" htmlFor="ni-type">Type</label>
            <select id="ni-type" className="input" value={type} onChange={(e) => setType(e.target.value as ItemType)}>
              {BACKLOG_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select>
          </div>
          {type === 'bug' ? (
            <div className="field">
              <label className="field-label" htmlFor="ni-sev">Severity</label>
              <select id="ni-sev" className="input" value={severity} onChange={(e) => setSeverity(e.target.value as Severity)}>
                <option value="critical">Critical</option>
                <option value="major">Major</option>
                <option value="minor">Minor</option>
              </select>
            </div>
          ) : (
            <div className="field">
              <label className="field-label" htmlFor="ni-weight">Weight</label>
              <select id="ni-weight" className="input" value={weight ?? ''} onChange={(e) => setWeight(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Not estimated</option>
                {WEIGHTS.map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="field">
          <label className="field-label" htmlFor="ni-assignee">Owner</label>
          <select id="ni-assignee" className="input" value={assigneeId ?? ''} onChange={(e) => setAssigneeId(e.target.value || null)}>
            <option value="">Unassigned</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}

/**
 * New task. Every task belongs to a backlog item and lands in that item's sprint,
 * so the dialog starts by picking the item (preset when opened from an item).
 */
export function NewTaskDialog({
  projectId,
  sprintId,
  parentId,
  statusId,
  onClose,
}: {
  projectId: string;
  /** Offer backlog items from this sprint (null = the product backlog). */
  sprintId: string | null;
  parentId?: string;
  statusId?: string;
  onClose: () => void;
}) {
  const create = useStore((s) => s.createItem);
  const allItems = useStore((s) => s.items);
  const members = useProjectMembers(projectId);
  const column = useStore((s) => s.projects.find((p) => p.id === projectId)?.workflow.find((w) => w.id === statusId));
  const parents = useMemo(
    () =>
      allItems
        .filter((i) => i.projectId === projectId && i.type !== 'task' && (parentId ? i.id === parentId : i.sprintId === sprintId))
        .sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done') || a.rank - b.rank),
    [allItems, projectId, sprintId, parentId],
  );
  const [parent, setParent] = useState(parentId ?? parents.find((p) => p.status !== 'done')?.id ?? parents[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [another, setAnother] = useState(false);
  const chosen = parents.find((p) => p.id === parent);

  const submit = () => {
    if (!title.trim() || !chosen) return;
    const item = create(projectId, { title, type: 'task', sprintId: chosen.sprintId, parentId: chosen.id, assigneeId, statusId });
    toast(`${item.key} added to ${chosen.key}.`);
    if (another) {
      setTitle('');
      document.getElementById('nt-title')?.focus();
    } else onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Add task"
      subtitle={chosen ? `Part of ${chosen.key}${column ? ` · ${column.name}` : ''}` : 'Tasks break a backlog item into work.'}
      footer={
        parents.length ? (
          <>
            <label className="check grow" style={{ fontSize: 13 }}>
              <input type="checkbox" checked={another} onChange={(e) => setAnother(e.target.checked)} />
              Add another after this
            </label>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="button" className="btn btn-primary" disabled={!title.trim() || !chosen} onClick={submit}>Add task</button>
          </>
        ) : (
          <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
        )
      }
    >
      {parents.length === 0 ? (
        <div className="col" style={{ gap: 8 }}>
          <strong>No backlog items {sprintId ? 'in this sprint' : 'yet'}</strong>
          <p className="muted" style={{ fontSize: 13 }}>
            Tasks always come from a backlog item. {sprintId ? 'Plan a backlog item into this sprint from the Backlog first, then break it into tasks.' : 'Add a backlog item first.'}
          </p>
        </div>
      ) : (
        <form className="col" style={{ gap: 16 }} onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <div className="field">
            <label className="field-label" htmlFor="nt-parent">Backlog item <span className="req">*</span></label>
            <select id="nt-parent" className="input" value={parent} onChange={(e) => setParent(e.target.value)} disabled={!!parentId}>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>{p.key} · {p.title}{p.status === 'done' ? ' (done)' : ''}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="nt-title">Task <span className="req">*</span></label>
            <input id="nt-title" data-autofocus className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Write API contract, Review with PO" />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="nt-assignee">Assignee</label>
            <select id="nt-assignee" className="input" value={assigneeId ?? ''} onChange={(e) => setAssigneeId(e.target.value || null)}>
              <option value="">Unassigned</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <button type="submit" hidden />
        </form>
      )}
    </Dialog>
  );
}
