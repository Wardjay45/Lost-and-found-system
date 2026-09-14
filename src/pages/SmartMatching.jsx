import { useState, useEffect, useMemo } from 'react';
import Modal from '../components/common/Modal';
import { categoriesApi } from '../services/api';
import { showToast } from '../components/common/Toast';
const API_URL = '/api';

const ALL_CATEGORIES_OPTION = '__all__';

export default function SmartMatching() {
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
      const res = await fetch(`${API_URL}/ai/auto-match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.matches) {
        setMatches(data.matches);
        setStats({ lostCount: data.lost_count, foundCount: data.found_count });
      }
    } catch (err) {
      console.error('Auto-match error:', err);
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
    if (score >= 0.7) return '🟢';
    if (score >= 0.5) return '🟡';
    return '🔴';
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cosine Similarity Matching</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Auto-matched lost & found items using cosine similarity
          </p>
        </div>
        <div className="flex gap-3">
          <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-3 py-1.5 rounded-full text-sm font-medium">
            📦 {stats.foundCount} found · 🔍 {stats.lostCount} lost
          </span>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value={ALL_CATEGORIES_OPTION}>All Categories</option>
            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          <button
            onClick={loadMatches}
            disabled={loading}
            className="bg-indigo-600 text-white px-4 py-1.5 rounded-full text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading ? '🔄 Loading...' : '🔄 Refresh'}
          </button>
        </div>
      </div>

      {/* Adjustable Percentage Slider */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Match Threshold</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Only show matches above <strong>{minScore}%</strong> similarity
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-3 py-1.5 rounded-full text-sm font-bold">
              {filteredMatches.length} matches
            </span>
          </div>
        </div>
        
        {/* Custom range slider styled with percentages */}
        <div className="relative">
          <input
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
              <button
                key={pct}
                onClick={() => setMinScore(pct)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
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
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          <p className="text-3xl mb-3 animate-pulse">🧠</p>
          <p className="font-medium">Running AI matching...</p>
          <p className="text-sm mt-1">Comparing all lost items against found items</p>
        </div>
      ) : matches.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          <p className="text-3xl mb-3">📭</p>
          <p className="font-medium">No matches found</p>
          <p className="text-sm mt-1">Add both lost and found items with embeddings to see matches</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredMatches.map((match) => (
              <div
                key={match.id}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md transition-shadow"
              >
                {/* Score badge + ID */}
                <div className="flex items-center justify-between mb-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${getScoreBg(match.score)}`}>
                    {getStatusDot(match.score)} {formatPct(match.score)} Match
                  </span>
                  <span className="text-xs text-gray-400">
                    L-{match.lost_item?.item_id} → F-{match.found_item?.item_id}
                  </span>
                </div>

                {/* Lost ← → Found side by side */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <p className="text-xs font-medium text-red-700 dark:text-red-400 mb-1">🔍 Lost</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {match.lost_item?.description}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      📍 {match.lost_item?.location}
                    </p>
                    <p className="text-xs text-gray-400">{match.lost_item?.reporter_name}</p>
                  </div>
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <p className="text-xs font-medium text-green-700 dark:text-green-400 mb-1">📦 Found</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {match.found_item?.description}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      📍 {match.found_item?.location}
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
                    <span className="text-gray-500">🖼️ Image</span>
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
                    <span className="text-gray-500">📝 Text</span>
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
                        className="w-full max-h-24 rounded-lg object-cover border border-gray-200 dark:border-gray-700"
                      />
                    </div>
                  )}
                  {match.found_item?.image && (
                    <div className="flex-1">
                      <p className="text-xs text-gray-400 mb-1">Found photo</p>
                      <img
                        src={match.found_item.image}
                        alt="Found"
                        className="w-full max-h-24 rounded-lg object-cover border border-gray-200 dark:border-gray-700"
                      />
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  {match.found_item?.status === 'potential_match' && (
                    <button
                      onClick={() => {
                        setClaimMatch(match);
                        setClaimForm({ verifiedBy: '', idVerified: true, knowledgePassed: true, notes: '' });
                      }}
                      className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
                    >
                      ✅ Face-to-Face Verification
                    </button>
                  )}
                  {match.found_item?.status === 'active' && (
                    <button
                      onClick={async () => {
                        try {
                          // 1. Update found item status to potential_match
                          await fetch(`${API_URL}/found-items/${match.found_item.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ status: 'potential_match' }),
                          });
                          match.found_item.status = 'potential_match';

                          // 2. Update lost item status to potential_match
                          if (match.lost_item?.id) {
                            await fetch(`${API_URL}/lost-items/${match.lost_item.id}`, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ status: 'potential_match' }),
                            });
                            match.lost_item.status = 'potential_match';
                          }

                          // 3. Log activity for the potential match (store IDs as JSON for FTF verification)
                          const scorePct = Math.round(match.score * 100);
                          const lostDesc = match.lost_item?.description || 'Unknown item';
                          const foundDesc = match.found_item?.description || 'Unknown item';
                          const lostId = match.lost_item?.id;
                          const foundId = match.found_item?.id;
                           const logDetails = JSON.stringify({
                             text: `Potential match (${scorePct}% similarity): Lost "${lostDesc}" (${match.lost_item?.item_id || 'N/A'}) ↔ Found "${foundDesc}" (${match.found_item?.item_id || 'N/A'}). Both items set to potential_match status pending Face-to-Face verification.`,
                             lost_item_id: lostId,
                             found_item_id: foundId,
                             lost_item_name: lostDesc,
                             found_item_name: foundDesc,
                             score: match.score,
                             image_score: match.image_score ?? 0,
                             text_score: match.text_score ?? 0,
                             lost_reporter_name: match.lost_item?.reporter_name || '',
                             lost_reporter_id: match.lost_item?.reporter_id || '',
                           });
                          await fetch(`${API_URL}/activity-logs`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              action: 'match',
                              details: logDetails,
                              user_name: 'Admin',
                              role: 'admin',
                            }),
                          });

                          // 4. Send notification message to the lost item reporter
                          const reporterId = match.lost_item?.reporter_id;
                          let reporterName = match.lost_item?.reporter_name;
                          
                          // Try to get the actual account name from users table for reliable match
                          if (reporterId) {
                            try {
                              const userRes = await fetch(`${API_URL}/users/${reporterId}`);
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
                            await fetch(`${API_URL}/messages`, {
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
                          setMatches(matches.filter(m => m.id !== match.id));
                          showToast('Go to Lost Items → filter by "Potential Match" → click View → complete Face-to-Face Verification.', 'success', 'Marked as Potential Match');
                        } catch (e) { console.error(e); }
                      }}
                      className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700"
                    >
                      🔍 Mark as Potential Match
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedMatch(match)}
                    className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg text-sm py-2 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>

          {filteredMatches.length === 0 && (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <p className="text-lg mb-1">No matches above {minScore}%</p>
              <p className="text-sm">Lower the threshold slider to see more results</p>
            </div>
          )}
        </>
      )}

      {/* Detail Modal */}
      <Modal isOpen={!!selectedMatch} onClose={() => setSelectedMatch(null)} title="Match Details" size="lg">
        {selectedMatch && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-sm font-bold ${getScoreBg(selectedMatch.score)}`}>
                {getStatusDot(selectedMatch.score)} {formatPct(selectedMatch.score)} Match
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl">
                <h5 className="text-sm font-semibold text-red-800 dark:text-red-400 mb-2">🔍 Lost Item</h5>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {selectedMatch.lost_item?.description}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  ID: {selectedMatch.lost_item?.item_id}
                </p>
                <p className="text-xs text-gray-500">
                  Location: {selectedMatch.lost_item?.location}
                </p>
                <p className="text-xs text-gray-500">
                  Reporter: {selectedMatch.lost_item?.reporter_name}
                </p>
                {selectedMatch.lost_item?.image && (
                  <img
                    src={selectedMatch.lost_item.image}
                    alt="Lost item"
                    className="w-full max-h-32 mt-2 rounded-lg object-cover border"
                  />
                )}
              </div>

              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
                <h5 className="text-sm font-semibold text-green-800 dark:text-green-400 mb-2">📦 Found Item</h5>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {selectedMatch.found_item?.description}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  ID: {selectedMatch.found_item?.item_id}
                </p>
                <p className="text-xs text-gray-500">
                  Location: {selectedMatch.found_item?.location}
                </p>
                <p className="text-xs text-gray-500">
                  Reporter: {selectedMatch.found_item?.reporter_name}
                </p>
                {selectedMatch.found_item?.image && (
                  <img
                    src={selectedMatch.found_item.image}
                    alt="Found item"
                    className="w-full max-h-32 mt-2 rounded-lg object-cover border"
                  />
                )}
              </div>
            </div>

            {/* Score breakdown */}
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-xl">
              <h5 className="font-medium text-gray-900 dark:text-white mb-3">AI Similarity Breakdown</h5>
              
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600 dark:text-gray-400">Combined</span>
                    <span className={`font-bold ${getScoreColor(selectedMatch.score)}`}>
                      {formatPct(selectedMatch.score)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2.5">
                    <div
                      className={`rounded-full h-2.5 ${getBarColor(selectedMatch.score)}`}
                      style={{ width: `${Math.min(100, selectedMatch.score * 100)}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600 dark:text-gray-400">🖼️ Image Similarity</span>
                    <span className={`font-bold ${getScoreColor(selectedMatch.image_score)}`}>
                      {formatPct(selectedMatch.image_score)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                    <div
                      className={`rounded-full h-2 ${getBarColor(selectedMatch.image_score)}`}
                      style={{ width: `${Math.min(100, selectedMatch.image_score * 100)}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600 dark:text-gray-400">📝 Text Similarity</span>
                    <span className={`font-bold ${getScoreColor(selectedMatch.text_score)}`}>
                      {formatPct(selectedMatch.text_score)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                    <div
                      className={`rounded-full h-2 ${getBarColor(selectedMatch.text_score)}`}
                      style={{ width: `${Math.min(100, selectedMatch.text_score * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
                CLIP ViT-B/32 image embeddings (512-dim) + E5-base-v2 text embeddings (768-dim)<br />
                Weighted: 70% image · 30% text = {formatPct(selectedMatch.score)} combined
              </p>
            </div>
          </div>
        )}
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
                  <p className="text-sm font-medium text-gray-900 dark:text-white">🪪 School ID Verified</p>
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
                  <p className="text-sm font-medium text-gray-900 dark:text-white">❓ Knowledge Check Passed</p>
                  <p className="text-xs text-gray-500">Student correctly answered questions about the item (color, brand, distinguishing features, location)</p>
                </div>
              </label>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Admin Name *</label>
                <input
                  type="text"
                  value={claimForm.verifiedBy}
                  onChange={(e) => setClaimForm({ ...claimForm, verifiedBy: e.target.value })}
                  placeholder="e.g. Admin User"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Notes (optional)</label>
                <textarea
                  value={claimForm.notes}
                  onChange={(e) => setClaimForm({ ...claimForm, notes: e.target.value })}
                  placeholder="e.g. Additional verification details..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 outline-none"
                  rows={2}
                />
              </div>
            </div>

            <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={async () => {
                  if (!claimForm.verifiedBy.trim()) return alert('Please enter the admin name');
                  setClaiming(true);
                  try {
                    const res = await fetch(`${API_URL}/lost-items/${claimMatch.lost_item?.id}/claim`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
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
                    alert('✅ Item claimed successfully! Verification recorded in activity log.');
                  } catch (e) {
                    alert('❌ Error: ' + e.message);
                  } finally {
                    setClaiming(false);
                  }
                }}
                disabled={claiming || !claimForm.verifiedBy.trim()}
                className="flex-1 bg-green-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {claiming ? 'Processing...' : '✅ Approve & Release Item'}
              </button>
              <button
                onClick={() => setClaimMatch(null)}
                className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600"
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