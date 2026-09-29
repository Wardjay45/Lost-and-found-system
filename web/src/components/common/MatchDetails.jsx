import { useState, useEffect } from 'react';

const API_URL = '/api';

function formatPct(score) { return `${Math.round((score || 0) * 100)}%`; }
function getScoreColor(score) {
  if (score >= 0.7) return 'text-green-600 dark:text-green-400';
  if (score >= 0.5) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}
function getBarColor(score) {
  if (score >= 0.7) return 'bg-green-500';
  if (score >= 0.5) return 'bg-yellow-500';
  return 'bg-red-500';
}

export default function MatchDetails({ itemId, table }) {
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!itemId || !table) { setLoading(false); return; }
    setLoading(true);
    setError('');

    async function load() {
      try {
        // 1. Try the timestamp-based endpoint first
        const res1 = await fetch(`${API_URL}/ai/match-for-item/${itemId}/${table}`);
        if (res1.ok) {
          const data = await res1.json();
          if (data.match) {
            setMatch(data.match);
            setLoading(false);
            return;
          }
        }

        // 2. Fallback: search activity logs (same approach as FTFVerificationForm which works)
        const logsRes = await fetch(`${API_URL}/activity-logs?action=match`);
        if (!logsRes.ok) throw new Error('Failed to load activity logs');
        const logs = await logsRes.json();

        // Find a log referencing this item
        const matchLog = (logs || []).find(log => {
          try {
            const d = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
            return d && (String(d.lost_item_id) === String(itemId) || String(d.found_item_id) === String(itemId));
          } catch { return false; }
        });

        if (!matchLog) { setMatch(null); setLoading(false); return; }

        const details = typeof matchLog.details === 'string' ? JSON.parse(matchLog.details) : matchLog.details;
        const lostId = details.lost_item_id;
        const foundId = details.found_item_id;

        // Fetch both items and scores in parallel
        const [lostRes, foundRes, scoresRes] = await Promise.all([
          lostId ? fetch(`${API_URL}/lost-items/${lostId}`) : null,
          foundId ? fetch(`${API_URL}/found-items/${foundId}`) : null,
          (lostId && foundId) ? fetch(`${API_URL}/ai/compute-match-scores`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lost_id: lostId, found_id: foundId }),
          }) : null,
        ]);

        const lostItem = lostRes?.ok ? await lostRes.json() : null;
        const foundItem = foundRes?.ok ? await foundRes.json() : null;
        let scores = { score: details.score || 0, image_score: details.image_score || 0, text_score: details.text_score || 0 };
        if (scoresRes?.ok) {
          const s = await scoresRes.json();
          if (s.score !== undefined) scores = s;
        }

        setMatch({
          score: scores.score,
          image_score: scores.image_score,
          text_score: scores.text_score,
          lost_item: lostItem ? {
            description: lostItem.description,
            location: lostItem.location_lost || '',
            reporter_name: lostItem.reporter_name || '',
            image: lostItem.image || null,
          } : (details.lost_item_name ? { description: details.lost_item_name, location: '', reporter_name: details.lost_reporter_name || '', image: null } : null),
          found_item: foundItem ? {
            description: foundItem.description,
            location: foundItem.location_found || '',
            finder_name: foundItem.finder_name || '',
            image: foundItem.image || null,
          } : (details.found_item_name ? { description: details.found_item_name, location: '', finder_name: '', image: null } : null),
        });
      } catch (e) {
        console.error('MatchDetails error:', e);
        setError(e.message);
        setMatch(null);
      }
      setLoading(false);
    }

    load();
  }, [itemId, table]);

  if (loading) {
    return (
      <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-200 dark:border-indigo-800">
        <p className="text-sm text-indigo-600 dark:text-indigo-400 animate-pulse">🔍 Loading match details...</p>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-200 dark:border-amber-800 text-xs text-amber-600 dark:text-amber-400">
        ⚠️ Match data not available for this item yet. {(error ? `(${error})` : '')}
      </div>
    );
  }

  const hasScores = (match.score > 0 || match.image_score > 0 || match.text_score > 0);

  return (
    <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-200 dark:border-indigo-800 space-y-4">
      <div className="text-center">
        <h4 className="text-sm font-bold text-indigo-700 dark:text-indigo-400">🔗 Potential Match</h4>
        {hasScores && (
          <p className="text-xs text-indigo-500 dark:text-indigo-400/70">
            {formatPct(match.score)} combined · 70% image + 30% text weighted
          </p>
        )}
      </div>

      {hasScores && (
        <div className="space-y-2">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-500">Combined</span>
              <span className={`font-bold ${getScoreColor(match.score)}`}>{formatPct(match.score)}</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
              <div className={`rounded-full h-1.5 ${getBarColor(match.score)}`} style={{ width: `${Math.min(100, (match.score || 0) * 100)}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-500">🖼️ Image</span>
              <span className={`font-bold ${getScoreColor(match.image_score || 0)}`}>{formatPct(match.image_score)}</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
              <div className={`rounded-full h-1.5 ${getBarColor(match.image_score || 0)}`} style={{ width: `${Math.min(100, (match.image_score || 0) * 100)}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-500">📝 Text</span>
              <span className={`font-bold ${getScoreColor(match.text_score || 0)}`}>{formatPct(match.text_score)}</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
              <div className={`rounded-full h-1.5 ${getBarColor(match.text_score || 0)}`} style={{ width: `${Math.min(100, (match.text_score || 0) * 100)}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* Matched pair display */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
          <p className="text-xs font-bold text-red-700 dark:text-red-400 mb-1">🔍 Lost</p>
          {match.lost_item ? (
            <>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{match.lost_item.description}</p>
              {match.lost_item.location && <p className="text-xs text-gray-500 mt-1">📍 {match.lost_item.location}</p>}
              {match.lost_item.reporter_name && <p className="text-xs text-gray-400">{match.lost_item.reporter_name}</p>}
              {match.lost_item.image && (
                <img src={match.lost_item.image} alt="Lost" className="mt-2 w-full rounded-lg object-contain border" />
              )}
            </>
          ) : (
            <p className="text-xs text-gray-400">Item not found</p>
          )}
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
          <p className="text-xs font-bold text-green-700 dark:text-green-400 mb-1">📦 Found</p>
          {match.found_item ? (
            <>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{match.found_item.description}</p>
              {match.found_item.location && <p className="text-xs text-gray-500 mt-1">📍 {match.found_item.location}</p>}
              {match.found_item.finder_name && <p className="text-xs text-gray-400">{match.found_item.finder_name}</p>}
              {match.found_item.image && (
                <img src={match.found_item.image} alt="Found" className="mt-2 w-full rounded-lg object-contain border" />
              )}
            </>
          ) : (
            <p className="text-xs text-gray-400">Item not found</p>
          )}
        </div>
      </div>
    </div>
  );
}
