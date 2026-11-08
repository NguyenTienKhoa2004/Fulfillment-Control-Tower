import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api/client';
import { ApiRequestError, errorMessage } from '../api/errors';
import { useRefreshData } from '../api/hooks';
import type { OrderDetail, Profile, VerifyOrderDataRequest, WarehouseStatus } from '../api/types';
import { formatTime, fromVietnamDateTimeInput, labels, toVietnamDateTimeInput } from '../lib/display';
import { Icon } from './Icon';
import { useToast } from './ToastProvider';

function initialDraft(order: OrderDetail) {
  return {
    source: order,
    warehouse: order.warehouse_status,
    delivery: order.delivery_status === 'UNKNOWN' ? '' : order.delivery_status,
    eta: toVietnamDateTimeInput(order.estimated_delivery_at),
    dispatched: toVietnamDateTimeInput(order.dispatched_at),
    delivered: toVietnamDateTimeInput(order.delivered_at),
    note: '', confirmed: false,
  };
}
const sourceLabels: Record<string, string> = {
  warehouse_status: 'Warehouse status', delivery_status: 'Delivery status',
  estimated_delivery_at: 'ETA', dispatched_at: 'Actual dispatch', delivered_at: 'Actual delivery',
};
const stages = ['NOT_DISPATCHED', 'DISPATCHED', 'DELIVERED'] as const;

