import { useSearchParams, Link } from 'react-router';
import { useOrders, useProfile } from '../api/hooks';
import type { IncidentStatus } from '../api/types';
import { QueryState } from '../components/QueryState';
import { StatusBadge } from '../components/StatusBadge';
import { RiskLabel } from '../components/RiskLabel';
import { EvaluateButton } from '../components/EvaluateButton';
import { Icon } from '../components/Icon';
import { formatTime, labels } from '../lib/display';

export function OrdersPage() {
  const query = useOrders();
  const profile = useProfile();
  const [params, setParams] = useSearchParams();
  const search = params.get('q') || '';
  const risk = params.get('risk') || '';
  const stage = params.get('stage') || '';
  const workflow = params.get('workflow') || '';
  function filter(key: string, value: string) {
    setParams((previous) => { const next = new URLSearchParams(previous); if (value) next.set(key, value); else next.delete(key); return next; }, { replace: true });
  }
  const orders = query.data?.items || [];
  const incidents = orders.flatMap((order) => order.incidents);
  const counts: Record<IncidentStatus, number> = { NEW: 0, IN_PROGRESS: 0, RESOLVED: 0 };
  for (const item of incidents) counts[item.status] += 1;
  const latest = orders.map((order) => order.assessed_at).filter((value): value is string => Boolean(value)).sort().at(-1);
  const filtered = orders.filter((order) => {
    const matchesText = `${order.order_number} ${order.customer_reference} ${order.store_code}`.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi'));
    const matchesRisk = !risk || (risk === 'RISK' || risk === 'DELAYED'
      ? order.risk_assessments.some((rule) => rule.status === 'AT_RISK' && rule.alert_type === risk)
      : order.risk_status === risk);
    return matchesText && matchesRisk && (!stage || order.delivery_status === stage)
      && (!workflow || order.incidents.some((incident) => incident.status === workflow));
  });
  const cards: { status: IncidentStatus; icon: 'alert' | 'clock' | 'check'; caption: string }[] = [
    { status: 'NEW', icon: 'alert', caption: 'Sự cố chờ tiếp nhận' },
    { status: 'IN_PROGRESS', icon: 'clock', caption: 'Sự cố đã có người phụ trách' },
    { status: 'RESOLVED', icon: 'check', caption: 'Sự cố đã ghi nhận giải quyết' },
  ];
  return <section>
    <div className="page-heading"><div><p className="eyebrow">TỔNG QUAN VẬN HÀNH</p><h1>Đơn hàng & sự cố</h1>
      <p className="muted">Theo dõi giao hàng, phát hiện rủi ro và phối hợp xử lý.</p></div><EvaluateButton /></div>
    <div className="stats-grid">{cards.map((card, index) => <button key={card.status}
      className={`stat-card stat-${index} ${workflow === card.status ? 'stat-selected' : ''}`}
      aria-pressed={workflow === card.status} onClick={() => filter('workflow', workflow === card.status ? '' : card.status)}>
      <div className="stat-top"><span>{labels[card.status]}</span><span className="stat-icon"><Icon name={card.icon} /></span></div>
      <strong>{query.data ? counts[card.status] : '—'}</strong><p>{card.caption}</p>
    </button>)}</div>
    {counts.NEW > 0 && <div className="new-incident-banner"><span className="banner-icon"><Icon name="bell" /></span>
      <div><strong>{counts.NEW} sự cố mới chờ tiếp nhận</strong><p>{profile.data?.role === 'STORE_STAFF' ? 'Logistics sẽ tiếp nhận. Bạn có thể bổ sung thông tin trong từng sự cố.' : 'Mở đơn hàng để xem chi tiết và nhận xử lý từng sự cố.'}</p></div>
      <button className="button button-small button-ghost" onClick={() => { setParams({ workflow: 'NEW' }); }}>Xem sự cố <Icon name="arrow" size={15} /></button>
    </div>}
    <div className="panel orders-panel">
      <div className="section-heading"><div><h2>Danh sách đơn hàng <span className="subtle-count">{orders.length}</span></h2>
        <p className="muted">{profile.data?.store_code ? `Cửa hàng ${profile.data.store_code}` : 'Tất cả cửa hàng trong phạm vi tài khoản'}</p></div>
        <div className="sync-state"><span className={`live-dot ${query.isFetching ? 'is-syncing' : ''}`} />Tự cập nhật mỗi 10 giây</div>
      </div>
      <div className="filters">
        <label className="search-field"><Icon name="search" size={18} /><span className="sr-only">Tìm đơn hàng</span><input type="search" value={search} onChange={(event) => filter('q', event.target.value)} placeholder="Tìm mã đơn, khách hàng, cửa hàng…" /></label>
        <label><span className="sr-only">Lọc cảnh báo</span><select value={risk} onChange={(event) => filter('risk', event.target.value)}>
          <option value="">Tất cả cảnh báo</option><option value="AT_RISK">Có cảnh báo</option><option value="RISK">Có nguy cơ</option><option value="DELAYED">Đã trễ</option><option value="UNKNOWN">Cần xác minh</option><option value="CLEAR">Không có cảnh báo</option><option value="NOT_CHECKED">Chưa kiểm tra</option>
        </select></label>
        <label><span className="sr-only">Lọc giai đoạn giao hàng</span><select value={stage} onChange={(event) => filter('stage', event.target.value)}>
          <option value="">Tất cả giai đoạn</option><option value="NOT_DISPATCHED">Chưa xuất giao</option><option value="DISPATCHED">Đang vận chuyển</option><option value="DELIVERED">Đã giao</option><option value="UNKNOWN">Cần xác minh</option>
        </select></label>
        {(search || risk || stage || workflow) && <button className="button button-ghost button-small" onClick={() => setParams({})}>Xóa bộ lọc</button>}
      </div>
      {workflow && <div className="active-filter">Sự cố: {labels[workflow] || workflow}<button className="icon-button" aria-label="Bỏ lọc sự cố" onClick={() => filter('workflow', '')}><Icon name="close" size={14} /></button></div>}
      <QueryState loading={query.isPending} error={query.error} retry={() => void query.refetch()} />
      {query.data && <>
        <div className="table-wrap"><table>
          <thead><tr><th>Đơn hàng</th><th>Cửa hàng</th><th>Giai đoạn</th><th>Hạn giao / Dự kiến đến khách</th><th>Cảnh báo hiện tại</th><th>Sự cố</th><th><span className="sr-only">Chi tiết</span></th></tr></thead>
          <tbody>{filtered.map((order) => <tr key={order.id}>
            <td><Link className="order-link" to={`/orders/${order.id}`}>{order.order_number}</Link><span className="table-secondary">{order.customer_reference}</span></td>
            <td><span className="store-code">{order.store_code}</span></td>
            <td><StatusBadge value={order.delivery_status} /><span className="table-secondary">Kho: {labels[order.warehouse_status]}</span></td>
            <td className="date-cell"><strong>{formatTime(order.original_delivery_due_at)}</strong><span className="table-secondary">Dự kiến đến khách: {formatTime(order.estimated_delivery_at)}</span></td>
            <td><RiskLabel order={order} /><span className="table-secondary">{order.assessed_at ? formatTime(order.assessed_at) : 'Chưa kiểm tra rủi ro'}</span></td>
            <td><span className={`incident-number ${order.incidents.some((item) => item.status === 'NEW') ? 'has-new' : ''}`}>{order.incidents.length}</span>
              <span className="table-secondary">{order.incidents.filter((item) => item.status !== 'RESOLVED').length} chưa xử lý xong</span></td>
            <td><Link className="row-arrow" to={`/orders/${order.id}`} aria-label={`Chi tiết đơn ${order.order_number}`}><Icon name="arrow" size={18} /></Link></td>
          </tr>)}</tbody>
        </table></div>
        {filtered.length === 0 && <div className="empty-state"><Icon name={orders.length ? 'search' : 'box'} size={36} /><h3>{orders.length ? 'Không tìm thấy đơn phù hợp' : 'Chưa có đơn hàng'}</h3><p>{orders.length ? 'Thử thay đổi từ khóa hoặc bộ lọc.' : 'Đơn hàng sẽ xuất hiện khi dữ liệu được bổ sung.'}</p></div>}
        <div className="table-footer"><span>Hiển thị {filtered.length} / {orders.length} đơn · Số đếm trên dashboard là số sự cố.</span><span>Kiểm tra gần nhất: {formatTime(latest)}</span></div>
      </>}
    </div>
  </section>;
}
