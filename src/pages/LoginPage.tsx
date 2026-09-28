import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { isSupabaseConfigured, useAuth } from '../auth/AuthProvider';
import { Icon } from '../components/Icon';
import { toast } from '../components/toast';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth">
      <main className="auth-main">
        <div className="auth-brand">
          <span className="auth-logo" aria-hidden="true">S</span>
          <span>SPEctrum</span>
        </div>
        <div className="auth-body">{children}</div>
        <p className="auth-foot">Powered by SPE Solution {new Date().getFullYear()}</p>
      </main>
      <AuthShowcase />
    </div>
  );
}

function MicrosoftLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 21 21" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

/**
 * Whether a sign-in provider is switched on in Supabase (Authentication › Providers), so the page
 * never offers a button that can only fail. Hidden until known; shown if the check itself fails.
 */
function useProviderEnabled(provider: string): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const url = import.meta.env.VITE_SUPABASE_URL?.trim();
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
    if (!url || !key) return;
    let alive = true;
    fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((s: { external?: Record<string, boolean> }) => alive && setEnabled(!!s.external?.[provider]))
      .catch(() => alive && setEnabled(true));
    return () => {
      alive = false;
    };
  }, [provider]);
  return enabled;
}

export function PasswordInput({
  id,
  value,
  onChange,
  placeholder,
  autoComplete,
  invalid,
  describedBy,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoComplete: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className={`auth-input${invalid ? ' invalid' : ''}`}>
      <Icon name="lock" size={18} />
      <input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
      />
      <button type="button" className="auth-eye" aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show} onClick={() => setShow((v) => !v)}>
        <Icon name={show ? 'eye' : 'eyeOff'} size={18} />
      </button>
    </div>
  );
}

export function LoginPage() {
  const auth = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/projects';
  const [view, setView] = useState<'signin' | 'forgot'>('signin');

  if (auth.status === 'signedIn') return <Navigate to={from} replace />;

  return (
    <AuthLayout>
      {view === 'signin' ? (
        <SignInForm onForgot={() => setView('forgot')} />
      ) : (
        <ForgotForm onBack={() => setView('signin')} />
      )}
    </AuthLayout>
  );
}

function SignInForm({ onForgot }: { onForgot: () => void }) {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState<'password' | 'microsoft' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [caps, setCaps] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const microsoftEnabled = useProviderEnabled('azure');

  useEffect(() => emailRef.current?.focus(), []);

  const emailErr = !email.trim() ? 'Enter your email.' : !EMAIL_RE.test(email.trim()) ? 'Enter a valid email, like name@company.com.' : null;
  const passErr = !password ? 'Enter your password.' : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setError(null);
    if (emailErr || passErr) return;
    setBusy('password');
    const err = await auth.signInWithPassword(email, password);
    // On success keep the spinner: the page moves on once the workspace has loaded.
    if (err) {
      setBusy(null);
      setError(err);
    }
  };

  const microsoft = async () => {
    setError(null);
    setBusy('microsoft');
    const err = await auth.signInWithMicrosoft();
    // On success the browser leaves for Microsoft; only errors come back here.
    if (err) {
      setBusy(null);
      setError(err);
    }
  };

  return (
    <>
      <div className="auth-hero">
        <h1>Simplify Work, Collaborate Better, Deliver More</h1>
        <p>Organize tasks, monitor progress, and keep every project on track — effortlessly and efficiently.</p>
      </div>

      {!isSupabaseConfigured && (
        <div className="auth-note" role="note">
          <Icon name="info" size={18} />
          <div className="col" style={{ gap: 6 }}>
            <span>Sign-in isn’t connected to Supabase on this site yet. You can explore SPEctrum with demo data.</span>
            <button type="button" className="btn-link" style={{ alignSelf: 'flex-start' }} onClick={() => { auth.enterDemo(); toast('You’re in demo mode. Data stays in this browser.'); }}>
              Continue in demo mode
            </button>
          </div>
        </div>
      )}

      <form className="auth-form" onSubmit={submit} noValidate>
        {microsoftEnabled && (
          <>
            <button type="button" className="auth-sso" onClick={microsoft} disabled={busy !== null} aria-busy={busy === 'microsoft'}>
              {busy === 'microsoft' ? <span className="spinner" aria-hidden="true" /> : <MicrosoftLogo />}
              {busy === 'microsoft' ? 'Redirecting to Microsoft…' : 'Sign in with Microsoft'}
            </button>
            <div className="auth-divider"><span>or sign in with email</span></div>
          </>
        )}

        {error && (
          <div className="auth-error" role="alert">
            <Icon name="alert" size={16} /> {error}
          </div>
        )}

        <div className="auth-field">
          <label htmlFor="login-email" className="sr-only">Email</label>
          <div className={`auth-input${touched && emailErr ? ' invalid' : ''}`}>
            <Icon name="mail" size={18} />
            <input
              ref={emailRef}
              id="login-email"
              type="email"
              inputMode="email"
              autoComplete="username"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={(touched && !!emailErr) || undefined}
              aria-describedby={touched && emailErr ? 'login-email-err' : undefined}
            />
          </div>
          {touched && emailErr && <span id="login-email-err" className="field-error">{emailErr}</span>}
        </div>

        <div className="auth-field" onKeyUp={(e) => setCaps(e.getModifierState?.('CapsLock') ?? false)}>
          <label htmlFor="login-password" className="sr-only">Password</label>
          <PasswordInput
            id="login-password"
            value={password}
            onChange={setPassword}
            placeholder="Password"
            autoComplete="current-password"
            invalid={touched && !!passErr}
            describedBy={touched && passErr ? 'login-password-err' : caps ? 'login-caps' : undefined}
          />
          {touched && passErr && <span id="login-password-err" className="field-error">{passErr}</span>}
          {caps && <span id="login-caps" className="field-hint">Caps Lock is on.</span>}
        </div>

        <button type="submit" className="btn btn-primary auth-submit" disabled={busy !== null} aria-busy={busy === 'password'}>
          {busy === 'password' ? <><span className="spinner light" aria-hidden="true" /> Signing in…</> : 'Sign In'}
        </button>

        <p className="auth-help">
          Having trouble signing in?{' '}
          <button type="button" className="btn-link" onClick={onForgot}>Reset your password</button>
        </p>
      </form>
    </>
  );
}

