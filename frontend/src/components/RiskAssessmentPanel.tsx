import type { OrderDetail } from '../api/types';
import { assessmentFreshness, formatTime } from '../lib/display';
import { deliveryCheckLabels, deliveryCheckResult } from '../lib/deliveryChecks';
import type { RiskCode } from '../api/types';
import { RiskLabel } from './RiskLabel';
import { StatusBadge } from './StatusBadge';

export function RiskAssessmentPanel({ order }: { order: OrderDetail }) {
  const now = Date.now();
  const stale = assessmentFreshness(order, now) === 'stale';
  const checks = (Object.keys(deliveryCheckLabels) as RiskCode[])
    .map((code) => deliveryCheckResult(order, code, now)).sort((a, b) => a.rank - b.rank);
  const needsReview = checks.some((check) => check.rank === 1);
  const hasAlerts = checks.some((check) => check.rank === 0);
  return <section className="panel risk-overview" aria-labelledby="risk-overview-title">
    <div className="risk-overview-heading">
      <div className="risk-overview-title"><h2 id="risk-overview-title">Delivery checks</h2>
        {!order.assessed_at ? <StatusBadge value="NOT_CHECKED" /> : <span className="badge-group">
          {hasAlerts && <RiskLabel order={order} />}
          {needsReview && <StatusBadge value="UNKNOWN" />}
          {!hasAlerts && !needsReview && (order.delivery_status === 'DELIVERED'
            ? <StatusBadge value="DELIVERED" label="Completed" /> : <RiskLabel order={order} />)}
        </span>}
      </div>
      <p className="delivery-check-description">{order.delivery_status === 'DELIVERED'
        ? 'Completed order: actual delivery performance is shown below.' : 'Readiness, handover and delivery timing.'}</p>
      <span className="risk-overview-time">Last checked: {formatTime(order.assessed_at)}</span>
      {stale && <span className="assessment-stale">Verify source data and run the checks again.</span>}
    </div>
    {order.risk_assessments.length === 0
      ? <p className="risk-overview-empty">No checks yet. Logistics can select “Check risks” to update.</p>
      : <div className="risk-checks">{checks.map((check) => <details
        className={`risk-check risk-check-${check.className}`} key={check.code}>
        <summary>
          <span className="risk-check-title">{check.title}</span>
          <StatusBadge value={check.tone} label={check.label} />
          <span className="risk-check-toggle" aria-hidden="true" />
          <span className="sr-only"> — Expand or collapse the check explanation</span>
        </summary>
        <div className="risk-check-reason"><p className="delivery-check-question">{check.question}</p><p>{check.explanation}</p>
          {check.assessedAt && <time dateTime={check.assessedAt}>Last checked: {formatTime(check.assessedAt)}</time>}</div>
      </details>)}</div>}
  </section>;
}