export function OrderDataVerificationPanel({ order, profile }: { order: OrderDetail; profile?: Profile }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => initialDraft(order));
  const refresh = useRefreshData();
  const notify = useToast();
  const mutation = useMutation({
    mutationFn: (body: VerifyOrderDataRequest) => api.verifyOrderData(order.id, body),
    onSuccess: async (updated) => {
      await refresh();
      setEditing(false);
      notify(`Data verified and risks reassessed: ${labels[updated.risk_status]}.`);
    },
    onError: async (error) => {
      if (error instanceof ApiRequestError && error.status === 409) await refresh();
    },
  });
  const conflict = mutation.error instanceof ApiRequestError && mutation.error.status === 409;
  const coordinator = profile?.role === 'LOGISTICS_COORDINATOR';
  const prefix = `verify-${order.id}`;
  function startEditing() {
    setDraft(initialDraft(order)); mutation.reset(); setEditing(true);
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.confirmed || !draft.note.trim() || !draft.delivery || mutation.isPending || conflict) return;
    mutation.mutate({
      expected_data_verified_at: draft.source.data_verified_at,
      warehouse_status: draft.warehouse,
      delivery_status: draft.delivery as VerifyOrderDataRequest['delivery_status'],
      estimated_delivery_at: fromVietnamDateTimeInput(draft.eta, draft.source.estimated_delivery_at),
      dispatched_at: draft.delivery === 'NOT_DISPATCHED' ? null
        : fromVietnamDateTimeInput(draft.dispatched, draft.source.dispatched_at),
      delivered_at: draft.delivery === 'DELIVERED'
        ? fromVietnamDateTimeInput(draft.delivered, draft.source.delivered_at) : null,
      verification_note: draft.note.trim(),
    });
  }
  return <div className="source-verification" id="source-verification">
    <div className="source-verification-heading">
      <div><strong>Source data</strong><p className="muted small">Last verified: {formatTime(order.data_verified_at)}</p></div>
      {coordinator && !editing && <button className="button button-secondary button-small" onClick={startEditing}>
        <Icon name="check" size={15} />Update & verify data
      </button>}
    </div>
    {coordinator && editing && <form onSubmit={submit} className="source-verification-form">
      <p className="muted small">Enter information confirmed with the warehouse or carrier. All times use Vietnam time (UTC+7).</p>
      <fieldset disabled={mutation.isPending}>
        <div className="source-fields">
          <div><label htmlFor={`${prefix}-warehouse`}>Warehouse status</label>
            <select id={`${prefix}-warehouse`} value={draft.warehouse} onChange={(e) => setDraft({ ...draft, warehouse: e.target.value as WarehouseStatus })}>
              <option value="NOT_READY">Not ready</option><option value="READY">Ready</option><option value="UNKNOWN">Unknown</option>
            </select></div>
          <div><label htmlFor={`${prefix}-delivery`}>Delivery status *</label>
            <select id={`${prefix}-delivery`} value={draft.delivery} required onChange={(e) => setDraft({ ...draft, delivery: e.target.value })}>
              <option value="" disabled>Select the verified status</option>
              {stages.map((stage, index) => <option key={stage} value={stage} disabled={index < stages.indexOf(draft.source.delivery_status as typeof stages[number])}>{labels[stage]}</option>)}
            </select></div>
          {draft.delivery !== 'DELIVERED' && <div><label htmlFor={`${prefix}-eta`}>Estimated delivery (ETA)</label>
            <input id={`${prefix}-eta`} type="datetime-local" value={draft.eta} onChange={(e) => setDraft({ ...draft, eta: e.target.value })} />
            <p className="muted small">Leave blank if no updated ETA is available.</p></div>}
          {['DISPATCHED', 'DELIVERED'].includes(draft.delivery) && <div><label htmlFor={`${prefix}-dispatched`}>Handed to carrier at *</label>
            <input id={`${prefix}-dispatched`} type="datetime-local" required value={draft.dispatched} onChange={(e) => setDraft({ ...draft, dispatched: e.target.value })} /></div>}
          {draft.delivery === 'DELIVERED' && <div><label htmlFor={`${prefix}-delivered`}>Delivered at *</label>
            <input id={`${prefix}-delivered`} type="datetime-local" required value={draft.delivered} onChange={(e) => setDraft({ ...draft, delivered: e.target.value })} /></div>}
        </div>
        <label htmlFor={`${prefix}-note`}>Verification source and details *</label>
        <textarea id={`${prefix}-note`} required maxLength={2000} rows={2} value={draft.note}
          placeholder="Example: Warehouse confirmed the order has not been dispatched; the carrier provided an updated ETA…"
          onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
        <label className="verification-confirmation"><input type="checkbox" required checked={draft.confirmed}
          onChange={(e) => setDraft({ ...draft, confirmed: e.target.checked })} />I have confirmed this information with the warehouse or carrier.</label>
      </fieldset>
      {mutation.error && <div className="notice notice-error" role="alert"><div><p>{errorMessage(mutation.error)}</p>
        {conflict && <><p>Reloading will replace your draft with the latest data.</p>
          <button className="button button-secondary button-small" type="button" onClick={startEditing}>Reload latest data</button></>}
      </div></div>}
      <div className="form-footer"><p className="muted small">Original delivery deadline: <strong>{formatTime(order.original_delivery_due_at)}</strong></p>
        <div className="verification-actions"><button type="button" className="button button-ghost button-small" disabled={mutation.isPending} onClick={() => setEditing(false)}>Cancel</button>
          <button className="button button-primary button-small" disabled={mutation.isPending || !draft.confirmed || !draft.note.trim() || !draft.delivery || conflict}>
            {mutation.isPending ? 'Verifying…' : 'Save verification & reassess risks'}
          </button></div>
      </div>
    </form>}
    {(order.data_verifications?.length ?? 0) > 0 && <details className="verification-history"><summary>Verification history ({order.data_verifications.length})</summary>
      {order.data_verifications.map((entry) => <article key={entry.id}>
        <strong>{entry.actor_name}</strong><time dateTime={entry.verified_at}>{formatTime(entry.verified_at)}</time>
        <p className="preserve-text">{entry.note}</p>
        <ul>{Object.entries(sourceLabels).filter(([field]) => entry.previous_data[field] !== entry.verified_data[field]).map(([field, label]) => {
          const render = (value: string | null) => field.endsWith('_at') ? formatTime(value) : labels[value || ''] || 'No data';
          return <li key={field}>{label}: {render(entry.previous_data[field])} → {render(entry.verified_data[field])}</li>;
        })}</ul>
      </article>)}
    </details>}
  </div>;
}
