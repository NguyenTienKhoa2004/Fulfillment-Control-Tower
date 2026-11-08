import { labels } from '../lib/display';

export function StatusBadge({ value, label }: { value: string; label?: string }) {
  return <span className={`badge badge-${value.toLowerCase()}`}><span className="badge-dot" aria-hidden="true" />{label ?? labels[value] ?? value}</span>;
}
