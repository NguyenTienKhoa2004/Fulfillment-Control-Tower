import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Icon } from './Icon';

interface Toast { id: string; text: string; href?: string; }
const ToastContext = createContext<((text: string, href?: string) => void) | null>(null);

function ToastItem({ toast, dismiss }: { toast: Toast; dismiss: (id: string) => void }) {
  useEffect(() => {
    const timer = window.setTimeout(() => dismiss(toast.id), 8000);
    return () => window.clearTimeout(timer);
  }, [toast.id, dismiss]);
  return <div className="toast"><div className="toast-icon"><Icon name="bell" size={18} /></div>
    <div>{toast.href ? <Link to={toast.href} onClick={() => dismiss(toast.id)}>{toast.text}</Link> : toast.text}</div>
    <button className="icon-button" aria-label="Đóng thông báo" onClick={() => dismiss(toast.id)}><Icon name="close" size={16} /></button>
  </div>;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const notify = useCallback((text: string, href?: string) => {
    setToasts((previous) => [...previous.slice(-3), { id: crypto.randomUUID(), text, href }]);
  }, []);
  const dismiss = useCallback((id: string) => setToasts((items) => items.filter((item) => item.id !== id)), []);
  return <ToastContext.Provider value={notify}>{children}
    <div className="toast-region" role="status" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => <ToastItem key={toast.id} toast={toast} dismiss={dismiss} />)}
    </div>
  </ToastContext.Provider>;
}

export function useToast() {
  const notify = useContext(ToastContext);
  if (!notify) throw new Error('Thiếu ToastProvider.');
  return notify;
}
