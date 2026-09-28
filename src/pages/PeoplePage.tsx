import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { initialsOf } from '../auth/profile';
import { Topbar } from '../components/AppShell';
import { Icon } from '../components/Icon';
import { toast } from '../components/toast';
import { Avatar, Dialog, Empty, TribeBadge } from '../components/ui';
import { TRIBES, type Member, type Tribe } from '../domain/types';
import { supabase } from '../lib/supabase';
import { newId, useStore } from '../store/useStore';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type AccessMap = Record<string, Tribe[]>;

/**
 * Administration › People & access. Admins add people by email (they link on first sign-in),
 * choose which tribes each person can follow, and who is an admin. Project membership is set per project.
 */
export function PeoplePage() {
  const auth = useAuth();
  const members = useStore((s) => s.members);
  const projects = useStore((s) => s.projects);
  const setState = useStore.setState;
  const [access, setAccess] = useState<AccessMap>({});
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Member | 'new' | null>(null);

  const loadAccess = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.from('tribe_access').select('member_id, tribe');
    const map: AccessMap = {};
    for (const r of data ?? []) (map[r.member_id] ??= []).push(r.tribe as Tribe);
    setAccess(map);
  }, []);

  useEffect(() => {
    void loadAccess();
  }, [loadAccess]);

  const list = useMemo(
    () =>
      members
        .filter((m) => !q.trim() || `${m.name} ${m.email ?? ''} ${m.role}`.toLowerCase().includes(q.trim().toLowerCase()))
        .sort((a, b) => Number(!!b.isAdmin) - Number(!!a.isAdmin) || a.name.localeCompare(b.name)),
    [members, q],
  );

  if (!auth.workspace || !auth.access.isAdmin) {
    return (
      <>
        <Topbar crumbs={[{ label: 'Administration' }, { label: 'People & access' }]} />
        <div className="content">
          <div className="page">
            <Empty icon="shield" title="Only workspace admins can manage people">
              <span>{auth.workspace ? 'Ask an admin if you need access to a tribe or project.' : 'Connect SPEctrum to Supabase to manage people and access.'}</span>
            </Empty>
          </div>
        </div>
      </>
    );
  }

  const save = async (next: Member, tribes: Tribe[]) => {
    const exists = members.some((m) => m.id === next.id);
    setState({ members: exists ? members.map((m) => (m.id === next.id ? next : m)) : [...members, next] });
    // tribe_access references the member, so wait until the sync engine has written it.
    await waitForMember(next.id);
    const before = access[next.id] ?? [];
    const add = tribes.filter((t) => !before.includes(t));
    const remove = before.filter((t) => !tribes.includes(t));
    if (supabase) {
      if (remove.length) await supabase.from('tribe_access').delete().eq('member_id', next.id).in('tribe', remove);
      if (add.length) {
        const { error } = await supabase.from('tribe_access').insert(add.map((tribe) => ({ member_id: next.id, tribe })));
        if (error) toast('Couldn’t save tribe access. Try again.');
      }
    }
    await loadAccess();
    toast(exists ? `${next.name} updated.` : `${next.name} added. They get access when they sign in with ${next.email}.`);
    setEditing(null);
  };

  return (
    <>
      <Topbar crumbs={[{ label: 'Administration' }, { label: 'People & access' }]} />
      <div className="content">
        <div className="page">
          <div className="page-head">
            <div className="col" style={{ gap: 6 }}>
              <h1 className="page-title">People &amp; access</h1>
              <p className="muted" style={{ maxWidth: 720 }}>
                Add people by the email they sign in with. <strong>Tribe access</strong> lets someone follow every project in that tribe;
                they can edit only projects they’re a member of. Admins can see and change everything.
              </p>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
              <Icon name="userPlus" size={18} /> Add person
            </button>
          </div>

          <label className="search-box" style={{ alignSelf: 'flex-start', minWidth: 280 }}>
            <Icon name="search" size={16} />
            <input type="search" aria-label="Search people" placeholder="Search name, email, or role" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>

          <div className="table-wrap" style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Person</th>
                  <th scope="col">Role</th>
                  <th scope="col">Tribe access</th>
                  <th scope="col" style={{ width: 90 }}>Projects</th>
                  <th scope="col" style={{ width: 150 }}>Sign-in</th>
                  <th scope="col" style={{ width: 70 }}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {list.map((m) => {
                  const tribes = access[m.id] ?? [];
                  const count = projects.filter((p) => p.memberIds.includes(m.id)).length;
                  return (
                    <tr key={m.id}>
                      <td>
                        <div className="row">
                          <Avatar member={m} />
                          <div className="col" style={{ gap: 0 }}>
                            <span style={{ fontWeight: 600 }}>
                              {m.name}
                              {m.isAdmin && <span className="badge sm info" style={{ marginLeft: 8 }}>Admin</span>}
                            </span>
                            <span className="muted" style={{ fontSize: 12 }}>{m.email || 'No email'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="muted">{m.role || '—'}</td>
                      <td>
                        {m.isAdmin ? (
                          <span className="muted" style={{ fontSize: 13 }}>All tribes</span>
                        ) : tribes.length ? (
                          <span className="row wrap" style={{ gap: 6 }}>{tribes.map((t) => <TribeBadge key={t} tribe={t} />)}</span>
                        ) : (
                          <span className="subtle">None</span>
                        )}
                      </td>
                      <td className="num">{count}</td>
                      <td>
                        {m.userId ? (
                          <span className="row" style={{ gap: 6, fontSize: 13 }}><Icon name="checkCircle" size={14} color="var(--success)" /> Signed in</span>
                        ) : m.email ? (
                          <span className="muted" style={{ fontSize: 13 }}>Waiting for first sign-in</span>
                        ) : (
                          <span className="row" style={{ gap: 6, fontSize: 13, color: 'var(--warning-text)' }}><Icon name="alert" size={14} /> Add an email</span>
                        )}
                      </td>
                      <td>
                        <button type="button" className="btn btn-ghost btn-sm" aria-label={`Edit ${m.name}`} onClick={() => setEditing(m)}>Edit</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {editing && (
        <PersonDialog
          person={editing === 'new' ? null : editing}
          tribes={editing === 'new' ? [] : access[editing.id] ?? []}
          members={members}
          isSelf={editing !== 'new' && editing.id === auth.access.memberId}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      )}
    </>
  );
}

async function waitForMember(id: string) {
  if (!supabase) return;
  for (let i = 0; i < 20; i++) {
    const { data } = await supabase.from('members').select('id').eq('id', id).maybeSingle();
    if (data) return;
    await new Promise((r) => setTimeout(r, 300));
  }
}

function PersonDialog({
  person,
  tribes: initialTribes,
  members,
  isSelf,
  onClose,
  onSave,
}: {
  person: Member | null;
  tribes: Tribe[];
  members: Member[];
  isSelf: boolean;
  onClose: () => void;
  onSave: (m: Member, tribes: Tribe[]) => Promise<void>;
}) {
  const [name, setName] = useState(person?.name ?? '');
  const [email, setEmail] = useState(person?.email ?? '');
  const [role, setRole] = useState(person?.role ?? '');
  const [isAdmin, setIsAdmin] = useState(!!person?.isAdmin);
  const [tribes, setTribes] = useState<Tribe[]>(initialTribes);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);

  const e = email.trim().toLowerCase();
  const taken = !!e && members.some((m) => m.id !== person?.id && m.email?.toLowerCase() === e);
  const errors = {
    name: !name.trim() ? 'Enter a name.' : null,
    email: !e && !person ? 'Enter the email they sign in with.' : e && !EMAIL_RE.test(e) ? 'Enter a valid email.' : taken ? 'Someone already uses this email.' : null,
  };
  const linked = !!person?.userId;

  return (
    <Dialog
      open
      onClose={onClose}
      title={person ? `Edit ${person.name}` : 'Add person'}
      subtitle={person ? undefined : 'They get access the first time they sign in with this email.'}
      footer={
        <>
          <button type="button" className="btn btn-secondary btn-md" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn btn-primary btn-md"
            disabled={busy}
            onClick={async () => {
              setTouched(true);
              if (errors.name || errors.email) return;
              setBusy(true);
              const n = name.trim();
              await onSave(
                { ...(person ?? { id: newId('u'), userId: null }), name: n, initials: person?.initials && person.name === n ? person.initials : initialsOf(n), role: role.trim(), email: e || null, isAdmin },
                isAdmin ? [] : tribes,
              );
              setBusy(false);
            }}
          >
            {busy ? 'Saving…' : person ? 'Save' : 'Add person'}
          </button>
        </>
      }
    >
      <div className="col" style={{ gap: 14 }}>
        <div className="field">
          <label className="field-label" htmlFor="pp-name">Name</label>
          <input id="pp-name" className="input" value={name} onChange={(ev) => setName(ev.target.value)} aria-invalid={(touched && !!errors.name) || undefined} />
          {touched && errors.name && <span className="field-error">{errors.name}</span>}
        </div>
        <div className="field">
          <label className="field-label" htmlFor="pp-email">Sign-in email</label>
          <input id="pp-email" type="email" className="input" value={email} onChange={(ev) => setEmail(ev.target.value)} disabled={linked} aria-invalid={(touched && !!errors.email) || undefined} placeholder="name@company.com" />
          {linked ? <span className="field-hint">Linked to their account, so the email can’t change here.</span> : touched && errors.email && <span className="field-error">{errors.email}</span>}
        </div>
        <div className="field">
          <label className="field-label" htmlFor="pp-role">Role</label>
          <input id="pp-role" className="input" value={role} onChange={(ev) => setRole(ev.target.value)} placeholder="e.g. Product Manager" />
        </div>
        <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }} disabled={isAdmin}>
          <legend className="field-label" style={{ marginBottom: 6 }}>Tribe access</legend>
          <div className="row wrap" style={{ gap: 14 }}>
            {TRIBES.map((t) => (
              <label key={t} className="check" style={{ alignItems: 'center' }}>
                <input type="checkbox" checked={isAdmin || tribes.includes(t)} onChange={(ev) => setTribes((cur) => (ev.target.checked ? [...cur, t] : cur.filter((x) => x !== t)))} />
                {t}
              </label>
            ))}
          </div>
          <span className="field-hint">{isAdmin ? 'Admins see every tribe.' : 'Follow every project in these tribes (view only unless they’re a project member).'}</span>
        </fieldset>
        <label className="check">
          <input type="checkbox" checked={isAdmin} disabled={isSelf} onChange={(ev) => setIsAdmin(ev.target.checked)} />
          <span className="col" style={{ gap: 2 }}>
            <span style={{ fontWeight: 600 }}>Workspace admin</span>
            <span className="field-hint">{isSelf ? 'You can’t remove your own admin access.' : 'Sees and changes everything, manages people and holidays.'}</span>
          </span>
        </label>
      </div>
    </Dialog>
  );
}
