import { labels } from '../lib/display';

export function StatusBadge({ value }: { value: string }) {
  return <span className={`badge badge-${value.toLowerCase()}`}><span className="badge-dot" aria-hidden="true" />{labels[value] || value}</span>;
}
