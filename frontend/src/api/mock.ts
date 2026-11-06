import { ApiRequestError } from './errors';
import type { ApiAdapter, Incident, IncidentEvent, OrderDetail, Profile, RiskCode, RuleAssessment } from './types';

export const mockProfile: Profile = {
  id: '00000000-0000-4000-8000-000000000001',
  display_name: 'Demo Logistics', role: 'LOGISTICS_COORDINATOR', store_code: null,
};
const baseTime = Date.now();
const after = (hours: number) => new Date(baseTime + hours * 3_600_000).toISOString();
const codes: RiskCode[] = ['WAREHOUSE_NOT_READY_BEFORE_HANDOVER', 'HANDOVER_OVERDUE', 'DELIVERY_ETA_LATE', 'DELIVERY_OVERDUE'];
const orders: OrderDetail[] = Array.from({ length: 10 }, (_, index) => {
  const dispatched = [2, 3, 5].includes(index);
  const delivered = [7, 8].includes(index);
  return {
    id: `00000000-0000-4000-8000-${String(index + 10).padStart(12, '0')}`,
    order_number: `SE-MOCK-${String(index + 1).padStart(3, '0')}`,
    store_code: index === 6 ? 'SE02' : 'SE01', customer_reference: `Khách hàng mẫu ${index + 1}`,
    planned_handover_at: after(index === 0 ? 1 : index < 4 ? -1 : 3),
    original_delivery_due_at: after([1, 3].includes(index) ? -1 : index === 8 ? -2 : 4),
    estimated_delivery_at: index === 5 ? null : after(index === 2 ? 5 : 3),
    dispatched_at: dispatched || delivered ? after(-3) : null,
    delivered_at: delivered ? after(-1) : null,
    warehouse_status: index === 0 ? 'NOT_READY' : 'READY',
    delivery_status: delivered ? 'DELIVERED' : dispatched ? 'DISPATCHED' : index === 9 ? 'UNKNOWN' : 'NOT_DISPATCHED',
    data_verified_at: after(index === 6 ? -1.5 : 0), risk_status: 'NOT_CHECKED',
    risk_reason: null, risk_assessments: [], assessed_at: null, incidents: [], timeline: [],
  };
});

function fail(status: number, message: string): never {
  throw new ApiRequestError(status, { code: `HTTP_${status}`, message });
}
function getOrder(id: string) { return orders.find((order) => order.id === id) || fail(404, 'Không tìm thấy đơn hàng.'); }
function getIncident(id: string): { order: OrderDetail; incident: Incident } {
  for (const order of orders) {
    const incident = order.incidents.find((item) => item.id === id);
    if (incident) return { order, incident };
  }
  return fail(404, 'Không tìm thấy sự cố.');
}
function addEvent(order: OrderDetail, incident: Incident, type: IncidentEvent['type'], text: string): IncidentEvent {
  const event: IncidentEvent = {
    id: crypto.randomUUID(), incident_id: incident.id, risk_code: incident.risk_code,
    type, actor_id: type === 'DETECTED' ? null : mockProfile.id, text, created_at: new Date().toISOString(),
  };
  order.timeline.push(event);
  return event;
}
function evaluate(order: OrderDetail): RuleAssessment[] {
  const now = Date.now();
  const assessed_at = new Date(now).toISOString();
  const results: RuleAssessment[] = codes.map((risk_code) => ({ risk_code, status: 'CLEAR', alert_type: null, reason: 'Không có cảnh báo ở giai đoạn hiện tại.', assessed_at }));
  const unknownAll = (reason: string) => results.map((rule) => ({ ...rule, status: 'UNKNOWN' as const, reason }));
  const stamp = (value: string | null) => Date.parse(value || '');
  const set = (index: number, status: RuleAssessment['status'], reason: string, alert_type: RuleAssessment['alert_type'] = null) => {
    results[index] = { ...results[index], status, reason, alert_type };
  };
  if (order.delivery_status === 'DELIVERED') {
    if (!(stamp(order.dispatched_at) <= stamp(order.delivered_at) && stamp(order.delivered_at) <= now)) return unknownAll('Mốc giao thực tế thiếu hoặc mâu thuẫn.');
    return results.map((rule) => ({ ...rule, reason: 'Đơn đã giao xong; không còn cảnh báo hiệu lực.' }));
  }
  if (order.delivery_status === 'UNKNOWN') return unknownAll('Chưa xác định trạng thái giao hàng.');
  const age = now - stamp(order.data_verified_at);
  if (!Number.isFinite(age) || age < 0 || age > 3_600_000) return unknownAll('Dữ liệu chưa xác minh hoặc đã cũ hơn 60 phút.');
  if (order.delivery_status === 'NOT_DISPATCHED') {
    const planned = stamp(order.planned_handover_at);
    if (!Number.isFinite(planned)) { set(0, 'UNKNOWN', 'Thiếu giờ bàn giao.'); set(1, 'UNKNOWN', 'Thiếu giờ bàn giao.'); }
    else {
      if (planned - 7_200_000 <= now && now <= planned) {
        if (order.warehouse_status === 'NOT_READY') set(0, 'AT_RISK', 'Kho chưa sẵn sàng gần giờ bàn giao.', 'RISK');
        else if (order.warehouse_status === 'UNKNOWN') set(0, 'UNKNOWN', 'Cần xác minh trạng thái kho.');
      }
      if (now > planned) set(1, 'AT_RISK', 'Đã quá giờ nhưng chưa bàn giao.', 'DELAYED');
    }
  }
  const due = stamp(order.original_delivery_due_at);
  if (!Number.isFinite(due)) {
    set(3, 'UNKNOWN', 'Thiếu hạn giao cam kết.');
    if (order.delivery_status === 'DISPATCHED') set(2, 'UNKNOWN', 'Thiếu hạn giao cam kết.');
  } else if (now > due) set(3, 'AT_RISK', 'Đã quá hạn giao nhưng chưa giao xong.', 'DELAYED');
  else if (order.delivery_status === 'DISPATCHED') {
    const eta = stamp(order.estimated_delivery_at);
    if (!Number.isFinite(eta) || eta < now) set(2, 'UNKNOWN', 'ETA thiếu hoặc đã nằm trong quá khứ.');
    else if (eta > due) set(2, 'AT_RISK', 'Dự kiến giao trễ hơn hạn cam kết.', 'RISK');
  }
  return results;
}
function evaluateAll() {
  let created = 0;
  for (const order of orders) {
    order.risk_assessments = evaluate(order);
    order.assessed_at = order.risk_assessments[0].assessed_at;
    order.risk_status = order.risk_assessments.some((rule) => rule.status === 'AT_RISK') ? 'AT_RISK'
      : order.risk_assessments.some((rule) => rule.status === 'UNKNOWN') ? 'UNKNOWN' : 'CLEAR';
    order.risk_reason = order.risk_assessments.filter((rule) => rule.status === order.risk_status).map((rule) => rule.reason).join(' ') || null;
    for (const rule of order.risk_assessments) {
      if (rule.status !== 'AT_RISK' || !rule.alert_type || order.incidents.some((item) => item.risk_code === rule.risk_code)) continue;
      const incident: Incident = {
        id: crypto.randomUUID(), order_id: order.id, risk_code: rule.risk_code, alert_type: rule.alert_type,
        status: 'NEW', assignee_id: null, assignee_name: null, created_at: rule.assessed_at,
        accepted_at: null, resolved_at: null, resolution_note: null, version: 0,
      };
      order.incidents.push(incident);
      addEvent(order, incident, 'DETECTED', rule.reason);
      created += 1;
    }
  }
  return { evaluated_count: orders.length, created_incident_count: created };
}

