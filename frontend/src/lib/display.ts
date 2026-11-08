import type { OrderSummary, RiskCode } from '../api/types';

export const ruleLabels: Record<RiskCode, string> = {
  WAREHOUSE_NOT_READY_BEFORE_HANDOVER: 'Warehouse not ready',
  HANDOVER_OVERDUE: 'Handover overdue',
  DELIVERY_ETA_LATE: 'Delivery expected late',
  DELIVERY_OVERDUE: 'Delivery overdue',
};

export const labels: Record<string, string> = {
  NOT_DISPATCHED: 'Not dispatched', DISPATCHED: 'In transit', DELIVERED: 'Delivered',
  NOT_READY: 'Not ready', READY: 'Ready', UNKNOWN: 'Needs verification',
  NOT_CHECKED: 'Not assessed', AT_RISK: 'Alerts detected', CLEAR: 'No alerts',
  NEW: 'New', IN_PROGRESS: 'In progress', RESOLVED: 'Resolved',
  RISK: 'At risk', DELAYED: 'Delayed',
  DETECTED: 'Incident detected', ACCEPTED: 'Ownership taken', NOTE_ADDED: 'Note added',
  LOGISTICS_COORDINATOR: 'Logistics coordinator', STORE_STAFF: 'Store staff',
};

const formatter = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh',
});

export function formatTime(value: string | null | undefined): string {
  if (!value || Number.isNaN(Date.parse(value))) return 'No data';
  return formatter.format(new Date(value));
}

export function toVietnamDateTimeInput(value: string | null): string {
  const timestamp = Date.parse(value || '');
  return Number.isFinite(timestamp)
    ? new Date(timestamp + 7 * 3_600_000).toISOString().slice(0, 16) : '';
}

export function fromVietnamDateTimeInput(value: string, original: string | null): string | null {
  if (!value) return null;
  if (value === toVietnamDateTimeInput(original)) return original;
  return new Date(`${value}+07:00`).toISOString();
}

export function assessmentFreshness(order: OrderSummary, now = Date.now()): 'unchecked' | 'stale' | 'fresh' {
  if (!order.assessed_at) return 'unchecked';
  const assessed = Date.parse(order.assessed_at);
  const verified = Date.parse(order.data_verified_at || '');
  const invalidAge = (value: number) => !Number.isFinite(value) || value > now || now - value > 60 * 60_000;
  return invalidAge(assessed) || (order.delivery_status !== 'DELIVERED' && invalidAge(verified))
    ? 'stale' : 'fresh';
}

export function deliveryOutcome(order: OrderSummary): 'ON_TIME' | 'LATE' | 'UNVERIFIED' | null {
  if (order.delivery_status !== 'DELIVERED') return null;
  const dispatch = Date.parse(order.dispatched_at || '');
  const actual = Date.parse(order.delivered_at || '');
  const due = Date.parse(order.original_delivery_due_at || '');
  if (![dispatch, actual, due].every(Number.isFinite) || dispatch > actual || actual > Date.now()) return 'UNVERIFIED';
  return actual > due ? 'LATE' : 'ON_TIME';
}

export function orderAlert(order: OrderSummary): string {
  if (order.risk_status !== 'AT_RISK') return order.risk_status;
  return order.risk_assessments.some((rule) => rule.status === 'AT_RISK' && rule.alert_type === 'DELAYED')
    ? 'DELAYED' : 'RISK';
}

export function quantity(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function duration(milliseconds: number): string {
  const minutes = Math.max(0, Math.round(Math.abs(milliseconds) / 60_000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor(minutes % 1440 / 60);
  const remainder = minutes % 60;
  return [days && `${days}d`, hours && `${hours}h`, remainder && `${remainder}m`].filter(Boolean).join(' ') || '0m';
}

export function nextDeadline(order: OrderSummary): { label: string; at: number } | null {
  if (order.delivery_status === 'DELIVERED' || order.delivery_status === 'UNKNOWN') return null;
  const handover = order.delivery_status === 'NOT_DISPATCHED';
  const at = Date.parse((handover ? order.planned_handover_at : order.original_delivery_due_at) || '');
  return Number.isFinite(at) ? { label: handover ? 'Handover' : 'Delivery', at } : null;
}

export function dueSoon(order: OrderSummary, now: number): boolean {
  const deadline = nextDeadline(order);
  return Boolean(deadline && deadline.at >= now && deadline.at - now <= 2 * 3_600_000);
}

export function needsVerification(order: OrderSummary, now: number): boolean {
  const deadline = nextDeadline(order);
  const assessed = Date.parse(order.assessed_at || '');
  const deadlineChanged = deadline && Number.isFinite(assessed) && assessed < deadline.at && deadline.at <= now;
  return order.delivery_status !== 'DELIVERED'
    && (order.risk_status === 'UNKNOWN' || assessmentFreshness(order, now) !== 'fresh'
      || order.risk_assessments.length === 0 || Boolean(deadlineChanged));
}

/** An explainable rule severity index; it is not a probability or an ML prediction. */
export function rulePriority(order: OrderSummary, now: number): { score: number | null; explanation: string } {
  if (order.delivery_status === 'DELIVERED') {
    return { score: null, explanation: 'Completed order. Historical delivery performance is shown separately.' };
  }
  if (needsVerification(order, now)) {
    return { score: null, explanation: 'Unscored: verify missing or outdated data and reassess first.' };
  }
  const alerts = order.risk_assessments.filter((rule) => rule.status === 'AT_RISK');
  const delayed = alerts.filter((rule) => rule.alert_type === 'DELAYED');
  if (delayed.length) {
    const lateness = Math.max(0, ...delayed.map((rule) => {
      const deadline = rule.risk_code === 'HANDOVER_OVERDUE' ? order.planned_handover_at : order.original_delivery_due_at;
      const timestamp = Date.parse(deadline || '');
      return Number.isFinite(timestamp) ? now - timestamp : 0;
    }));
    const extra = Math.min(20, Math.floor(lateness / 3_600_000) * 5);
    return { score: 80 + extra, explanation: `Rule-based priority: 80 for an overdue rule, plus 5 per full hour overdue (maximum 100). Current time escalation: +${extra}. Not a probability.` };
  }
  if (alerts.length) {
    const delta = Date.parse(order.estimated_delivery_at || '') - Date.parse(order.original_delivery_due_at || '');
    const extra = alerts.some((rule) => rule.risk_code === 'DELIVERY_ETA_LATE') && Number.isFinite(delta)
      ? Math.min(20, Math.floor(Math.max(0, delta) / 3_600_000) * 5) : 0;
    return { score: 50 + extra, explanation: `Rule-based priority: 50 for a warehouse or ETA warning, plus 5 per full hour the ETA exceeds the promise (maximum 70). Current ETA escalation: +${extra}. Not a probability.` };
  }
  const deadline = nextDeadline(order);
  if (deadline && deadline.at <= now) {
    return { score: null, explanation: 'A deadline has passed since the last assessment. Check risks again to confirm the current status.' };
  }
  const remaining = deadline ? deadline.at - now : Infinity;
  const score = remaining <= 3_600_000 ? 35 : remaining <= 2 * 3_600_000 ? 20 : 0;
  return { score, explanation: `Rule-based priority: no active alerts; 35 when the next deadline is within 1 hour, 20 within 2 hours, otherwise 0. Current score: ${score}. Proximity is not a prediction of delay.` };
}
