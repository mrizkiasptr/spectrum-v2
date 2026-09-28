import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useMatch, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useStore } from '../store/useStore';
import { TaskDrawerHost } from '../features/TaskDrawer';
import { Icon, type IconName } from './Icon';
import { QuickSwitcher } from './QuickSwitcher';
import { SyncStatus } from './SyncStatus';
import { TRIBE_STYLE, MenuButton, Avatar } from './ui';
import { Toasts, toast } from './toast';

function NavItem({ to, icon, label, count, end }: { to: string; icon: IconName; label: string; count?: number; end?: boolean }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title={label}>
      <Icon name={icon} />
      <span className="nav-label">{label}</span>
      {count !== undefined && count > 0 && <span className="nav-count">{count}</span>}
    </NavLink>
  );
}

function Sidebar({ onSearch }: { onSearch: () => void }) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('spectrum-sidebar') === 'collapsed';
    } catch {
      return false;
    }
  });
  const [adminOpen, setAdminOpen] = useState(false);
  const projects = useStore((s) => s.projects);
  const favorites = useStore((s) => s.favorites);
  const me = useStore((s) => s.members.find((m) => m.id === s.currentUserId) ?? null);
  const myOpen = useStore((s) => s.items.filter((i) => i.assigneeId === s.currentUserId && i.status !== 'done' && i.sprintId).length);
  const resetDemo = useStore((s) => s.resetDemo);
  const auth = useAuth();
  const projectMatch = useMatch('/projects/:projectId/*');
  const navigate = useNavigate();

  useEffect(() => {
    try {
      localStorage.setItem('spectrum-sidebar', collapsed ? 'collapsed' : 'expanded');
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  const favProjects = favorites.map((id) => projects.find((p) => p.id === id)).filter(Boolean) as typeof projects;

  return (
    <nav aria-label="Main navigation" className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="brand">
        <div className="brand-mark">S</div>
        <span className="brand-name">SPEctrum</span>
        <button
          type="button"
          className="icon-btn sm"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-pressed={collapsed}
          onClick={() => setCollapsed((c) => !c)}
        >
          <Icon name="panel" size={18} />
        </button>
      </div>
      <button type="button" className="search-trigger" onClick={onSearch} aria-label="Search projects and sprints (Ctrl K)">
        <Icon name="search" size={16} />
        <span className="search-text grow" style={{ textAlign: 'left' }}>Search</span>
        {!collapsed && <span className="kbd">Ctrl K</span>}
      </button>

      <div className="nav-group">
        <span className="nav-group-title">Main</span>
        <NavItem to="/home" icon="home" label="Home" />
        <NavItem to="/my-tasks" icon="tasks" label="My tasks" count={myOpen} />
      </div>
      <div className="nav-group">
        <span className="nav-group-title">Teamwork</span>
        <NavItem to="/projects" icon="folder" label="Project Board" />
        <NavItem to="/squad-health-check" icon="pulse" label="Squad Health Check" />
        <NavItem to="/change-requests" icon="merge" label="Change Request" />
      </div>
      <div className="nav-group">
        <span className="nav-group-title">Performance &amp; people</span>
        <NavItem to="/work-performance" icon="chart" label="Work Performance" />
        <NavItem to="/time-management" icon="clock" label="Time Management" />
        <NavItem to="/employees" icon="users" label="Employee" />
        <NavItem to="/digital-signature" icon="pen" label="Digital Signature" />
        <button type="button" className="nav-item" aria-expanded={adminOpen} onClick={() => setAdminOpen((o) => !o)} title="Administration">
          <Icon name="shield" />
          <span className="nav-label">Administration</span>
          <span className="nav-count"><Icon name={adminOpen ? 'chevronDown' : 'chevronRight'} size={16} /></span>
        </button>
        {adminOpen && (
          <div className="nav-group" style={{ paddingLeft: collapsed ? 0 : 16 }}>
            {auth.workspace && auth.access.isAdmin && <NavItem to="/admin/people" icon="users" label="People & access" />}
            <NavItem to="/admin/holidays" icon="calendar" label="Holiday calendar" />
            <NavItem to="/admin/master-data" icon="layers" label="Master Data" />
            <NavItem to="/admin/configuration" icon="sliders" label="Configuration" />
          </div>
        )}
      </div>
      {favProjects.length > 0 && (
        <div className="nav-group">
          <span className="nav-group-title">Favorite projects</span>
          {favProjects.map((p) => {
            const t = TRIBE_STYLE[p.tribe];
            const active = projectMatch?.params.projectId === p.id;
            return (
              <Link key={p.id} to={`/projects/${p.id}`} className={`nav-item ${active ? 'soft-active' : ''}`} title={p.name}>
                <span className="nav-tile" style={{ background: t.bg, color: t.fg }}>{p.code}</span>
                <span className="nav-label">{p.name}</span>
              </Link>
            );
          })}
        </div>
      )}
      <div className="sidebar-user">
        <Avatar member={me} size="lg" />
        <div className="user-meta grow col" style={{ gap: 0 }}>
          <span className="truncate" style={{ fontWeight: 600 }}>{me?.name}</span>
          <span className="muted truncate" style={{ fontSize: 12 }}>{auth.mode === 'demo' ? 'Demo mode' : auth.profile?.email || me?.role}</span>
        </div>
        {!collapsed && (
          <MenuButton label="Account menu" trigger={<Icon name="more" size={18} />} align="right" up>
            {(close) => (
              <>
                {!auth.workspace && <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    close();
                    resetDemo();
                    navigate('/projects');
                    toast('Demo data has been reset.');
                  }}
                >
                  <Icon name="refresh" size={16} /> Reset demo data
                </button>}
                <button
                  type="button"
                  role="menuitem"
                  onClick={async () => {
                    close();
                    await auth.signOut();
                    navigate('/login', { replace: true });
                  }}
                >
                  <Icon name="logout" size={16} /> Sign out
                </button>
              </>
            )}
          </MenuButton>
        )}
      </div>
    </nav>
  );
}

