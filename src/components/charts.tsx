import type { ReactNode } from 'react';
import { HEALTH_LABEL, type Health } from '../domain/insights';
import type { ItemStatus } from '../domain/types';
import { STATUS_LABEL } from '../domain/types';
import { Icon, type IconName } from './Icon';

/* Health uses the reserved status colors and always ships with an icon + label. */
const HEALTH_STYLE: Record<Health, { cls: string; icon: IconName }> = {
  on_track: { cls: 'success', icon: 'checkCircle' },
  at_risk: { cls: 'warning', icon: 'alert' },
  off_track: { cls: 'danger', icon: 'alert' },
  no_sprint: { cls: '', icon: 'info' },
  completed: { cls: 'info', icon: 'check' },
};

export function HealthBadge({ health }: { health: Health }) {
  const s = HEALTH_STYLE[health];
  return (
    <span className={`badge ${s.cls}`}>
      <Icon name={s.icon} size={12} strokeWidth={2.6} />
      {HEALTH_LABEL[health]}
    </span>
  );
}

export function StatTile({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: ReactNode; icon?: IconName }) {
  return (
    <div className="card metric" style={{ padding: 16 }}>
      <span className="metric-label row" style={{ gap: 6 }}>
        {icon && <Icon name={icon} size={14} />}
        {label}
      </span>
      <span className="metric-value" style={{ fontSize: 26 }}>{value}</span>
      {hint && <span className="metric-label">{hint}</span>}
    </div>
  );
}

/** Progress bar with a tick where it should be if work kept pace with elapsed working time. */
export function ProgressVsTime({ progress, time, compact }: { progress: number; time: number; compact?: boolean }) {
  const behind = time - progress;
  return (
    <div className="col" style={{ gap: 4, minWidth: compact ? 140 : 200 }}>
      <div
        role="img"
        aria-label={`${progress}% done with ${time}% of the sprint time elapsed`}
        title={`${progress}% done · ${time}% of sprint time elapsed`}
        style={{ position: 'relative', height: 8, borderRadius: 999, background: 'var(--border)' }}
      >
        <span style={{ position: 'absolute', inset: 0, width: `${progress}%`, borderRadius: 999, background: 'var(--primary)' }} />
        <span
          aria-hidden="true"
          style={{ position: 'absolute', top: -3, bottom: -3, left: `calc(${time}% - 1px)`, width: 2, borderRadius: 2, background: 'var(--text)' }}
        />
      </div>
      <span className="muted num" style={{ fontSize: 12 }}>
        <strong style={{ color: 'var(--text)' }}>{progress}%</strong> done · {time}% of time
        {behind > 10 && <span style={{ color: 'var(--warning-text)' }}> · {behind} pts behind</span>}
      </span>
    </div>
  );
}

const STACK: { key: ItemStatus; color: string }[] = [
  { key: 'done', color: '#0561B6' },
  { key: 'review', color: '#3D95EA' },
  { key: 'in_progress', color: '#9CC8F3' },
  { key: 'todo', color: '#E5E7EB' },
];

/** Tasks by category as one stacked bar (sequential blues, 2px gaps). */
export function StatusMiniBar({ byStatus, width = 160 }: { byStatus: Record<ItemStatus, number>; width?: number }) {
  const total = STACK.reduce((t, s) => t + byStatus[s.key], 0);
  const label = STACK.map((s) => `${STATUS_LABEL[s.key]} ${byStatus[s.key]}`).join(', ');
  if (!total) return <span className="subtle">—</span>;
  return (
    <div className="stack-bar" role="img" aria-label={label} title={label} style={{ width, height: 8, background: 'transparent' }}>
      {STACK.map((s) =>
        byStatus[s.key] ? (
          <span key={s.key} style={{ width: `${(byStatus[s.key] / total) * 100}%`, background: s.color, boxShadow: s.key === 'todo' ? 'inset 0 0 0 1px #C3C8CF' : undefined }} />
        ) : null,
      )}
    </div>
  );
}

export function StatusLegend() {
  return (
    <div className="row wrap" style={{ gap: 14, fontSize: 12 }} aria-hidden="true">
      {STACK.map((s) => (
        <span key={s.key} className="row" style={{ gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, boxShadow: s.key === 'todo' ? 'inset 0 0 0 1px #C3C8CF' : undefined }} />
          {STATUS_LABEL[s.key]}
        </span>
      ))}
    </div>
  );
}

/** Tiny velocity sparkbars for tables. */
export function Sparkbars({ values, label }: { values: number[]; label: string }) {
  if (!values.length) return <span className="subtle">—</span>;
  const max = Math.max(...values, 1);
  return (
    <span role="img" aria-label={`${label}: ${values.join(', ')}`} title={values.join(' · ')} style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 2, height: 22 }}>
      {values.map((v, i) => (
        <span key={i} style={{ width: 6, height: Math.max(2, (v / max) * 22), borderRadius: '2px 2px 0 0', background: i === values.length - 1 ? 'var(--primary)' : '#9CC8F3' }} />
      ))}
    </span>
  );
}

export interface BarDatum {
  label: string;
  value: number;
  /** Rendered hatched and labeled as in progress (not final). */
  partial?: boolean;
  hint?: string;
}

/** Vertical single-series bar chart with value labels on each bar and a baseline. */
export function BarChart({ data, unit, height = 220, ariaLabel }: { data: BarDatum[]; unit: string; height?: number; ariaLabel: string }) {
  const W = 640;
  const H = height;
  const pad = { l: 36, r: 12, t: 20, b: 34 };
  const max = Math.max(1, ...data.map((d) => d.value));
  const nice = Math.ceil(max / 5) * 5;
  const bw = Math.min(56, ((W - pad.l - pad.r) / Math.max(data.length, 1)) * 0.6);
  const step = (W - pad.l - pad.r) / Math.max(data.length, 1);
  const y = (v: number) => pad.t + (1 - v / nice) * (H - pad.t - pad.b);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={ariaLabel} style={{ display: 'block', maxHeight: H }}>
      <defs>
        <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" fill="#CFE3F8" />
          <line x1="0" y1="0" x2="0" y2="6" stroke="#0779E4" strokeWidth="2" />
        </pattern>
      </defs>
      {[0, nice / 2, nice].map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#EEF0F2" />
          <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#6B7280">{t}</text>
        </g>
      ))}
      {data.map((d, i) => {
        const cx = pad.l + step * i + step / 2;
        const top = y(d.value);
        const h = Math.max(0, H - pad.b - top);
        return (
          <g key={d.label}>
            <title>{`${d.label}: ${d.value} ${unit}${d.partial ? ' so far (in progress)' : ''}${d.hint ? ` · ${d.hint}` : ''}`}</title>
            <rect x={cx - step / 2} y={pad.t} width={step} height={H - pad.t - pad.b} fill="transparent" />
            <path
              d={`M${cx - bw / 2},${H - pad.b} V${top + Math.min(4, h)} Q${cx - bw / 2},${top} ${cx - bw / 2 + 4},${top} H${cx + bw / 2 - 4} Q${cx + bw / 2},${top} ${cx + bw / 2},${top + Math.min(4, h)} V${H - pad.b} Z`}
              fill={d.partial ? 'url(#hatch)' : '#0779E4'}
            />
            <text x={cx} y={top - 6} textAnchor="middle" fontSize="12" fontWeight="600" fill="#2D2D2D">{d.value}</text>
            <text x={cx} y={H - 12} textAnchor="middle" fontSize="11" fill="#5C6068">{d.label}</text>
          </g>
        );
      })}
      <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="#C3C8CF" />
    </svg>
  );
}
