import { useAuth } from '../auth/AuthProvider';
import { useSync } from '../sync/engine';
import { Icon } from './Icon';

/** Small save-state indicator in the top bar: Saved · Saving… · Offline · Couldn’t save. */
export function SyncStatus() {
  const { workspace } = useAuth();
  const { state, message } = useSync();
  if (!workspace || state === 'off') return null;
  const view = {
    loading: { icon: null, text: 'Loading…', tone: 'muted' },
    saving: { icon: null, text: 'Saving…', tone: 'muted' },
    saved: { icon: 'checkCircle', text: 'Saved', tone: 'muted' },
    offline: { icon: 'alert', text: 'Offline', tone: 'warning' },
    error: { icon: 'alert', text: 'Not saved', tone: 'danger' },
  }[state];
  return (
    <span
      className={`sync-status ${view.tone}`}
      role="status"
      aria-live="polite"
      title={message ?? (state === 'saved' ? 'All changes are saved to your team workspace.' : undefined)}
    >
      {view.icon ? <Icon name={view.icon as 'alert'} size={14} /> : <span className="spinner" aria-hidden="true" style={{ width: 12, height: 12 }} />}
      {view.text}
    </span>
  );
}
