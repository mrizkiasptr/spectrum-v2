import { Component, type ErrorInfo, type ReactNode } from 'react';

const STORAGE_KEY = 'spectrum-v2';

interface State {
  error: Error | null;
}

/**
 * Last line of defense: instead of a blank page, show what happened and offer a way out.
 * Data lives in this browser only, so resetting it restores the demo data.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('SPEctrum crashed', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <main
        role="alert"
        style={{
          minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#F9F9F9',
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", color: '#2D2D2D',
        }}
      >
        <div style={{ maxWidth: 520, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 28, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h1 style={{ margin: 0, fontSize: 22 }}>Something went wrong</h1>
          <p style={{ margin: 0, color: '#5C6068', lineHeight: 1.5 }}>
            SPEctrum couldn&rsquo;t open this page. Reload first. If it keeps happening, your saved data in this browser may be from an
            older version; resetting it restores the demo data.
          </p>
          <code style={{ fontSize: 12, background: '#F3F4F6', padding: '8px 10px', borderRadius: 6, overflowWrap: 'anywhere' }}>{error.message}</code>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => {
                try {
                  localStorage.removeItem(STORAGE_KEY);
                } catch {
                  /* storage unavailable */
                }
                window.location.assign('/projects');
              }}
              style={{ height: 40, padding: '0 16px', borderRadius: 6, border: '1px solid rgba(217,45,32,0.3)', background: '#fff', color: '#B42318', fontWeight: 600, cursor: 'pointer' }}
            >
              Reset data and reload
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{ height: 40, padding: '0 16px', borderRadius: 6, border: 0, background: '#0779E4', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
            >
              Reload
            </button>
          </div>
        </div>
      </main>
    );
  }
}
