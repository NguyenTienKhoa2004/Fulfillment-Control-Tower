import { useSearchParams, Link } from 'react-router';
import { useOrders, useProfile } from '../api/hooks';
import type { IncidentStatus, OrderSummary } from '../api/types';
import { QueryState } from '../components/QueryState';
import { StatusBadge } from '../components/StatusBadge';
import { RiskLabel } from '../components/RiskLabel';
import { EvaluateButton } from '../components/EvaluateButton';
import { Icon } from '../components/Icon';
import { assessmentFreshness, formatTime, labels, orderAlert } from '../lib/display';

function needsAttention(order: OrderSummary) {
  return order.incidents.some((incident) => incident.status !== 'RESOLVED')
    || ['AT_RISK', 'UNKNOWN', 'NOT_CHECKED'].includes(order.risk_status)
    || (order.delivery_status !== 'DELIVERED' && assessmentFreshness(order) === 'stale');
}

function priority(order: OrderSummary) {
  const alert = orderAlert(order);
  if (alert === 'DELAYED') return 0;
  if (alert === 'RISK') return 1;
  if (alert === 'UNKNOWN' || (order.delivery_status !== 'DELIVERED' && assessmentFreshness(order) === 'stale')) return 2;
  if (alert === 'NOT_CHECKED') return 3;
  return 4;
}

function assessmentExplanation(order: OrderSummary) {
  if (!order.assessed_at) return 'Logistics chưa kiểm tra rủi ro.';
  return order.risk_reason || order.risk_assessments.find((rule) => rule.status !== 'CLEAR')?.reason
    || 'Không có cảnh báo ở lần kiểm tra này.';
}

function OrderRow({ order, showStore }: { order: OrderSummary; showStore: boolean }) {
  const open = order.incidents.filter((incident) => incident.status !== 'RESOLVED');
  const waiting = open.filter((incident) => incident.status === 'NEW').length;
  const progress = open.filter((incident) => incident.status === 'IN_PROGRESS').length;
  const owners = [...new Set(open.map((incident) => incident.assignee_name).filter(Boolean))];
  const freshness = assessmentFreshness(order);
  const explanation = assessmentExplanation(order);
  const alert = orderAlert(order);
  return <tr className={alert === 'DELAYED' ? 'order-row-delayed' : alert === 'RISK' ? 'order-row-risk' : ''}>
    <td><Link className="order-link" to={`/orders/${order.id}`}>{order.order_number}</Link><span className="table-secondary customer-reference">{order.customer_reference}</span></td>
    {showStore && <td><span className="store-code">{order.store_code}</span></td>}
    <td><StatusBadge value={order.delivery_status} />{order.delivery_status === 'NOT_DISPATCHED' && <span className="table-secondary">Kho: {labels[order.warehouse_status]}</span>}</td>
    <td className="date-cell"><strong>{formatTime(order.original_delivery_due_at)}</strong>
      <span className="table-secondary">{order.delivery_status === 'DELIVERED' ? `Đã giao: ${formatTime(order.delivered_at)}` : `Dự kiến: ${formatTime(order.estimated_delivery_at)}`}</span></td>
    <td className="assessment-cell"><RiskLabel order={order} />
      {freshness === 'stale' && <span className="data-age-label"><Icon name="clock" size={12} />Kết quả hoặc dữ liệu nguồn đã cũ</span>}
      <span className="table-secondary assessment-explanation" title={explanation}>{explanation}</span>
      {order.assessed_at && <span className="assessment-time">Kiểm tra: {formatTime(order.assessed_at)}</span>}</td>
    <td className="workflow-cell">
      {open.length > 0 ? <>
        <span className="workflow-total">{order.incidents.length} sự cố</span>
        <div className="workflow-counts">{waiting > 0 && <span className="workflow-waiting">{waiting} chờ nhận</span>}{progress > 0 && <span className="workflow-progress">{progress} đang xử lý</span>}</div>
        <span className="table-secondary">{owners.length > 0 ? `Phụ trách: ${owners.join(', ')}` : 'Chưa có người phụ trách'}</span>
        {owners.length > 0 && waiting > 0 && <span className="table-secondary">{waiting} sự cố chưa có người phụ trách</span>}
      </> : <><span className="workflow-complete">{order.incidents.length ? 'Đã xử lý tất cả' : 'Chưa có sự cố'}</span><span className="table-secondary">{order.incidents.length} sự cố đã ghi nhận</span></>}
    </td>
    <td><Link className="order-detail-link" to={`/orders/${order.id}`} aria-label={`Xem chi tiết đơn ${order.order_number}`}>Chi tiết<Icon name="arrow" size={16} /></Link></td>
  </tr>;
}

