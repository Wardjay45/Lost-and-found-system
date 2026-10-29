import AppIcon from './AppIcon';

export default function ReportReadState({ unread }) {
  return <span className={`report-read-state ${unread ? 'report-read-state-unread' : 'report-read-state-viewed'}`} aria-label={unread ? 'Unread report' : 'Viewed report'}>
    {unread ? <span className="report-read-dot" aria-hidden="true" /> : <AppIcon name="check" />}
    {unread ? 'Unread' : 'Viewed'}
  </span>;
}
