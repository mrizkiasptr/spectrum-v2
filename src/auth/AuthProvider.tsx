import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { todayISO } from '../domain/dates';
import { createSeed } from '../domain/seed';
import { TRIBES, type Member, type Tribe } from '../domain/types';
import { SyncEngine } from '../sync/engine';
import { fromRow, type Row } from '../sync/rows';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { initialsOf, memberForProfile, nameFromEmail, type Profile } from './profile';

type Status = 'loading' | 'signedIn' | 'signedOut';

interface AuthCtx {
  status: Status;
  /** 'demo' when the build has no Supabase keys or the person chose demo mode. */
  mode: 'supabase' | 'demo' | null;
  profile: Profile | null;
  /** True after the person opened a password-recovery link and must set a new password. */
  recovering: boolean;
  signInWithPassword: (email: string, password: string) => Promise<string | null>;
  signInWithMicrosoft: () => Promise<string | null>;
  sendPasswordReset: (email: string) => Promise<string | null>;
  updatePassword: (password: string) => Promise<string | null>;
  enterDemo: () => void;
  signOut: () => Promise<void>;
  /** What this person may see and change. Demo mode: everything. */
  access: Access;
  /** False when signed in but the workspace tables aren't set up; data then stays in this browser. */
  workspace: boolean;
  /** Admin only: fill an empty workspace with the demo projects. */
  importDemoData: () => void;
  /** True right after the person signed out themselves, so the next sign-in starts fresh. */
  signedOutByUser: boolean;
}

export interface Access {
  isAdmin: boolean;
  tribes: Tribe[];
  memberId: string | null;
}

const FULL_ACCESS: Access = { isAdmin: true, tribes: [...TRIBES], memberId: null };
const EMPTY_LISTS = { members: [], projects: [], sprints: [], items: [], retro: [], docs: [], holidays: [] };

const Ctx = createContext<AuthCtx | null>(null);
const DEMO_KEY = 'spectrum-demo-session';
const LAST_USER_KEY = 'spectrum-last-user';

const readDemo = () => {
  try {
    return localStorage.getItem(DEMO_KEY) === '1';
  } catch {
    return false;
  }
};
const writeDemo = (on: boolean) => {
  try {
    if (on) localStorage.setItem(DEMO_KEY, '1');
    else localStorage.removeItem(DEMO_KEY);
  } catch {
    /* ignore */
  }
};

/** Maps Supabase errors to plain messages; never reveals whether an email has an account. */
export function authMessage(err: { message?: string; status?: number } | null): string | null {
  if (!err) return null;
  const m = (err.message ?? '').toLowerCase();
  if (m.includes('invalid login') || m.includes('invalid credentials')) return 'Email or password is incorrect.';
  if (m.includes('email not confirmed')) return 'Confirm your email first. Check your inbox for the confirmation link.';
  if (m.includes('rate limit') || err.status === 429) return 'Too many attempts. Wait a minute and try again.';
  if (m.includes('password should be')) return 'Use at least 8 characters for your password.';
  if (m.includes('same password') || m.includes('different from the old')) return 'Choose a password you haven’t used before.';
  if (m.includes('provider is not enabled') || m.includes('unsupported provider')) return 'Microsoft sign-in isn’t enabled yet. Ask your admin, or use email.';
  if (m.includes('failed to fetch') || m.includes('network')) return 'Can’t reach the server. Check your connection and try again.';
  return 'Something went wrong. Try again.';
}

