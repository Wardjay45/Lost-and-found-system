import AppIcon from './AppIcon';

export function PageHeader({ title, description, actions, eyebrow }) {
  return <div className="page-header">
    <div className="page-heading">{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p className="page-description">{description}</p>}</div>
    {actions && <div className="page-actions">{actions}</div>}
  </div>;
}
export function EmptyState({ icon = 'box', title = 'Nothing here yet', description, action }) {
  return <div className="empty-state"><span className="empty-state-icon"><AppIcon name={icon} /></span><h3>{title}</h3>{description && <p>{description}</p>}{action}</div>;
}
export function LoadingState({ label = 'Loading your workspace...' }) {
  return <div className="loading-state" role="status"><span className="spinner" /><p>{label}</p><div className="skeleton-lines" aria-hidden="true"><span /><span /><span /></div></div>;
}
export function ErrorState({ message = 'Something went wrong. Please try again.', onRetry }) {
  return <div className="ui-alert ui-alert-error" role="alert"><AppIcon name="warning" /><div><strong>Unable to load this section</strong><p>{message}</p></div>{onRetry && <button type="button" className="ui-button ui-button-secondary" onClick={onRetry}><AppIcon name="refresh" />Try again</button>}</div>;
}
export function DataRegion({ loading, error, empty, emptyTitle = 'No results found', emptyDescription = 'Try adjusting your search or filters.', onRetry, children }) {
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (empty) return <EmptyState icon="search" title={emptyTitle} description={emptyDescription} />;
  return children;
}
