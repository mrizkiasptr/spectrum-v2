import { useState } from 'react';
import { Icon } from '../components/Icon';
import { toast } from '../components/toast';
import { ColumnIcon, Dialog, MenuButton } from '../components/ui';
import type { ItemStatus, Project, WorkflowStatus } from '../domain/types';
import { STATUS_COLORS, STATUS_LABEL, STATUS_ORDER } from '../domain/types';
import { columnOf, MAX_STATUS_NAME } from '../domain/workflow';
import { useStore } from '../store/useStore';

const CATEGORY_HINT: Record<ItemStatus, string> = {
  todo: 'Work not started yet',
  in_progress: 'Work in progress',
  review: 'Waiting for review or QA',
  done: 'Finished; counts toward progress and releases',
};

function ColorPicker({ value, onChange, label }: { value: string; onChange: (c: string) => void; label: string }) {
  return (
    <MenuButton
      label={label}
      className="icon-btn sm"
      align="left"
      trigger={<span style={{ width: 16, height: 16, borderRadius: 999, background: value, display: 'block' }} />}
    >
      {(close) => (
        <div role="radiogroup" aria-label="Color" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 32px)', gap: 6, padding: 4 }}>
          {STATUS_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={value === c.value}
              aria-label={c.name}
              title={c.name}
              onClick={() => {
                onChange(c.value);
                close();
              }}
              style={{
                width: 32, height: 32, padding: 0, borderRadius: 8, cursor: 'pointer', display: 'grid', placeItems: 'center',
                border: value === c.value ? `2px solid ${c.value}` : '1px solid var(--border)', background: '#fff',
              }}
            >
              <span style={{ width: 16, height: 16, borderRadius: 999, background: c.value }} />
            </button>
          ))}
        </div>
      )}
    </MenuButton>
  );
}

/**
 * Edit a project's board columns: rename, recolor, reorder (drag or arrows),
 * change what a column counts as, add new columns, and delete columns safely.
 */
