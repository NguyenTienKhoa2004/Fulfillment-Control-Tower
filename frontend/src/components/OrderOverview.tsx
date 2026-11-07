import type { OrderDetail, Profile } from '../api/types';
import { assessmentFreshness, formatTime, labels, ruleLabels } from '../lib/display';
import { Icon } from './Icon';

export function OrderOverview({ order, profile }: { order: OrderDetail; profile?: Profile }) {
  const freshness = assessmentFreshness(order);
  const alerts = order.risk_assessments.filter((rule) => rule.status === 'AT_RISK');
  const primary = alerts.find((rule) => rule.alert_type === 'DELAYED') || alerts[0];
  const open = order.incidents.filter((incident) => incident.status !== 'RESOLVED');
  const next = open.find((incident) => profile?.role === 'LOGISTICS_COORDINATOR'
    && (incident.status === 'NEW' || incident.assignee_id === profile.id)) || open[0];
  const owners = [...new Set(open.map((incident) => incident.assignee_name).filter(Boolean))];
  const unassigned = open.filter((incident) => !incident.assignee_id).length;
  const difference = Date.parse(order.estimated_delivery_at || '') - Date.parse(order.original_delivery_due_at || '');
  const title = primary?.risk_code === 'DELIVERY_ETA_LATE' && difference > 0
    ? `Dự kiến giao trễ ${Math.ceil(difference / 60_000)} phút`
    : primary ? ruleLabels[primary.risk_code] : labels[order.risk_status];
  const claim = profile?.role === 'LOGISTICS_COORDINATOR' && next?.status === 'NEW';
  const resolve = profile?.role === 'LOGISTICS_COORDINATOR' && next?.status === 'IN_PROGRESS'
    && next.assignee_id === profile.id;
  const target = next ? claim ? `incident-${next.id}` : resolve ? `resolve-${next.id}` : `note-${next.id}` : '';
  return <section className={`order-overview overview-${primary?.alert_type === 'DELAYED' ? 'delayed' : primary ? 'risk' : 'neutral'}`} aria-labelledby="order-overview-title">
    <div className="overview-top">
      <span className="overview-icon"><Icon name={primary ? 'alert' : 'box'} size={24} /></span>
      <div className="overview-message"><p className="eyebrow">{freshness === 'stale' ? 'THEO LẦN KIỂM TRA GẦN NHẤT' : 'TỔNG QUAN ĐƠN HÀNG'}</p>
        <h2 id="order-overview-title">{title}</h2>
        <p>{open.length ? `${open.length} sự cố cần xử lý` : 'Không có sự cố đang mở'}
          {unassigned > 0 && ` · ${unassigned} chưa có người phụ trách`}
          {owners.length > 0 && ` · Phụ trách: ${owners.join(', ')}`}</p>
      </div>
      {next && profile && <a className="button button-primary" href={`#${target}`} onClick={() => {
        requestAnimationFrame(() => document.getElementById(target)?.focus({ preventScroll: true }));
      }}><Icon name={claim ? 'user' : resolve ? 'check' : 'message'} size={17} />
        {claim ? 'Nhận xử lý' : resolve ? 'Ghi nhận giải quyết' : 'Bổ sung thông tin'}<Icon name="arrow" size={16} /></a>}
    </div>
    <div className="overview-deadlines">
      <dl><dt>Hạn giao cam kết</dt><dd>{formatTime(order.original_delivery_due_at)}</dd></dl>
      <span className="deadline-arrow" aria-hidden="true"><Icon name="arrow" size={20} /></span>
      <dl><dt>{order.delivery_status === 'DELIVERED' ? 'Giao thực tế' : 'Dự kiến giao đến khách'}</dt><dd>{formatTime(order.delivery_status === 'DELIVERED' ? order.delivered_at : order.estimated_delivery_at)}</dd></dl>
      <div className="overview-timezone"><Icon name="clock" size={14} />Giờ Sweden · Europe/Stockholm</div>
    </div>
    {freshness === 'stale' && <div className="assessment-warning"><Icon name="clock" size={16} /><span><strong>Cần cập nhật đánh giá.</strong> Kết quả kiểm tra hoặc dữ liệu nguồn đã cũ / cần xác minh. {profile?.role === 'LOGISTICS_COORDINATOR' ? 'Xác minh dữ liệu nguồn và kiểm tra lại rủi ro.' : 'Nhờ logistics xác minh dữ liệu và kiểm tra lại rủi ro.'}</span></div>}
  </section>;
}