async function loadProfile(session: Session): Promise<Profile> {
  const u = session.user;
  const meta = (u.user_metadata ?? {}) as Record<string, string | undefined>;
  const base: Profile = { id: u.id, email: u.email ?? '', fullName: meta.full_name ?? meta.name ?? '', role: '' };
  if (!supabase) return base;
  const { data } = await supabase.from('profiles').select('full_name, role').eq('id', u.id).maybeSingle();
  return data ? { ...base, fullName: data.full_name || base.fullName, role: data.role ?? '' } : base;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [mode, setMode] = useState<AuthCtx['mode']>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [recovering, setRecovering] = useState(false);
  const [access, setAccess] = useState<Access>(FULL_ACCESS);
  const [workspace, setWorkspace] = useState(false);
  const [signedOutByUser, setSignedOutByUser] = useState(false);
  const engine = useRef<SyncEngine | null>(null);
  const userId = useRef<string | null>(null);

  const stopEngine = () => {
    engine.current?.stop();
    engine.current = null;
  };

  const applySession = useCallback(async (session: Session | null) => {
    if (!session) {
      if (userId.current) {
        // Signed out: stop syncing first, then drop this person's copy of the workspace.
        stopEngine();
        useStore.setState(EMPTY_LISTS);
        userId.current = null;
      }
      setProfile(null);
      setWorkspace(false);
      setAccess(FULL_ACCESS);
      if (readDemo()) {
        setMode('demo');
        setStatus('signedIn');
      } else {
        setMode(null);
        setStatus('signedOut');
      }
      return;
    }
    const p = await loadProfile(session);
    setProfile(p);
    if (userId.current === session.user.id) return; // token refresh or tab refocus
    userId.current = session.user.id;
    setStatus('loading');
    stopEngine();
    writeDemo(false);
    // Favorites and recents live in this browser; don't show one person's to the next.
    try {
      if (localStorage.getItem(LAST_USER_KEY) !== session.user.id) useStore.setState({ favorites: [], recent: [] });
      localStorage.setItem(LAST_USER_KEY, session.user.id);
    } catch {
      /* ignore */
    }

    const name = p.fullName.trim() || nameFromEmail(p.email);
    const linked = supabase ? await supabase.rpc('link_member', { p_name: name, p_initials: initialsOf(name) }) : null;
    if (!supabase || !linked || linked.error) {
      // Workspace tables not set up yet (migration 0002 not run): keep working on this browser's data.
      const s = useStore.getState();
      if (!s.projects.length) s.resetDemo();
      s.signInAs(memberForProfile(p, useStore.getState().members));
      setWorkspace(false);
      setAccess(FULL_ACCESS);
    } else {
      const me = fromRow('members', linked.data as Row) as Member;
      const { data: tribes } = await supabase.from('tribe_access').select('tribe').eq('member_id', me.id);
      const acc: Access = { isAdmin: !!me.isAdmin, tribes: (tribes ?? []).map((t) => t.tribe as Tribe), memberId: me.id };
      const eng = new SyncEngine(supabase, (c) => (c === 'members' || c === 'holidays' ? acc.isAdmin : true));
      engine.current = eng;
      useStore.setState({ ...EMPTY_LISTS, currentUserId: me.id });
      try {
        await eng.start();
      } catch {
        /* status bar shows the error; the person can retry */
      }
      useStore.setState({ currentUserId: me.id });
      setAccess(acc);
      setWorkspace(true);
    }
    setMode('supabase');
    setSignedOutByUser(false);
    setStatus('signedIn');
  }, []);

  useEffect(() => {
    if (!supabase) {
      void applySession(null);
      return;
    }
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) void applySession(data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        // Defer: Supabase warns against awaiting other calls inside this callback.
        setTimeout(() => {
          if (alive) void applySession(session);
        }, 0);
      }
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [applySession]);

  const value = useMemo<AuthCtx>(
    () => ({
      status,
      mode,
      profile,
      recovering,
      async signInWithPassword(email, password) {
        if (!supabase) return 'Sign-in isn’t set up for this site yet. Use demo mode.';
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        return authMessage(error);
      },
      async signInWithMicrosoft() {
        if (!supabase) return 'Sign-in isn’t set up for this site yet. Use demo mode.';
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'azure',
          options: { scopes: 'email openid profile', redirectTo: `${window.location.origin}/projects` },
        });
        return authMessage(error);
      },
      async sendPasswordReset(email) {
        if (!supabase) return 'Password reset isn’t set up for this site yet.';
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
        // Rate limits are worth showing; "user not found" is not, to avoid leaking accounts.
        return error && (error.status === 429 || /rate limit|fetch/i.test(error.message)) ? authMessage(error) : null;
      },
      async updatePassword(password) {
        if (!supabase) return 'Password reset isn’t set up for this site yet.';
        const { error } = await supabase.auth.updateUser({ password });
        if (!error) setRecovering(false);
        return authMessage(error);
      },
      enterDemo() {
        setSignedOutByUser(false);
        writeDemo(true);
        if (!useStore.getState().projects.length) useStore.getState().resetDemo();
        setMode('demo');
        setStatus('signedIn');
      },
      async signOut() {
        setSignedOutByUser(true);
        writeDemo(false);
        if (supabase && userId.current) {
          stopEngine();
          useStore.setState(EMPTY_LISTS);
          userId.current = null;
          await supabase.auth.signOut();
        }
        setProfile(null);
        setMode(null);
        setStatus('signedOut');
      },
      access: mode === 'supabase' && workspace ? access : FULL_ACCESS,
      workspace: mode === 'supabase' && workspace,
      signedOutByUser,
      importDemoData() {
        if (!engine.current || !access.isAdmin) return;
        const s = useStore.getState();
        // The demo's "current user" becomes the admin importing it, so their tasks and projects are theirs.
        const raw = createSeed(todayISO());
        const seed = JSON.parse(JSON.stringify(raw).split(JSON.stringify(raw.currentUserId)).join(JSON.stringify(s.currentUserId))) as typeof raw;
        useStore.setState({
          members: [...s.members, ...seed.members.filter((m) => !s.members.some((x) => x.id === m.id))],
          projects: seed.projects,
          sprints: seed.sprints,
          items: seed.items,
          retro: seed.retro,
          docs: seed.docs,
          holidays: s.holidays.length ? s.holidays : seed.holidays,
        });
      },
    }),
    [status, mode, profile, recovering, access, workspace, signedOutByUser],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth must be used inside AuthProvider');
  return c;
}

export { isSupabaseConfigured };
