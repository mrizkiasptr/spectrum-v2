import { initialsOf } from '../auth/profile';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { GoalOutcome, ItemStatus, ItemType, Member, Severity, SprintStatus, Tribe, WorkflowStatus, WorkItem } from '../domain/types';
import { columnOf, defaultWorkflow } from '../domain/workflow';
import { OUTCOME_LABEL, STATUS_LABEL, TYPE_LABEL } from '../domain/types';
import { useStore } from '../store/useStore';
import { Icon } from './Icon';

export function Avatar({ member, size, title }: { member: Member | null; size?: 'md' | 'lg'; title?: string }) {
  const me = useStore((s) => s.currentUserId);
  if (!member) {
    return (
      <span className={`avatar empty ${size ?? ''}`} title={title ?? 'Unassigned'} aria-label={title ?? 'Unassigned'}>
        ?
      </span>
    );
  }
  return (
    <span className={`avatar ${member.id === me ? 'me' : ''} ${size ?? ''}`} title={member.name} aria-label={member.name}>
      {member.initials || initialsOf(member.name)}
    </span>
  );
}

export function AvatarStack({ ids, max = 3 }: { ids: string[]; max?: number }) {
  const members = useStore((s) => s.members);
  const shown = ids.slice(0, max);
  const rest = ids.length - shown.length;
  return (
    <div className="avatar-stack" aria-label={`${ids.length} members`}>
      {shown.map((id) => (
        <Avatar key={id} member={members.find((m) => m.id === id) ?? null} />
      ))}
      {rest > 0 && <span className="avatar" style={{ background: 'var(--surface-sunken)' }}>+{rest}</span>}
    </div>
  );
}

const STATUS_COLOR: Record<ItemStatus, string> = {
  todo: 'var(--text-subtle)',
  in_progress: 'var(--primary)',
  review: 'var(--warning)',
  done: 'var(--success)',
};

/** Circle status glyph: dashed = not started, half = in progress, dot = in review, filled check = done. */
export function StatusIcon({ status, size = 16, color }: { status: ItemStatus; size?: number; color?: string }) {
  const c = color ?? STATUS_COLOR[status];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
      {status === 'done' ? (
        <>
          <circle cx="12" cy="12" r="9" fill={c} />
          <path d="m7.8 12.2 2.8 2.8 5.6-6" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <>
          <circle cx="12" cy="12" r="8" fill="none" stroke={c} strokeWidth="2.5" strokeDasharray={status === 'todo' ? '3 3' : undefined} />
          {status === 'in_progress' && <path d="M12 4a8 8 0 0 1 0 16z" fill={c} />}
          {status === 'review' && <circle cx="12" cy="12" r="3" fill={c} />}
        </>
      )}
    </svg>
  );
}

const STATUS_TONE: Record<ItemStatus, string> = { todo: '', in_progress: 'info', review: 'warning', done: 'success' };

/** Glyph for a workflow column: the shape shows its category, the color is the team's choice. */
export function ColumnIcon({ column, size = 16 }: { column: WorkflowStatus; size?: number }) {
  return <StatusIcon status={column.category} color={column.color} size={size} />;
}

/** Badge showing the item's workflow column name (words stay dark for contrast; the icon carries the color). */
export function ItemStatusBadge({ item }: { item: Pick<WorkItem, 'projectId' | 'status' | 'statusId'> }) {
  const workflow = useStore((s) => s.projects.find((p) => p.id === item.projectId)?.workflow) ?? defaultWorkflow();
  const column = columnOf(workflow, item);
  return (
    <span className="badge" style={{ borderColor: `${column.color}55`, background: `${column.color}0F`, color: 'var(--text-2)' }}>
      <ColumnIcon column={column} size={12} />
      {column.name}
    </span>
  );
}

export function StatusBadge({ status }: { status: ItemStatus }) {
  return (
    <span className={`badge ${STATUS_TONE[status]}`}>
      <StatusIcon status={status} size={12} />
      {STATUS_LABEL[status]}
    </span>
  );
}

const TYPE_TONE: Record<ItemType, string> = { story: 'purple', task: '', bug: 'danger' };
export function TypeBadge({ type }: { type: ItemType }) {
  return <span className={`badge sm ${TYPE_TONE[type]}`}>{TYPE_LABEL[type]}</span>;
}

const SEV_TONE: Record<Severity, string> = { critical: 'danger', major: 'warning', minor: 'neutral' };
export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={`badge sm ${SEV_TONE[severity]}`}>
      {severity !== 'minor' && <Icon name="alert" size={11} strokeWidth={2.6} />}
      {severity[0].toUpperCase() + severity.slice(1)}
    </span>
  );
}

