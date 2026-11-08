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
    store_code: index === 6 ? 'SE02' : 'SE01', customer_reference: `Demo customer ${index + 1}`,
    planned_handover_at: after(index === 0 ? 1 : index < 4 ? -1 : 3),
    original_delivery_due_at: after([1, 3].includes(index) ? -1 : index === 8 ? -2 : 4),
    estimated_delivery_at: index === 5 ? null : after(index === 2 ? 5 : 3),
    dispatched_at: dispatched || delivered ? after(-3) : null,
    delivered_at: delivered ? after(-1) : null,
    warehouse_status: index === 0 ? 'NOT_READY' : 'READY',
    delivery_status: delivered ? 'DELIVERED' : dispatched ? 'DISPATCHED' : index === 9 ? 'UNKNOWN' : 'NOT_DISPATCHED',
    data_verified_at: after(index === 6 ? -1.5 : 0), risk_status: 'NOT_CHECKED',
    risk_reason: null, risk_assessments: [], assessed_at: null, incidents: [], timeline: [], data_verifications: [],
  };
});

function fail(status: number, message: string): never {
  throw new ApiRequestError(status, { code: `HTTP_${status}`, message });
}
function getOrder(id: string) { return orders.find((order) => order.id === id) || fail(404, 'Order not found.'); }
function getIncident(id: string): { order: OrderDetail; incident: Incident } {
  for (const order of orders) {
    const incident = order.incidents.find((item) => item.id === id);
    if (incident) return { order, incident };
  }
  return fail(404, 'Incident not found.');
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
  const results: RuleAssessment[] = codes.map((risk_code) => ({ risk_code, status: 'CLEAR', alert_type: null, reason: 'No alerts at this stage.', assessed_at }));
  const unknownAll = (reason: string) => results.map((rule) => ({ ...rule, status: 'UNKNOWN' as const, reason }));
  const stamp = (value: string | null) => Date.parse(value || '');
  const set = (index: number, status: RuleAssessment['status'], reason: string, alert_type: RuleAssessment['alert_type'] = null) => {
    results[index] = { ...results[index], status, reason, alert_type };
  };
  if (order.delivery_status === 'DELIVERED') {
    if (!(stamp(order.dispatched_at) <= stamp(order.delivered_at) && stamp(order.delivered_at) <= now)) return unknownAll('Actual delivery timestamps are missing or inconsistent.');
    return results.map((rule) => ({ ...rule, reason: 'The order has been delivered; no active alerts remain.' }));
  }
  if (order.delivery_status === 'UNKNOWN') return unknownAll('Delivery status is unknown.');
  const age = now - stamp(order.data_verified_at);
  if (!Number.isFinite(age) || age < 0 || age > 3_600_000) return unknownAll('Data is unverified or more than 60 minutes old.');
  if (order.delivery_status === 'NOT_DISPATCHED') {
    const planned = stamp(order.planned_handover_at);
    if (!Number.isFinite(planned)) { set(0, 'UNKNOWN', 'Handover time is missing.'); set(1, 'UNKNOWN', 'Handover time is missing.'); }
    else {
      if (planned - 7_200_000 <= now && now <= planned) {
        if (order.warehouse_status === 'NOT_READY') set(0, 'AT_RISK', 'The warehouse is not ready as handover time approaches.', 'RISK');
        else if (order.warehouse_status === 'UNKNOWN') set(0, 'UNKNOWN', 'Warehouse status needs verification.');
      }
      if (now > planned) set(1, 'AT_RISK', 'The handover deadline has passed, but the order has not been handed over.', 'DELAYED');
    }
  }
  const due = stamp(order.original_delivery_due_at);
  if (!Number.isFinite(due)) {
    set(3, 'UNKNOWN', 'The promised delivery deadline is missing.');
    if (order.delivery_status === 'DISPATCHED') set(2, 'UNKNOWN', 'The promised delivery deadline is missing.');
  } else if (now > due) set(3, 'AT_RISK', 'The delivery deadline has passed, but delivery is not complete.', 'DELAYED');
  else if (order.delivery_status === 'DISPATCHED') {
    const eta = stamp(order.estimated_delivery_at);
    if (!Number.isFinite(eta) || eta < now) set(2, 'UNKNOWN', 'The ETA is missing or in the past.');
    else if (eta > due) set(2, 'AT_RISK', 'Estimated delivery is later than the promised deadline.', 'RISK');
  }
  return results;
}
function evaluateOrders(selected = orders) {
  let created = 0;
  for (const order of selected) {
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
  return { evaluated_count: selected.length, created_incident_count: created };
}

function sourceSnapshot(order: OrderDetail) {
  return {
    warehouse_status: order.warehouse_status, delivery_status: order.delivery_status,
    estimated_delivery_at: order.estimated_delivery_at, dispatched_at: order.dispatched_at,
    delivered_at: order.delivered_at, data_verified_at: order.data_verified_at,
  };
}

// In-memory fixtures for UI development; reload restores demo data.
export const mockApi: ApiAdapter = {
  me: async () => structuredClone(mockProfile),
  orders: async () => ({ items: structuredClone(orders) }),
  order: async (id) => structuredClone(getOrder(id)),
  activity: async () => ({ items: structuredClone(orders.flatMap((order) => order.timeline.map((event) => ({
    ...event, order_id: order.id, order_number: order.order_number,
  }))).sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id)).slice(0, 20)) }),
  evaluateRisks: async () => evaluateOrders(),
  verifyOrderData: async (id, body) => {
    if (mockProfile.role !== 'LOGISTICS_COORDINATOR') fail(403, 'Only logistics coordinators can verify data.');
    const order = getOrder(id);
    if (order.data_verified_at !== body.expected_data_verified_at) fail(409, 'Source data has been updated.');
    const stages = ['UNKNOWN', 'NOT_DISPATCHED', 'DISPATCHED', 'DELIVERED'];
    if (stages.indexOf(body.delivery_status) < stages.indexOf(order.delivery_status)) fail(422, 'Delivery stages cannot move backwards.');
    if (!body.verification_note.trim() || body.verification_note.trim().length > 2000) fail(422, 'Verification details must contain 1 to 2000 characters.');
    const dispatched = Date.parse(body.dispatched_at || '');
    const delivered = Date.parse(body.delivered_at || '');
    const eta = Date.parse(body.estimated_delivery_at || '');
    const now = Date.now();
    if (body.delivery_status === 'NOT_DISPATCHED' && (body.dispatched_at || body.delivered_at)) fail(422, 'An order that has not been dispatched cannot have actual delivery timestamps.');
    if (body.delivery_status !== 'NOT_DISPATCHED' && (!Number.isFinite(dispatched) || dispatched > now)) fail(422, 'Enter a valid dispatch time that is not in the future.');
    if (body.delivery_status === 'DISPATCHED' && body.delivered_at) fail(422, 'An order in transit cannot have an actual delivery timestamp.');
    if (body.delivery_status === 'DELIVERED' && (!Number.isFinite(delivered) || delivered < dispatched || delivered > now)) fail(422, 'The delivery time must be between dispatch and now.');
    if (body.delivery_status !== 'DELIVERED' && body.estimated_delivery_at && (!Number.isFinite(eta) || eta < now)) fail(422, 'Update the ETA or leave it blank if unknown.');
    const previous_data = sourceSnapshot(order);
    Object.assign(order, {
      warehouse_status: body.warehouse_status, delivery_status: body.delivery_status,
      estimated_delivery_at: body.estimated_delivery_at, dispatched_at: body.dispatched_at,
      delivered_at: body.delivered_at, data_verified_at: new Date(now).toISOString(),
    });
    evaluateOrders([order]);
    order.data_verifications.unshift({
      id: crypto.randomUUID(), actor_name: mockProfile.display_name, verified_at: order.data_verified_at!,
      note: body.verification_note.trim(), previous_data, verified_data: sourceSnapshot(order),
    });
    return structuredClone(order);
  },
  acceptIncident: async (id, version) => {
    const { order, incident } = getIncident(id);
    if (incident.status !== 'NEW' || incident.version !== version) fail(409, 'The incident has changed.');
    Object.assign(incident, { status: 'IN_PROGRESS', assignee_id: mockProfile.id,
      assignee_name: mockProfile.display_name, accepted_at: new Date().toISOString(), version: version + 1 });
    addEvent(order, incident, 'ACCEPTED', `${mockProfile.display_name} took ownership of the incident.`);
    return structuredClone(incident);
  },
  addNote: async (id, text) => {
    const { order, incident } = getIncident(id);
    if (!text.trim() || text.trim().length > 5000) fail(422, 'Notes must contain 1 to 5000 characters.');
    return structuredClone(addEvent(order, incident, 'NOTE_ADDED', text.trim()));
  },
  resolveIncident: async (id, version, resolution_note) => {
    const { order, incident } = getIncident(id);
    if (incident.status !== 'IN_PROGRESS' || incident.version !== version) fail(409, 'The incident has changed.');
    if (incident.assignee_id !== mockProfile.id) fail(403, 'Only the assigned owner can resolve this incident.');
    if (!resolution_note.trim() || resolution_note.trim().length > 5000) fail(422, 'Resolution details must contain 1 to 5000 characters.');
    Object.assign(incident, { status: 'RESOLVED', resolved_at: new Date().toISOString(), resolution_note: resolution_note.trim(), version: version + 1 });
    addEvent(order, incident, 'RESOLVED', resolution_note.trim());
    return structuredClone(incident);
  },
};
