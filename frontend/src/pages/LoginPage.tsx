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
  if (loading) return <div className="full-page-loading" role="status"><span className="spinner" />Đang kiểm tra phiên đăng nhập…</div>;
  if (authenticated) return <Navigate to="/orders" replace />;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!supabase || pending) return;
    setPending(true); setError('');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) setError(error.code === 'invalid_credentials' ? 'Email hoặc mật khẩu chưa đúng.' : error.message);
    } catch { setError('Không thể kết nối dịch vụ đăng nhập. Vui lòng thử lại.'); }
    finally { setPending(false); }
  }
  return <div className="login-page"><aside className="login-story"><div className="brand"><span className="brand-symbol"><Icon name="box" size={26} /></span><span>netcom<span className="brand-subtitle">LOGISTICS WORKSPACE</span></span></div>
    <div className="login-story-content"><p className="eyebrow">KẾT NỐI VẬN HÀNH</p><h1>Theo sát từng đơn.<br />Phối hợp từng bước.</h1><p>Phát hiện rủi ro, tiếp nhận sự cố và cùng cửa hàng đưa đơn hàng đến khách.</p><div className="login-route"><span><Icon name="box" size={20} />Chuẩn bị</span><i /><span><Icon name="arrow" size={20} />Vận chuyển</span><i /><span><Icon name="check" size={20} />Hoàn tất</span></div></div>
    <span className="login-region">SWEDEN · LOGISTICS OPERATIONS</span>
  </aside><main className="login-main"><div className="login-theme-toggle"><ThemeToggle /></div><section className="login-card"><p className="eyebrow">CHÀO MỪNG BẠN TRỞ LẠI</p><h2>Đăng nhập workspace</h2><p className="muted">Sử dụng tài khoản logistics hoặc cửa hàng của bạn.</p>
    {authMessage && <p className="notice notice-warning" role="alert">{authMessage}</p>}
    {!supabase && <div className="notice notice-warning" role="alert">Dịch vụ đăng nhập chưa được cấu hình. Vui lòng liên hệ người quản lý workspace.</div>}
    <form onSubmit={submit}><label htmlFor="email">Email công việc</label><input id="email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={pending} placeholder="you@company.com" />
      <label htmlFor="password">Mật khẩu</label><input id="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={pending} placeholder="Nhập mật khẩu" />
      {error && <p role="alert" className="notice notice-error">{error}</p>}
      <button className="button button-primary login-submit" disabled={pending || !supabase}>{pending ? 'Đang đăng nhập…' : 'Đăng nhập'}<Icon name="arrow" size={18} /></button>
    </form><p className="login-help">Tài khoản được cấp bởi người quản lý hệ thống.</p>
  </section><span className="login-copyright">Netcom · Logistics workspace</span></main></div>;
}
