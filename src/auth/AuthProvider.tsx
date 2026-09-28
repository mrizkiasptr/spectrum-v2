import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { memberForProfile, type Profile } from './profile';

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
}

const Ctx = createContext<AuthCtx | null>(null);
const DEMO_KEY = 'spectrum-demo-session';

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

  const applySession = useCallback(async (session: Session | null) => {
    if (!session) {
      setProfile(null);
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
    const s = useStore.getState();
    s.signInAs(memberForProfile(p, s.members));
    setProfile(p);
    setMode('supabase');
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
        writeDemo(true);
        setMode('demo');
        setStatus('signedIn');
      },
      async signOut() {
        writeDemo(false);
        if (supabase) await supabase.auth.signOut();
        setProfile(null);
        setMode(null);
        setStatus('signedOut');
      },
    }),
    [status, mode, profile, recovering],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth must be used inside AuthProvider');
  return c;
}

export { isSupabaseConfigured };
