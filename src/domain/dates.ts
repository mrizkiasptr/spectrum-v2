import type { Holiday, ISODate } from './types';

const MS_DAY = 86_400_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function parseDate(d: ISODate): Date {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

export function toISO(d: Date): ISODate {
  return d.toISOString().slice(0, 10);
}

/** Today's date in the user's local time zone, as an ISO date. */
export function todayISO(now: Date = new Date()): ISODate {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(d: ISODate, n: number): ISODate {
  return toISO(new Date(parseDate(d).getTime() + n * MS_DAY));
}

/** Whole days from a to b (b - a). */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / MS_DAY);
}

/** Inclusive length in calendar days. */
export function lengthInDays(start: ISODate, end: ISODate): number {
  return diffDays(start, end) + 1;
}

export function isWeekend(d: ISODate): boolean {
  const wd = parseDate(d).getUTCDay();
  return wd === 0 || wd === 6;
}

export function holidaysFor(holidays: Holiday[], countCollectiveLeave: boolean): Map<ISODate, Holiday> {
  const map = new Map<ISODate, Holiday>();
  for (const h of holidays) {
    if (h.kind === 'collective' && !countCollectiveLeave) continue;
    map.set(h.date, h);
  }
  return map;
}

export interface WorkingDays {
  calendarDays: number;
  workingDays: number;
  /** Holidays that fall on weekdays inside the range. */
  holidays: Holiday[];
}

/** Working days in [start, end] inclusive, excluding weekends and the given holidays. */
export function workingDays(start: ISODate, end: ISODate, holidays: Map<ISODate, Holiday>): WorkingDays {
  const len = lengthInDays(start, end);
  if (len <= 0) return { calendarDays: 0, workingDays: 0, holidays: [] };
  let work = 0;
  const hit: Holiday[] = [];
  for (let i = 0; i < len; i++) {
    const day = addDays(start, i);
    if (isWeekend(day)) continue;
    const h = holidays.get(day);
    if (h) {
      hit.push(h);
      continue;
    }
    work++;
  }
  return { calendarDays: len, workingDays: work, holidays: hit };
}

/** Working days remaining from today (inclusive) until end (inclusive). */
export function workingDaysLeft(today: ISODate, end: ISODate, holidays: Map<ISODate, Holiday>): number {
  if (diffDays(today, end) < 0) return 0;
  return workingDays(today, end, holidays).workingDays;
}

export function fmtDate(d: ISODate | null | undefined, withYear = true): string {
  if (!d) return '—';
  const x = parseDate(d);
  const base = `${x.getUTCDate()} ${MONTHS[x.getUTCMonth()]}`;
  return withYear ? `${base} ${x.getUTCFullYear()}` : base;
}

export function fmtDayDate(d: ISODate): string {
  return `${DAYS[parseDate(d).getUTCDay()]}, ${fmtDate(d)}`;
}

/** "1 – 30 Sep 2026", "28 Sep – 11 Oct 2026", "22 Dec 2026 – 4 Jan 2027". */
export function fmtRange(start: ISODate | null, end: ISODate | null): string {
  if (!start || !end) return 'Dates not set';
  const a = parseDate(start);
  const b = parseDate(end);
  const sameYear = a.getUTCFullYear() === b.getUTCFullYear();
  const sameMonth = sameYear && a.getUTCMonth() === b.getUTCMonth();
  if (sameMonth) return `${a.getUTCDate()} – ${fmtDate(end)}`;
  if (sameYear) return `${fmtDate(start, false)} – ${fmtDate(end)}`;
  return `${fmtDate(start)} – ${fmtDate(end)}`;
}

/** Relative due label used on cards: "Overdue", "Today", "Tomorrow", or "30 Sep". */
export function fmtDue(due: ISODate, today: ISODate): { label: string; tone: 'danger' | 'warning' | 'neutral' } {
  const d = diffDays(today, due);
  if (d < 0) return { label: `Overdue · ${fmtDate(due, false)}`, tone: 'danger' };
  if (d === 0) return { label: 'Today', tone: 'warning' };
  if (d === 1) return { label: 'Tomorrow', tone: 'warning' };
  return { label: fmtDate(due, false), tone: 'neutral' };
}

export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  const date = `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${date}, ${((h + 11) % 12) + 1}:${m} ${ampm}`;
}
