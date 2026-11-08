import { isMock, supabase } from '../auth/supabase';
import { mockApi } from './mock';
import type { ApiAdapter, ApiError } from './types';
import { ApiRequestError } from './errors';
export { ApiRequestError } from './errors';

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
  const headers = new Headers(options.headers);
  if (options.body) headers.set('Content-Type', 'application/json');
  if (data.session) headers.set('Authorization', `Bearer ${data.session.access_token}`);
  const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';
  const response = await fetch(`${base.replace(/\/$/, '')}${path}`, { ...options, headers });
  if (!response.ok) {
    const body: ApiError = await response.json().catch(() => ({
      code: `HTTP_${response.status}`, message: `Request failed (${response.status}).`,
    }));
    if (response.status === 401) window.dispatchEvent(new CustomEvent('netcom:session-expired', {
      detail: { userId: data.session?.user.id },
    }));
    throw new ApiRequestError(response.status, body);
  }
  return response.json() as Promise<T>;
}

export const api: ApiAdapter = isMock ? mockApi : {
  me: (signal) => request('/me', { signal }),
  orders: (signal) => request('/orders', { signal }),
  order: (id, signal) => request(`/orders/${encodeURIComponent(id)}`, { signal }),
  activity: (signal) => request('/activity', { signal }),
  evaluateRisks: () => request('/demo/evaluate-risks', { method: 'POST' }),
  verifyOrderData: (id, body) => request(`/orders/${encodeURIComponent(id)}/verify-data`, {
    method: 'POST', body: JSON.stringify(body),
  }),
  acceptIncident: (id, expected_version) => request(`/incidents/${encodeURIComponent(id)}/accept`, {
    method: 'POST', body: JSON.stringify({ expected_version }),
  }),
  addNote: (id, text) => request(`/incidents/${encodeURIComponent(id)}/notes`, {
    method: 'POST', body: JSON.stringify({ text }),
  }),
  resolveIncident: (id, expected_version, resolution_note) => request(`/incidents/${encodeURIComponent(id)}/resolve`, {
    method: 'POST', body: JSON.stringify({ expected_version, resolution_note }),
  }),
};
