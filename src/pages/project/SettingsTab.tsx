import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { toast } from '../../components/toast';
import { Avatar } from '../../components/ui';
import { SPRINT_LENGTH_PRESETS } from '../../domain/sprint';
import type { Tribe } from '../../domain/types';
import { TRIBES } from '../../domain/types';
import { useStore } from '../../store/useStore';
import { WorkflowEditor } from '../../features/WorkflowEditor';
import { useProjectCtx } from './ProjectLayout';

export function SettingsTab() {
  const { project } = useProjectCtx();
  const members = useStore((s) => s.members);
  const update = useStore((s) => s.updateProject);
  const location = useLocation();
  const [f, setF] = useState({
    name: project.name,
    client: project.client,
    description: project.description,
    tribe: project.tribe,
    startDate: project.startDate,
    endDate: project.endDate,
  });
  const [customLen, setCustomLen] = useState(String(project.defaultSprintDays));
  const [invite, setInvite] = useState('');

  useEffect(() => {
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth' });
  }, [location.hash]);

  const dirty =
    f.name !== project.name || f.client !== project.client || f.description !== project.description ||
    f.tribe !== project.tribe || f.startDate !== project.startDate || f.endDate !== project.endDate;
  const dateError = f.endDate < f.startDate ? 'End date must be after the start date.' : '';
  const outsiders = members.filter((m) => !project.memberIds.includes(m.id));
  const preset = SPRINT_LENGTH_PRESETS.includes(project.defaultSprintDays);

  return (
    <div className="page" style={{ maxWidth: 880 }}>
      <section className="card" aria-labelledby="st-details">
        <div className="card-head"><h2 id="st-details" className="card-title">Project details</h2></div>
        <form
          className="card-body col"
          style={{ gap: 16 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (!f.name.trim() || dateError) return;
            update(project.id, { ...f, name: f.name.trim() });
            toast('Project details saved.');
          }}
        >
          <div className="grid-2" style={{ gap: 12 }}>
            <div className="field">
              <label className="field-label" htmlFor="st-name">Name</label>
              <input id="st-name" className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="st-client">Client or owner</label>
              <input id="st-client" className="input" value={f.client} onChange={(e) => setF({ ...f, client: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="st-desc">Description</label>
            <textarea id="st-desc" className="textarea" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
          </div>
          <div className="grid-3" style={{ gap: 12 }}>
            <div className="field">
              <label className="field-label" htmlFor="st-tribe">Tribe</label>
              <select id="st-tribe" className="input" value={f.tribe} onChange={(e) => setF({ ...f, tribe: e.target.value as Tribe })}>
                {TRIBES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="st-start">Start date</label>
              <input id="st-start" type="date" className="input" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="st-end">End date</label>
              <input id="st-end" type="date" className="input" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} />
              {dateError && <span className="field-error">{dateError}</span>}
            </div>
          </div>
          <div className="row">
            <span className="grow muted" style={{ fontSize: 12 }}>Project code {project.code} and task key {project.key} can&rsquo;t change after creation.</span>
            <button type="submit" className="btn btn-primary" disabled={!dirty || !!dateError || !f.name.trim()}>Save changes</button>
          </div>
        </form>
      </section>

      <section className="card" aria-labelledby="st-sprints">
        <div className="card-head"><h2 id="st-sprints" className="card-title">Sprint defaults</h2></div>
        <div className="card-body col" style={{ gap: 16 }}>
          <fieldset style={{ border: 0, margin: 0, padding: 0 }} className="col">
            <legend className="field-label" style={{ marginBottom: 8 }}>Default sprint length</legend>
            <div className="row wrap">
              {SPRINT_LENGTH_PRESETS.map((d) => (
                <label key={d} className="check" style={{ padding: '8px 12px', border: `1px solid ${project.defaultSprintDays === d ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 8 }}>
                  <input type="radio" name="len" checked={project.defaultSprintDays === d} onChange={() => { update(project.id, { defaultSprintDays: d }); toast(`New sprints default to ${d / 7} week${d > 7 ? 's' : ''}.`); }} />
                  {d / 7} week{d > 7 ? 's' : ''}{d === 14 ? ' (recommended)' : ''}
                </label>
              ))}
              <label className="check" style={{ padding: '8px 12px', border: `1px solid ${!preset ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 8, alignItems: 'center' }}>
                <input type="radio" name="len" checked={!preset} onChange={() => document.getElementById('st-custom')?.focus()} style={{ marginTop: 0 }} />
                Custom
                <input
                  id="st-custom"
                  type="number"
                  min={1}
                  max={90}
                  className="input input-sm"
                  style={{ width: 80 }}
                  aria-label="Custom length in days"
                  value={customLen}
                  onChange={(e) => setCustomLen(e.target.value)}
                  onBlur={() => {
                    const n = Math.round(Number(customLen));
                    if (n >= 1 && n <= 90 && n !== project.defaultSprintDays) {
                      update(project.id, { defaultSprintDays: n });
                      toast(`New sprints default to ${n} days.`);
                    } else setCustomLen(String(project.defaultSprintDays));
                  }}
                />
                days
              </label>
            </div>
            <span className="field-hint">Teams can still pick any length when they set up each sprint.</span>
          </fieldset>
          <label className="check">
            <input type="checkbox" checked={project.countCollectiveLeave} onChange={(e) => update(project.id, { countCollectiveLeave: e.target.checked })} />
            <span>
              <strong style={{ fontWeight: 600 }}>Exclude collective leave from working days</strong>
              <br />
              <span className="muted" style={{ fontSize: 13 }}>Turn off for teams that stay on duty during collective leave (for example, critical payment services).</span>
            </span>
          </label>
        </div>
      </section>

      <section className="card" id="workflow" aria-labelledby="st-workflow">
        <div className="card-head">
          <h2 id="st-workflow" className="card-title">Board columns</h2>
          <span className="count-pill">{project.workflow.length}</span>
        </div>
        <div className="card-body">
          <WorkflowEditor project={project} />
        </div>
      </section>

      <section className="card" id="members" aria-labelledby="st-members">
        <div className="card-head">
          <h2 id="st-members" className="card-title">Members</h2>
          <span className="count-pill">{project.memberIds.length}</span>
        </div>
        <div className="card-body col" style={{ gap: 12 }}>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              if (!invite) return;
              update(project.id, { memberIds: [...project.memberIds, invite] });
              toast(`${members.find((m) => m.id === invite)?.name} added to ${project.name}.`);
              setInvite('');
            }}
          >
            <label className="sr-only" htmlFor="st-invite">Add member</label>
            <select id="st-invite" className="input grow" value={invite} onChange={(e) => setInvite(e.target.value)} disabled={!outsiders.length}>
              <option value="">{outsiders.length ? 'Choose an employee to add' : 'Everyone is already a member'}</option>
              {outsiders.map((m) => <option key={m.id} value={m.id}>{m.name} · {m.role}</option>)}
            </select>
            <button type="submit" className="btn btn-primary" disabled={!invite}><Icon name="userPlus" size={18} /> Add</button>
          </form>
          {project.memberIds.map((id) => {
            const m = members.find((x) => x.id === id);
            if (!m) return null;
            return (
              <div key={id} className="row" style={{ padding: '6px 0', borderTop: '1px solid var(--border-soft)' }}>
                <Avatar member={m} size="md" />
                <div className="col grow" style={{ gap: 0 }}>
                  <strong style={{ fontWeight: 600 }}>{m.name}</strong>
                  <span className="muted" style={{ fontSize: 12 }}>{m.role}</span>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={project.memberIds.length === 1}
                  onClick={() => {
                    update(project.id, { memberIds: project.memberIds.filter((x) => x !== id) });
                    toast(`${m.name} removed from ${project.name}.`, { label: 'Undo', run: () => update(project.id, { memberIds: [...project.memberIds] }) });
                  }}
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card" aria-labelledby="st-status">
        <div className="card-head"><h2 id="st-status" className="card-title">Project status</h2></div>
        <div className="card-body row wrap">
          <p className="grow muted" style={{ fontSize: 13 }}>
            {project.status === 'active'
              ? 'Completing a project hides it from the default Project Board view. History stays available.'
              : 'This project is completed. Reopen it to plan new sprints.'}
          </p>
          <button
            type="button"
            className={project.status === 'active' ? 'btn btn-danger' : 'btn btn-secondary'}
            onClick={() => {
              if (project.status === 'active' && !window.confirm(`Mark ${project.name} as completed?`)) return;
              update(project.id, { status: project.status === 'active' ? 'completed' : 'active' });
              toast(project.status === 'active' ? `${project.name} marked as completed.` : `${project.name} reopened.`);
            }}
          >
            {project.status === 'active' ? 'Mark project completed' : 'Reopen project'}
          </button>
        </div>
      </section>
    </div>
  );
}