function ForgotForm({ onBack }: { onBack: () => void }) {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const emailErr = !email.trim() ? 'Enter your email.' : !EMAIL_RE.test(email.trim()) ? 'Enter a valid email, like name@company.com.' : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setError(null);
    if (emailErr) return;
    setBusy(true);
    const err = await auth.sendPasswordReset(email);
    setBusy(false);
    if (err) setError(err);
    else setSentTo(email.trim());
  };

  if (sentTo)
    return (
      <div className="auth-form" role="status">
        <span className="auth-badge"><Icon name="mail" size={22} /></span>
        <h1 className="auth-title">Check your email</h1>
        <p className="muted">
          If <strong style={{ color: 'var(--text)' }}>{sentTo}</strong> has a SPEctrum account, we’ve sent a link to reset the password. The link works for 1 hour.
        </p>
        <p className="muted" style={{ fontSize: 13 }}>Didn’t get it? Check spam, or wait a minute and send it again.</p>
        <div className="row" style={{ gap: 10 }}>
          <button type="button" className="btn btn-secondary" onClick={() => setSentTo(null)}>Send again</button>
          <button type="button" className="btn btn-primary" onClick={onBack}>Back to sign in</button>
        </div>
      </div>
    );

  return (
    <form className="auth-form" onSubmit={submit} noValidate>
      <button type="button" className="btn-link row" style={{ gap: 4, alignSelf: 'flex-start' }} onClick={onBack}>
        <Icon name="chevronLeft" size={16} /> Back to sign in
      </button>
      <h1 className="auth-title">Reset your password</h1>
      <p className="muted">Enter the email you use for SPEctrum. We’ll send you a link to set a new password.</p>
      <p className="muted" style={{ fontSize: 13 }}>Signing in with Microsoft? Reset your password in your Microsoft account instead.</p>
      {error && <div className="auth-error" role="alert"><Icon name="alert" size={16} /> {error}</div>}
      <div className="auth-field">
        <label htmlFor="forgot-email" className="sr-only">Email</label>
        <div className={`auth-input${touched && emailErr ? ' invalid' : ''}`}>
          <Icon name="mail" size={18} />
          <input
            id="forgot-email"
            type="email"
            inputMode="email"
            autoComplete="username"
            placeholder="Email"
            value={email}
            autoFocus
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={(touched && !!emailErr) || undefined}
            aria-describedby={touched && emailErr ? 'forgot-email-err' : undefined}
          />
        </div>
        {touched && emailErr && <span id="forgot-email-err" className="field-error">{emailErr}</span>}
      </div>
      <button type="submit" className="btn btn-primary auth-submit" disabled={busy}>
        {busy ? <><span className="spinner light" aria-hidden="true" /> Sending…</> : 'Send reset link'}
      </button>
    </form>
  );
}

