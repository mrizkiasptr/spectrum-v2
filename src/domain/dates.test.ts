import { describe, expect, it } from 'vitest';
import { addDays, fmtDue, fmtRange, holidaysFor, lengthInDays, workingDays, workingDaysLeft } from './dates';
import type { Holiday } from './types';

const holidays: Holiday[] = [
  { id: '1', date: '2026-12-25', name: 'Christmas Day', kind: 'public' },
  { id: '2', date: '2026-12-24', name: 'Christmas collective leave', kind: 'collective' },
  { id: '3', date: '2026-12-26', name: 'Saturday holiday', kind: 'public' },
];

describe('dates', () => {
  it('adds days across months and years', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-10-01', 13)).toBe('2026-10-14');
    expect(lengthInDays('2026-10-01', '2026-10-14')).toBe(14);
  });

  it('counts working days without weekends', () => {
    // 1 Oct 2026 is a Thursday; two weeks → 10 working days.
    expect(workingDays('2026-10-01', '2026-10-14', new Map()).workingDays).toBe(10);
    expect(workingDays('2026-10-01', '2026-10-30', new Map()).workingDays).toBe(22);
  });

  it('excludes public holidays and optionally collective leave', () => {
    const withLeave = workingDays('2026-12-21', '2026-12-31', holidaysFor(holidays, true));
    expect(withLeave.workingDays).toBe(7);
    expect(withLeave.holidays.map((h) => h.date)).toEqual(['2026-12-24', '2026-12-25']);

    const withoutLeave = workingDays('2026-12-21', '2026-12-31', holidaysFor(holidays, false));
    expect(withoutLeave.workingDays).toBe(8);
    // Holidays on weekends are not reported as lost working days.
    expect(withoutLeave.holidays.map((h) => h.date)).toEqual(['2026-12-25']);
  });

  it('returns zero working days left after the end date', () => {
    expect(workingDaysLeft('2026-10-02', '2026-10-01', new Map())).toBe(0);
    expect(workingDaysLeft('2026-09-28', '2026-09-30', new Map())).toBe(3);
  });

  it('formats ranges compactly', () => {
    expect(fmtRange('2026-09-01', '2026-09-30')).toBe('1 – 30 Sep 2026');
    expect(fmtRange('2026-09-28', '2026-10-11')).toBe('28 Sep – 11 Oct 2026');
    expect(fmtRange('2026-12-22', '2027-01-04')).toBe('22 Dec 2026 – 4 Jan 2027');
    expect(fmtRange(null, null)).toBe('Dates not set');
  });

  it('labels due dates relative to today', () => {
    expect(fmtDue('2026-09-29', '2026-09-28')).toEqual({ label: 'Tomorrow', tone: 'warning' });
    expect(fmtDue('2026-09-28', '2026-09-28').label).toBe('Today');
    expect(fmtDue('2026-09-27', '2026-09-28').tone).toBe('danger');
    expect(fmtDue('2026-10-05', '2026-09-28').label).toBe('5 Oct');
  });
});
