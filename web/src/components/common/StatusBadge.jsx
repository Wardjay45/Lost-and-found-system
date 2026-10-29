export default function StatusBadge({ status = 'pending' }) {
  const key = String(status).toLowerCase().replace(/\s+/g, '_');
  return <span className={`status-badge status-${key}`}><span aria-hidden="true" />{String(status).replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())}</span>;
}
