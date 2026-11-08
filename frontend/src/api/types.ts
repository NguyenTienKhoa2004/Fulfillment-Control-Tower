export type Role = 'LOGISTICS_COORDINATOR' | 'STORE_STAFF';
export type DeliveryStatus = 'NOT_DISPATCHED' | 'DISPATCHED' | 'DELIVERED' | 'UNKNOWN';
export type WarehouseStatus = 'NOT_READY' | 'READY' | 'UNKNOWN';
export type RiskStatus = 'NOT_CHECKED' | 'AT_RISK' | 'CLEAR' | 'UNKNOWN';
export type RiskCode = 'WAREHOUSE_NOT_READY_BEFORE_HANDOVER' | 'HANDOVER_OVERDUE'
  | 'DELIVERY_ETA_LATE' | 'DELIVERY_OVERDUE';
export type AlertType = 'RISK' | 'DELAYED';
export type IncidentStatus = 'NEW' | 'IN_PROGRESS' | 'RESOLVED';
export interface Profile {
  id: string;
  display_name: string;
  role: Role;
  store_code: string | null;
}
export interface RuleAssessment {
  risk_code: RiskCode;
  status: Exclude<RiskStatus, 'NOT_CHECKED'>;
  alert_type: AlertType | null;
  reason: string;
  assessed_at: string;
}
export interface IncidentSummary {
  id: string;
  risk_code: RiskCode;
  alert_type: AlertType;
  status: IncidentStatus;
  assignee_id: string | null;
  assignee_name: string | null;
}
export interface Incident extends IncidentSummary {
  order_id: string;
  created_at: string;
  accepted_at: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  version: number;
}
export interface IncidentEvent {
  id: string;
  incident_id: string;
  risk_code: RiskCode;
  type: 'DETECTED' | 'ACCEPTED' | 'NOTE_ADDED' | 'RESOLVED';
  actor_id: string | null;
  text: string;
  created_at: string;
}
export interface ActivityItem extends IncidentEvent {
  order_id: string;
  order_number: string;
}
export interface OrderSummary {
  id: string;
  order_number: string;
  store_code: string;
  customer_reference: string;
  planned_handover_at: string | null;
  original_delivery_due_at: string | null;
  estimated_delivery_at: string | null;
  dispatched_at: string | null;
  delivered_at: string | null;
  warehouse_status: WarehouseStatus;
  delivery_status: DeliveryStatus;
  data_verified_at: string | null;
  risk_status: RiskStatus;
  risk_reason: string | null;
  risk_assessments: RuleAssessment[];
  assessed_at: string | null;
  incidents: IncidentSummary[];
}
export interface OrderDetail extends OrderSummary {
  incidents: Incident[];
  timeline: IncidentEvent[];
  data_verifications: OrderDataVerification[];
}
export interface OrderDataVerification {
  id: string;
  actor_name: string;
  verified_at: string;
  note: string;
  previous_data: Record<string, string | null>;
  verified_data: Record<string, string | null>;
}
export interface VerifyOrderDataRequest {
  expected_data_verified_at: string | null;
  warehouse_status: WarehouseStatus;
  delivery_status: Exclude<DeliveryStatus, 'UNKNOWN'>;
  estimated_delivery_at: string | null;
  dispatched_at: string | null;
  delivered_at: string | null;
  verification_note: string;
}
export interface ApiError {
  code: string;
  message: string;
  field_errors?: { loc: (string | number)[]; msg: string; type: string }[] | null;
}
export interface EvaluationResult {
  evaluated_count: number;
  created_incident_count: number;
}
export interface ApiAdapter {
  me(signal?: AbortSignal): Promise<Profile>;
  orders(signal?: AbortSignal): Promise<{ items: OrderSummary[] }>;
  order(id: string, signal?: AbortSignal): Promise<OrderDetail>;
  activity(signal?: AbortSignal): Promise<{ items: ActivityItem[] }>;
  evaluateRisks(): Promise<EvaluationResult>;
  verifyOrderData(id: string, body: VerifyOrderDataRequest): Promise<OrderDetail>;
  acceptIncident(id: string, expected_version: number): Promise<Incident>;
  addNote(id: string, text: string): Promise<IncidentEvent>;
  resolveIncident(id: string, expected_version: number, resolution_note: string): Promise<Incident>;
}
