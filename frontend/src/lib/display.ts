import type { OrderSummary, RiskCode } from '../api/types';

export const ruleLabels: Record<RiskCode, string> = {
  WAREHOUSE_NOT_READY_BEFORE_HANDOVER: 'Kho chưa sẵn sàng',
  HANDOVER_OVERDUE: 'Trễ bàn giao',
  DELIVERY_ETA_LATE: 'Dự kiến giao trễ',
  DELIVERY_OVERDUE: 'Quá hạn giao hàng',
};

export const labels: Record<string, string> = {
  NOT_DISPATCHED: 'Chưa xuất giao', DISPATCHED: 'Đang vận chuyển', DELIVERED: 'Đã giao',
  NOT_READY: 'Chưa sẵn sàng', READY: 'Sẵn sàng', UNKNOWN: 'Cần xác minh',
  NOT_CHECKED: 'Chưa kiểm tra', AT_RISK: 'Có cảnh báo', CLEAR: 'Không có cảnh báo',
  NEW: 'Mới phát hiện', IN_PROGRESS: 'Đang xử lý', RESOLVED: 'Đã xử lý',
  RISK: 'Có nguy cơ', DELAYED: 'Đã trễ',
  DETECTED: 'Phát hiện sự cố', ACCEPTED: 'Nhận xử lý', NOTE_ADDED: 'Thêm ghi chú',
  LOGISTICS_COORDINATOR: 'Điều phối logistics', STORE_STAFF: 'Nhân viên cửa hàng',
};

const formatter = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Stockholm',
});

export function formatTime(value: string | null | undefined): string {
  if (!value || Number.isNaN(Date.parse(value))) return 'Chưa có dữ liệu';
  return formatter.format(new Date(value));
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
