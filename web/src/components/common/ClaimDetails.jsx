import { useEffect, useState } from 'react';
import request from '../../services/api';
import MatchComparison from './MatchComparison';
import { ErrorState, LoadingState } from './UI';
import { formatDateTime } from '../../utils/formatters';

const checkLabel = (value, passed) => value === true ? passed : value === false ? 'Not passed' : 'Not recorded';

export default function ClaimDetails({ itemId, table }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError('');
    request('/activity-logs/claim/' + table + '/' + itemId, { signal: controller.signal })
      .then(result => {
        if (!result || !Object.hasOwn(result, 'match') || !Object.hasOwn(result, 'verification')) throw new Error('Unable to load the completed claim.');
        if (!controller.signal.aborted) setData(result);
      })
      .catch(err => { if (!controller.signal.aborted) setError(err.message); });
    return () => controller.abort();
  }, [itemId, table, revision]);
  if (error) return <ErrorState message={error} onRetry={() => setRevision(value => value + 1)} />;
  if (!data) return <LoadingState label="Loading comparison and claim verification..." />;
  const verification = data.verification;
  return <div className="claim-details">
    {data.match ? <MatchComparison match={data.match} /> : <div className="ui-alert ui-alert-warning">No saved comparison is available for this claimed report.</div>}
    <section className="match-score-panel" aria-label="Completed claim verification">
      <h3>Claim verification</h3>
      {verification ? <dl className="collection-detail-fields claim-verification-fields">
        <div><dt>Verified by</dt><dd>{verification.verified_by || 'Not recorded'}</dd></div>
        <div><dt>Released on</dt><dd>{verification.claimed_on ? formatDateTime(verification.claimed_on) : 'Not recorded'}</dd></div>
        <div><dt>School ID verification</dt><dd>{checkLabel(verification.id_verified, 'Verified')}</dd></div>
        <div><dt>Knowledge check</dt><dd>{checkLabel(verification.knowledge_passed, 'Passed')}</dd></div>
        <div className="collection-detail-wide"><dt>Ownership questions and answers</dt><dd>{verification.knowledge_answers || 'See the original Q&A and verification notes below. Older claims may have no recorded answers.'}</dd></div>
        <div className="collection-detail-wide"><dt>Q&A and verification notes</dt><dd>{verification.notes?.trim() || 'No Q&A or additional notes were recorded.'}</dd></div>
        <div className="collection-detail-wide"><dt>Handover photo</dt><dd>{verification.handover_image ? <img className="handover-photo-preview" src={verification.handover_image} alt="Recorded handover of the item to its owner" /> : 'No handover photo was recorded for this older claim.'}</dd></div>
        {verification.recovery_id && <div className="collection-detail-wide"><dt>Handover reference</dt><dd>{verification.recovery_id}</dd></div>}
      </dl> : <p>No verification history was recorded for this report.</p>}
    </section>
  </div>;
}
