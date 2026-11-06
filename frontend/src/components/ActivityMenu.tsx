import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { useActivity, useOrders } from '../api/hooks';
import { errorMessage } from '../api/errors';
import { formatTime, labels, ruleLabels } from '../lib/display';
import { Icon } from './Icon';
import { useToast } from './ToastProvider';

export function ActivityMenu() {
  const query = useActivity();
  const orders = useOrders();
  const notify = useToast();
  const seen = useRef<Set<string> | null>(null);
  const details = useRef<HTMLDetailsElement>(null);
  const count = orders.data?.items.flatMap((order) => order.incidents).filter((item) => item.status === 'NEW').length || 0;

  useEffect(() => {
    if (!query.data) return;
    const items = query.data.items;
    if (!seen.current) { seen.current = new Set(items.map((item) => item.id)); return; }
    const fresh = items.filter((item) => !seen.current!.has(item.id));
    for (const item of items) seen.current.add(item.id);
    for (const item of fresh.slice(0, 3).reverse()) {
      notify(`${item.order_number} · ${labels[item.type]}: ${item.text}`, `/orders/${item.order_id}#incident-${item.incident_id}`);
    }
  }, [query.data, notify]);

  useEffect(() => {
    function outside(event: PointerEvent) {
      if (details.current && !details.current.contains(event.target as Node)) details.current.open = false;
    }
    function escape(event: KeyboardEvent) { if (event.key === 'Escape' && details.current) details.current.open = false; }
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, []);

  return <details className="activity-menu" ref={details}>
    <summary className="activity-toggle" aria-label={`Hoạt động gần đây, ${count} sự cố mới`}>
      <Icon name="bell" /><span className="activity-label">Hoạt động</span><span className="count-bubble">{count}</span>
    </summary>
    <div className="activity-dropdown">
      <div className="dropdown-heading"><div><strong>Hoạt động gần đây</strong><p className="muted">20 cập nhật mới nhất</p></div><span className="live-dot" aria-label="Tự cập nhật" /></div>
      {query.isPending && <p className="dropdown-empty">Đang tải…</p>}
      {query.error && <div className="dropdown-empty error" role="alert">{errorMessage(query.error)}
        <button className="button button-small button-ghost" onClick={() => void query.refetch()}>Thử lại</button></div>}
      {query.data?.items.length === 0 && <div className="dropdown-empty"><Icon name="bell" size={28} /><p>Chưa có hoạt động.</p></div>}
      <div className="activity-list">{query.data?.items.map((event) => <Link key={event.id}
        to={`/orders/${event.order_id}#incident-${event.incident_id}`} onClick={() => { if (details.current) details.current.open = false; }}>
        <div className={`event-marker event-${event.type.toLowerCase()}`}><Icon name={event.type === 'NOTE_ADDED' ? 'message' : event.type === 'DETECTED' ? 'alert' : 'check'} size={16} /></div>
        <div><div className="activity-title">{event.order_number}<span>{formatTime(event.created_at)}</span></div>
          <p>{labels[event.type]} · {ruleLabels[event.risk_code]}</p><p className="muted activity-text">{event.text}</p></div>
      </Link>)}</div>
    </div>
  </details>;
}
