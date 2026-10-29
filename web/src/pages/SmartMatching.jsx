import AppIcon from '../components/common/AppIcon';
import { PageHeader, DataRegion } from '../components/common/UI';
import { useState, useEffect, useMemo, useRef } from 'react';
import Modal from '../components/common/Modal';
import MatchComparison from '../components/common/MatchComparison';
import ItemDescription from '../components/common/ItemDescription';
import { categoriesApi, activityLogsApi, lostItemsApi, foundItemsApi } from '../services/api';
import { recordPotentialMatch } from '../services/recordPotentialMatch.mjs';
import { showToast } from '../components/common/Toast';
const API_URL = import.meta.env.VITE_API_URL || '/api';
const authenticatedFetch = (url, options = {}) => fetch(url, { ...options, headers: { ...options.headers, Authorization: 'Bearer ' + (localStorage.getItem('token') || '') } });

const ALL_CATEGORIES_OPTION = '__all__';

export default function SmartMatching() {
  const [pageError, setPageError] = useState('');
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [minScore, setMinScore] = useState(50); // adjustable percentage threshold
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [stats, setStats] = useState({ lostCount: 0, foundCount: 0 });
  const [categories, setCategories] = useState([]);
  const [filterCategory, setFilterCategory] = useState(ALL_CATEGORIES_OPTION);
  const [claimMatch, setClaimMatch] = useState(null);
  const [claimForm, setClaimForm] = useState({ verifiedBy: '', idVerified: true, knowledgePassed: true, notes: '' });
  const [claiming, setClaiming] = useState(false);
  const [markingMatch, setMarkingMatch] = useState(null);
  const markingRef = useRef(false);

  useEffect(() => {
    loadMatches();
    categoriesApi.getAll().then(data => {
      if (Array.isArray(data)) {
        setCategories(data.filter(c => c.auto_tagging !== false));
      }
    }).catch(console.error);
  }, []);

  const loadMatches = async () => {
    setLoading(true);
    try {
      const res = await authenticatedFetch(`${API_URL}/ai/auto-match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Unable to load matching results. Please try again.');
      const data = await res.json();
      if (data.matches) {
        setMatches(data.matches);
        setStats({ lostCount: data.lost_count, foundCount: data.found_count });
      }
    } catch (err) {
      setPageError(err.message || 'Unable to load matching results.');
    } finally {
      setLoading(false);
    }
  };

  const filteredMatches = useMemo(() => {
    return matches.filter(m => {
      if (m.score * 100 < minScore) return false;
      if (filterCategory !== ALL_CATEGORIES_OPTION) {
        const lostCat = m.lost_item?.category_name;
        const foundCat = m.found_item?.category_name;
        if (lostCat !== filterCategory && foundCat !== filterCategory) return false;
      }
      return true;
    });
  }, [matches, minScore, filterCategory]);

  const formatPct = (score) => `${Math.round(score * 100)}%`;

  const getScoreColor = (score) => {
    if (score >= 0.7) return 'text-green-600 dark:text-green-400';
    if (score >= 0.5) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreBg = (score) => {
    if (score >= 0.7) return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
    if (score >= 0.5) return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400';
    return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
  };

  const getBarColor = (score) => {
    if (score >= 0.7) return 'bg-green-500';
    if (score >= 0.5) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getStatusDot = (score) => {
    if (score >= 0.7) return <span className="score-dot tone-success" />;
    if (score >= 0.5) return <span className="score-dot" />;
    return <span className="score-dot tone-error" />;
  };

  return (
    <div className="page page-smartmatching">
      {/* Header */}
      <PageHeader title="Smart matching" description={"Review suggested lost and found pairs before verifying ownership."} actions={<><div className="flex gap-3">
          <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-3 py-1.5 rounded-full text-sm font-medium">
            <AppIcon name="box" /> {stats.foundCount} found · <AppIcon name="search" /> {stats.lostCount} lost
          </span>
          <select aria-label="filter Category"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="ui-input"
          >
            <option value={ALL_CATEGORIES_OPTION}>All Categories</option>
            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          <button type="button"
            onClick={loadMatches}
            disabled={loading}
            className="ui-button ui-button-primary disabled:opacity-50 transition-colors"
          >
            <DataRegion loading={loading} error={pageError} onRetry={loadMatches}>{loading ? "Loading..." : "Refresh"}</DataRegion>
          </button>
        </div></>} />

      {/* Adjustable Percentage Slider */}
      <div className="ui-panel p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Match Threshold</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Only show matches above <strong>{minScore}%</strong> similarity
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-3 py-1.5 rounded-full text-sm font-bold">
              {filteredMatches.length} match{filteredMatches.length === 1 ? '' : 'es'}
            </span>
          </div>
        </div>

        {/* Custom range slider styled with percentages */}
        <div className="relative">
          <input aria-label="Minimum match similarity"
            type="range"
            min="0"
            max="100"
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none cursor-pointer accent-indigo-600"
          />
          <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mt-2 px-1">
            <span>0%</span>
            <span>25%</span>
            <span>50%</span>
            <span>75%</span>
            <span>100%</span>
          </div>
          {/* Quick preset buttons */}
          <div className="flex gap-2 mt-3">
            {[0, 30, 50, 70, 85].map(pct => (
              <button type="button"
                key={pct}
                onClick={() => setMinScore(pct)}
                className={`ui-button px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  minScore === pct
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {pct === 0 ? 'All' : `${pct}%+`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Match Results */}
      {loading ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400 ui-empty">
          <p className="text-3xl mb-3 animate-pulse"><AppIcon name="matching" /></p>
          <p className="font-medium">Running AI matching...</p>
          <p className="text-sm mt-1">Comparing all lost items against found items</p>
        </div>
      ) : filteredMatches.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400 ui-empty">
          <p className="text-3xl mb-3"><AppIcon name="box" /></p>
          <p className="font-medium">{matches.length ? 'No matches meet your filters' : 'No matches found'}</p>
          <p className="text-sm mt-1">{matches.length ? 'Try a lower threshold or another category.' : 'New lost and found reports will be compared here.'}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredMatches.map((match) => (
              <div
                key={match.id}
                className="ui-panel p-5 transition-shadow"
              >
                {/* Score badge + ID */}
                <div className="flex items-center justify-between mb-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${getScoreBg(match.score)}`}>
                    {getStatusDot(match.score)} {formatPct(match.score)} Match
                  </span>
                  <span className="text-xs text-gray-400">
                    {match.lost_item?.item_id} → {match.found_item?.item_id}
                  </span>
                </div>

                {/* Lost ← → Found side by side */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <p className="text-xs font-medium text-red-700 dark:text-red-400 mb-1"><AppIcon name="search" /> Lost</p>
                    <ItemDescription description={match.lost_item?.description} compact />
                    <p className="text-xs text-gray-500 mt-1">
                      <AppIcon name="location" /> {match.lost_item?.location}
                    </p>
                    <p className="text-xs text-gray-400">{match.lost_item?.reporter_name}</p>
                  </div>
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <p className="text-xs font-medium text-green-700 dark:text-green-400 mb-1"><AppIcon name="box" /> Found</p>
                    <ItemDescription description={match.found_item?.description} compact />
                    <p className="text-xs text-gray-500 mt-1">
                      <AppIcon name="location" /> {match.found_item?.location}
                    </p>
                    <p className="text-xs text-gray-400">{match.found_item?.reporter_name}</p>
                  </div>
                </div>

                {/* Combined Score Bar */}
                <div className="mb-2">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500">Combined</span>
                    <span className={`font-bold ${getScoreColor(match.score)}`}>
                      {formatPct(match.score)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className={`rounded-full h-2 transition-all ${getBarColor(match.score)}`}
                      style={{ width: `${Math.min(100, match.score * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Image Similarity */}
                <div className="mb-2">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500"><AppIcon name="image" /> Image</span>
                    <span className={`font-bold ${getScoreColor(match.image_score)}`}>
                      {formatPct(match.image_score)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                    <div
                      className={`rounded-full h-1.5 transition-all ${getBarColor(match.image_score)}`}
                      style={{ width: `${Math.min(100, match.image_score * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Text Similarity */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500"><AppIcon name="document" /> Text</span>
                    <span className={`font-bold ${getScoreColor(match.text_score)}`}>
                      {formatPct(match.text_score)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                    <div
                      className={`rounded-full h-1.5 transition-all ${getBarColor(match.text_score)}`}
                      style={{ width: `${Math.min(100, match.text_score * 100)}%` }}
                    />
                  </div>
                </div>

                <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
                  Weighted: 70% image + 30% text
                </p>

                {/* Item images side by side */}
                <div className="flex gap-2 mb-3">
                  {match.lost_item?.image && (
                    <div className="flex-1">
                      <p className="text-xs text-gray-400 mb-1">Lost photo</p>
                      <img
                        src={match.lost_item.image}
                        alt="Lost"
                        className="w-full h-28 rounded-lg object-contain border border-gray-200 dark:border-gray-700"
                      />
                    </div>
                  )}
                  {match.found_item?.image && (
                    <div className="flex-1">
                      <p className="text-xs text-gray-400 mb-1">Found photo</p>
                      <img
                        src={match.found_item.image}
                        alt="Found"
                        className="w-full h-28 rounded-lg object-contain border border-gray-200 dark:border-gray-700"
                      />
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  {match.found_item?.status === 'potential_match' && (
                    <button type="button"
                      onClick={() => {
                        setClaimMatch(match);
                        setClaimForm({ verifiedBy: '', idVerified: true, knowledgePassed: true, notes: '' });
                      }}
                      className="ui-button ui-button-primary flex-1"
                    >
                      <AppIcon name="success" /> Face-to-Face Verification
                    </button>
                  )}
                  {match.found_item?.status === 'active' && (
                    <button type="button"
                      disabled={markingMatch !== null}
                      onClick={async () => {
                        if (markingRef.current) return;
                        markingRef.current = true; setMarkingMatch(match.id);
                        try {
                          await recordPotentialMatch(match, { activityLogsApi, lostItemsApi, foundItemsApi });
                          const scorePct = Math.round(match.score * 100);

                          // 4. Send notification message to the lost item reporter
                          const reporterId = match.lost_item?.reporter_id;
                          let reporterName = match.lost_item?.reporter_name;

                          // Try to get the actual account name from users table for reliable match
                          if (reporterId) {
                            try {
                              const userRes = await authenticatedFetch(`${API_URL}/users/${reporterId}`);
                              if (userRes.ok) {
                                const userData = await userRes.json();
                                reporterName = userData.name || reporterName;
                              }
                            } catch {}
                          }

                          if (reporterName) {
                            // Use the match notification template from Settings, or fallback to default
                            let template;
                            try {
                              const raw = localStorage.getItem('lost-found-admin-settings');
                              if (raw) {
                                const parsed = JSON.parse(raw);
                                template = parsed.matchTemplate;
                              }
                            } catch {}
                            const notifyMsg = (template || 'Our system has found an item that may match your lost report ({similarity}% similarity). Please visit the Campus Lost and Found Office within three (3) days and bring a valid school ID. The administrator will verify ownership before the item is released.')
                              .replace('{userName}', reporterName)
                              .replace('{itemDescription}', match.lost_item?.description || 'your item')
                              .replace('{similarity}', scorePct);
                            await authenticatedFetch(`${API_URL}/messages`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                sender: 'admin',
                                sender_name: reporterName,
                                text: notifyMsg,
                              }),
                            });
                          }

                          // 5. Remove from Smart Matching list & show toast
                          setMatches(current => current.filter(m => m.lost_item?.id !== match.lost_item?.id && m.found_item?.id !== match.found_item?.id));
                          showToast('Go to Lost Items → filter by "Potential Match" → click View → complete Face-to-Face Verification.', 'success', 'Marked as Potential Match');
                        } catch (e) {
                          showToast(`${e.message || 'Unable to record the decision.'} Some item changes may already be saved; refresh before retrying.`, 'error');
                        } finally { markingRef.current = false; setMarkingMatch(null); }
                      }}
                      className="ui-button ui-button-success flex-1"
                    >
                      <AppIcon name="search" /> {markingMatch === match.id ? "Recording…" : "Mark as Potential Match"}
                    </button>
                  )}
                  <button type="button"
                    onClick={() => setSelectedMatch(match)}
                    className="ui-button ui-button-secondary flex-1"
                  >
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>

          {filteredMatches.length === 0 && (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400 ui-empty">
              <p className="text-lg mb-1">No matches above {minScore}%</p>
              <p className="text-sm">Lower the threshold slider to see more results</p>
            </div>
          )}
        </>
      )}

      {/* Detail Modal */}
      <Modal isOpen={!!selectedMatch} onClose={() => setSelectedMatch(null)} title="Match Details" size="xl">
        {selectedMatch && <MatchComparison match={selectedMatch} />}
      </Modal>

      {/* FTF Verification & Claim Modal */}
      <Modal isOpen={!!claimMatch} onClose={() => setClaimMatch(null)} title="Face-to-Face Verification" size="md">
        {claimMatch && (
          <div className="space-y-4">
            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl">
              <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-400 mb-1">
                {claimMatch.lost_item?.description}
              </p>
              <p className="text-xs text-gray-500">
                Lost by: {claimMatch.lost_item?.reporter_name} · Student ID: {claimMatch.lost_item?.reporter_id || 'N/A'}
              </p>
              <p className="text-xs text-gray-500">
                Matched Found Item: {claimMatch.found_item?.description} ({formatPct(claimMatch.score)} similarity)
              </p>
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={claimForm.idVerified}
                  onChange={(e) => setClaimForm({ ...claimForm, idVerified: e.target.checked })}
                  className="w-5 h-5 rounded accent-indigo-600"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white"><AppIcon name="info" /> School ID Verified</p>
                  <p className="text-xs text-gray-500">Student presented a valid school ID matching the reporter name</p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={claimForm.knowledgePassed}
                  onChange={(e) => setClaimForm({ ...claimForm, knowledgePassed: e.target.checked })}
                  className="w-5 h-5 rounded accent-indigo-600"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white"><AppIcon name="info" /> Knowledge Check Passed</p>
                  <p className="text-xs text-gray-500">Student correctly answered questions about the item (color, brand, distinguishing features, location)</p>
                </div>
              </label>

              <div>
                <label htmlFor="field-smartmatching-1" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Admin Name *</label>
                <input id="field-smartmatching-1" aria-label="Admin Name *"
                  type="text"
                  value={claimForm.verifiedBy}
                  onChange={(e) => setClaimForm({ ...claimForm, verifiedBy: e.target.value })}
                  placeholder="e.g. Admin User"
                  className="ui-input w-full placeholder-gray-400"
                />
              </div>

              <div>
                <label htmlFor="field-smartmatching-2" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Notes (optional)</label>
                <textarea id="field-smartmatching-2" aria-label="Notes (optional)"
                  value={claimForm.notes}
                  onChange={(e) => setClaimForm({ ...claimForm, notes: e.target.value })}
                  placeholder="e.g. Additional verification details..."
                  className="ui-input w-full placeholder-gray-400"
                  rows={2}
                />
              </div>
            </div>

            <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
              <button type="button"
                onClick={async () => {
                  if (!claimForm.verifiedBy.trim()) return showToast('Please enter the admin name', 'warning');
                  setClaiming(true);
                  try {
                    const res = await authenticatedFetch(`${API_URL}/lost-items/${claimMatch.lost_item?.id}/claim`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
                      body: JSON.stringify({
                        found_item_id: claimMatch.found_item?.id,
                        verified_by: claimForm.verifiedBy,
                        id_verified: claimForm.idVerified,
                        knowledge_passed: claimForm.knowledgePassed,
                        notes: claimForm.notes,
                      }),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || 'Claim failed');

                    // Update local state
                    claimMatch.found_item.status = 'claimed';
                    claimMatch.lost_item.status = 'claimed';
                    setMatches([...matches]);
                    setClaimMatch(null);
                    showToast('Item claimed. Verification recorded in activity log.', 'success');
                  } catch (e) {
                    showToast(e.message || 'Unable to complete the claim. Please try again.', 'error');
                  } finally {
                    setClaiming(false);
                  }
                }}
                disabled={claiming || !claimForm.verifiedBy.trim()}
                className="ui-button ui-button-success flex-1 disabled:opacity-50"
              >
                {claiming ? 'Processing...' : "Approve & Release Item"}
              </button>
              <button type="button"
                onClick={() => setClaimMatch(null)}
                className="ui-button ui-button-secondary flex-1"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
