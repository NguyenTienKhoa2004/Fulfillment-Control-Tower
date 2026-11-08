import { useMutation } from '@tanstack/react-query';
import { api } from '../api/client';
import { errorMessage } from '../api/errors';
import { useProfile, useRefreshData } from '../api/hooks';
import { Icon } from './Icon';
import { useToast } from './ToastProvider';
import { quantity } from '../lib/display';

export function EvaluateButton() {
  const profile = useProfile();
  const refresh = useRefreshData();
  const notify = useToast();
  const mutation = useMutation({
    mutationFn: api.evaluateRisks,
    onSuccess: async (result) => {
      notify(`Assessed ${quantity(result.evaluated_count, 'order')} · ${quantity(result.created_incident_count, 'new incident')}.`);
      await refresh();
    },
  });
  if (profile.data?.role !== 'LOGISTICS_COORDINATOR') return null;
  return <div className="evaluate-action">
    <button className="button button-primary" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
      <Icon name="refresh" size={17} />{mutation.isPending ? 'Checking…' : 'Check risks'}
    </button>
    {mutation.error && <p role="alert" className="action-error">{errorMessage(mutation.error)}</p>}
  </div>;
}
