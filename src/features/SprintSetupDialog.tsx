import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { toast } from '../components/toast';
import { Dialog } from '../components/ui';
import { addDays, fmtDate, fmtDayDate, holidaysFor, lengthInDays, todayISO, workingDays } from '../domain/dates';
import {
  checkPeriod,
  MAX_GOAL_LENGTH,
  readiness,
  RECOMMENDED_SPRINT_DAYS,
  sprintName,
  SPRINT_LENGTH_PRESETS,
  startBlocker,
} from '../domain/sprint';
import type { Sprint } from '../domain/types';
import { useProject } from '../store/hooks';
import { useStore } from '../store/useStore';

type Length = number | 'custom';

export function SprintSetupDialog({ sprint, onClose }: { sprint: Sprint; onClose: () => void }) {
  const project = useProject(sprint.projectId)!;
  const allSprints = useStore((s) => s.sprints);
  const items = useStore((s) => s.items);
  const holidayList = useStore((s) => s.holidays);
  const updateSprint = useStore((s) => s.updateSprint);
  const updateProject = useStore((s) => s.updateProject);
  const startSprint = useStore((s) => s.startSprint);

  const initialLen: Length = (() => {
    if (!sprint.startDate || !sprint.endDate) return project.defaultSprintDays;
    const len = lengthInDays(sprint.startDate, sprint.endDate);
    return SPRINT_LENGTH_PRESETS.includes(len) ? len : 'custom';
  })();

  const [goal, setGoal] = useState(sprint.goal);
  const [length, setLength] = useState<Length>(initialLen);
  const [start, setStart] = useState(sprint.startDate ?? '');
  const [customEnd, setCustomEnd] = useState(sprint.endDate ?? '');
  const [saveDefault, setSaveDefault] = useState(false);

  const end = length === 'custom' ? customEnd : start ? addDays(start, length - 1) : '';
  const holidays = useMemo(() => holidaysFor(holidayList, project.countCollectiveLeave), [holidayList, project.countCollectiveLeave]);
  const others = allSprints.filter((s) => s.projectId === sprint.projectId && s.id !== sprint.id);
  const check = checkPeriod(start, end, others, holidays);
  const valid = check.errors.length === 0;
  const summary = valid ? workingDays(start, end, holidays) : null;
  const goalOk = goal.trim().length > 0;

  const draftAfterSave: Sprint = { ...sprint, goal: goal.trim(), startDate: start || null, endDate: end || null };
  const ready = readiness(draftAfterSave, items);
  const blocker = valid ? startBlocker(draftAfterSave, allSprints, items) : 'Fix the dates first.';

  const isDraft = sprint.status === 'draft';

  const persist = () => {
    updateSprint(sprint.id, { goal: goal.trim(), startDate: start, endDate: end });
    const len = lengthInDays(start, end);
    if (saveDefault && len !== project.defaultSprintDays) updateProject(project.id, { defaultSprintDays: len });
  };

  const presets = SPRINT_LENGTH_PRESETS.map((d) => ({ value: d as Length, label: `${d / 7} week${d > 7 ? 's' : ''}`, sub: d === RECOMMENDED_SPRINT_DAYS ? 'Recommended' : `${d} days` }));

  return (
    <Dialog
      open
      onClose={onClose}
      title={`${isDraft ? 'Set up' : 'Edit'} ${sprintName(sprint)}`}
      subtitle={`${project.name}${others.length ? '' : ' · First sprint'}`}
      footer={
        !isDraft ? (
          <>
            <span className="grow" />
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!valid || !goalOk}
              onClick={() => {
                persist();
                toast(`${sprintName(sprint)} updated.`);
                onClose();
              }}
            >
              Save changes
            </button>
          </>
        ) : (
        <>
          <span className="grow muted" style={{ fontSize: 12 }}>
            {!goalOk
              ? 'Add a sprint goal to be able to start this sprint.'
              : !ready.checks.find((c) => c.key === 'items')!.ok
                ? 'Add at least one task from the backlog to start.'
                : blocker ?? (start && start > todayISO() ? 'Ready. Starting now moves the sprint to begin today, keeping its length.' : 'Ready to start.')}
          </span>
          <button type="button" className="btn btn-secondary" disabled={!valid} onClick={() => { persist(); toast(`${sprintName(sprint)} saved as draft.`); onClose(); }}>
            Save draft
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!!blocker}
            title={blocker ?? undefined}
            onClick={() => {
              persist();
              const err = startSprint(sprint.id);
              if (err) toast(err);
              else {
                toast(`${sprintName(sprint)} started.`);
                onClose();
              }
            }}
          >
            Start sprint
          </button>
        </>
        )
      }
    >
      <div className="field">
        <label className="field-label" htmlFor="ss-goal">
          Sprint goal <span className="req">*</span>
        </label>
        <input
          id="ss-goal"
          data-autofocus
          className="input"
          maxLength={MAX_GOAL_LENGTH}
          placeholder="[Checkable outcome] so that [who can do what]"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          aria-describedby="ss-goal-hint"
        />
        <div id="ss-goal-hint" className="row field-hint">
          <span className="grow">Example: Refund API spec ready so dev can start building.</span>
          <span className="num">{goal.length}/{MAX_GOAL_LENGTH}</span>
        </div>
      </div>

      <fieldset style={{ margin: 0, padding: 0, border: 0 }} className="col">
        <legend className="field-label" style={{ marginBottom: 10 }}>Sprint length</legend>
        <div role="radiogroup" aria-label="Sprint length" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 8 }}>
          {[...presets, { value: 'custom' as Length, label: 'Custom', sub: 'Pick dates' }].map((p) => {
            const on = length === p.value;
            return (
              <button
                key={String(p.value)}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  if (p.value === 'custom') setCustomEnd(end);
                  setLength(p.value);
                }}
                style={{
                  height: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                  borderRadius: 8, cursor: 'pointer', border: `1px solid ${on ? 'var(--primary)' : 'var(--border)'}`,
                  boxShadow: on ? '0 0 0 1px var(--primary)' : 'none', background: on ? 'var(--primary-subtle)' : '#fff',
                  color: on ? 'var(--primary-darker)' : 'var(--text)',
                }}
              >
                <span style={{ fontWeight: 600 }}>{p.label}</span>
                <span style={{ fontSize: 11, fontWeight: 500, color: p.sub === 'Recommended' ? 'var(--success-text)' : 'var(--text-muted)' }}>{p.sub}</span>
              </button>
            );
          })}
        </div>
        <span className="field-hint">
          Pick what fits your team&rsquo;s rhythm. 2 weeks keeps the goal focused; the Scrum Guide caps sprints at one month.
        </span>
      </fieldset>

      <div className="grid-2" style={{ gap: 12 }}>
        <div className="field">
          <label className="field-label" htmlFor="ss-start">Start date</label>
          <input id="ss-start" type="date" className="input" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="ss-end">End date</label>
          <input
            id="ss-end"
            type="date"
            className="input"
            value={end}
            readOnly={length !== 'custom'}
            onChange={(e) => setCustomEnd(e.target.value)}
            aria-describedby="ss-end-hint"
          />
          <span id="ss-end-hint" className="field-hint">
            {length === 'custom' ? 'Set any end date your team needs.' : 'Calculated from the length. Choose Custom to change it.'}
          </span>
        </div>
      </div>

      <div className="col" style={{ gap: 8 }}>
        <div className="row" style={{ gap: 12, padding: '14px 16px', borderRadius: 8, background: 'var(--surface-muted)', border: '1px solid var(--border-soft)' }}>
          <Icon name="calendar" color="var(--primary-darker)" />
          <div className="col grow" style={{ gap: 2 }}>
            <strong>{summary ? `${sprintName(sprint)} · ${fmtDate(start)} – ${fmtDate(end)}` : 'Invalid period'}</strong>
            <span className="muted" style={{ fontSize: 12 }}>
              {summary
                ? `${summary.calendarDays} days · ${summary.workingDays} working days${summary.holidays.length ? ` (${summary.holidays.length} holiday${summary.holidays.length > 1 ? 's' : ''} excluded)` : ''} · ends ${fmtDayDate(end)}`
                : 'Check the start and end dates.'}
            </span>
          </div>
        </div>
        {summary && summary.holidays.length > 0 && (
          <div className="row wrap" style={{ gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>Holidays in this period:</span>
            {summary.holidays.map((h) => (
              <span key={h.id} className="badge danger">
                <Icon name="calendar" size={12} /> {fmtDate(h.date, false)} · {h.name}
              </span>
            ))}
          </div>
        )}
        <span className="row muted" style={{ fontSize: 12, gap: 6 }}>
          <Icon name="info" size={14} />
          <span>
            Working days exclude weekends, public holidays{project.countCollectiveLeave ? ', and collective leave' : ''} from{' '}
            <Link to="/admin/holidays" onClick={onClose}>Holiday calendar</Link>.
          </span>
        </span>
      </div>

      {[...check.errors.map((m) => ({ m, tone: 'danger' })), ...check.warnings.map((m) => ({ m, tone: 'warning' }))].map(({ m, tone }) => (
        <div key={m} className={`alert ${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
          <Icon name="alert" size={16} color={tone === 'danger' ? 'var(--danger-text)' : 'var(--warning-text)'} style={{ marginTop: 2 }} />
          <span>{m}</span>
        </div>
      ))}

      {isDraft && (
      <div className="row wrap" style={{ gap: 16, fontSize: 13 }} aria-label="Readiness">
        <strong>Ready to start: {ready.checks.filter((c) => c.ok).length} of {ready.checks.length}</strong>
        {ready.checks.map((c) => (
          <span key={c.key} className="row" style={{ gap: 6, color: c.ok ? 'var(--text)' : 'var(--text-muted)' }}>
            {c.ok ? <Icon name="check" size={14} color="var(--success)" strokeWidth={3} /> : <Icon name="info" size={14} color="var(--text-subtle)" />}
            {c.label}
          </span>
        ))}
      </div>
      )}

      <label className="check" style={{ fontSize: 13 }}>
        <input type="checkbox" checked={saveDefault} onChange={(e) => setSaveDefault(e.target.checked)} />
        <span>
          Make this the default length for future sprints in this project
          <span className="muted"> (currently {project.defaultSprintDays} days)</span>
        </span>
      </label>
    </Dialog>
  );
}
