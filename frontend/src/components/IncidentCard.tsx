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
    onSuccess: async () => { notify('You are now assigned to this incident.'); await refresh(); }, onError: conflict,
  });
  const addNote = useMutation({
    mutationFn: (text: string) => api.addNote(incident.id, text),
    onSuccess: async () => { setNote(''); notify('Note added.'); await refresh(); }, onError: conflict,
  });
  const resolve = useMutation({
    mutationFn: (text: string) => api.resolveIncident(incident.id, incident.version, text),
    onSuccess: async () => { setResolution(''); notify('Incident resolution recorded.'); await refresh(); }, onError: conflict,
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
      <div><p className="eyebrow">INCIDENT · {incident.id.slice(-6).toUpperCase()}</p><h3>{ruleLabels[incident.risk_code]}</h3></div></div>
      <div className="badge-group"><StatusBadge value={incident.alert_type} /><StatusBadge value={incident.status} /></div>
    </div>
    <div className="incident-meta"><span><Icon name="user" size={15} />{incident.assignee_name || 'Unassigned'}{owner && ' (you)'}</span>
      <span>Detected: {formatTime(incident.created_at)}</span>
      {incident.accepted_at && <span>Assigned: {formatTime(incident.accepted_at)}</span>}
    </div>
    {incident.status === 'NEW' && <div className="incident-claim"><p>{coordinator ? 'This incident is waiting for logistics to take ownership.' : 'Logistics has not taken ownership yet. You can add information below.'}</p>
      {coordinator && <button className="button button-primary button-small" disabled={pending} onClick={() => { resetErrors(); accept.mutate(); }}><Icon name="user" size={16} />{accept.isPending ? 'Assigning…' : 'Take ownership'}</button>}
    </div>}
    {incident.status === 'IN_PROGRESS' && !owner && <p className="muted incident-hint">{incident.assignee_name || 'Logistics'} is handling this incident. Add a note to coordinate.</p>}
    {coordinator && owner && incident.status === 'IN_PROGRESS' && <div className="incident-claim"><p>You are assigned to this incident.</p><a className="button button-success button-small" href={`#resolve-${incident.id}`} onClick={() => requestAnimationFrame(() => document.getElementById(`resolve-${incident.id}`)?.focus({ preventScroll: true }))}><Icon name="check" size={16} />Record resolution</a></div>}
    {incident.status === 'RESOLVED' && <div className="resolution-record"><Icon name="check" size={20} /><div><strong>Resolution recorded · {formatTime(incident.resolved_at)}</strong><p className="preserve-text">{incident.resolution_note}</p></div></div>}
    {latestError && <div className="notice notice-error" role="alert">{errorMessage(latestError)}</div>}
    <div className="notes-section"><h4><Icon name="message" size={16} />Notes & collaboration <span className="subtle-count">{notes.length}</span></h4>
      <form onSubmit={submitNote} className="note-composer">
        <label htmlFor={`note-${incident.id}`}>Add information</label>
        <textarea id={`note-${incident.id}`} value={note} onChange={(event) => setNote(event.target.value)} disabled={pending}
          placeholder="Customer details, warehouse updates, or support requests…" maxLength={5000} rows={3}
          aria-invalid={Boolean(fieldError(addNote.error, 'text'))} aria-describedby={fieldError(addNote.error, 'text') ? `note-error-${incident.id}` : undefined} />
        {fieldError(addNote.error, 'text') && <p id={`note-error-${incident.id}`} className="field-error">{fieldError(addNote.error, 'text')}</p>}
        <div className="form-footer"><span className="muted small">{note.length}/5000 characters</span><button className="button button-secondary button-small" disabled={pending || !note.trim()}>{addNote.isPending ? 'Sending…' : 'Add note'}</button></div>
      </form>
      {notes.length === 0 ? <p className="muted small">No notes yet. Add information to help resolve this incident.</p> : <>
        <p className="notes-order">Latest notes</p>
        <div className="note-list" id={`notes-${incident.id}`}>{visibleNotes.map((event) => <div className="note-item" key={event.id}>
          <div><strong>{event.actor_id === profile.id ? `${profile.display_name} (you)` : event.actor_id === incident.assignee_id ? incident.assignee_name : 'Team member'}</strong><time dateTime={event.created_at}>{formatTime(event.created_at)}</time></div>
          <p className="preserve-text">{event.text}</p>
        </div>)}</div>
        {notes.length > 3 && <button className="button button-ghost button-small expand-history" aria-expanded={showAllNotes} aria-controls={`notes-${incident.id}`} onClick={() => setShowAllNotes(!showAllNotes)}>{showAllNotes ? 'Show fewer notes' : `View all ${notes.length} notes`}</button>}
      </>}
    </div>
    {coordinator && owner && incident.status === 'IN_PROGRESS' && <form className="resolve-form" onSubmit={submitResolution}>
      <h4><Icon name="check" size={17} />Record resolution</h4><label htmlFor={`resolve-${incident.id}`}>Resolution details <span className="required">*</span></label>
      <textarea id={`resolve-${incident.id}`} value={resolution} onChange={(event) => setResolution(event.target.value)} disabled={pending}
        placeholder="Describe the actions taken and the outcome…" maxLength={5000} rows={3} required
        aria-invalid={Boolean(fieldError(resolve.error, 'resolution_note'))} aria-describedby={`resolve-help-${incident.id}`} />
      {fieldError(resolve.error, 'resolution_note') && <p className="field-error">{fieldError(resolve.error, 'resolution_note')}</p>}
      <div className="form-footer"><p className="muted small" id={`resolve-help-${incident.id}`}>This records the incident resolution. Delivery status is updated by the carrier data source.</p>
        <button className="button button-success button-small" disabled={pending || !resolution.trim()}>{resolve.isPending ? 'Saving…' : 'Record resolution'}</button></div>
    </form>}
  </article>;
}
