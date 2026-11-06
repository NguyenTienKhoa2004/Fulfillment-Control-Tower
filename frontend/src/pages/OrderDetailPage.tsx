import { useEffect } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { useOrder, useProfile } from '../api/hooks';
import { QueryState } from '../components/QueryState';
import { StatusBadge } from '../components/StatusBadge';
import { RiskAssessmentPanel } from '../components/RiskAssessmentPanel';
import { IncidentCard } from '../components/IncidentCard';
import { Timeline } from '../components/Timeline';
import { EvaluateButton } from '../components/EvaluateButton';
import { Icon } from '../components/Icon';
import { deliveryOutcome, formatTime } from '../lib/display';

export function OrderDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const query = useOrder(id);
  const profile = useProfile();
  const order = query.data;
  const outcome = order ? deliveryOutcome(order) : null;
  const step = order?.delivery_status === 'DELIVERED' ? 2 : order?.delivery_status === 'DISPATCHED' ? 1 : order?.delivery_status === 'NOT_DISPATCHED' ? 0 : -1;
  useEffect(() => {
    if (query.data && location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [id, location.hash, Boolean(query.data)]);
  return <section>
    <Link className="back-link" to="/orders"><Icon name="back" size={16} />Danh sách đơn hàng</Link>
    <QueryState loading={query.isPending} error={query.error} retry={() => void query.refetch()} />
    {order && <>
      <div className="page-heading detail-heading"><div><p className="eyebrow">CHI TIẾT ĐƠN HÀNG · {order.store_code}</p><div className="detail-title-row"><h1>{order.order_number}</h1><StatusBadge value={order.delivery_status} /></div><p className="muted">{order.customer_reference}</p></div><EvaluateButton /></div>
      <div className="detail-body"><div className="detail-primary">
      {outcome && <div className={`notice ${outcome === 'LATE' ? 'notice-warning' : outcome === 'ON_TIME' ? 'notice-success' : 'notice-neutral'}`}>
        <Icon name={outcome === 'ON_TIME' ? 'check' : 'clock'} size={20} /><div><strong>{outcome === 'LATE' ? 'Đã giao trễ so với hạn cam kết ban đầu' : outcome === 'ON_TIME' ? 'Đã giao đúng hạn cam kết' : 'Chưa đủ dữ liệu để xác định giao đúng hạn hay trễ'}</strong>
          <p>{outcome === 'UNVERIFIED' ? 'Cần xác minh hạn giao và các mốc giao thực tế.' : `Giao thực tế: ${formatTime(order.delivered_at)} · Hạn cam kết: ${formatTime(order.original_delivery_due_at)}`}</p></div>
      </div>}
      <div className="panel delivery-panel"><div className="section-heading"><h2>Thông tin giao hàng</h2><span className="timezone-label"><Icon name="clock" size={14} />Europe/Stockholm</span></div>
        <ol className="delivery-progress">{['Chuẩn bị & bàn giao', 'Đang vận chuyển', 'Giao thành công'].map((title, index) => <li key={title} className={step >= index ? 'step-complete' : ''} aria-current={step === index ? 'step' : undefined}><span>{step > index ? <Icon name="check" size={14} /> : index + 1}</span>{title}</li>)}</ol>
        <dl className="delivery-fields">
          <div><dt>Dự kiến giao cho vận chuyển</dt><dd>{formatTime(order.planned_handover_at)}</dd></div>
          <div><dt>Hạn giao cam kết ban đầu</dt><dd className="due-value">{formatTime(order.original_delivery_due_at)}</dd></div>
          <div><dt>Dự kiến giao đến khách</dt><dd>{formatTime(order.estimated_delivery_at)}</dd></div>
          <div><dt>Đã giao cho vận chuyển lúc</dt><dd>{formatTime(order.dispatched_at)}</dd></div>
          <div><dt>Giao thực tế</dt><dd>{formatTime(order.delivered_at)}</dd></div>
          <div><dt>Trạng thái kho</dt><dd><StatusBadge value={order.warehouse_status} /></dd></div>
        </dl>
        <div className="data-verification"><span>Dữ liệu xác minh lúc: <strong>{formatTime(order.data_verified_at)}</strong></span><span>Hạn cam kết được giữ nguyên khi giờ giao dự kiến thay đổi.</span></div>
      </div>
      <div className="detail-incidents"><div className="section-heading incident-section-heading"><div><h2>Hồ sơ sự cố <span className="subtle-count">{order.incidents.length}</span></h2><p className="muted">Mỗi sự cố có người phụ trách và tiến độ riêng.</p></div></div>
        <QueryState loading={profile.isPending} error={profile.error} retry={() => void profile.refetch()} />
        {order.incidents.length === 0 && <div className="panel empty-state"><Icon name="check" size={32} /><h3>Chưa có sự cố được ghi nhận</h3><p>Kết quả đánh giá và hồ sơ xử lý được theo dõi riêng.</p></div>}
        {profile.data && order.incidents.map((incident) => <IncidentCard key={incident.id} incident={incident} profile={profile.data!} events={order.timeline.filter((event) => event.incident_id === incident.id)} />)}
      </div></div>
      <aside className="detail-risk"><RiskAssessmentPanel key={order.id} order={order} /></aside>
      <aside className="detail-history">{profile.data && <Timeline events={order.timeline} incidents={order.incidents} profile={profile.data} />}</aside>
      </div>
    </>}
  </section>;
}
