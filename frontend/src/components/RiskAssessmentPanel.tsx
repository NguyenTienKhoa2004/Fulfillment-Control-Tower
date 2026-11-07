import type { OrderDetail } from '../api/types';
import { assessmentFreshness, formatTime, ruleLabels } from '../lib/display';
import { RiskLabel } from './RiskLabel';
import { StatusBadge } from './StatusBadge';

export function RiskAssessmentPanel({ order }: { order: OrderDetail }) {
  const stale = assessmentFreshness(order) === 'stale';
  return <section className="panel risk-overview" aria-labelledby="risk-overview-title">
    <div className="risk-overview-heading">
      <div className="risk-overview-title"><h2 id="risk-overview-title">Kết quả kiểm tra</h2><RiskLabel order={order} /></div>
      <span className="risk-overview-time">Kiểm tra: {formatTime(order.assessed_at)}</span>
      {stale && <span className="assessment-stale"><span className="badge-dot" />Cần xác minh lại dữ liệu</span>}
    </div>
    {order.risk_assessments.length === 0
      ? <p className="risk-overview-empty">Chưa có đánh giá. Logistics bấm “Kiểm tra rủi ro” để cập nhật.</p>
      : <div className="risk-checks">{[...order.risk_assessments].sort((a, b) => ({ AT_RISK: 0, UNKNOWN: 1, CLEAR: 2 }[a.status] - { AT_RISK: 0, UNKNOWN: 1, CLEAR: 2 }[b.status])).map((rule) => <details
        className={`risk-check risk-check-${rule.status.toLowerCase()}`} key={rule.risk_code}>
        <summary>
          <span className="risk-check-title">{ruleLabels[rule.risk_code]}</span>
          <StatusBadge value={rule.status === 'AT_RISK' ? rule.alert_type || 'AT_RISK' : rule.status} />
          <span className="risk-check-toggle" aria-hidden="true" />
          <span className="sr-only"> — Mở hoặc thu gọn lý do đánh giá</span>
        </summary>
        <div className="risk-check-reason"><p>{rule.reason}</p><time dateTime={rule.assessed_at}>{formatTime(rule.assessed_at)}</time></div>
      </details>)}</div>}
  </section>;
}
