import { addDays } from './dates';
import { defaultWorkflow } from './workflow';
import type {
  Criterion,
  Doc,
  Holiday,
  ISODate,
  ItemStatus,
  ItemType,
  Member,
  Project,
  ReleaseState,
  RetroItem,
  Severity,
  Sprint,
  WorkItem,
} from './types';

/**
 * Sample data for the prototype. Dates are generated relative to "today" so the
 * demo always shows an active sprint that is about to end.
 */
export interface SeedData {
  currentUserId: string;
  members: Member[];
  projects: Project[];
  sprints: Sprint[];
  items: WorkItem[];
  retro: RetroItem[];
  docs: Doc[];
  holidays: Holiday[];
  favorites: string[];
  recent: string[];
}

export const CURRENT_USER_ID = 'u-mr';

const members: Member[] = [
  { id: 'u-mr', name: 'Muhammad Rizkia Saputra', initials: 'MR', role: 'Business Analyst' },
  { id: 'u-am', name: 'Anisa Maharani', initials: 'AM', role: 'Lead Business Analyst' },
  { id: 'u-ds', name: 'Dimas Saputro', initials: 'DS', role: 'Business Analyst' },
  { id: 'u-rp', name: 'Rina Pratiwi', initials: 'RP', role: 'Business Analyst' },
  { id: 'u-fn', name: 'Fajar Nugroho', initials: 'FN', role: 'Software Engineer' },
  { id: 'u-hs', name: 'Hendra Setiawan', initials: 'HS', role: 'Scrum Master' },
  { id: 'u-ag', name: 'Andy Mahendra Giriseno', initials: 'AG', role: 'Product Owner' },
  { id: 'u-lp', name: 'Lestari Putri', initials: 'LP', role: 'QA Engineer' },
];

/** Fixed-date Indonesian public holidays. Lunar-calendar holidays and collective leave are added by admins. */
function fixedHolidays(years: number[]): Holiday[] {
  const out: Holiday[] = [];
  for (const y of years) {
    out.push(
      { id: `h-${y}-0101`, date: `${y}-01-01`, name: 'New Year’s Day', kind: 'public' },
      { id: `h-${y}-0501`, date: `${y}-05-01`, name: 'Labour Day', kind: 'public' },
      { id: `h-${y}-0601`, date: `${y}-06-01`, name: 'Pancasila Day', kind: 'public' },
      { id: `h-${y}-0817`, date: `${y}-08-17`, name: 'Independence Day', kind: 'public' },
      { id: `h-${y}-1225`, date: `${y}-12-25`, name: 'Christmas Day', kind: 'public' },
    );
  }
  return out;
}

let seq = 0;
const uid = (p: string) => `${p}-${(++seq).toString(36)}`;

function crit(texts: string[], doneCount = 0): Criterion[] {
  return texts.map((text, i) => ({ id: uid('c'), text, done: i < doneCount }));
}

interface ItemSpec {
  key: number;
  type: ItemType;
  title: string;
  status: ItemStatus;
  /** Column id when it differs from the category's default column. */
  column?: string;
  weight: number | null;
  assignee: string | null;
  description?: string;
  criteria?: string[];
  criteriaDone?: number;
  dueOffset?: number;
  doneOffset?: number;
  severity?: Severity;
  release?: ReleaseState;
  comments?: { by: string; text: string; ago: number }[];
  attachments?: string[];
  reviewer?: string;
  epic?: string;
}

