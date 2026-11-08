import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import { api, ApiRequestError } from '../api/client';
import { errorMessage } from '../api/errors';
import { useOrders, useProfile, useRefreshData } from '../api/hooks';
import type { IncidentStatus, IncidentSummary, OrderSummary } from '../api/types';
import { QueryState } from '../components/QueryState';
import { StatusBadge } from '../components/StatusBadge';
import { RiskLabel } from '../components/RiskLabel';
import { EvaluateButton } from '../components/EvaluateButton';
import { Icon } from '../components/Icon';
import { useToast } from '../components/ToastProvider';
import {
  assessmentFreshness, dueSoon, duration, formatTime, labels, needsVerification,
  nextDeadline, orderAlert, quantity, ruleLabels, rulePriority,
} from '../lib/display';

type Density = 'compact' | 'comfortable';

function needsAttention(order: OrderSummary, now: number) {
  return order.incidents.some((incident) => incident.status !== 'RESOLVED')
    || ['AT_RISK', 'UNKNOWN', 'NOT_CHECKED'].includes(order.risk_status)
    || needsVerification(order, now) || dueSoon(order, now);
}

function priority(order: OrderSummary, now: number) {
  const alert = orderAlert(order);
  if (alert === 'DELAYED') return 0;
  if (alert === 'RISK') return 1;
  if (needsVerification(order, now)) return 2;
  if (dueSoon(order, now)) return 3;
  return 4;
}

function assessmentExplanation(order: OrderSummary) {
  if (!order.assessed_at) return 'Logistics has not checked risks yet.';
  return order.risk_reason || order.risk_assessments.find((rule) => rule.status !== 'CLEAR')?.reason
    || 'No alerts in this assessment.';
}

function AssignButton({ order, incident }: { order: OrderSummary; incident: IncidentSummary }) {
  const refresh = useRefreshData();
  const notify = useToast();
  const mutation = useMutation({
    mutationFn: async () => {
      // Summary rows do not carry a version. Fetch the current incident before
      // accepting, then let the API enforce its optimistic concurrency check.
      const detail = await api.order(order.id);
      const current = detail.incidents.find((item) => item.id === incident.id);
      if (!current || current.status !== 'NEW') {
        throw new ApiRequestError(409, { code: 'INCIDENT_CHANGED', message: 'This incident has already changed.' });
      }
      return api.acceptIncident(current.id, current.version);
    },
    onSuccess: async () => { notify(`Assigned ${order.order_number} · ${ruleLabels[incident.risk_code]} to you.`); await refresh(); },
    onError: async (error) => { if (error instanceof ApiRequestError && error.status === 409) await refresh(); },
  });
  return <div className="queue-assign">
    <button type="button" className="queue-assign-button" disabled={mutation.isPending}
      aria-label={`Assign ${ruleLabels[incident.risk_code]} on ${order.order_number} to me`}
      onClick={() => mutation.mutate()}>{mutation.isPending ? 'Assigning…' : 'Assign to me'}</button>
    {mutation.error && <p className="queue-action-error" role="alert">{mutation.error instanceof ApiRequestError && mutation.error.status === 409
      ? 'This incident changed. The list has been refreshed; review its owner before trying again.' : errorMessage(mutation.error)}</p>}
  </div>;
}