export function OrdersPage() {
  const query = useOrders();
  const profile = useProfile();
  const [params, setParams] = useSearchParams();
  const search = params.get('q') || '';
  const risk = params.get('risk') || '';
  const stage = params.get('stage') || '';
  const workflow = params.get('workflow') || '';
  const attention = params.get('view') === 'attention';
  const sort = params.get('sort') || 'priority';
  const showStore = profile.data?.role !== 'STORE_STAFF';
  function filter(key: string, value: string) {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (value) next.set(key, value); else next.delete(key);
      return next;
    }, { replace: true });
  }
  function clearFilters() {
    setParams(sort === 'priority' ? {} : { sort }, { replace: true });
  }
  const orders = query.data?.items || [];
  const incidents = orders.flatMap((order) => order.incidents);
  const counts: Record<IncidentStatus, number> = { NEW: 0, IN_PROGRESS: 0, RESOLVED: 0 };
  for (const item of incidents) counts[item.status] += 1;
  const attentionCount = orders.filter(needsAttention).length;
  const staleCount = orders.filter((order) => order.delivery_status !== 'DELIVERED' && assessmentFreshness(order) === 'stale').length;
  const latest = orders.map((order) => order.assessed_at).filter((value): value is string => Boolean(value))
    .sort((a, b) => Date.parse(a) - Date.parse(b)).at(-1);
  const filtered = orders.filter((order) => {
    const matchesText = `${order.order_number} ${order.customer_reference} ${order.store_code}`.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi'));
    const matchesRisk = !risk || (risk === 'RISK' || risk === 'DELAYED'
      ? order.risk_assessments.some((rule) => rule.status === 'AT_RISK' && rule.alert_type === risk)
      : order.risk_status === risk);
    return matchesText && matchesRisk && (!stage || order.delivery_status === stage)
      && (!workflow || order.incidents.some((incident) => incident.status === workflow))
      && (!attention || needsAttention(order));
  }).sort((a, b) => {
    if (sort === 'number') return a.order_number.localeCompare(b.order_number);
    if (sort === 'due') {
      const dueA = Date.parse(a.original_delivery_due_at || '');
      const dueB = Date.parse(b.original_delivery_due_at || '');
      const difference = (Number.isFinite(dueA) ? dueA : Infinity) - (Number.isFinite(dueB) ? dueB : Infinity);
      if (difference) return difference;
    } else {
      const difference = priority(a) - priority(b)
        || Number(b.incidents.some((item) => item.status !== 'RESOLVED')) - Number(a.incidents.some((item) => item.status !== 'RESOLVED'));
      if (difference) return difference;
    }
    return a.order_number.localeCompare(b.order_number);
  });
  const hasFilters = Boolean(search || risk || stage || workflow || attention);
  const cards: { status: IncidentStatus; icon: 'alert' | 'clock' | 'check'; title: string }[] = [
    { status: 'NEW', icon: 'alert', title: 'Chờ tiếp nhận' },
    { status: 'IN_PROGRESS', icon: 'clock', title: 'Đang xử lý' },
    { status: 'RESOLVED', icon: 'check', title: 'Đã xử lý' },
  ];
  return <section className="orders-page">
    <div className="page-heading"><div><p className="eyebrow">TỔNG QUAN VẬN HÀNH</p><h1>Đơn hàng & sự cố</h1>
      <p className="muted">{profile.data?.store_code ? `Cửa hàng ${profile.data.store_code} · ` : ''}{profile.data?.role === 'STORE_STAFF' ? 'Theo dõi sự cố và bổ sung thông tin cho logistics.' : 'Ưu tiên đơn có vấn đề, tiếp nhận và theo dõi xử lý.'}</p></div><EvaluateButton /></div>
    <div className="stats-grid" aria-label="Thống kê sự cố — bấm để lọc đơn hàng">{cards.map((card, index) => <button key={card.status}
      className={`stat-card stat-${index} ${workflow === card.status ? 'stat-selected' : ''}`}
      aria-label={`${card.title}: ${query.data ? counts[card.status] : 'đang tải'} sự cố. Lọc đơn có sự cố ${card.title.toLocaleLowerCase('vi')}.`}
      aria-pressed={workflow === card.status} onClick={() => filter('workflow', workflow === card.status ? '' : card.status)}>
      <span className="stat-icon"><Icon name={card.icon} /></span><div><span className="stat-title">{card.title}</span>
        <p className="stat-value"><strong>{query.data ? counts[card.status] : '—'}</strong><span>sự cố</span></p></div>
      <Icon name="arrow" size={17} />
    </button>)}</div>
    <div className="panel orders-panel">
      <div className="section-heading"><div><h2>Danh sách đơn hàng <span className="subtle-count">{query.data ? orders.length : '—'}</span></h2>
        <p className="muted">{profile.data?.store_code ? `Phạm vi: ${profile.data.store_code}` : 'Tất cả cửa hàng trong phạm vi tài khoản'} · Thời gian Europe/Stockholm</p></div>
        <div className="sync-state"><span className={`live-dot ${query.isFetching ? 'is-syncing' : ''}`} />Tự cập nhật mỗi 10 giây</div>
      </div>
      <div className="orders-list-toolbar">
        <div className="order-views" role="group" aria-label="Phạm vi danh sách">
          <button aria-pressed={!attention} onClick={() => filter('view', '')}>Tất cả <span>{query.data ? orders.length : '—'}</span></button>
          <button aria-pressed={attention} onClick={() => filter('view', 'attention')}>Cần xử lý <span>{query.data ? attentionCount : '—'}</span></button>
        </div>
        <label className="orders-sort"><span>Sắp xếp</span><select value={sort} onChange={(event) => filter('sort', event.target.value)}>
          <option value="priority">Mức độ ưu tiên</option><option value="due">Hạn giao sớm nhất</option><option value="number">Mã đơn hàng</option>
        </select></label>
      </div>
      <div className="filters">
        <label className="search-field"><Icon name="search" size={18} /><span className="sr-only">Tìm đơn hàng</span><input type="search" value={search} onChange={(event) => filter('q', event.target.value)} placeholder={showStore ? 'Tìm mã đơn, khách hàng, cửa hàng…' : 'Tìm mã đơn hoặc khách hàng…'} /></label>
        <label className="orders-select"><span>Kết quả kiểm tra</span><select value={risk} onChange={(event) => filter('risk', event.target.value)}>
          <option value="">Tất cả kết quả</option><option value="AT_RISK">Có cảnh báo</option><option value="RISK">Có nguy cơ</option><option value="DELAYED">Đã trễ</option><option value="UNKNOWN">Cần xác minh</option><option value="CLEAR">Không có cảnh báo</option><option value="NOT_CHECKED">Chưa kiểm tra</option>
        </select></label>
        <label className="orders-select"><span>Giai đoạn giao hàng</span><select value={stage} onChange={(event) => filter('stage', event.target.value)}>
          <option value="">Tất cả giai đoạn</option><option value="NOT_DISPATCHED">Chưa xuất giao</option><option value="DISPATCHED">Đang vận chuyển</option><option value="DELIVERED">Đã giao</option><option value="UNKNOWN">Cần xác minh</option>
        </select></label>
      </div>
      <div className="orders-list-context">
        <span aria-live="polite">{query.data ? `${filtered.length} / ${orders.length} đơn` : 'Đang tải danh sách…'}{sort === 'priority' && ' · Đã trễ → Có nguy cơ → Cần xác minh'}</span>
        {hasFilters && <button className="clear-order-filters" onClick={clearFilters}><Icon name="close" size={14} />Xóa bộ lọc</button>}
      </div>
      {workflow && <div className="active-filter">Có sự cố: {labels[workflow] || workflow}<button className="icon-button" aria-label="Bỏ lọc sự cố" onClick={() => filter('workflow', '')}><Icon name="close" size={14} /></button></div>}
      {staleCount > 0 && <div className="orders-data-notice"><Icon name="clock" size={16} /><p><strong>{staleCount} đơn cần cập nhật dữ liệu.</strong> {profile.data?.role === 'STORE_STAFF' ? 'Nhờ logistics xác minh dữ liệu và kiểm tra lại rủi ro.' : 'Xác minh dữ liệu nguồn trước khi kiểm tra lại rủi ro.'}</p></div>}
      <QueryState loading={query.isPending} error={query.error} retry={() => void query.refetch()} />
      {query.data && <>
        <p className="table-scroll-hint"><Icon name="arrow" size={14} />Cuộn ngang bảng để xem kết quả kiểm tra và tiến độ sự cố.</p>
        <div className="table-wrap" role="region" aria-label="Bảng đơn hàng, cuộn ngang để xem thêm trên màn hình nhỏ" tabIndex={0}><table>
          <thead><tr><th scope="col">Đơn hàng</th>{showStore && <th scope="col">Cửa hàng</th>}<th scope="col">Giai đoạn</th><th scope="col">Hạn giao cam kết / Dự kiến</th><th scope="col">Kết quả kiểm tra</th><th scope="col">Tiến độ sự cố</th><th scope="col"><span className="sr-only">Chi tiết</span></th></tr></thead>
          <tbody>{filtered.map((order) => <OrderRow key={order.id} order={order} showStore={showStore} />)}</tbody>
        </table></div>
        {filtered.length === 0 && <div className="empty-state"><Icon name={orders.length ? 'search' : 'box'} size={36} /><h3>{orders.length ? 'Không tìm thấy đơn phù hợp' : 'Chưa có đơn hàng'}</h3><p>{orders.length ? 'Thử thay đổi từ khóa hoặc bộ lọc.' : 'Đơn hàng sẽ xuất hiện khi dữ liệu được bổ sung.'}</p>{hasFilters && <button className="button button-secondary button-small" onClick={clearFilters}>Xóa bộ lọc</button>}</div>}
        <div className="table-footer"><span>Thống kê phía trên đếm sự cố; một đơn có thể có nhiều sự cố.</span><span>Kiểm tra gần nhất: {formatTime(latest)}</span></div>
      </>}
    </div>
  </section>;
}