/** Set a new password after opening the recovery link from the email. */
export function ResetPasswordPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pwErr = pw.length < 8 ? 'Use at least 8 characters.' : null;
  const confirmErr = confirm !== pw ? 'Passwords don’t match.' : null;
  const hasSession = auth.mode === 'supabase';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setError(null);
    if (pwErr || confirmErr) return;
    setBusy(true);
    const err = await auth.updatePassword(pw);
    setBusy(false);
    if (err) setError(err);
    else {
      toast('Password updated. You’re signed in.');
      navigate('/projects', { replace: true });
    }
  };

  return (
    <AuthLayout>
      {auth.status === 'loading' ? (
        <p className="muted">Checking your link…</p>
      ) : !hasSession ? (
        <div className="auth-form">
          <h1 className="auth-title">This link has expired</h1>
          <p className="muted">Reset links work once and for 1 hour. Request a new one from the sign-in page.</p>
          <Link to="/login" className="btn btn-primary auth-submit">Back to sign in</Link>
        </div>
      ) : (
        <form className="auth-form" onSubmit={submit} noValidate>
          <h1 className="auth-title">Set a new password</h1>
          <p className="muted">For {auth.profile?.email}. Use at least 8 characters.</p>
          {error && <div className="auth-error" role="alert"><Icon name="alert" size={16} /> {error}</div>}
          <div className="auth-field">
            <label htmlFor="new-pw" className="sr-only">New password</label>
            <PasswordInput id="new-pw" value={pw} onChange={setPw} placeholder="New password" autoComplete="new-password" invalid={touched && !!pwErr} describedBy={touched && pwErr ? 'new-pw-err' : undefined} />
            {touched && pwErr && <span id="new-pw-err" className="field-error">{pwErr}</span>}
          </div>
          <div className="auth-field">
            <label htmlFor="confirm-pw" className="sr-only">Confirm new password</label>
            <PasswordInput id="confirm-pw" value={confirm} onChange={setConfirm} placeholder="Confirm new password" autoComplete="new-password" invalid={touched && !!confirmErr} describedBy={touched && confirmErr ? 'confirm-pw-err' : undefined} />
            {touched && confirmErr && <span id="confirm-pw-err" className="field-error">{confirmErr}</span>}
          </div>
          <button type="submit" className="btn btn-primary auth-submit" disabled={busy}>
            {busy ? <><span className="spinner light" aria-hidden="true" /> Saving…</> : 'Save password'}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}

/** Right-hand product preview, decorative only. */
function AuthShowcase() {
  const events = [
    { title: 'Daily scrum · Spectrum Sprint 16', time: '09:00 – 09:15', tone: 'blue', people: ['MR', 'FN', 'RP'] },
    { title: 'Weekly UI/UX sync', time: '11:00 – 12:00', tone: 'amber', people: ['AM', 'DS', 'HS'] },
    { title: 'QRISAN · Sprint review & retro', time: '13:00 – 15:00', tone: 'violet', people: ['LP', 'MR', 'FN'] },
  ];
  return (
    <aside className="auth-side" aria-hidden="true">
      <div className="auth-stack">
        <div className="auth-card">
          <div style={{ fontSize: 15 }}><strong>E-Collection</strong> · Sprint 5</div>
          <div className="auth-k">Sprint goal</div>
          <div style={{ fontSize: 13, lineHeight: 1.45 }}>Make SFTP processing reliable and visible: finish config, logging, and resend so support can monitor every run.</div>
          <div className="auth-k">Sprint progress</div>
          <div className="row" style={{ gap: 16, alignItems: 'baseline' }}>
            <span><strong style={{ fontSize: 20 }}>12</strong><span className="muted">/24 tasks done</span></span>
          </div>
          <div className="row" style={{ gap: 10 }}>
            <div className="grow" style={{ height: 6, borderRadius: 999, background: 'var(--border)' }}>
              <div style={{ width: '50%', height: '100%', borderRadius: 999, background: 'var(--success)' }} />
            </div>
            <strong style={{ fontSize: 12 }}>50%</strong>
          </div>
          <div className="row wrap" style={{ gap: 8 }}>
            <span className="auth-pill">10 working days</span>
            <span className="auth-pill">4 days left</span>
          </div>
        </div>

        <div className="auth-card">
          <div><strong style={{ fontSize: 15 }}>Today’s events</strong></div>
          <div className="muted" style={{ fontSize: 13, marginTop: -6 }}>{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' })}</div>
          {events.map((e) => (
            <div key={e.title} className={`auth-event ${e.tone}`}>
              <strong style={{ fontSize: 13 }}>{e.title}</strong>
              <span style={{ fontSize: 12 }}>{e.time}</span>
              <span className="row" style={{ gap: 0 }}>
                {e.people.map((p) => <span key={p} className="auth-av">{p}</span>)}
              </span>
              <span className="auth-join">Join</span>
            </div>
          ))}
        </div>

        <div className="auth-card" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="col" style={{ gap: 2 }}>
            <strong style={{ fontSize: 26 }}>20</strong>
            <span className="muted">Tasks this sprint</span>
          </div>
          <span className="auth-badge"><Icon name="tasks" size={22} /></span>
        </div>
      </div>
    </aside>
  );
}