function OrderRow({ order, showStore, coordinator, now }: {
  order: OrderSummary; showStore: boolean; coordinator: boolean; now: number;
}) {
  const open = order.incidents.filter((incident) => incident.status !== 'RESOLVED');
  const waiting = open.filter((incident) => incident.status === 'NEW');
  const progress = open.filter((incident) => incident.status === 'IN_PROGRESS').length;
  const owners = [...new Set(open.map((incident) => incident.assignee_name).filter(Boolean))];
  const freshness = assessmentFreshness(order, now);
  const explanation = assessmentExplanation(order);
  const alert = orderAlert(order);
  const score = rulePriority(order, now);
  const deadline = nextDeadline(order);
  const remaining = deadline ? deadline.at - now : null;
  const actual = order.delivery_status === 'DELIVERED';
  const comparison = actual ? order.delivered_at : order.estimated_delivery_at;
  const delta = Date.parse(comparison || '') - Date.parse(order.original_delivery_due_at || '');
  const flagged = order.risk_assessments.filter((rule) => rule.status !== 'CLEAR');
  const shortReason = order.risk_status === 'UNKNOWN' ? 'Data needs verification' : flagged.length
    ? `${ruleLabels[flagged[0].risk_code]}${flagged.length > 1 ? ` +${flagged.length - 1} more` : ''}`
    : order.assessed_at ? 'Assessment details' : 'Not assessed yet';
  const nextIncident = waiting.find((incident) => incident.alert_type === 'DELAYED') || waiting[0];
  return <tr className={alert === 'DELAYED' ? 'order-row-delayed' : alert === 'RISK' ? 'order-row-risk' : ''}>
    <td className="queue-identity"><div className="queue-order-code"><Link className="order-link" to={`/orders/${order.id}`}>{order.order_number}</Link>
      {showStore && <span className="store-code">{order.store_code}</span>}</div>
      <span className="table-secondary customer-reference" title={order.customer_reference}>{order.customer_reference}</span></td>
    <td className="queue-stage"><StatusBadge value={order.delivery_status} />
      {deadline && remaining !== null && <span className={`deadline-relative ${remaining < 0 ? 'timing-late' : remaining <= 2 * 3_600_000 ? 'timing-soon' : ''}`}
        title={`${deadline.label}: ${formatTime(new Date(deadline.at).toISOString())}`}>
        {deadline.label} {Math.abs(remaining) < 60_000 ? 'due now' : remaining < 0 ? `overdue ${duration(remaining)}` : `in ${duration(remaining)}`}
      </span>}
      {order.delivery_status === 'UNKNOWN' && <span className="table-secondary">Confirm delivery stage</span>}
      {order.delivery_status === 'NOT_DISPATCHED' && <span className="queue-warehouse">Warehouse: {labels[order.warehouse_status]}</span>}
    </td>
    <td className="date-cell queue-timing"><dl className="queue-times">
      <div><dt>Promise</dt><dd>{formatTime(order.original_delivery_due_at)}</dd></div>
      <div><dt>{actual ? 'Actual' : 'ETA'}</dt><dd>{formatTime(comparison)}</dd></div>
      </dl>
      {Number.isFinite(delta) && <span className={`eta-delta ${delta > 0 ? 'timing-late' : ''}`}>
        {delta > 0 ? `+${duration(delta)} ${actual ? 'delivered late' : 'vs promise'}` : delta < 0 ? `${duration(delta)} ${actual ? 'delivered early' : 'before promise'}` : actual ? 'Delivered on time' : 'ETA matches promise'}
      </span>}
    </td>
    <td className="assessment-cell"><div className="queue-risk-heading"><RiskLabel order={order} />
      <span className="priority-score" title={score.explanation}>Rule priority <strong>{score.score === null ? '—' : `${score.score}/100`}</strong></span></div>
      {freshness === 'stale' && <span className="data-age-label">Outdated data · verify & reassess</span>}
      <details className="assessment-reason"><summary title={explanation}><span>{shortReason}</span><span className="reason-toggle">Details</span></summary>
        <div className="assessment-reason-body"><p>{explanation}</p><p>{score.explanation}</p>
          <p className="muted">Assessed: {formatTime(order.assessed_at)}</p>
          <Link to={`/orders/${order.id}#source-verification`}>View source data</Link></div>
      </details>
    </td>
    <td className="workflow-cell"><div className="queue-workflow-heading"><strong>{open.length ? quantity(open.length, 'open incident') : order.incidents.length ? 'All resolved' : 'No incidents'}</strong>
      {open.length > 0 && <span className="queue-workflow-counts">{waiting.length > 0 && <span>{waiting.length} awaiting</span>}{progress > 0 && <span>{progress} in progress</span>}</span>}
      {!open.length && order.incidents.length > 0 && <span className="queue-workflow-counts">{quantity(order.incidents.length, 'resolved incident')}</span>}
      </div>
      {open.length > 0 && <div className="queue-workflow-action"><span className="queue-owner" title={owners.join(', ')}>{owners.length ? owners.join(', ') : 'No owner yet'}</span>
        {coordinator && nextIncident && <AssignButton key={nextIncident.id} order={order} incident={nextIncident} />}</div>}
    </td>
    <td className="queue-detail"><Link className="order-detail-link" to={`/orders/${order.id}`} aria-label={`View order details for ${order.order_number}`}>Details<Icon name="arrow" size={14} /></Link></td>
  </tr>;
}

