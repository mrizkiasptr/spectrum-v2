import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { toast } from '../../components/toast';
import { Avatar, Empty, OutcomeBadge, ItemStatusBadge, TypeBadge } from '../../components/ui';
import { diffDays, fmtDate, fmtDue } from '../../domain/dates';
import { burndown, progressOf, sprintName } from '../../domain/sprint';
import type { WorkItem } from '../../domain/types';
import { statusIndex } from '../../domain/workflow';
import { RetroBoard } from '../../features/RetroBoard';
import { useToday } from '../../store/hooks';
import { useStore } from '../../store/useStore';
import { useSprintCtx } from './SprintLayout';

function useSprintItems() {
  const { sprint } = useSprintCtx();
  const all = useStore((s) => s.items);
  return useMemo(() => all.filter((i) => i.sprintId === sprint.id), [all, sprint.id]);
}

/* ---------- Task list ---------- */

type SortKey = 'key' | 'status' | 'weight' | 'due' | 'assignee';

export function SprintTaskList() {
  const { project } = useSprintCtx();
  const workflow = project.workflow;
  const items = useSprintItems();
  const members = useStore((s) => s.members);
  const today = useToday();
  const [, setParams] = useSearchParams();
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'status', dir: 1 });

  const sorted = [...items].sort((a, b) => {
    const name = (i: WorkItem) => members.find((m) => m.id === i.assigneeId)?.name ?? '~';
    const v: Record<SortKey, (i: WorkItem) => string | number> = {
      key: (i) => Number(i.key.split('-').pop()),
      status: (i) => statusIndex(workflow, i),
      weight: (i) => i.weight ?? -1,
      due: (i) => i.dueDate ?? '9999',
      assignee: name,
    };
    const x = v[sort.key](a);
    const y = v[sort.key](b);
    return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
  });

  const th = (key: SortKey, label: string, width?: number) => (
    <th scope="col" style={{ width }} aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="th-btn" onClick={() => setSort((s) => ({ key, dir: s.key === key ? ((s.dir * -1) as 1 | -1) : 1 }))}>
        {label}
        {sort.key === key && <Icon name={sort.dir === 1 ? 'chevronUp' : 'chevronDown'} size={14} />}
      </button>
    </th>
  );

  if (!items.length)
    return (
      <div className="page">
        <Empty icon="list" title="No tasks in this sprint yet"><span>Add items from the backlog or create tasks on the board.</span></Empty>
      </div>
    );

  return (
    <div className="page" style={{ paddingTop: 16 }}>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              {th('key', 'ID', 100)}
              <th scope="col">Task</th>
              {th('status', 'Status', 160)}
              {th('weight', 'Weight', 100)}
              {th('assignee', 'Assignee', 200)}
              {th('due', 'Due', 160)}
            </tr>
          </thead>
          <tbody>
            {sorted.map((i) => {
              const m = members.find((x) => x.id === i.assigneeId) ?? null;
              const due = i.dueDate && i.status !== 'done' ? fmtDue(i.dueDate, today) : null;
              return (
                <tr key={i.id} className="clickable">
                  <td className="muted num">{i.key}</td>
                  <td>
                    <div className="row">
                      <TypeBadge type={i.type} />
                      <button type="button" className="task-card-title truncate" onClick={() => setParams({ task: i.id })}>{i.title}</button>
                      {i.parentId && (() => {
                        const parent = items.find((x) => x.id === i.parentId);
                        return parent ? <span className="muted truncate" style={{ fontSize: 12 }}>in {parent.key}</span> : null;
                      })()}
                    </div>
                  </td>
                  <td><ItemStatusBadge item={i} /></td>
                  <td className="num">{i.weight ?? <span style={{ color: 'var(--warning-text)' }}>—</span>}</td>
                  <td><span className="row"><Avatar member={m} /> <span className="truncate">{m?.name ?? 'Unassigned'}</span></span></td>
                  <td>{due ? <span className={`chip-date ${due.tone === 'neutral' ? '' : due.tone}`}>{due.label}</span> : <span className="subtle">—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- Report ---------- */

export function SprintReport() {
  const { sprint } = useSprintCtx();
  const items = useSprintItems();
  const members = useStore((s) => s.members);
  const today = useToday();
  const points = burndown(sprint, items, today);
  const p = progressOf(items);

  const byPerson = useMemo(() => {
    const map = new Map<string, { total: number; done: number; weight: number }>();
    for (const i of items) {
      const k = i.assigneeId ?? '';
      const e = map.get(k) ?? { total: 0, done: 0, weight: 0 };
      e.total++;
      if (i.status === 'done') {
        e.done++;
        e.weight += i.weight ?? 0;
      }
      map.set(k, e);
    }
    return [...map.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [items]);

  if (!sprint.startDate || !sprint.endDate)
    return (
      <div className="page">
        <Empty icon="chart" title="No report yet"><span>Set the sprint dates to see the burndown.</span></Empty>
      </div>
    );

  const W = 1040;
  const H = 300;
  const pad = { l: 40, r: 16, t: 16, b: 32 };
  const max = Math.max(1, ...points.map((x) => Math.max(x.ideal, x.remaining ?? 0)));
  const x = (i: number) => pad.l + (i / Math.max(points.length - 1, 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const ideal = points.map((pt, i) => `${i ? 'L' : 'M'}${x(i)},${y(pt.ideal)}`).join('');
  const actualPts = points.map((pt, i) => ({ pt, i })).filter(({ pt }) => pt.remaining !== null);
  const actual = actualPts.map(({ pt, i }, k) => `${k ? 'L' : 'M'}${x(i)},${y(pt.remaining!)}`).join('');
  const todayIdx = points.findIndex((pt) => pt.date === today);
  const last = actualPts[actualPts.length - 1];
  const ticks = [0, Math.round(max / 2), max];
  const every = Math.ceil(points.length / 8);

  return (
    <div className="page" style={{ paddingTop: 16 }}>
      <div className="grid-3">
        <div className="card metric"><span className="metric-label">Scope</span><span className="metric-value">{p.total} items</span><span className="metric-label">{p.totalWeight} weight</span></div>
        <div className="card metric"><span className="metric-label">Done</span><span className="metric-value">{p.done} items</span><span className="metric-label">{p.doneWeight} weight delivered</span></div>
        <div className="card metric">
          <span className="metric-label">Remaining</span>
          <span className="metric-value">{p.totalWeight - p.doneWeight} weight</span>
          <span className="metric-label">{diffDays(today, sprint.endDate) >= 0 ? `ends ${fmtDate(sprint.endDate)}` : `ended ${fmtDate(sprint.endDate)}`}</span>
        </div>
      </div>

      <section className="card" aria-labelledby="bd-title">
        <div className="card-head">
          <h2 id="bd-title" className="card-title">Burndown</h2>
          <div className="row" style={{ fontSize: 12, gap: 16 }}>
            <span className="row" style={{ gap: 6 }}><span style={{ width: 16, height: 2, background: 'var(--primary)' }} /> Remaining weight</span>
            <span className="row" style={{ gap: 6 }}><span style={{ width: 16, borderTop: '2px dashed #9CA3AF' }} /> Ideal</span>
          </div>
        </div>
        <div className="card-body" style={{ overflowX: 'auto' }}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', minWidth: 560 }} role="img" aria-label={`Burndown: ${last ? `${last.pt.remaining} weight remaining on ${fmtDate(last.pt.date)}` : 'no data yet'}, ideal reaches zero on ${fmtDate(sprint.endDate)}.`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#EEF0F2" />
                <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#6B7280">{t}</text>
              </g>
            ))}
            {points.map((pt, i) =>
              i % every === 0 || i === points.length - 1 ? (
                <text key={pt.date} x={x(i)} y={H - 10} textAnchor="middle" fontSize="11" fill="#6B7280">{fmtDate(pt.date, false)}</text>
              ) : null,
            )}
            {todayIdx >= 0 && (
              <g>
                <line x1={x(todayIdx)} x2={x(todayIdx)} y1={pad.t} y2={H - pad.b} stroke="#D1D5DB" strokeDasharray="2 3" />
                <text x={x(todayIdx)} y={pad.t - 4} textAnchor="middle" fontSize="11" fill="#5C6068">Today</text>
              </g>
            )}
            <path d={ideal} fill="none" stroke="#9CA3AF" strokeWidth="2" strokeDasharray="5 4" />
            <path d={actual} fill="none" stroke="#0779E4" strokeWidth="2.5" strokeLinejoin="round" />
            {last && <circle cx={x(last.i)} cy={y(last.pt.remaining!)} r="4" fill="#0779E4" />}
            {last && (
              <text x={x(last.i) + 8} y={y(last.pt.remaining!) - 8} fontSize="12" fontWeight="600" fill="#2D2D2D">{last.pt.remaining}</text>
            )}
          </svg>
        </div>
      </section>

      <section className="col" style={{ gap: 12 }} aria-labelledby="by-person">
        <h2 id="by-person" style={{ fontSize: 16, fontWeight: 600 }}>By person</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th scope="col">Member</th><th scope="col" style={{ width: 140 }}>Tasks done</th><th scope="col" style={{ width: 160 }}>Weight delivered</th></tr>
            </thead>
            <tbody>
              {byPerson.map(([id, e]) => {
                const m = members.find((x) => x.id === id) ?? null;
                return (
                  <tr key={id || 'none'}>
                    <td><span className="row"><Avatar member={m} /> {m?.name ?? 'Unassigned'}</span></td>
                    <td className="num">{e.done} / {e.total}</td>
                    <td className="num">{e.weight}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/* ---------- Review ---------- */

export function SprintReview() {
  const { sprint } = useSprintCtx();
  const items = useSprintItems();
  const updateSprint = useStore((s) => s.updateSprint);
  const [notes, setNotes] = useState(sprint.reviewNotes);
  const [, setParams] = useSearchParams();
  const done = items.filter((i) => i.status === 'done' && i.type !== 'task');
  const open = items.filter((i) => i.status !== 'done' && i.type !== 'task');

  const list = (arr: WorkItem[]) => (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' }}>
      {arr.map((i, idx) => (
        <li key={i.id} className="row" style={{ padding: '10px 16px', borderTop: idx ? '1px solid var(--border-soft)' : undefined, fontSize: 13 }}>
          <span className="muted num" style={{ width: 80 }}>{i.key}</span>
          <button type="button" className="task-card-title truncate grow" style={{ fontSize: 13 }} onClick={() => setParams({ task: i.id })}>{i.title}</button>
          <ItemStatusBadge item={i} />
        </li>
      ))}
    </ul>
  );

  return (
    <div className="page" style={{ paddingTop: 16 }}>
      <section className="card">
        <div className="card-head">
          <h2 className="card-title">Sprint goal</h2>
          {sprint.goalOutcome ? <OutcomeBadge outcome={sprint.goalOutcome} /> : <span className="muted" style={{ fontSize: 12 }}>Outcome is recorded when the sprint is completed</span>}
        </div>
        <div className="card-body row" style={{ alignItems: 'flex-start' }}>
          <Icon name="target" color="var(--primary-darker)" />
          <p style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.5 }}>{sprint.goal || 'No goal was set for this sprint.'}</p>
        </div>
      </section>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <section className="card">
          <div className="card-head"><h2 className="card-title">Increment (done)</h2><span className="count-pill">{done.length}</span></div>
          {done.length ? list(done) : <p className="muted card-body">Nothing is done yet.</p>}
        </section>
        <section className="card">
          <div className="card-head"><h2 className="card-title">Not done</h2><span className="count-pill">{open.length}</span></div>
          {open.length ? list(open) : <p className="muted card-body">Everything planned is done.</p>}
        </section>
      </div>

      <section className="card">
        <div className="card-head"><h2 className="card-title"><label htmlFor="rv-notes">Review notes</label></h2></div>
        <div className="card-body col">
          <textarea id="rv-notes" className="textarea" placeholder="What was demoed, stakeholder feedback, backlog changes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div className="row">
            <span className="grow" />
            <button
              type="button"
              className="btn btn-primary btn-md"
              disabled={notes === sprint.reviewNotes}
              onClick={() => {
                updateSprint(sprint.id, { reviewNotes: notes });
                toast('Review notes saved.');
              }}
            >
              Save notes
            </button>
          </div>
        </div>
      </section>
      {sprint.status === 'completed' && sprint.closedSummary && (
        <p className="muted" style={{ fontSize: 13 }}>
          Closed with {sprint.closedSummary.doneWeight} of {sprint.closedSummary.totalWeight} weight delivered
          {sprint.closedSummary.carriedOver ? ` · ${sprint.closedSummary.carriedOver} items carried over` : ''}.
        </p>
      )}
    </div>
  );
}

/* ---------- Retro ---------- */

export function SprintRetro() {
  const { sprint } = useSprintCtx();
  if (sprint.status === 'draft')
    return (
      <div className="page">
        <Empty icon="message" title="Retro opens once the sprint starts" />
      </div>
    );
  return (
    <div className="page" style={{ paddingTop: 16 }}>
      <p className="muted" style={{ fontSize: 13 }}>Retro for {sprintName(sprint)}. Everyone on the project can add notes and vote.</p>
      <RetroBoard sprint={sprint} />
    </div>
  );
}
