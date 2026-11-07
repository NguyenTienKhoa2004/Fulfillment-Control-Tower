import { useState } from 'react';
import type { Incident, IncidentEvent, Profile } from '../api/types';
import { formatTime, labels, ruleLabels } from '../lib/display';
import { Icon } from './Icon';

export function Timeline({ events, incidents, profile }: { events: IncidentEvent[]; incidents: Incident[]; profile: Profile }) {
  const [showAll, setShowAll] = useState(false);
  const recent = [...events].reverse();
  const visible = showAll ? recent : recent.slice(0, 5);
  return <div className="panel timeline-panel"><div className="section-heading"><h2>Lịch sử cập nhật</h2><span className="subtle-count">{events.length}</span></div>
    {events.length === 0 ? <div className="empty-state compact"><Icon name="clock" size={28} /><p>Chưa có cập nhật cho đơn hàng.</p></div> : <ol className="timeline" id="order-timeline">{visible.map((event) => {
      const incident = incidents.find((item) => item.id === event.incident_id);
      const actor = event.actor_id === null ? 'Hệ thống' : event.actor_id === profile.id ? `${profile.display_name} (bạn)` : event.actor_id === incident?.assignee_id ? incident?.assignee_name : 'Thành viên phối hợp';
      return <li key={event.id}><span className={`event-marker event-${event.type.toLowerCase()}`}><Icon name={event.type === 'NOTE_ADDED' ? 'message' : event.type === 'DETECTED' ? 'alert' : 'check'} size={14} /></span>
        <div><strong>{labels[event.type]}</strong><a className="timeline-rule" href={`#incident-${event.incident_id}`}>{ruleLabels[event.risk_code]}</a>
          <p className="timeline-meta">{actor}<br /><time dateTime={event.created_at}>{formatTime(event.created_at)}</time></p>
          <details className="timeline-content"><summary>Xem nội dung</summary><p className="preserve-text">{event.text}</p></details></div>
      </li>;
    })}</ol>}
    {events.length > 5 && <div className="timeline-footer"><button className="button button-ghost button-small" aria-expanded={showAll} aria-controls="order-timeline" onClick={() => setShowAll(!showAll)}>{showAll ? 'Thu gọn lịch sử' : `Xem tất cả ${events.length} cập nhật`}</button></div>}
  </div>;
}