export function OrdersPage() {
  const query = useOrders();
  const profile = useProfile();
  const [params, setParams] = useSearchParams();
  const [, tick] = useState(0);
  const now = Date.now();
  const [density, setDensity] = useState<Density>(() => {
    try { return localStorage.getItem('netcom-order-density') === 'comfortable' ? 'comfortable' : 'compact'; }
    catch { return 'compact'; }
  });
  useEffect(() => { const timer = window.setInterval(() => tick((value) => value + 1), 30_000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { try { localStorage.setItem('netcom-order-density', density); } catch { /* Storage may be blocked. */ } }, [density]);
  const search = params.get('q') || '';
  const risk = params.get('risk') || '';
  const stage = params.get('stage') || '';
  const workflow = params.get('workflow') || '';
  const view = params.get('view') || '';
  const attention = view === 'attention';
  const soon = view === 'due_soon';
  const sort = params.get('sort') || 'priority';
  const showStore = profile.data?.role !== 'STORE_STAFF';
  const coordinator = profile.data?.role === 'LOGISTICS_COORDINATOR';
  function filter(key: string, value: string) {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (value) next.set(key, value); else next.delete(key);
      return next;
    }, { replace: true });
  }
  function clearFilters() { setParams(sort === 'priority' ? {} : { sort }, { replace: true }); }
  const orders = query.data?.items || [];
  const incidents = orders.flatMap((order) => order.incidents);
  const counts: Record<IncidentStatus, number> = { NEW: 0, IN_PROGRESS: 0, RESOLVED: 0 };
  for (const item of incidents) counts[item.status] += 1;
  const attentionCount = orders.filter((order) => needsAttention(order, now)).length;
  const staleCount = orders.filter((order) => order.delivery_status !== 'DELIVERED' && assessmentFreshness(order, now) === 'stale').length;
  const kpis = [
    { label: 'Delayed', count: orders.filter((order) => orderAlert(order) === 'DELAYED').length, key: 'risk', value: 'DELAYED', note: 'Orders with an overdue handover or delivery rule in the latest assessment.' },
    { label: 'At risk', count: orders.filter((order) => orderAlert(order) === 'RISK').length, key: 'risk', value: 'RISK', note: 'Orders with an early warehouse or ETA warning and no overdue alert.' },
    { label: 'Needs verification', count: orders.filter((order) => needsVerification(order, now)).length, key: 'risk', value: 'verification', note: 'Active orders with missing, unknown, unassessed, or outdated data, or a deadline that passed since assessment. May overlap other KPIs.' },
    { label: 'Due in next 2h', count: orders.filter((order) => dueSoon(order, now)).length, key: 'view', value: 'due_soon', note: 'The next handover or delivery deadline is within two hours. This is not a prediction of delay.' },
  ];
  const latest = orders.map((order) => order.assessed_at).filter((value): value is string => Boolean(value))
    .sort((a, b) => Date.parse(a) - Date.parse(b)).at(-1);
  const filtered = orders.filter((order) => {
    const matchesText = `${order.order_number} ${order.customer_reference} ${order.store_code}`.toLocaleLowerCase('en').includes(search.trim().toLocaleLowerCase('en'));
    const matchesRisk = !risk || (risk === 'verification' ? needsVerification(order, now)
      : risk === 'RISK' || risk === 'DELAYED' ? orderAlert(order) === risk : order.risk_status === risk);
    return matchesText && matchesRisk && (!stage || order.delivery_status === stage)
      && (!workflow || order.incidents.some((incident) => incident.status === workflow))
      && (!attention || needsAttention(order, now)) && (!soon || dueSoon(order, now));
  }).sort((a, b) => {
    if (sort === 'number') return a.order_number.localeCompare(b.order_number);
    if (sort === 'due') {
      const dueA = Date.parse(a.original_delivery_due_at || '');
      const dueB = Date.parse(b.original_delivery_due_at || '');
      const difference = (Number.isFinite(dueA) ? dueA : Infinity) - (Number.isFinite(dueB) ? dueB : Infinity);
      if (Number.isFinite(difference) && difference) return difference;
      if (dueA !== dueB && Number.isFinite(dueA)) return -1;
      if (dueA !== dueB && Number.isFinite(dueB)) return 1;
    } else {
      const difference = priority(a, now) - priority(b, now)
        || Number(b.incidents.some((item) => item.status !== 'RESOLVED')) - Number(a.incidents.some((item) => item.status !== 'RESOLVED'))
        || (rulePriority(b, now).score ?? -1) - (rulePriority(a, now).score ?? -1);
      if (difference) return difference;
      const nextA = nextDeadline(a)?.at ?? Infinity;
      const nextB = nextDeadline(b)?.at ?? Infinity;
      if (nextA !== nextB) return nextA < nextB ? -1 : 1;
    }
    return a.order_number.localeCompare(b.order_number);
  });
  const hasFilters = Boolean(search || risk || stage || workflow || attention || soon);
  const incidentFilters: { status: IncidentStatus; title: string }[] = [
    { status: 'NEW', title: 'Awaiting assignment' }, { status: 'IN_PROGRESS', title: 'In progress' }, { status: 'RESOLVED', title: 'Resolved' },
  ];
  return <section className={`orders-page density-${density}`}>
    <div className="page-heading"><div><h1>Order Monitoring</h1>
      <p className="muted">{profile.data?.store_code ? `Store ${profile.data.store_code} · ` : ''}Track orders, spot delays early, and resolve issues.</p></div><EvaluateButton /></div>
    <div className="order-kpis" role="group" aria-label="Order KPIs — select to filter. Counts cover your full account scope and may overlap.">
      {kpis.map((item) => <button key={item.label} type="button" title={item.note}
        aria-label={`${item.label}: ${query.data ? quantity(item.count, 'order') : 'loading'}. ${item.note} Select to toggle this filter.`}
        aria-pressed={params.get(item.key) === item.value} onClick={() => filter(item.key, params.get(item.key) === item.value ? '' : item.value)}>
        <strong>{query.data ? item.count : '—'}</strong><span>{item.label}</span>
      </button>)}
    </div>
    <div className="panel orders-panel">
      <div className="section-heading orders-panel-heading"><div><h2>Orders <span className="subtle-count">{query.data ? orders.length : '—'}</span></h2>
        <p className="muted">{profile.data?.store_code ? `Scope: ${profile.data.store_code}` : 'All stores in your scope'} · Vietnam time (UTC+7)</p></div>
        <div className="orders-header-meta"><div className="incident-summary" role="group" aria-label="Incident counts — select a status to filter orders">
          <span className="incident-summary-label">Incidents <strong>{query.data ? incidents.length : '—'}</strong></span>
          {incidentFilters.map((item) => <button key={item.status} type="button"
            aria-label={`${item.title}: ${query.data ? quantity(counts[item.status], 'incident') : 'loading'}. Select to toggle this filter.`}
            aria-pressed={workflow === item.status} onClick={() => filter('workflow', workflow === item.status ? '' : item.status)}>
            <span>{item.title}</span><strong>{query.data ? counts[item.status] : '—'}</strong>
          </button>)}
        </div><div className="sync-state">{query.isFetching ? 'Updating…' : 'Updates every 10 seconds'}</div></div>
      </div>
      <div className="orders-list-toolbar"><div className="order-views" role="group" aria-label="Order view">
        <button aria-pressed={!attention && !soon} onClick={() => filter('view', '')}>All <span>{query.data ? orders.length : '—'}</span></button>
        <button aria-pressed={attention} onClick={() => filter('view', 'attention')}>Needs attention <span>{query.data ? attentionCount : '—'}</span></button>
      </div><div className="queue-display-controls">
        <div className="queue-density" role="group" aria-label="Table density">{(['compact', 'comfortable'] as const).map((value) => <button type="button" key={value} aria-pressed={density === value}
          onClick={() => setDensity(value)}>{value === 'compact' ? 'Compact' : 'Comfortable'}</button>)}</div>
        <label className="orders-sort"><span>Sort by</span><select value={sort} onChange={(event) => filter('sort', event.target.value)}>
          <option value="priority">Priority</option><option value="due">Earliest delivery deadline</option><option value="number">Order number</option>
        </select></label>
      </div></div>
      <div className="filters"><label className="search-field"><Icon name="search" size={18} /><span className="sr-only">Search orders</span>
        <input type="search" value={search} onChange={(event) => filter('q', event.target.value)} placeholder={showStore ? 'Search order, customer, or store…' : 'Search order or customer…'} /></label>
        <label className="orders-select"><span>Risk assessment</span><select value={risk} onChange={(event) => filter('risk', event.target.value)}>
          <option value="">All results</option><option value="AT_RISK">Alerts detected</option><option value="RISK">At risk</option><option value="DELAYED">Delayed</option>
          <option value="verification">Needs verification / outdated</option><option value="UNKNOWN">Unknown assessment</option><option value="CLEAR">No alerts</option><option value="NOT_CHECKED">Not assessed</option>
        </select></label>
        <label className="orders-select"><span>Delivery stage</span><select value={stage} onChange={(event) => filter('stage', event.target.value)}>
          <option value="">All stages</option><option value="NOT_DISPATCHED">Not dispatched</option><option value="DISPATCHED">In transit</option><option value="DELIVERED">Delivered</option><option value="UNKNOWN">Unknown stage</option>
        </select></label>
      </div>
      <div className="orders-list-context"><span aria-live="polite">{query.data ? `${filtered.length} / ${quantity(orders.length, 'order')}` : 'Loading orders…'}
        {soon ? ' · Next milestone due within 2 hours' : sort === 'priority' ? ' · Overdue → At risk → Verify → Due soon' : ''}</span>
        {hasFilters && <button className="clear-order-filters" onClick={clearFilters}><Icon name="close" size={14} />Clear filters</button>}
      </div>
      {workflow && <div className="active-filter">Incident status: {labels[workflow] || workflow}<button className="icon-button" aria-label="Remove incident filter" onClick={() => filter('workflow', '')}><Icon name="close" size={14} /></button></div>}
      {staleCount > 0 && <div className="orders-data-notice"><Icon name="clock" size={16} /><p><strong>{quantity(staleCount, 'order')} with outdated data.</strong> {coordinator ? 'Verify source data before reassessing risks.' : 'Ask logistics to verify and reassess.'}</p></div>}
      <QueryState loading={query.isPending} error={query.error} retry={() => void query.refetch()} />
      {query.data && <><p className="table-scroll-hint"><Icon name="arrow" size={14} />Scroll horizontally for all columns.</p>
        <div className="table-wrap" role="region" aria-label="Orders table. Scroll horizontally on smaller screens." tabIndex={0}><table>
          <thead><tr><th scope="col">Order {showStore && '/ Store'}</th><th scope="col">Stage / Next deadline</th><th scope="col">Promise / ETA / Delta</th><th scope="col">Risk / Rule priority</th><th scope="col">Incident progress</th><th scope="col"><span className="sr-only">Details</span></th></tr></thead>
          <tbody>{filtered.map((order) => <OrderRow key={order.id} order={order} showStore={showStore} coordinator={coordinator} now={now} />)}</tbody>
        </table></div>
        {filtered.length === 0 && <div className="empty-state"><h3>{orders.length ? 'No matching orders' : 'No orders yet'}</h3><p>{orders.length ? 'Try a different search or filter.' : 'Orders will appear when data is added.'}</p>
          {hasFilters && <button className="button button-secondary button-small" onClick={clearFilters}>Clear filters</button>}</div>}
        <div className="table-footer"><span>KPIs count orders and can overlap. Workflow counts incidents. Rule priority is not a probability.</span><span>Last assessed: {formatTime(latest)}</span></div>
      </>}
    </div>
  </section>;
}
