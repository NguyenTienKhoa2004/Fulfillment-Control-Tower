import { errorMessage } from '../api/errors';

export function QueryState({ loading, error, retry }: {
  loading: boolean; error: Error | null; retry?: () => void;
}) {
  if (loading) return <div className="loading-state" role="status"><span className="spinner" />Đang tải dữ liệu…</div>;
  if (error) return <div role="alert" className="notice notice-error"><span>{errorMessage(error)}</span>
    {retry && <button className="button button-small button-ghost" onClick={retry}>Thử lại</button>}</div>;
  return null;
}
