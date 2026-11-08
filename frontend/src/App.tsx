import { useState } from 'react';
import { Navigate, Outlet, Route, Routes, Link } from 'react-router';
import { useProfile } from './api/hooks';
import { errorMessage } from './api/errors';
import { useAuth } from './auth/AuthProvider';
import { isMock } from './auth/supabase';
import { LoginPage } from './pages/LoginPage';
import { OrdersPage } from './pages/OrdersPage';
import { OrderDetailPage } from './pages/OrderDetailPage';
import { ActivityMenu } from './components/ActivityMenu';
import { ToastProvider } from './components/ToastProvider';
import { Icon } from './components/Icon';
import { ThemeToggle } from './components/ThemeProvider';
import { labels } from './lib/display';

function Workspace() {
  const { signOut } = useAuth();
  const [error, setError] = useState('');
  const [leaving, setLeaving] = useState(false);
  const profile = useProfile();
  async function logout() {
    setLeaving(true); setError('');
    try { await signOut(); } catch (cause) { setError(errorMessage(cause)); } finally { setLeaving(false); }
  }
  const initials = profile.data?.display_name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase() || 'NC';
  return <ToastProvider><div className="app-shell">
    <aside className="sidebar"><Link to="/orders" className="brand compact-brand"><span>Order Fulfillment<span className="brand-title-line">Tower</span></span></Link>
      <div className="sidebar-section-label">OPERATIONS</div><nav aria-label="Main navigation"><Link to="/orders" className="nav-link nav-active"><Icon name="grid" size={19} />Order Monitoring</Link></nav>
      <div className="sidebar-bottom"><div className="sidebar-region">Vietnam time (UTC+7)</div></div>
    </aside>
    <div className="workspace"><header className="topbar"><div className="workspace-title"><span className="mobile-brand">netcom / </span>Operations workspace <span className="workspace-tag">SE</span></div>
      <div className="topbar-actions"><ThemeToggle /><ActivityMenu /><div className="account"><span className="avatar">{initials}</span><div><strong>{profile.data?.display_name || 'Account'}</strong><span>{profile.data ? labels[profile.data.role] : 'Loading…'}{profile.data?.store_code ? ` · ${profile.data.store_code}` : ''}</span></div></div>
        {!isMock && <button className="icon-button logout-button" aria-label={leaving ? 'Signing out' : 'Sign out'} title="Sign out" disabled={leaving} onClick={() => void logout()}><Icon name="logout" size={19} /></button>}
      </div></header>
      {isMock && <div className="mock-banner"><strong>Demo mode</strong><span>Changes are saved for this session only. Reload to restore demo data.</span></div>}
      {error && <div className="notice notice-error shell-notice" role="alert">{error}</div>}
      {profile.error && <div className="notice notice-error shell-notice" role="alert"><span>{errorMessage(profile.error)}</span><button className="button button-small button-ghost" onClick={() => void profile.refetch()}>Reload account</button></div>}
      <main className="main-content"><Outlet /></main>
      <footer className="workspace-footer"><span>NETCOM · LOGISTICS OPERATIONS</span><span>Vietnam time (UTC+7)</span></footer>
    </div>
  </div></ToastProvider>;
}

function ProtectedLayout() {
  const { authenticated, loading, userId } = useAuth();
  if (loading) return <div className="full-page-loading" role="status"><span className="spinner" />Checking your session…</div>;
  if (!authenticated) return <Navigate to="/login" replace />;
  return <Workspace key={userId} />;
}

export default function App() {
  return <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route element={<ProtectedLayout />}>
      <Route path="/orders" element={<OrdersPage />} />
      <Route path="/orders/:id" element={<OrderDetailPage />} />
    </Route>
    <Route path="/" element={<Navigate to="/orders" replace />} />
    <Route path="*" element={<div className="not-found"><p className="eyebrow">404</p><h1>Page not found</h1><p className="muted">The address may have changed.</p><Link className="button button-primary" to="/orders">Back to orders</Link></div>} />
  </Routes>;
}
