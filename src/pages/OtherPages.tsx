import { useAuth } from '../auth/AuthProvider';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Topbar } from '../components/AppShell';
import { Icon } from '../components/Icon';
import { toast } from '../components/toast';
import { Empty, ItemStatusBadge, TypeBadge } from '../components/ui';
import { fmtDayDate, fmtDue, isWeekend } from '../domain/dates';
import { sprintName } from '../domain/sprint';
import type { HolidayKind } from '../domain/types';
import { STATUS_ORDER } from '../domain/types';
import { useToday } from '../store/hooks';
import { useStore } from '../store/useStore';

/* ---------- Holiday calendar (Administration) ---------- */

export function HolidayCalendarPage() {
  const holidays = useStore((s) => s.holidays);
  const addHoliday = useStore((s) => s.addHoliday);
  const deleteHoliday = useStore((s) => s.deleteHoliday);
  const canEdit = useAuth().access.isAdmin;
  const today = useToday();
  const years = [...new Set(holidays.map((h) => h.date.slice(0, 4)))].sort();
  const [year, setYear] = useState(today.slice(0, 4));
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [kind, setKind] = useState<HolidayKind>('public');
  const [touched, setTouched] = useState(false);
  const list = holidays.filter((h) => h.date.startsWith(year));
  const duplicate = holidays.some((h) => h.date === date);

  return (
    <>
      <Topbar crumbs={[{ label: 'Administration' }, { label: 'Holiday calendar' }]} />
      <div className="content">
        <div className="page" style={{ maxWidth: 960 }}>
          <div className="page-head">
            <div className="col" style={{ gap: 6 }}>
              <h1 className="page-title">Holiday calendar</h1>
              <p className="muted">
                Public holidays and collective leave are excluded from sprint working days. Update this list from the official decree every year.
              </p>
            </div>
            <div className="row">
              <label className="sr-only" htmlFor="hc-year">Year</label>
              <select id="hc-year" className="filter-select" value={year} onChange={(e) => setYear(e.target.value)}>
                {[...new Set([...years, today.slice(0, 4)])].sort().map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          {!canEdit && (
            <p className="muted row" style={{ fontSize: 13 }}><Icon name="info" size={16} /> Only admins can change the holiday calendar.</p>
          )}
          {canEdit && <form
            className="card row wrap"
            style={{ padding: 16, alignItems: 'flex-end' }}
            onSubmit={(e) => {
              e.preventDefault();
              setTouched(true);
              if (!date || !name.trim() || duplicate) return;
              addHoliday({ date, name: name.trim(), kind });
              toast(`${name.trim()} added.`);
              setYear(date.slice(0, 4));
              setDate('');
              setName('');
              setTouched(false);
            }}
          >
            <div className="field">
              <label className="field-label" htmlFor="hc-date">Date</label>
              <input id="hc-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="field grow" style={{ minWidth: 220 }}>
              <label className="field-label" htmlFor="hc-name">Name</label>
              <input id="hc-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Eid al-Fitr" />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="hc-kind">Type</label>
              <select id="hc-kind" className="input" value={kind} onChange={(e) => setKind(e.target.value as HolidayKind)}>
                <option value="public">Public holiday</option>
                <option value="collective">Collective leave</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary"><Icon name="plus" size={18} /> Add</button>
            {touched && (!date || !name.trim() || duplicate) && (
              <span className="field-error" style={{ width: '100%' }}>
                {!date ? 'Choose a date.' : !name.trim() ? 'Enter a name.' : 'That date is already in the calendar.'}
              </span>
            )}
          </form>}

          {list.length === 0 ? (
            <Empty icon="calendar" title={`No holidays for ${year} yet`}><span>Add them from the official decree so sprint capacity stays accurate.</span></Empty>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col" style={{ width: 220 }}>Date</th>
                    <th scope="col">Name</th>
                    <th scope="col" style={{ width: 170 }}>Type</th>
                    <th scope="col" style={{ width: 56 }}><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((h) => (
                    <tr key={h.id}>
                      <td className="num">
                        {fmtDayDate(h.date)}
                        {isWeekend(h.date) && <span className="muted" style={{ fontSize: 12 }}> · weekend</span>}
                      </td>
                      <td style={{ fontWeight: 600 }}>{h.name}</td>
                      <td><span className={`badge sm ${h.kind === 'public' ? 'danger' : 'warning'}`}>{h.kind === 'public' ? 'Public holiday' : 'Collective leave'}</span></td>
                      <td>
                        {canEdit && <button
                          type="button"
                          className="icon-btn sm"
                          aria-label={`Remove ${h.name}`}
                          onClick={() => {
                            deleteHoliday(h.id);
                            toast(`${h.name} removed.`, { label: 'Undo', run: () => addHoliday({ date: h.date, name: h.name, kind: h.kind }) });
                          }}
                        >
                          <Icon name="trash" size={16} />
                        </button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="muted row" style={{ fontSize: 12, gap: 6 }}>
            <Icon name="info" size={14} /> Lunar-calendar holidays (Eid, Chinese New Year, Nyepi, and others) change every year, so they are not pre-filled.
          </p>
        </div>
      </div>
    </>
  );
}

/* ---------- My tasks ---------- */

export function MyTasksPage() {
  const items = useStore((s) => s.items);
  const sprints = useStore((s) => s.sprints);
  const projects = useStore((s) => s.projects);
  const me = useStore((s) => s.currentUserId);
  const today = useToday();
  const [, setParams] = useSearchParams();
  const [showDone, setShowDone] = useState(false);

  const mine = useMemo(
    () =>
      items
        .filter((i) => i.assigneeId === me && (showDone || i.status !== 'done'))
        .filter((i) => {
          const s = sprints.find((x) => x.id === i.sprintId);
          return s ? s.status === 'active' : false;
        })
        .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)),
    [items, sprints, me, showDone],
  );

  return (
    <>
      <Topbar crumbs={[{ label: 'My tasks' }]} />
      <div className="content">
        <div className="page">
          <div className="page-head">
            <div className="col" style={{ gap: 6 }}>
              <h1 className="page-title">My tasks</h1>
              <p className="muted">Everything assigned to you in active sprints, soonest due first.</p>
            </div>
            <label className="check" style={{ fontSize: 13 }}>
              <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Show done
            </label>
          </div>
          {mine.length === 0 ? (
            <Empty icon="tasks" title="You're all caught up"><span>No open tasks in active sprints.</span></Empty>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col" style={{ width: 100 }}>ID</th>
                    <th scope="col">Task</th>
                    <th scope="col" style={{ width: 220 }}>Project · Sprint</th>
                    <th scope="col" style={{ width: 160 }}>Status</th>
                    <th scope="col" style={{ width: 160 }}>Due</th>
                  </tr>
                </thead>
                <tbody>
                  {mine.map((i) => {
                    const s = sprints.find((x) => x.id === i.sprintId)!;
                    const p = projects.find((x) => x.id === i.projectId)!;
                    const due = i.dueDate && i.status !== 'done' ? fmtDue(i.dueDate, today) : null;
                    return (
                      <tr key={i.id} className="clickable">
                        <td className="muted num">{i.key}</td>
                        <td>
                          <div className="row">
                            <TypeBadge type={i.type} />
                            <button type="button" className="task-card-title truncate" onClick={() => setParams({ task: i.id })}>{i.title}</button>
                          </div>
                        </td>
                        <td><Link to={`/projects/${p.id}/sprints/${s.id}`}>{p.name} · {sprintName(s)}</Link></td>
                        <td><ItemStatusBadge item={i} /></td>
                        <td>{due ? <span className={`chip-date ${due.tone === 'neutral' ? '' : due.tone}`}>{due.label}</span> : <span className="subtle">—</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
