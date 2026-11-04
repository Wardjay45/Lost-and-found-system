import { useEffect, useMemo, useState } from 'react';
import useNotifications from '../../hooks/useNotifications';
import useMarkVisibleRead from '../../hooks/useMarkVisibleRead';
import request from '../../services/api';
import { loadPotentialMatch } from '../../services/potentialMatch.mjs';
import MatchComparison from './MatchComparison';
import { ErrorState, LoadingState } from './UI';

export default function MatchDetails({ itemId, table, onMatchLoaded }) {
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const { potentialPairs } = useNotifications();
  const viewedPairs = useMemo(() => match ? potentialPairs.filter(pair => String(pair.lost_item_id) === String(match.lost_item?.id) && String(pair.found_item_id) === String(match.found_item?.id)) : [], [match, potentialPairs]);
  const lostRows = useMemo(() => match?.lost_item ? [match.lost_item] : [], [match]);
  const foundRows = useMemo(() => match?.found_item ? [match.found_item] : [], [match]);
  useMarkVisibleRead('potential', viewedPairs);
  useMarkVisibleRead('lost', lostRows);
  useMarkVisibleRead('found', foundRows);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setMatch(null); onMatchLoaded?.(null);
    loadPotentialMatch(itemId, table, request, { signal: controller.signal })
      .then(value => { if (!controller.signal.aborted) { setMatch(value); onMatchLoaded?.(value); } })
      .catch(err => { if (!controller.signal.aborted) setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [itemId, table, revision, onMatchLoaded]);
  if (loading) return <LoadingState label="Loading match details..." />;
  if (error) return <ErrorState message={error} onRetry={() => setRevision(value => value + 1)} />;
  if (!match) return <div className="ui-alert ui-alert-warning">Match data not available for this item yet.</div>;
  return <MatchComparison match={match} />;
}