export interface Crumb {
  label: string;
  to?: string;
}

export function Topbar({ crumbs, actions }: { crumbs: Crumb[]; actions?: ReactNode }) {
  return (
    <header className="topbar">
      <nav aria-label="Breadcrumb" className="breadcrumb">
        <Link to="/projects" aria-label="Project Board home" style={{ display: 'flex' }}>
          <Icon name="home" size={18} />
        </Link>
        {crumbs.map((c, i) => (
          <span key={i} className="row" style={{ gap: 8, minWidth: 0 }}>
            <Icon name="chevronRight" size={14} />
            {c.to && i < crumbs.length - 1 ? (
              <Link to={c.to} className="truncate">{c.label}</Link>
            ) : (
              <span aria-current="page" className="truncate">{c.label}</span>
            )}
          </span>
        ))}
      </nav>
      <div className="row" style={{ gap: 4 }}>
        <SyncStatus />
        {actions}
        <a className="btn btn-ghost btn-md" href="mailto:feedback@spectrum.example?subject=SPEctrum%20v2%20feedback">
          <Icon name="message" size={18} /> Feedback
        </a>
        <button type="button" className="icon-btn" aria-label="Notifications" style={{ position: 'relative' }}>
          <Icon name="bell" />
          <span style={{ position: 'absolute', top: 8, right: 9, width: 8, height: 8, borderRadius: 999, background: 'var(--danger)', border: '2px solid #fff' }} />
        </button>
      </div>
    </header>
  );
}

export function AppShell() {
  const [switcher, setSwitcher] = useState(false);
  const location = useLocation();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSwitcher((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => setSwitcher(false), [location.pathname]);

  return (
    <div className="shell">
      <Sidebar onSearch={() => setSwitcher(true)} />
      <div className="main">
        <Outlet />
      </div>
      <QuickSwitcher open={switcher} onClose={() => setSwitcher(false)} />
      <TaskDrawerHost />
      <Toasts />
    </div>
  );
}
