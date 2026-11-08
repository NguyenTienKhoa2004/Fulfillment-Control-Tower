import { errorMessage } from '../api/errors';

export function QueryState({ loading, error, retry }: {
  loading: boolean; error: Error | null; retry?: () => void;
}) {
  if (loading) return <div className="loading-state" role="status"><span className="spinner" />Loading data…</div>;
  if (error) return <div role="alert" className="notice notice-error"><span>{errorMessage(error)}</span>
    {retry && <button className="button button-small button-ghost" onClick={retry}>Try again</button>}</div>;
  return null;
}
