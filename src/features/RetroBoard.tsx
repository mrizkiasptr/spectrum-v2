import { useState } from 'react';
import { Icon } from '../components/Icon';
import { Avatar } from '../components/ui';
import type { RetroKind, Sprint } from '../domain/types';
import { useProjectMembers } from '../store/hooks';
import { useStore } from '../store/useStore';

const COLS: { kind: RetroKind; title: string; hint: string }[] = [
  { kind: 'well', title: 'Went well', hint: 'What should we keep doing?' },
  { kind: 'improve', title: 'To improve', hint: 'What slowed us down?' },
  { kind: 'action', title: 'Action items', hint: 'One owner, one concrete next step.' },
];

export function RetroBoard({ sprint }: { sprint: Sprint }) {
  const retro = useStore((s) => s.retro);
  const me = useStore((s) => s.currentUserId);
  const members = useStore((s) => s.members);
  const addRetro = useStore((s) => s.addRetro);
  const toggleVote = useStore((s) => s.toggleVote);
  const updateRetro = useStore((s) => s.updateRetro);
  const deleteRetro = useStore((s) => s.deleteRetro);
  const projectMembers = useProjectMembers(sprint.projectId);
  const [drafts, setDrafts] = useState<Record<RetroKind, string>>({ well: '', improve: '', action: '' });

  const notes = retro.filter((r) => r.sprintId === sprint.id);

  return (
    <div className="grid-3" style={{ alignItems: 'start' }}>
      {COLS.map((c) => {
        const list = notes.filter((n) => n.kind === c.kind).sort((a, b) => b.votes.length - a.votes.length);
        return (
          <section key={c.kind} className="retro-col" aria-labelledby={`retro-${c.kind}`}>
            <div className="row">
              <h3 id={`retro-${c.kind}`} style={{ fontSize: 14, fontWeight: 600 }}>{c.title}</h3>
              <span className="count-pill">{list.length}</span>
            </div>
            <span className="muted" style={{ fontSize: 12 }}>{c.hint}</span>
            {list.map((n) => {
              const voted = n.votes.includes(me);
              return (
                <div key={n.id} className="retro-note">
                  {c.kind === 'action' ? (
                    <label className="check" style={{ fontSize: 13, lineHeight: 1.5 }}>
                      <input type="checkbox" checked={n.done} onChange={() => updateRetro(n.id, { done: !n.done })} />
                      <span style={{ textDecoration: n.done ? 'line-through' : undefined, color: n.done ? 'var(--text-muted)' : undefined }}>{n.text}</span>
                    </label>
                  ) : (
                    <p style={{ fontSize: 13, lineHeight: 1.5 }}>{n.text}</p>
                  )}
                  <div className="row" style={{ fontSize: 12 }}>
                    {c.kind === 'action' ? (
                      <>
                        <label className="sr-only" htmlFor={`owner-${n.id}`}>Owner</label>
                        <select id={`owner-${n.id}`} className="filter-select" style={{ height: 28, fontSize: 12 }} value={n.ownerId ?? ''} onChange={(e) => updateRetro(n.id, { ownerId: e.target.value || null })}>
                          <option value="">No owner</option>
                          {projectMembers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                      </>
                    ) : (
                      <Avatar member={members.find((m) => m.id === n.authorId) ?? null} />
                    )}
                    <span className="grow" />
                    {c.kind !== 'action' && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        aria-pressed={voted}
                        aria-label={`${voted ? 'Remove vote' : 'Vote'} (${n.votes.length} votes)`}
                        onClick={() => toggleVote(n.id)}
                        style={{ color: voted ? 'var(--primary-darker)' : undefined, height: 28 }}
                      >
                        <Icon name="thumb" size={14} /> {n.votes.length}
                      </button>
                    )}
                    {n.authorId === me && (
                      <button type="button" className="icon-btn sm" aria-label="Delete note" onClick={() => deleteRetro(n.id)}>
                        <Icon name="trash" size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            <form
              className="col"
              style={{ gap: 6 }}
              onSubmit={(e) => {
                e.preventDefault();
                if (!drafts[c.kind].trim()) return;
                addRetro(sprint.projectId, sprint.id, c.kind, drafts[c.kind]);
                setDrafts((d) => ({ ...d, [c.kind]: '' }));
              }}
            >
              <label className="sr-only" htmlFor={`new-${c.kind}`}>Add to {c.title}</label>
              <textarea
                id={`new-${c.kind}`}
                className="textarea"
                style={{ minHeight: 64 }}
                placeholder={c.kind === 'action' ? 'Add an action item' : 'Add a note'}
                value={drafts[c.kind]}
                onChange={(e) => setDrafts((d) => ({ ...d, [c.kind]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    (e.currentTarget.form as HTMLFormElement).requestSubmit();
                  }
                }}
              />
              <button type="submit" className="btn btn-secondary btn-sm" disabled={!drafts[c.kind].trim()} style={{ alignSelf: 'flex-start' }}>
                <Icon name="plus" size={14} /> Add
              </button>
            </form>
          </section>
        );
      })}
    </div>
  );
}
