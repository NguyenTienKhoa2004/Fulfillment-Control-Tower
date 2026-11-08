import type { OrderSummary, RiskCode } from '../api/types';
import { assessmentFreshness, deliveryOutcome } from './display';

export const deliveryCheckLabels: Record<RiskCode, { title: string; question: string }> = {
  WAREHOUSE_NOT_READY_BEFORE_HANDOVER: {
    title: 'Warehouse readiness', question: 'Is the order ready before carrier handover?',
  },
  HANDOVER_OVERDUE: {
    title: 'Carrier handover', question: 'Has the order been handed over on schedule?',
  },
  DELIVERY_ETA_LATE: {
    title: 'Estimated delivery', question: 'Is the ETA within the original delivery promise?',
  },
  DELIVERY_OVERDUE: {
    title: 'Delivery deadline', question: 'Has the original delivery deadline been missed?',
  },
};

export function deliveryCheckResult(order: OrderSummary, code: RiskCode, now: number) {
  const rule = order.risk_assessments.find((item) => item.risk_code === code);
  const result = (label: string, tone: string, explanation: string, rank = 2) => ({
    code, ...deliveryCheckLabels[code], label, tone, explanation, rank,
    assessedAt: rule?.assessed_at,
    className: rank === 0 ? 'at_risk' : rank === 1 ? 'unknown' : 'clear',
  });
  const verify = (reason: string) => result('Needs verification', 'UNKNOWN', reason, 1);
  if (!rule) return result('Not assessed', 'NOT_CHECKED', 'Select “Check risks” to run this check.', 1);
  if (assessmentFreshness(order, now) !== 'fresh') {
    return verify('The assessment or source data is outdated or unverified. Verify source data and run the checks again.');
  }
  const assessed = Date.parse(rule.assessed_at);
  if (!Number.isFinite(assessed) || assessed > now || Date.parse(order.data_verified_at || '') > assessed) {
    return verify('The check does not match the latest verified data. Run the checks again.');
  }
  const dispatched = order.delivery_status === 'DISPATCHED';
  const delivered = order.delivery_status === 'DELIVERED';
  const preparing = order.delivery_status === 'NOT_DISPATCHED';
  const eta = Date.parse(order.estimated_delivery_at || '');
  const due = Date.parse(order.original_delivery_due_at || '');
  const handover = Date.parse(order.planned_handover_at || '');

  if (rule.status === 'UNKNOWN') {
    const actualDispatch = Date.parse(order.dispatched_at || '');
    if (code === 'DELIVERY_ETA_LATE' && dispatched && !order.estimated_delivery_at
      && Number.isFinite(due) && due > assessed && Number.isFinite(actualDispatch)
      && actualDispatch <= assessed && !order.delivered_at) {
      return result('ETA missing', 'UNKNOWN', 'The carrier has not provided an ETA. Confirm the estimate before assessing delivery risk.', 1);
    }
    return verify(rule.reason);
  }
  // Outcomes remain distinct from live alerts: a late completed delivery has
  // no active overdue rule, but must never be presented as an on-time delivery.
  if (delivered && code === 'DELIVERY_OVERDUE') {
    const outcome = deliveryOutcome(order);
    if (outcome === 'ON_TIME') return result('Delivered on time', 'CLEAR', 'Actual delivery was at or before the original promised deadline.');
    if (outcome === 'LATE') return result('Delivered late', 'DELAYED', 'Actual delivery was after the original promised deadline. This is the delivery outcome, not a new active alert.');
    return verify('Actual delivery timestamps or the original deadline are missing or inconsistent.');
  }
  if (code === 'WAREHOUSE_NOT_READY_BEFORE_HANDOVER' && (dispatched || delivered)) {
    return result('Not applicable', 'NEUTRAL', 'This readiness check applies before dispatch. The order has already been handed to the carrier.', 3);
  }
  if (code === 'HANDOVER_OVERDUE' && (dispatched || delivered)) {
    const actual = Date.parse(order.dispatched_at || '');
    return Number.isFinite(actual) && actual <= now
      ? result('Completed', 'CLEAR', 'Handover to the carrier is recorded. This confirms completion, not whether the historical handover was on time.')
      : verify('The actual carrier handover time needs confirmation.');
  }
  if (code === 'DELIVERY_ETA_LATE' && !dispatched) {
    return result('Not applicable', 'NEUTRAL', delivered
      ? 'Delivery is complete. Compare actual delivery with the promise under Delivery deadline.'
      : 'This ETA check applies while the order is in transit.', 3);
  }
  if (!preparing && !dispatched && !delivered) return verify('Confirm the delivery stage before interpreting this check.');
  if (rule.status === 'AT_RISK') {
    const alerts: Record<RiskCode, { label: string; tone: string }> = {
      WAREHOUSE_NOT_READY_BEFORE_HANDOVER: { label: 'Preparation at risk', tone: 'RISK' },
      HANDOVER_OVERDUE: { label: 'Handover overdue', tone: 'DELAYED' },
      DELIVERY_ETA_LATE: { label: 'Expected late', tone: 'RISK' },
      DELIVERY_OVERDUE: { label: 'Overdue', tone: 'DELAYED' },
    };
    const alert = alerts[code];
    return result(alert.label, alert.tone, rule.reason, 0);
  }
  if (code === 'WAREHOUSE_NOT_READY_BEFORE_HANDOVER') {
    return order.warehouse_status === 'READY'
      ? result('Ready', 'CLEAR', 'The latest verified warehouse status confirms that the order is ready for handover.')
      : result('Not applicable', 'NEUTRAL', 'Outside the configured pre-handover warning window at the last check. This does not mean the warehouse is ready.', 3);
  }
  if (code === 'HANDOVER_OVERDUE') {
    if (!Number.isFinite(handover)) return verify('Confirm the planned carrier handover time.');
    return handover >= now ? result('On schedule', 'CLEAR', 'The planned handover deadline has not passed. The order is still awaiting handover.')
      : verify('The handover deadline has passed since the last check. Run the checks again.');
  }
  if (code === 'DELIVERY_ETA_LATE') {
    if (!Number.isFinite(eta) || !Number.isFinite(due) || eta < now || eta > due) {
      return verify('Confirm the current ETA and original delivery promise, then run the checks again.');
    }
    return result('Within promise', 'CLEAR', 'The latest verified ETA is at or before the original promised delivery deadline.');
  }
  return Number.isFinite(due) && due >= now
    ? result('Not overdue', 'CLEAR', 'The original delivery deadline has not passed. This does not guarantee that delivery will be on time.')
    : verify('Confirm the delivery deadline and run the checks again.');
}