export function WorkflowEditor({ project }: { project: Project }) {
  const items = useStore((s) => s.items);
  const addStatus = useStore((s) => s.addStatus);
  const updateStatus = useStore((s) => s.updateStatus);
  const deleteStatus = useStore((s) => s.deleteStatus);
  const moveStatus = useStore((s) => s.moveStatus);
  const workflow = project.workflow;

  const [names, setNames] = useState<Record<string, string>>({});
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<ItemStatus>('in_progress');
  const [newColor, setNewColor] = useState(STATUS_COLORS[3].value);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<WorkflowStatus | null>(null);
  const [moveTo, setMoveTo] = useState('');

  const countIn = (id: string) =>
    items.filter((i) => i.projectId === project.id && columnOf(workflow, i).id === id).length;
  const report = (err: string | null, ok?: string) => (err ? toast(err) : ok && toast(ok));

  const commitName = (w: WorkflowStatus) => {
    const name = names[w.id];
    if (name === undefined || name.trim() === w.name) return;
    const err = updateStatus(project.id, w.id, { name });
    if (err) {
      toast(err);
      setNames((n) => ({ ...n, [w.id]: w.name }));
    }
  };

  const doneCount = workflow.filter((w) => w.category === 'done').length;

  return (
    <div className="col" style={{ gap: 12 }}>
      <p className="muted" style={{ fontSize: 13 }}>
        Columns appear on every sprint board in this order. <strong style={{ color: 'var(--text)' }}>Counts as</strong> tells SPEctrum
        how to treat a column in progress, burndown, and releases. Drag rows or use the arrows to reorder.
      </p>
      <div className="row muted" style={{ fontSize: 12, padding: '0 10px', gap: 10 }} aria-hidden="true">
        <span style={{ width: 16 + 16 + 28 + 20 }} />
        <span className="grow">Name</span>
        <span style={{ width: 150 }}>Counts as</span>
        <span style={{ width: 64 + 3 * 28 + 30 }} />
      </div>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }} aria-label="Workflow statuses">
        {workflow.map((w, idx) => {
          const count = countIn(w.id);
          const lastDone = w.category === 'done' && doneCount === 1;
          return (
            <li
              key={w.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', w.id);
                setTimeout(() => setDragId(w.id), 0);
              }}
              onDragEnd={() => {
                setDragId(null);
                setOverIdx(null);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (overIdx !== idx) setOverIdx(idx);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData('text/plain') || dragId;
                if (id) moveStatus(project.id, id, idx);
                setDragId(null);
                setOverIdx(null);
              }}
              className="row"
              style={{
                gap: 10, padding: '8px 10px', borderRadius: 8, background: '#fff',
                border: `1px solid ${overIdx === idx && dragId && dragId !== w.id ? 'var(--primary)' : 'var(--border)'}`,
                opacity: dragId === w.id ? 0.5 : 1,
              }}
            >
              <span aria-hidden="true" style={{ cursor: 'grab', color: 'var(--text-subtle)', display: 'flex' }} title="Drag to reorder">
                <Icon name="more" size={16} style={{ transform: 'rotate(90deg)' }} />
              </span>
              <ColumnIcon column={w} />
              <ColorPicker value={w.color} label={`Color for ${w.name}`} onChange={(color) => report(updateStatus(project.id, w.id, { color }))} />
              <label className="sr-only" htmlFor={`wf-name-${w.id}`}>Name</label>
              <input
                id={`wf-name-${w.id}`}
                className="input input-sm grow"
                style={{ minWidth: 120 }}
                maxLength={MAX_STATUS_NAME}
                value={names[w.id] ?? w.name}
                onChange={(e) => setNames((n) => ({ ...n, [w.id]: e.target.value }))}
                onBlur={() => commitName(w)}
                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              />
              <label className="sr-only" htmlFor={`wf-cat-${w.id}`}>Counts as</label>
              <select
                id={`wf-cat-${w.id}`}
                className="filter-select"
                style={{ height: 36, width: 150 }}
                value={w.category}
                title={CATEGORY_HINT[w.category]}
                onChange={(e) => report(updateStatus(project.id, w.id, { category: e.target.value as ItemStatus }))}
              >
                {STATUS_ORDER.map((c) => (
                  <option key={c} value={c} disabled={lastDone && c !== 'done'}>
                    {STATUS_LABEL[c]}
                  </option>
                ))}
              </select>
              <span className="muted num" style={{ fontSize: 12, width: 64, textAlign: 'right', whiteSpace: 'nowrap' }}>
                {count} task{count === 1 ? '' : 's'}
              </span>
              <button type="button" className="icon-btn sm" aria-label={`Move ${w.name} left`} disabled={idx === 0} onClick={() => moveStatus(project.id, w.id, idx - 1)}>
                <Icon name="chevronUp" size={16} />
              </button>
              <button
                type="button"
                className="icon-btn sm"
                aria-label={`Move ${w.name} right`}
                disabled={idx === workflow.length - 1}
                onClick={() => moveStatus(project.id, w.id, idx + 1)}
              >
                <Icon name="chevronDown" size={16} />
              </button>
              <button
                type="button"
                className="icon-btn sm"
                aria-label={`Delete ${w.name}`}
                title={lastDone ? 'Keep at least one Done status' : workflow.length <= 2 ? 'Keep at least two statuses' : undefined}
                disabled={lastDone || workflow.length <= 2}
                onClick={() => {
                  const fallback = workflow.find((x) => x.id !== w.id && x.category === w.category) ?? workflow.find((x) => x.id !== w.id)!;
                  if (count === 0) {
                    report(deleteStatus(project.id, w.id, fallback.id), `"${w.name}" deleted.`);
                  } else {
                    setMoveTo(fallback.id);
                    setDeleting(w);
                  }
                }}
              >
                <Icon name="trash" size={16} />
              </button>
            </li>
          );
        })}
      </ol>

      <form
        className="row"
        style={{ gap: 10, padding: '8px 10px', borderRadius: 8, border: '1px dashed var(--border-strong)' }}
        onSubmit={(e) => {
          e.preventDefault();
          if (!newName.trim()) return;
          const err = addStatus(project.id, { name: newName, category: newCategory, color: newColor });
          if (err) toast(err);
          else {
            toast(`"${newName.trim()}" added to the board.`);
            setNewName('');
          }
        }}
      >
        <ColorPicker value={newColor} label="Color for new status" onChange={setNewColor} />
        <label className="sr-only" htmlFor="wf-new-name">New status name</label>
        <input
          id="wf-new-name"
          className="input input-sm grow"
          style={{ minWidth: 120 }}
          maxLength={MAX_STATUS_NAME}
          placeholder="New status, e.g. Ready for QA"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <label className="sr-only" htmlFor="wf-new-cat">Counts as</label>
        <select id="wf-new-cat" className="filter-select" style={{ height: 36, width: 150 }} value={newCategory} onChange={(e) => setNewCategory(e.target.value as ItemStatus)}>
          {STATUS_ORDER.map((c) => (
            <option key={c} value={c}>{STATUS_LABEL[c]}</option>
          ))}
        </select>
        <button type="submit" className="btn btn-primary btn-md" disabled={!newName.trim()}>
          <Icon name="plus" size={16} /> Add status
        </button>
      </form>
      <p className="muted" style={{ fontSize: 12 }}>
        New statuses are placed before Done; drag them anywhere afterwards. Every board needs at least one status that counts as Done.
      </p>

      {deleting && (
        <div className="alert warning col" role="region" aria-label={`Delete ${deleting.name}`} style={{ gap: 10 }}>
          <strong>
            Delete "{deleting.name}"? {countIn(deleting.id)} task{countIn(deleting.id) === 1 ? ' is' : 's are'} in this status.
          </strong>
          <div className="row wrap">
            <label htmlFor="wf-move" style={{ fontSize: 13 }}>Move tasks to</label>
            <select id="wf-move" className="filter-select" value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
              {workflow.filter((w) => w.id !== deleting.id).map((w) => (
                <option key={w.id} value={w.id}>{w.name} (counts as {STATUS_LABEL[w.category]})</option>
              ))}
            </select>
            <span className="grow" />
            <button type="button" className="btn btn-secondary btn-md" onClick={() => setDeleting(null)}>Cancel</button>
            <button
              type="button"
              className="btn btn-danger btn-md"
              onClick={() => {
                const target = workflow.find((w) => w.id === moveTo);
                const err = deleteStatus(project.id, deleting.id, moveTo);
                report(err, `"${deleting.name}" deleted. Tasks moved to ${target?.name}.`);
                if (!err) setDeleting(null);
              }}
            >
              Delete status
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function WorkflowDialog({ project, onClose }: { project: Project; onClose: () => void }) {
  return (
    <Dialog open onClose={onClose} wide title="Board columns" subtitle={`${project.name} · applies to every sprint in this project`} footer={
      <>
        <span className="grow" />
        <button type="button" className="btn btn-primary" onClick={onClose}>Done</button>
      </>
    }>
      <WorkflowEditor project={project} />
    </Dialog>
  );
}
