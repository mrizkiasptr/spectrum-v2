import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';

/** Sends signed-out visitors to /login and brings them back to where they were going. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading')
    return (
      <div role="status" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: 'var(--text-muted)' }}>
        <span className="row" style={{ gap: 10 }}><span className="spinner" aria-hidden="true" /> Loading SPEctrum…</span>
      </div>
    );
  if (status === 'signedOut') return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <>{children}</>;
}
