import ItemPhoto from './ItemPhoto';
import ReportReadState from './ReportReadState';

export default function ReportItemSummary({ item, kind, pairedItem, unread }) {
  const description = item.description?.trim() || 'No description provided.';
  const foundDescription = pairedItem?.description?.trim() || 'No description provided.';
  return <div className="report-item-summary">
    <div className={`report-item-photos${pairedItem ? ' report-item-photos-pair' : ''}`}>
      <ItemPhoto item={item} kind={kind} />
      {pairedItem && <ItemPhoto item={pairedItem} kind="found" />}
    </div>
    <div className="report-item-copy">
      <p className="report-item-title report-item-preview" title={description}>{description}</p>
      {pairedItem && <p className="report-item-secondary report-item-preview" title={'Found: ' + foundDescription}>Found: {foundDescription}</p>}
      <div className="report-item-meta"><ReportReadState unread={unread} /></div>
    </div>
  </div>;
}
