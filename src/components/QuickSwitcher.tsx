import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sprintName } from '../domain/sprint';
import { useStore } from '../store/useStore';
import { Icon } from './Icon';
import { Dialog, TRIBE_STYLE } from './ui';

interface Entry {
  id: string;
  label: string;
  hint: string;
  to: string;
  tile?: { code: string; bg: string; fg: string };
}

export function QuickSwitcher({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const projects = useStore((s) => s.projects);
  const sprints = useStore((s) => s.sprints);
  const items = useStore((s) => s.items);

  const entries = useMemo<Entry[]>(() => {
    const term = q.trim().toLowerCase();
    const list: Entry[] = [];
    for (const p of projects) {
      const t = TRIBE_STYLE[p.tribe];
      list.push({ id: p.id, label: p.name, hint: `${p.client} · ${p.status === 'active' ? 'Active' : 'Completed'}`, to: `/projects/${p.id}`, tile: { code: p.code, bg: t.bg, fg: t.fg } });
    }
    for (const s of sprints.filter((x) => x.status === 'active')) {
      const p = projects.find((x) => x.id === s.projectId);
      if (p) list.push({ id: s.id, label: `${p.name} · ${sprintName(s)}`, hint: 'Active sprint board', to: `/projects/${p.id}/sprints/${s.id}` });
    }
    if (term.length >= 2) {
      for (const i of items) {
        if (i.key.toLowerCase().includes(term) || i.title.toLowerCase().includes(term)) {
          list.push({ id: i.id, label: `${i.key} ${i.title}`, hint: 'Task', to: `?task=${i.id}` });
        }
      }
    }
    return (term ? list.filter((e) => `${e.label} ${e.hint}`.toLowerCase().includes(term)) : list).slice(0, 12);
  }, [q, projects, sprints, items]);

  const go = (e: Entry) => {
    onClose();
    setQ('');
    navigate(e.to.startsWith('?') ? { search: e.to } : e.to);
  };

  return (
    <Dialog open={open} onClose={onClose} title="Jump to">
      <div className="search-box" style={{ width: '100%', height: 44 }}>
        <Icon name="search" size={18} />
        <input
          data-autofocus
          aria-label="Search projects, sprints and tasks"
          placeholder="Search projects, sprints, or task IDs"
          value={q}
          role="combobox"
          aria-expanded="true"
          aria-controls="qs-list"
          aria-activedescendant={entries[active] ? `qs-${entries[active].id}` : undefined}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, entries.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter' && entries[active]) {
              go(entries[active]);
            }
          }}
          style={{ fontSize: 15 }}
        />
      </div>
      <ul id="qs-list" role="listbox" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {entries.length === 0 && <li className="muted" style={{ padding: 12 }}>No matches.</li>}
        {entries.map((e, i) => (
          <li
            key={e.id}
            id={`qs-${e.id}`}
            role="option"
            aria-selected={i === active}
            onMouseEnter={() => setActive(i)}
            onClick={() => go(e)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 6, cursor: 'pointer',
              background: i === active ? 'var(--primary-subtle)' : 'transparent',
            }}
          >
            {e.tile ? (
              <span className="nav-tile" style={{ background: e.tile.bg, color: e.tile.fg, width: 24, height: 24 }}>{e.tile.code}</span>
            ) : (
              <Icon name={e.hint === 'Task' ? 'tasks' : 'kanban'} size={18} color="var(--text-muted)" />
            )}
            <span className="grow truncate" style={{ fontWeight: 600 }}>{e.label}</span>
            <span className="muted" style={{ fontSize: 12 }}>{e.hint}</span>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