// In-memory fixtures riêng cho UI development; reload khôi phục dữ liệu mẫu.
export const mockApi: ApiAdapter = {
  me: async () => structuredClone(mockProfile),
  orders: async () => ({ items: structuredClone(orders) }),
  order: async (id) => structuredClone(getOrder(id)),
  activity: async () => ({ items: structuredClone(orders.flatMap((order) => order.timeline.map((event) => ({
    ...event, order_id: order.id, order_number: order.order_number,
  }))).sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id)).slice(0, 20)) }),
  evaluateRisks: async () => evaluateAll(),
  acceptIncident: async (id, version) => {
    const { order, incident } = getIncident(id);
    if (incident.status !== 'NEW' || incident.version !== version) fail(409, 'Sự cố đã thay đổi.');
    Object.assign(incident, { status: 'IN_PROGRESS', assignee_id: mockProfile.id,
      assignee_name: mockProfile.display_name, accepted_at: new Date().toISOString(), version: version + 1 });
    addEvent(order, incident, 'ACCEPTED', `${mockProfile.display_name} nhận xử lý sự cố.`);
    return structuredClone(incident);
  },
  addNote: async (id, text) => {
    const { order, incident } = getIncident(id);
    if (!text.trim() || text.trim().length > 5000) fail(422, 'Ghi chú phải có từ 1 đến 5000 ký tự.');
    return structuredClone(addEvent(order, incident, 'NOTE_ADDED', text.trim()));
  },
  resolveIncident: async (id, version, resolution_note) => {
    const { order, incident } = getIncident(id);
    if (incident.status !== 'IN_PROGRESS' || incident.version !== version) fail(409, 'Sự cố đã thay đổi.');
    if (incident.assignee_id !== mockProfile.id) fail(403, 'Chỉ người phụ trách được giải quyết.');
    if (!resolution_note.trim() || resolution_note.trim().length > 5000) fail(422, 'Nội dung giải quyết phải có từ 1 đến 5000 ký tự.');
    Object.assign(incident, { status: 'RESOLVED', resolved_at: new Date().toISOString(), resolution_note: resolution_note.trim(), version: version + 1 });
    addEvent(order, incident, 'RESOLVED', resolution_note.trim());
    return structuredClone(incident);
  },
};
