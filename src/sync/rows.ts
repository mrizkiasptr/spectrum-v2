import type { Doc, Holiday, Member, Project, RetroItem, Sprint, WorkItem } from '../domain/types';

/** Store lists that live in Supabase, in dependency order (parents first). */
export const COLLECTIONS = ['members', 'holidays', 'projects', 'sprints', 'items', 'retro', 'docs'] as const;
export type Collection = (typeof COLLECTIONS)[number];

export interface EntityOf {
  members: Member;
  holidays: Holiday;
  projects: Project;
  sprints: Sprint;
  items: WorkItem;
  retro: RetroItem;
  docs: Doc;
}

export const TABLE: Record<Collection, string> = {
  members: 'members',
  holidays: 'holidays',
  projects: 'projects',
  sprints: 'sprints',
  items: 'work_items',
  retro: 'retro_items',
  docs: 'docs',
};

export type Row = Record<string, unknown> & { id: string };

/** Entity → table row. Query/RLS columns are copied out; the whole entity goes in `data`. */
export function toRow<C extends Collection>(c: C, e: EntityOf[C]): Row {
  switch (c) {
    case 'members': {
      const m = e as Member;
      return { id: m.id, name: m.name, initials: m.initials, role: m.role, email: m.email ? m.email.toLowerCase() : null, is_admin: !!m.isAdmin };
    }
    case 'projects': {
      const p = e as Project;
      return { id: p.id, tribe: p.tribe, status: p.status, data: p };
    }
    case 'sprints': {
      const s = e as Sprint;
      return { id: s.id, project_id: s.projectId, status: s.status, data: s };
    }
    case 'items': {
      const i = e as WorkItem;
      return { id: i.id, project_id: i.projectId, sprint_id: i.sprintId, data: i };
    }
    case 'retro':
    case 'docs': {
      const x = e as RetroItem | Doc;
      return { id: x.id, project_id: x.projectId, data: x };
    }
    default:
      return { id: (e as Holiday).id, data: e };
  }
}

/** Table row → entity. */
export function fromRow<C extends Collection>(c: C, r: Row): EntityOf[C] {
  if (c === 'members') {
    return {
      id: r.id,
      name: String(r.name ?? ''),
      initials: String(r.initials ?? ''),
      role: String(r.role ?? ''),
      email: (r.email as string | null) ?? null,
      userId: (r.user_id as string | null) ?? null,
      isAdmin: !!r.is_admin,
    } as EntityOf[C];
  }
  return { ...(r.data as object), id: r.id } as EntityOf[C];
}

/** JSON with sorted keys, so entities compare equal whatever order Postgres returns jsonb keys in. */
export function stableStringify(v: unknown): string {
  if (v === undefined) return 'null';
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`)
    .join(',')}}`;
}

/** What to write so the server matches `next`, given what the server last had (`known`: id → fingerprint). */
export function diff<T extends { id: string }>(known: Map<string, string>, next: T[]): { upserts: T[]; deletes: string[] } {
  const upserts: T[] = [];
  const seen = new Set<string>();
  for (const e of next) {
    seen.add(e.id);
    if (known.get(e.id) !== stableStringify(e)) upserts.push(e);
  }
  const deletes = [...known.keys()].filter((id) => !seen.has(id));
  return { upserts, deletes };
}
