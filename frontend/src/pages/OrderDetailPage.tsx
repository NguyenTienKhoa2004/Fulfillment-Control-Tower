import { useEffect } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { useOrder, useProfile } from '../api/hooks';
import { QueryState } from '../components/QueryState';
import { StatusBadge } from '../components/StatusBadge';
import { RiskAssessmentPanel } from '../components/RiskAssessmentPanel';
import { IncidentCard } from '../components/IncidentCard';
import { Timeline } from '../components/Timeline';
import { EvaluateButton } from '../components/EvaluateButton';
import { Icon } from '../components/Icon';
import { OrderOverview } from '../components/OrderOverview';
import { OrderDataVerificationPanel } from '../components/OrderDataVerificationPanel';
import { deliveryOutcome, formatTime } from '../lib/display';

export function OrderDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const query = useOrder(id);
  const profile = useProfile();
  const order = query.data;
  const outcome = order ? deliveryOutcome(order) : null;
  const step = order?.delivery_status === 'DELIVERED' ? 2 : order?.delivery_status === 'DISPATCHED' ? 1 : order?.delivery_status === 'NOT_DISPATCHED' ? 0 : -1;
  useEffect(() => {
    if (query.data && location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [id, location.hash, Boolean(query.data)]);
  return <section className="order-detail-page">
    <Link className="back-link" to="/orders"><Icon name="back" size={16} />Orders</Link>
    <QueryState loading={query.isPending} error={query.error} retry={() => void query.refetch()} />
    {order && <>
      <div className="page-heading detail-heading"><div><p className="eyebrow">ORDER DETAILS · {order.store_code}</p><div className="detail-title-row"><h1>{order.order_number}</h1><StatusBadge value={order.delivery_status} /></div><p className="muted">{order.customer_reference}</p></div><EvaluateButton /></div>
      <div className="detail-summary-grid">
      <div className="detail-summary-overview"><OrderOverview order={order} profile={profile.data} />
      </div>
      <div className="panel delivery-panel"><div className="section-heading"><h2>Delivery information</h2><span className="timezone-label"><Icon name="clock" size={14} />Vietnam time (UTC+7)</span></div>
        <ol className="delivery-progress">{['Preparation & handover', 'In transit', 'Delivered'].map((title, index) => <li key={title} className={step >= index ? 'step-complete' : ''} aria-current={step === index ? 'step' : undefined}><span>{step > index ? <Icon name="check" size={14} /> : index + 1}</span>{title}</li>)}</ol>
        <OrderDataVerificationPanel key={order.id} order={order} profile={profile.data} />
        <details className="delivery-more"><summary>View delivery milestones & source data<span className="risk-check-toggle" aria-hidden="true" /></summary>
        <dl className="delivery-fields">
          <div><dt>Planned carrier handover</dt><dd>{formatTime(order.planned_handover_at)}</dd></div>
          <div><dt>Original delivery deadline</dt><dd className="due-value">{formatTime(order.original_delivery_due_at)}</dd></div>
          <div><dt>Estimated delivery</dt><dd>{formatTime(order.estimated_delivery_at)}</dd></div>
          <div><dt>Handed to carrier at</dt><dd>{formatTime(order.dispatched_at)}</dd></div>
          <div><dt>Actual delivery</dt><dd>{order.delivered_at ? formatTime(order.delivered_at) : ['NOT_DISPATCHED', 'DISPATCHED'].includes(order.delivery_status) ? 'Not delivered yet' : 'No data'}</dd></div>
          <div><dt>Warehouse status</dt><dd><StatusBadge value={order.warehouse_status} /></dd></div>
        </dl>
        <div className="data-verification"><span>Data verified at: <strong>{formatTime(order.data_verified_at)}</strong></span><span>The promised deadline stays unchanged when the delivery estimate changes.</span></div>
        </details>
      </div>
      </div>
      <div className="detail-body"><div className="detail-primary">
      {outcome && <div className={`notice ${outcome === 'LATE' ? 'notice-warning' : outcome === 'ON_TIME' ? 'notice-success' : 'notice-neutral'}`}>
        <Icon name={outcome === 'ON_TIME' ? 'check' : 'clock'} size={20} /><div><strong>{outcome === 'LATE' ? 'Delivered after the original deadline' : outcome === 'ON_TIME' ? 'Delivered on time' : 'Not enough data to determine whether delivery was on time'}</strong>
          <p>{outcome === 'UNVERIFIED' ? 'Verify the delivery deadline and actual delivery timestamps.' : `Actual delivery: ${formatTime(order.delivered_at)} · Promised deadline: ${formatTime(order.original_delivery_due_at)}`}</p></div>
      </div>}
      <div className="panel detail-incidents"><div className="section-heading incident-section-heading"><div><h2>Incidents <span className="subtle-count">{order.incidents.length}</span></h2><p className="muted">Each incident has its own owner and progress.</p></div></div>
        <QueryState loading={profile.isPending} error={profile.error} retry={() => void profile.refetch()} />
        {order.incidents.length === 0 && <div className="panel empty-state"><Icon name="check" size={32} /><h3>No incidents recorded</h3><p>Risk assessments and incident resolution are tracked separately.</p></div>}
        {profile.data && order.incidents.map((incident) => <IncidentCard key={incident.id} incident={incident} profile={profile.data!} events={order.timeline.filter((event) => event.incident_id === incident.id)} />)}
      </div></div>
      <aside className="detail-risk"><RiskAssessmentPanel key={order.id} order={order} /></aside>
      <aside className="detail-history">{profile.data && <Timeline key={order.id} events={order.timeline} incidents={order.incidents} profile={profile.data} />}</aside>
      </div>
    </>}
  </section>;
}