export function SprintStatusBadge({ status }: { status: SprintStatus }) {
  if (status === 'active')
    return (
      <span className="badge success">
        <StatusIcon status="in_progress" size={12} /> Active
      </span>
    );
  if (status === 'draft')
    return (
      <span className="badge">
        <StatusIcon status="todo" size={12} /> Draft
      </span>
    );
  return (
    <span className="badge info">
      <Icon name="check" size={12} strokeWidth={3} /> Completed
    </span>
  );
}

export function OutcomeBadge({ outcome }: { outcome: GoalOutcome }) {
  const tone = outcome === 'achieved' ? 'success' : outcome === 'partial' ? 'warning' : 'danger';
  return (
    <span className={`badge ${tone}`}>
      <Icon name={outcome === 'achieved' ? 'check' : 'target'} size={12} strokeWidth={2.6} />
      {OUTCOME_LABEL[outcome]}
    </span>
  );
}

export const TRIBE_STYLE: Record<Tribe, { bg: string; fg: string; border: string }> = {
  Analyst: { bg: 'rgba(45,45,45,0.06)', fg: '#3F434A', border: 'rgba(45,45,45,0.18)' },
  Andromeda: { bg: 'rgba(7,121,228,0.07)', fg: '#0561B6', border: 'rgba(7,121,228,0.30)' },
  Phoenix: { bg: 'rgba(124,58,237,0.07)', fg: '#5B21B6', border: 'rgba(124,58,237,0.28)' },
  'Ursa Major': { bg: 'rgba(13,148,136,0.08)', fg: '#0F766E', border: 'rgba(13,148,136,0.30)' },
};

export function TribeBadge({ tribe }: { tribe: Tribe }) {
  const t = TRIBE_STYLE[tribe];
  return (
    <span className="badge sm" style={{ background: t.bg, color: t.fg, borderColor: t.border }}>
      {tribe}
    </span>
  );
}

export function Progress({ pct, large, label }: { pct: number; large?: boolean; label?: string }) {
  return (
    <div
      className={`progress ${large ? 'lg' : ''}`}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? 'Progress'}
    >
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Empty({ icon = 'info', title, children }: { icon?: Parameters<typeof Icon>[0]['name']; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <Icon name={icon} size={28} color="var(--text-subtle)" />
      <strong>{title}</strong>
      {children}
    </div>
  );
}

/* ---------- Overlays ---------- */

function useFocusTrap(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const focusables = () =>
      Array.from(
        el?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])') ?? [],
      );
    const first = el?.querySelector<HTMLElement>('[data-autofocus]') ?? focusables()[0];
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
      if (e.key === 'Tab') {
        const f = focusables();
        if (!f.length) return;
        const a = f[0];
        const z = f[f.length - 1];
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault();
          z.focus();
        } else if (!e.shiftKey && document.activeElement === z) {
          e.preventDefault();
          a.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  return ref;
}

export function Dialog({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const ref = useFocusTrap(open, onClose);
  const id = useId();
  if (!open) return null;
  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div ref={ref} className={`dialog ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={id}>
        <div className="dialog-head">
          <div className="grow col" style={{ gap: 4 }}>
            <h2 id={id} className="dialog-title">
              {title}
            </h2>
            {subtitle && <div className="muted" style={{ fontSize: 13 }}>{subtitle}</div>}
          </div>
          <button type="button" className="icon-btn bordered" aria-label="Close" onClick={onClose}>
            <Icon name="close" size={16} />
          </button>
        </div>
        <div className="dialog-body">{children}</div>
        {footer && <div className="dialog-foot">{footer}</div>}
      </div>
    </>
  );
}

export function Drawer({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: ReactNode }) {
  const ref = useFocusTrap(open, onClose);
  if (!open) return null;
  return (
    <>
      <div className="overlay" onClick={onClose} />
      <aside ref={ref} className="drawer" role="dialog" aria-modal="true" aria-label={label}>
        {children}
      </aside>
    </>
  );
}

/** Button that toggles a dropdown menu; closes on outside click and Escape. */
export function MenuButton({
  label,
  trigger,
  children,
  align = 'right',
  up = false,
  className = 'icon-btn sm',
}: {
  label: string;
  trigger: ReactNode;
  children: (close: () => void) => ReactNode;
  align?: 'left' | 'right';
  up?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div ref={wrap} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        className={className}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        {trigger}
      </button>
      {open && (
        <div
          className="menu"
          role="menu"
          style={up ? { bottom: '100%', marginBottom: 4, [align]: 0 } : { top: '100%', marginTop: 4, [align]: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
