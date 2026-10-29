export default function ItemDescription({ description, compact = false }) {
  return <dl className={`report-description${compact ? ' report-description-compact' : ''}`}>
    <dt>Description</dt>
    <dd>{description?.trim() || 'No description provided.'}</dd>
  </dl>;
}
