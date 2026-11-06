import { useMutation } from '@tanstack/react-query';
import { api } from '../api/client';
import { errorMessage } from '../api/errors';
import { useProfile, useRefreshData } from '../api/hooks';
import { Icon } from './Icon';
import { useToast } from './ToastProvider';

export function EvaluateButton() {
  const profile = useProfile();
  const refresh = useRefreshData();
  const notify = useToast();
  const mutation = useMutation({
    mutationFn: api.evaluateRisks,
    onSuccess: async (result) => {
      notify(`Đã kiểm tra ${result.evaluated_count} đơn · ${result.created_incident_count} sự cố mới.`);
      await refresh();
    },
  });
  if (profile.data?.role !== 'LOGISTICS_COORDINATOR') return null;
  return <div className="evaluate-action">
    <button className="button button-primary" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
      <Icon name="refresh" size={17} />{mutation.isPending ? 'Đang kiểm tra…' : 'Kiểm tra rủi ro'}
    </button>
    {mutation.error && <p role="alert" className="action-error">{errorMessage(mutation.error)}</p>}
  </div>;
}
