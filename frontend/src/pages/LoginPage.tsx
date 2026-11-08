import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../auth/supabase';
import { Icon } from '../components/Icon';
import { ThemeToggle } from '../components/ThemeProvider';

export function LoginPage() {
  const { authenticated, loading, authMessage } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  if (loading) return <div className="full-page-loading" role="status"><span className="spinner" />Checking your session…</div>;
  if (authenticated) return <Navigate to="/orders" replace />;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!supabase || pending) return;
    setPending(true); setError('');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) setError(error.code === 'invalid_credentials' ? 'Incorrect email or password.' : error.message);
    } catch { setError('Cannot connect to the sign-in service. Please try again.'); }
    finally { setPending(false); }
  }
  return <div className="login-page"><aside className="login-story"><div className="brand"><span className="brand-symbol"><Icon name="box" size={26} /></span><span>netcom<span className="brand-subtitle">LOGISTICS WORKSPACE</span></span></div>
    <div className="login-story-content"><p className="eyebrow">CONNECTED OPERATIONS</p><h1>Track every order.<br />Coordinate every step.</h1><p>Identify risks, take ownership of incidents, and work with stores to deliver every order.</p><div className="login-route"><span><Icon name="box" size={20} />Preparation</span><i /><span><Icon name="arrow" size={20} />Shipping</span><i /><span><Icon name="check" size={20} />Complete</span></div></div>
    <span className="login-region">SWEDEN · LOGISTICS OPERATIONS</span>
  </aside><main className="login-main"><div className="login-theme-toggle"><ThemeToggle /></div><section className="login-card"><p className="eyebrow">WELCOME BACK</p><h2>Sign in to your workspace</h2><p className="muted">Use your logistics or store account.</p>
    {authMessage && <p className="notice notice-warning" role="alert">{authMessage}</p>}
    {!supabase && <div className="notice notice-warning" role="alert">Sign-in is not configured. Please contact your workspace administrator.</div>}
    <form onSubmit={submit}><label htmlFor="email">Work email</label><input id="email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={pending} placeholder="you@company.com" />
      <label htmlFor="password">Password</label><input id="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={pending} placeholder="Enter your password" />
      {error && <p role="alert" className="notice notice-error">{error}</p>}
      <button className="button button-primary login-submit" disabled={pending || !supabase}>{pending ? 'Signing in…' : 'Sign in'}<Icon name="arrow" size={18} /></button>
    </form><p className="login-help">Accounts are provided by your system administrator.</p>
  </section><span className="login-copyright">Netcom · Logistics workspace</span></main></div>;
}
