import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { Avatar, Empty } from '../../components/ui';
import { sprintName } from '../../domain/sprint';
import { RetroBoard } from '../../features/RetroBoard';
import { useProjectSprints } from '../../store/hooks';
import { useStore } from '../../store/useStore';
import { useProjectCtx } from './ProjectLayout';

export function RetroTab() {
  const { project } = useProjectCtx();
  const sprints = useProjectSprints(project.id).filter((s) => s.status !== 'draft');
  const retro = useStore((s) => s.retro);
  const members = useStore((s) => s.members);
  const updateRetro = useStore((s) => s.updateRetro);
  const [sprintId, setSprintId] = useState<string>(() => (sprints.find((s) => s.status === 'active') ?? sprints[0])?.id ?? '');
  const sprint = sprints.find((s) => s.id === sprintId) ?? null;
  const openActions = retro.filter((r) => r.projectId === project.id && r.kind === 'action' && !r.done);

  return (
    <div className="page">
      <div className="page-head">
        <div className="col" style={{ gap: 4 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Retrospectives</h2>
          <p className="muted" style={{ fontSize: 13 }}>One retro per sprint. Action items stay visible here until they are done.</p>
        </div>
        {sprints.length > 0 && (
          <div className="row">
            <label htmlFor="rt-sprint" className="muted" style={{ fontSize: 13 }}>Sprint</label>
            <select id="rt-sprint" className="filter-select" value={sprintId} onChange={(e) => setSprintId(e.target.value)}>
              {sprints.map((s) => <option key={s.id} value={s.id}>{sprintName(s)}{s.status === 'active' ? ' (active)' : ''}</option>)}
            </select>
          </div>
        )}
      </div>

      {openActions.length > 0 && (
        <section className="card" aria-labelledby="rt-open">
          <div className="card-head">
            <h3 id="rt-open" className="card-title">Open action items</h3>
            <span className="count-pill">{openActions.length}</span>
          </div>
          <div>
            {openActions.map((a, i) => {
              const s = sprints.find((x) => x.id === a.sprintId);
              return (
                <div key={a.id} className="row" style={{ padding: '10px 20px', borderTop: i ? '1px solid var(--border-soft)' : undefined }}>
                  <label className="check grow" style={{ fontSize: 13 }}>
                    <input type="checkbox" checked={a.done} onChange={() => updateRetro(a.id, { done: true })} />
                    <span>{a.text}</span>
                  </label>
                  <span className="muted" style={{ fontSize: 12 }}>{s ? `From ${sprintName(s)}` : ''}</span>
                  <Avatar member={members.find((m) => m.id === a.ownerId) ?? null} title="No owner" />
                </div>
              );
            })}
          </div>
        </section>
      )}

      {sprint ? (
        <RetroBoard sprint={sprint} />
      ) : (
        <Empty icon="message" title="No sprints to reflect on yet">
          <span>Retros open once the first sprint starts.</span>
        </Empty>
      )}
      <p className="muted row" style={{ fontSize: 12, gap: 6 }}>
        <Icon name="info" size={14} /> Tip: vote on notes to decide what to discuss first. Notes sort by votes.
      </p>
    </div>
  );
}