export function createSeed(today: ISODate): SeedData {
  seq = 0;
  const now = new Date().toISOString();
  const ts = (d: ISODate) => `${d}T09:00:00.000Z`;

  const projects: Project[] = [
    {
      id: 'p-at', key: 'ANL', code: 'AT', name: 'Analyst Teams', client: 'BA · Business analyst department',
      description: 'Project board for the SPE business analyst team.', tribe: 'Analyst', status: 'active',
      startDate: addDays(today, -32), endDate: '2030-12-27',
      memberIds: ['u-mr', 'u-am', 'u-ds', 'u-rp', 'u-hs', 'u-ag', 'u-lp', 'u-fn'],
      workflow: defaultWorkflow(), defaultSprintDays: 14, countCollectiveLeave: true, createdAt: ts(addDays(today, -32)),
    },
    {
      id: 'p-spe', key: 'SPE', code: 'SP', name: 'Spectrum', client: 'SPE · Internal',
      description: 'Scrum project management platform.', tribe: 'Phoenix', status: 'active',
      startDate: '2023-01-01', endDate: '2025-01-01',
      memberIds: ['u-mr', 'u-rp', 'u-fn', 'u-hs', 'u-lp'],
      workflow: [
        ...defaultWorkflow().slice(0, 3),
        { id: 'qa', name: 'Ready for QA', category: 'review', color: '#7C3AED' },
        ...defaultWorkflow().slice(3),
      ],
      defaultSprintDays: 14, countCollectiveLeave: true, createdAt: ts('2023-01-01'),
    },
    {
      id: 'p-mantap', key: 'QMT', code: 'QM', name: 'QRISAN x MANTAP', client: 'Mandiri Taspen (MANTAP)',
      description: 'QRIS merchant acquiring for Mandiri Taspen.', tribe: 'Ursa Major', status: 'active',
      startDate: addDays(today, -77), endDate: '2030-07-13',
      memberIds: ['u-mr', 'u-fn', 'u-hs', 'u-lp'],
      workflow: defaultWorkflow(), defaultSprintDays: 14, countCollectiveLeave: true, createdAt: ts(addDays(today, -77)),
    },
    {
      id: 'p-kaltim', key: 'QKT', code: 'QK', name: 'QRISAN x Bank Kaltimtara', client: 'Bank Kaltimtara',
      description: 'QRIS merchant acquiring for Bank Kaltimtara.', tribe: 'Ursa Major', status: 'active',
      startDate: '2025-01-24', endDate: '2030-01-24',
      memberIds: ['u-hs', 'u-fn', 'u-lp', 'u-ds'],
      workflow: defaultWorkflow(), defaultSprintDays: 14, countCollectiveLeave: true, createdAt: ts('2025-01-24'),
    },
    {
      id: 'p-specva', key: 'SVA', code: 'SV', name: 'SPECVA', client: 'PO · Andy Mahendra Giriseno',
      description: 'A core virtual account engine that can be replicated within two months.', tribe: 'Andromeda',
      status: 'completed', startDate: '2023-01-24', endDate: '2023-04-30',
      memberIds: ['u-ag', 'u-fn', 'u-rp', 'u-lp'],
      workflow: defaultWorkflow(), defaultSprintDays: 14, countCollectiveLeave: true, createdAt: ts('2023-01-24'),
    },
    {
      id: 'p-snap', key: 'ASN', code: 'AS', name: 'Autopay SNAP', client: 'BNI WHS',
      description: 'SNAP-compliant autopay for BNI WHS.', tribe: 'Andromeda', status: 'completed',
      startDate: '2023-06-07', endDate: '2024-12-28',
      memberIds: ['u-mr', 'u-fn', 'u-lp'],
      workflow: defaultWorkflow(), defaultSprintDays: 14, countCollectiveLeave: true, createdAt: ts('2023-06-07'),
    },
  ];

  const sprints: Sprint[] = [];
  const mkSprint = (p: Partial<Sprint> & Pick<Sprint, 'projectId' | 'number' | 'status'>): Sprint => {
    const s: Sprint = {
      id: uid('s'), goal: '', startDate: null, endDate: null, goalOutcome: null, reviewNotes: '',
      startedAt: null, completedAt: null, closedSummary: null, ...p,
    };
    sprints.push(s);
    return s;
  };

  const at1 = mkSprint({
    projectId: 'p-at', number: 1, status: 'active',
    goal: 'QRISAN Refund BRD & FSD ready for review so the dev team can estimate in Sprint 2.',
    startDate: addDays(today, -13), endDate: addDays(today, 2), startedAt: ts(addDays(today, -13)),
  });
  mkSprint({ projectId: 'p-at', number: 2, status: 'draft' });

  const spe15 = mkSprint({
    projectId: 'p-spe', number: 15, status: 'completed',
    goal: 'Sprint list and sprint setup flow usable end to end on staging.',
    startDate: addDays(today, -20), endDate: addDays(today, -7), startedAt: ts(addDays(today, -20)),
    completedAt: ts(addDays(today, -7)), goalOutcome: 'partial',
    reviewNotes: 'Setup flow works; holiday-aware working days slipped to Sprint 16.',
    closedSummary: { doneWeight: 21, totalWeight: 29, carriedOver: 2 },
  });
  mkSprint({
    projectId: 'p-spe', number: 14, status: 'completed',
    goal: 'Project Board v2 information architecture validated with 5 analysts.',
    startDate: addDays(today, -34), endDate: addDays(today, -21), startedAt: ts(addDays(today, -34)),
    completedAt: ts(addDays(today, -21)), goalOutcome: 'achieved', reviewNotes: '',
    closedSummary: { doneWeight: 26, totalWeight: 26, carriedOver: 0 },
  });
  const spe16 = mkSprint({
    projectId: 'p-spe', number: 16, status: 'active',
    goal: 'Project Board v2 module testable by the analyst team on staging.',
    startDate: addDays(today, -6), endDate: addDays(today, 7), startedAt: ts(addDays(today, -6)),
  });

  mkSprint({
    projectId: 'p-mantap', number: 4, status: 'completed',
    goal: 'Merchant registration API contract agreed with MANTAP.',
    startDate: addDays(today, -22), endDate: addDays(today, -9), startedAt: ts(addDays(today, -22)),
    completedAt: ts(addDays(today, -9)), goalOutcome: 'achieved', reviewNotes: '',
    closedSummary: { doneWeight: 18, totalWeight: 18, carriedOver: 0 },
  });
  const qm5 = mkSprint({
    projectId: 'p-mantap', number: 5, status: 'active',
    goal: 'MANTAP pilot merchants can accept QRIS payments end to end.',
    startDate: addDays(today, -8), endDate: addDays(today, 5), startedAt: ts(addDays(today, -8)),
  });
  const qm6 = mkSprint({
    projectId: 'p-mantap', number: 6, status: 'draft',
    goal: 'Settlement report available to MANTAP finance in the merchant portal.',
    startDate: addDays(today, 6), endDate: addDays(today, 19),
  });

  mkSprint({
    projectId: 'p-specva', number: 3, status: 'completed', goal: 'VA engine packaged for replication.',
    startDate: '2023-04-17', endDate: '2023-04-30', startedAt: ts('2023-04-17'), completedAt: ts('2023-04-30'),
    goalOutcome: 'achieved', reviewNotes: '', closedSummary: { doneWeight: 20, totalWeight: 20, carriedOver: 0 },
  });

  const items: WorkItem[] = [];
  const add = (projectId: string, key: string, sprint: Sprint | null, spec: ItemSpec, rank: number) => {
    const start = sprint?.startDate ?? today;
    const completedAt =
      spec.status === 'done' ? ts(addDays(start, spec.doneOffset ?? 1)) : null;
    items.push({
      id: uid('i'),
      projectId,
      key: `${key}-${spec.key}`,
      type: spec.type,
      title: spec.title,
      description: spec.description ?? '',
      status: spec.status,
      statusId: spec.column ?? spec.status,
      weight: spec.weight,
      assigneeId: spec.assignee,
      reviewerId: spec.reviewer ?? null,
      dueDate: spec.dueOffset !== undefined ? addDays(today, spec.dueOffset) : sprint?.endDate ?? null,
      sprintId: sprint?.id ?? null,
      epic: spec.epic ?? '',
      criteria: crit(spec.criteria ?? [], spec.criteriaDone ?? (spec.status === 'done' ? 99 : 0)),
      comments: (spec.comments ?? []).map((c) => ({
        id: uid('cm'), authorId: c.by, text: c.text, at: new Date(Date.now() - c.ago * 3_600_000).toISOString(),
      })),
      attachments: spec.attachments ?? [],
      severity: spec.severity ?? null,
      release: spec.release ?? 'unreleased',
      rank,
      createdAt: now,
      completedAt,
    });
  };

  // Analyst Teams — Sprint 1 (active, ends in 2 days)
  const atSprint: ItemSpec[] = [
    { key: 118, type: 'story', title: 'QRISAN merchant refund BRD', status: 'in_progress', weight: 8, assignee: 'u-mr', reviewer: 'u-am', dueOffset: 1, epic: 'QRISAN Refund',
      description: 'Write the BRD for merchant-initiated QRIS refunds: full and partial refunds, the request time limit, and the maker-checker approval flow on the merchant dashboard.',
      criteria: ['Merchants can request a full or partial refund from the transaction details.', 'Refunds are allowed up to 7 days after a successful transaction.', 'Refunds above Rp 5.000.000 require Checker approval.', 'Refund status is visible to both the merchant and the operations team.'], criteriaDone: 2,
      comments: [{ by: 'u-am', text: 'Let’s confirm the partial refund time limit with the settlement team first.', ago: 20 }],
      attachments: ['BRD_Refund_QRISAN_v0.3.docx', 'Refund_flow.png'] },
    { key: 121, type: 'story', title: 'Merchant onboarding user stories: KYB stage', status: 'in_progress', weight: 5, assignee: 'u-rp', epic: 'Merchant onboarding',
      description: 'Legal documents and company tax ID verification.', criteria: ['Required KYB documents listed per business type.', 'Rejection reasons are shown to the merchant.'] },
    { key: 125, type: 'task', title: 'Update SPECVA limit-change maker-checker flow', status: 'in_progress', weight: 3, assignee: 'u-mr', criteria: ['Checker sees old and new limit side by side.'] },
    { key: 127, type: 'bug', title: 'Revise acceptance criteria for failed payment alerts', status: 'todo', weight: 2, assignee: 'u-ds', severity: 'minor', description: 'Old AC did not cover bank timeouts.' },
    { key: 131, type: 'story', title: 'QRIS reconciliation report requirements analysis', status: 'todo', weight: 5, assignee: 'u-mr', description: 'Collect report formats from 3 partner banks.', criteria: ['Formats collected from all 3 banks.'] },
    { key: 134, type: 'task', title: 'Review Autopay SNAP FSD: failed debit scenarios', status: 'todo', weight: 3, assignee: 'u-am', description: 'Make sure retries and customer notifications are covered.' },
    { key: 112, type: 'story', title: 'SNAP VA Transfer gap analysis', status: 'review', weight: 5, assignee: 'u-mr', reviewer: 'u-ag', description: 'Waiting for PO review before handing off to dev.', criteria: ['Gap list signed off by PO.'] },
    { key: 109, type: 'task', title: 'Analyst document checkpoint & review', status: 'review', weight: 2, assignee: 'u-am' },
    { key: 101, type: 'story', title: 'New merchant application approval flow', status: 'done', weight: 5, assignee: 'u-rp', doneOffset: 3, release: 'released', criteria: ['Two-level maker-checker.'] },
    { key: 102, type: 'task', title: 'Stakeholder map for QRISAN refund', status: 'done', weight: 2, assignee: 'u-mr', doneOffset: 2 },
    { key: 103, type: 'story', title: 'Merchant settlement schedule rules', status: 'done', weight: 5, assignee: 'u-ds', doneOffset: 5, release: 'partial' },
    { key: 104, type: 'task', title: 'VA inquiry API documentation', status: 'done', weight: 2, assignee: 'u-mr', doneOffset: 4 },
    { key: 105, type: 'story', title: 'MDR fee configuration requirements', status: 'done', weight: 3, assignee: 'u-am', doneOffset: 6 },
    { key: 106, type: 'task', title: 'Refund process interviews with 4 merchants', status: 'done', weight: 3, assignee: 'u-mr', doneOffset: 7 },
    { key: 107, type: 'story', title: 'Chargeback dispute flow as-is mapping', status: 'done', weight: 5, assignee: 'u-rp', doneOffset: 9 },
    { key: 108, type: 'task', title: 'BRD template update for SNAP services', status: 'done', weight: 1, assignee: 'u-ds', doneOffset: 10 },
    { key: 110, type: 'story', title: 'Refund notification copy (email & WhatsApp)', status: 'done', weight: 3, assignee: 'u-mr', doneOffset: 11 },
    { key: 111, type: 'task', title: 'Glossary of settlement terms', status: 'done', weight: 1, assignee: 'u-am', doneOffset: 12 },
  ];
  atSprint.forEach((s, i) => add('p-at', 'ANL', at1, s, i));
  const atBacklog: ItemSpec[] = [
    { key: 138, type: 'story', title: 'Map VA transaction statuses to SNAP BI', status: 'todo', weight: 3, assignee: null, criteria: ['Mapping table from internal response codes to SNAP.'] },
    { key: 139, type: 'story', title: 'Refund API specification', status: 'todo', weight: null, assignee: null, description: 'Depends on the approved refund BRD.' },
    { key: 140, type: 'task', title: 'Partial refund edge cases workshop', status: 'todo', weight: null, assignee: null },
  ];
  atBacklog.forEach((s, i) => add('p-at', 'ANL', null, s, 100 + i));

  // Spectrum — Sprint 16 (active) + backlog + defects
  const speSprint: ItemSpec[] = [
    { key: 402, type: 'story', title: 'Project list with filters and favorites', status: 'done', weight: 5, assignee: 'u-fn', doneOffset: 2 },
    { key: 403, type: 'story', title: 'Sprint setup dialog with flexible length', status: 'done', weight: 5, assignee: 'u-fn', doneOffset: 4 },
    { key: 404, type: 'story', title: 'Holiday-aware working days', status: 'in_progress', weight: 5, assignee: 'u-fn' },
    { key: 405, type: 'story', title: 'Sprint board drag and drop', status: 'review', column: 'qa', weight: 8, assignee: 'u-fn', reviewer: 'u-lp' },
    { key: 406, type: 'task', title: 'Usability test script for Project Board v2', status: 'in_progress', weight: 3, assignee: 'u-mr' },
    { key: 407, type: 'bug', title: 'Board loses scroll position after moving a card', status: 'todo', weight: 2, assignee: 'u-fn', severity: 'critical' },
    { key: 408, type: 'task', title: 'Burndown chart', status: 'todo', weight: 3, assignee: 'u-rp' },
  ];
  speSprint.forEach((s, i) => add('p-spe', 'SPE', spe16, s, i));
  const speDone15: ItemSpec[] = [
    { key: 390, type: 'story', title: 'Sprint list grouped by status', status: 'done', weight: 5, assignee: 'u-fn', doneOffset: 3, release: 'released' },
    { key: 391, type: 'story', title: 'Auto-numbered sprint names', status: 'done', weight: 3, assignee: 'u-fn', doneOffset: 6, release: 'released' },
  ];
  speDone15.forEach((s, i) => add('p-spe', 'SPE', spe15, s, 50 + i));
  add('p-spe', 'SPE', null, { key: 409, type: 'bug', title: 'Quick switcher ignores archived projects', status: 'todo', weight: null, assignee: null, severity: 'major' }, 100);
  add('p-spe', 'SPE', null, { key: 410, type: 'story', title: 'Release notes export', status: 'todo', weight: 5, assignee: null, criteria: ['Export as Markdown.'] }, 101);

  // QRISAN x MANTAP — Sprint 5 (active) + Sprint 6 (draft, ready)
  const qmSprint: ItemSpec[] = [
    { key: 51, type: 'story', title: 'QRIS payment notification to merchant app', status: 'done', weight: 5, assignee: 'u-fn', doneOffset: 3 },
    { key: 52, type: 'story', title: 'Pilot merchant onboarding checklist', status: 'done', weight: 3, assignee: 'u-mr', doneOffset: 5 },
    { key: 53, type: 'story', title: 'Dynamic QR generation for pilot merchants', status: 'in_progress', weight: 8, assignee: 'u-fn' },
    { key: 54, type: 'task', title: 'End-to-end payment test with MANTAP UAT', status: 'todo', weight: 5, assignee: 'u-lp' },
    { key: 55, type: 'bug', title: 'Duplicate payment callback on retry', status: 'review', weight: 3, assignee: 'u-fn', severity: 'major' },
  ];
  qmSprint.forEach((s, i) => add('p-mantap', 'QMT', qm5, s, i));
  add('p-mantap', 'QMT', qm6, { key: 61, type: 'story', title: 'Settlement report in merchant portal', status: 'todo', weight: 8, assignee: 'u-mr', criteria: ['Daily settlement report downloadable as CSV.'] }, 20);

  // Kaltimtara — backlog only
  add('p-kaltim', 'QKT', null, { key: 12, type: 'story', title: 'Merchant category code mapping', status: 'todo', weight: 3, assignee: 'u-ds', criteria: ['MCC list agreed with bank.'] }, 0);
  add('p-kaltim', 'QKT', null, { key: 13, type: 'story', title: 'Bank Kaltimtara host-to-host connection', status: 'todo', weight: null, assignee: null }, 1);

  const retro: RetroItem[] = [
    { id: uid('r'), projectId: 'p-spe', sprintId: spe15.id, kind: 'well', text: 'Pairing BA and dev on the setup dialog removed a lot of back-and-forth.', authorId: 'u-mr', votes: ['u-fn', 'u-lp'], ownerId: null, done: false, createdAt: now },
    { id: uid('r'), projectId: 'p-spe', sprintId: spe15.id, kind: 'improve', text: 'Holiday data wasn’t ready, so the estimate was wrong.', authorId: 'u-fn', votes: ['u-mr'], ownerId: null, done: false, createdAt: now },
    { id: uid('r'), projectId: 'p-spe', sprintId: spe15.id, kind: 'action', text: 'Admin imports next year’s holiday decree before December.', authorId: 'u-hs', votes: [], ownerId: 'u-hs', done: false, createdAt: now },
    { id: uid('r'), projectId: 'p-spe', sprintId: spe15.id, kind: 'action', text: 'Add a readiness checklist to draft sprints.', authorId: 'u-mr', votes: [], ownerId: 'u-mr', done: true, createdAt: now },
  ];

  const docs: Doc[] = [
    { id: uid('d'), projectId: 'p-at', title: 'BRD template (2026)', url: 'https://example.com/brd-template', addedBy: 'u-am', updatedAt: ts(addDays(today, -20)) },
    { id: uid('d'), projectId: 'p-at', title: 'QRISAN Refund BRD v0.3', url: 'https://example.com/refund-brd', addedBy: 'u-mr', updatedAt: ts(addDays(today, -1)) },
    { id: uid('d'), projectId: 'p-spe', title: 'Project Board v2 prototype', url: 'https://example.com/prototype', addedBy: 'u-mr', updatedAt: ts(addDays(today, -3)) },
  ];

  const y = Number(today.slice(0, 4));
  return {
    currentUserId: CURRENT_USER_ID,
    members,
    projects,
    sprints,
    items,
    retro,
    docs,
    holidays: fixedHolidays([y - 1, y, y + 1]),
    favorites: ['p-at', 'p-spe'],
    recent: ['p-at', 'p-specva', 'p-spe'],
  };
}
