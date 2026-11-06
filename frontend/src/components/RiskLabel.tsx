import type { OrderSummary } from '../api/types';
import { orderAlert } from '../lib/display';
import { StatusBadge } from './StatusBadge';

export function RiskLabel({ order }: { order: OrderSummary }) {
  const alerts = [...new Set(order.risk_assessments.filter((rule) => rule.status === 'AT_RISK')
    .map((rule) => rule.alert_type).filter((value): value is 'RISK' | 'DELAYED' => Boolean(value)))];
  return <span className="badge-group">{order.risk_status === 'AT_RISK' && alerts.length
    ? alerts.map((value) => <StatusBadge key={value} value={value} />)
    : <StatusBadge value={orderAlert(order)} />}</span>;
}
