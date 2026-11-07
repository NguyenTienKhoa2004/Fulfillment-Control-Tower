import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api/client';
import { ApiRequestError, errorMessage, fieldError } from '../api/errors';
import { useRefreshData } from '../api/hooks';
import type { Incident, IncidentEvent, Profile } from '../api/types';
import { formatTime, ruleLabels } from '../lib/display';
import { StatusBadge } from './StatusBadge';
import { Icon } from './Icon';
import { useToast } from './ToastProvider';

export function IncidentCard({ incident, profile, events }: {
  incident: Incident; profile: Profile; events: IncidentEvent[];
}) {
  const [note, setNote] = useState('');
  const [resolution, setResolution] = useState('');
  const [showAllNotes, setShowAllNotes] = useState(false);
  const refresh = useRefreshData();
  const notify = useToast();
  async function conflict(error: Error) { if (error instanceof ApiRequestError && error.status === 409) await refresh(); }
  const accept = useMutation({
    mutationFn: () => api.acceptIncident(incident.id, incident.version),
    onSuccess: async () => { notify('Bạn đã nhận xử lý sự cố.'); await refresh(); }, onError: conflict,
  });
  const addNote = useMutation({
    mutationFn: (text: string) => api.addNote(incident.id, text),
    onSuccess: async () => { setNote(''); notify('Đã thêm ghi chú.'); await refresh(); }, onError: conflict,
  });
  const resolve = useMutation({
    mutationFn: (text: string) => api.resolveIncident(incident.id, incident.version, text),
    onSuccess: async () => { setResolution(''); notify('Đã ghi nhận giải quyết sự cố.'); await refresh(); }, onError: conflict,
  });
  const pending = accept.isPending || addNote.isPending || resolve.isPending;
  const coordinator = profile.role === 'LOGISTICS_COORDINATOR';
  const owner = incident.assignee_id === profile.id;
  const notes = events.filter((event) => event.type === 'NOTE_ADDED').slice().reverse();
  const visibleNotes = showAllNotes ? notes : notes.slice(0, 3);
  const latestError = accept.error || addNote.error || resolve.error;
  function resetErrors() { accept.reset(); addNote.reset(); resolve.reset(); }
  function submitNote(event: FormEvent) {
    event.preventDefault(); if (note.trim() && !pending) { resetErrors(); addNote.mutate(note.trim()); }
  }
  function submitResolution(event: FormEvent) {
    event.preventDefault(); if (resolution.trim() && !pending) { resetErrors(); resolve.mutate(resolution.trim()); }
  }
  return <article className={`panel incident-card incident-${incident.status.toLowerCase()}`} id={`incident-${incident.id}`} tabIndex={-1}>
    <div className="incident-heading"><div className="incident-heading-title"><span className={`incident-type-icon type-${incident.alert_type.toLowerCase()}`}><Icon name="alert" size={20} /></span>
      <div><p className="eyebrow">SỰ CỐ · {incident.id.slice(-6).toUpperCase()}</p><h3>{ruleLabels[incident.risk_code]}</h3></div></div>
      <div className="badge-group"><StatusBadge value={incident.alert_type} /><StatusBadge value={incident.status} /></div>
    </div>
    <div className="incident-meta"><span><Icon name="user" size={15} />{incident.assignee_name || 'Chưa có người phụ trách'}{owner && ' (bạn)'}</span>
      <span>Phát hiện: {formatTime(incident.created_at)}</span>
      {incident.accepted_at && <span>Nhận việc: {formatTime(incident.accepted_at)}</span>}
    </div>
    {incident.status === 'NEW' && <div className="incident-claim"><p>{coordinator ? 'Sự cố đang chờ logistics tiếp nhận.' : 'Logistics chưa nhận xử lý. Bạn có thể bổ sung thông tin bên dưới.'}</p>
      {coordinator && <button className="button button-primary button-small" disabled={pending} onClick={() => { resetErrors(); accept.mutate(); }}><Icon name="user" size={16} />{accept.isPending ? 'Đang nhận…' : 'Nhận xử lý'}</button>}
    </div>}
    {incident.status === 'IN_PROGRESS' && !owner && <p className="muted incident-hint">{incident.assignee_name || 'Logistics'} đang phụ trách. Bạn có thể phối hợp qua ghi chú.</p>}
    {coordinator && owner && incident.status === 'IN_PROGRESS' && <div className="incident-claim"><p>Bạn đang phụ trách sự cố này.</p><a className="button button-success button-small" href={`#resolve-${incident.id}`} onClick={() => requestAnimationFrame(() => document.getElementById(`resolve-${incident.id}`)?.focus({ preventScroll: true }))}><Icon name="check" size={16} />Ghi nhận giải quyết</a></div>}
    {incident.status === 'RESOLVED' && <div className="resolution-record"><Icon name="check" size={20} /><div><strong>Đã ghi nhận giải quyết · {formatTime(incident.resolved_at)}</strong><p className="preserve-text">{incident.resolution_note}</p></div></div>}
    {latestError && <div className="notice notice-error" role="alert">{errorMessage(latestError)}</div>}
    <div className="notes-section"><h4><Icon name="message" size={16} />Trao đổi & bổ sung thông tin <span className="subtle-count">{notes.length}</span></h4>
      <form onSubmit={submitNote} className="note-composer">
        <label htmlFor={`note-${incident.id}`}>Bổ sung thông tin</label>
        <textarea id={`note-${incident.id}`} value={note} onChange={(event) => setNote(event.target.value)} disabled={pending}
          placeholder="Thông tin khách hàng, phản hồi từ kho hoặc yêu cầu hỗ trợ…" maxLength={5000} rows={3}
          aria-invalid={Boolean(fieldError(addNote.error, 'text'))} aria-describedby={fieldError(addNote.error, 'text') ? `note-error-${incident.id}` : undefined} />
        {fieldError(addNote.error, 'text') && <p id={`note-error-${incident.id}`} className="field-error">{fieldError(addNote.error, 'text')}</p>}
        <div className="form-footer"><span className="muted small">{note.length}/5000 ký tự</span><button className="button button-secondary button-small" disabled={pending || !note.trim()}>{addNote.isPending ? 'Đang gửi…' : 'Thêm ghi chú'}</button></div>
      </form>
      {notes.length === 0 ? <p className="muted small">Chưa có ghi chú. Hãy bổ sung thông tin để phối hợp xử lý.</p> : <>
        <p className="notes-order">Ghi chú mới nhất</p>
        <div className="note-list" id={`notes-${incident.id}`}>{visibleNotes.map((event) => <div className="note-item" key={event.id}>
          <div><strong>{event.actor_id === profile.id ? `${profile.display_name} (bạn)` : event.actor_id === incident.assignee_id ? incident.assignee_name : 'Thành viên phối hợp'}</strong><time dateTime={event.created_at}>{formatTime(event.created_at)}</time></div>
          <p className="preserve-text">{event.text}</p>
        </div>)}</div>
        {notes.length > 3 && <button className="button button-ghost button-small expand-history" aria-expanded={showAllNotes} aria-controls={`notes-${incident.id}`} onClick={() => setShowAllNotes(!showAllNotes)}>{showAllNotes ? 'Thu gọn ghi chú' : `Xem tất cả ${notes.length} ghi chú`}</button>}
      </>}
    </div>
    {coordinator && owner && incident.status === 'IN_PROGRESS' && <form className="resolve-form" onSubmit={submitResolution}>
      <h4><Icon name="check" size={17} />Ghi nhận giải quyết</h4><label htmlFor={`resolve-${incident.id}`}>Nội dung xử lý <span className="required">*</span></label>
      <textarea id={`resolve-${incident.id}`} value={resolution} onChange={(event) => setResolution(event.target.value)} disabled={pending}
        placeholder="Mô tả phương án và kết quả xử lý sự cố…" maxLength={5000} rows={3} required
        aria-invalid={Boolean(fieldError(resolve.error, 'resolution_note'))} aria-describedby={`resolve-help-${incident.id}`} />
      {fieldError(resolve.error, 'resolution_note') && <p className="field-error">{fieldError(resolve.error, 'resolution_note')}</p>}
      <div className="form-footer"><p className="muted small" id={`resolve-help-${incident.id}`}>Chỉ ghi nhận xử lý sự cố; trạng thái giao hàng do nguồn vận chuyển cập nhật.</p>
        <button className="button button-success button-small" disabled={pending || !resolution.trim()}>{resolve.isPending ? 'Đang lưu…' : 'Ghi nhận giải quyết'}</button></div>
    </form>}
  </article>;
}
