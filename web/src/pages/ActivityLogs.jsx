import { useState, useEffect } from 'react';
import { activityLogsApi } from '../services/api';
import { timeAgo } from '../utils/formatters';

const API_URL = '/api';

const actionIcons = {
  report: '📝', match: '🔗', claim: '✅', resolve: '✔️', delete: '🗑️',
  approve: '👍', reject: '👎', message: '📨', export: '📄',
};

const parseMatchDetails = (details) => {
  try {
    if (!details) return null;
    const parsed = JSON.parse(details);
    if (parsed.lost_item_id && parsed.found_item_id) return parsed;
    return null;
  } catch { return null; }
};

export default function ActivityLogs() {
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activityLogs, setActivityLogs] = useState([]);
  const [expandedLog, setExpandedLog] = useState(null);
  const [ftfForm, setFtfForm] = useState({ verifiedBy: '', idVerified: true, knowledgeAnswers: '', notes: '', questions: [] });
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    activityLogsApi.getAll({ action: filterType !== 'all' ? filterType : undefined }).then(setActivityLogs).catch(console.error);
  }, [filterType]);

  const filtered = activityLogs.filter(l => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const detailsText = l.details || '';
      const matchData = parseMatchDetails(detailsText);
      const searchText = matchData ? matchData.text : detailsText;
      return searchText.toLowerCase().includes(q) || (l.user_name || '').toLowerCase().includes(q);
    }
    return true;
  });

  const getDisplayText = (log) => {
    const matchData = parseMatchDetails(log.details);
    return matchData ? matchData.text : log.details;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Activity Logs</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">System activities & Face-to-Face Verification</p>
        </div>
        <div></div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="min-w-[160px]">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Type</label>
            <select value={filterType} onChange={e => { setFilterType(e.target.value); setExpandedLog(null); }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none">
              <option value="all">All Activities</option>
              <option value="report">Reports</option>
              <option value="match">Matches</option>
              <option value="claim">Claims</option>
              <option value="approve">Approvals</option>
              <option value="reject">Rejections</option>
              <option value="resolve">Resolutions</option>
              <option value="update">Updates</option>
              <option value="delete">Deletions</option>
              <option value="message">Messages</option>
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Search</label>
            <input type="text" placeholder="Search..." value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {filtered.map(log => {
            const matchData = parseMatchDetails(log.details);
            const displayText = getDisplayText(log);
            const isMatchLog = log.action === 'match' && matchData;
            const isExpanded = expandedLog === log.id;

            return (
              <div key={log.id}>
                <div
                  className={`flex items-start gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer ${isExpanded ? 'bg-indigo-50 dark:bg-indigo-900/10' : ''}`}
                  onClick={() => {
                    setExpandedLog(isExpanded ? null : log.id);
                    if (!isExpanded) {
                      setFtfForm({ verifiedBy: '', idVerified: true, knowledgeAnswers: '', notes: '' });
                    }
                  }}
                >
                  <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-lg flex-shrink-0">
                    {actionIcons[log.action] || '📋'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">{log.action}</p>
                      {isMatchLog && (
                        <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded text-xs font-medium">
                          🔗 {Math.round((matchData.score || 0) * 100)}% match — Pending FTF
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{displayText}</p>
                    {matchData && (
                      <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-1">
                        Lost: {matchData.lost_item_name} | Found: {matchData.found_item_name}
                      </p>
                    )}
                    <div className="flex gap-3 mt-1">
                      {log.user_name && <span className="text-xs text-gray-400">User: {log.user_name}</span>}
                      {log.role && <span className="text-xs text-gray-400">Role: {log.role}</span>}
                      <span className="text-xs text-gray-400">{timeAgo(log.timestamp)}</span>
                    </div>
                  </div>
                  <span className="text-gray-400 text-sm">{isExpanded ? '▲' : '▼'}</span>
                </div>

                {/* Expanded FTF Verification Form */}
                {isExpanded && isMatchLog && (
                  <div className="px-4 pb-5 bg-gray-50 dark:bg-gray-700/30 border-t border-gray-100 dark:border-gray-700">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white pt-4 mb-3">
                      ✅ Face-to-Face Verification
                    </h4>

                    {/* Match summary */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <p className="text-xs font-medium text-red-700 dark:text-red-400">🔍 Lost Item</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{matchData.lost_item_name}</p>
                        <p className="text-xs text-gray-500">Lost by: {matchData.lost_reporter_name || 'N/A'}</p>
                        <p className="text-xs text-gray-400">Student ID: {matchData.lost_reporter_id || 'N/A'}</p>
                      </div>
                      <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <p className="text-xs font-medium text-green-700 dark:text-green-400">📦 Found Item</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{matchData.found_item_name}</p>
                        <p className="text-xs text-gray-500">Similarity: {Math.round((matchData.score || 0) * 100)}%</p>
                      </div>
                    </div>

                    {/* FTF Verification Form */}
                    <div className="space-y-3">
                      <label className="flex items-center gap-3 p-3 bg-white dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 cursor-pointer">
                        <input type="checkbox" checked={ftfForm.idVerified}
                          onChange={(e) => setFtfForm({ ...ftfForm, idVerified: e.target.checked })}
                          className="w-5 h-5 rounded accent-indigo-600" />
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">🪪 School ID Verified</p>
                          <p className="text-xs text-gray-500">Student presented a valid school ID matching the reporter</p>
                        </div>
                      </label>

                      {/* Knowledge Check — Q&A style */}
                      <div className="p-3 bg-white dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600">
                        <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">❓ Knowledge Check (Q&A)</p>
                        <p className="text-xs text-gray-500 mb-2">Ask the student to describe the item. Record their answers below.</p>
                        <p className="text-xs text-gray-400 mb-2">
                          Suggested questions: What color is the item? What brand? Any distinguishing marks or features? Where was it lost? When was it lost?
                        </p>
                        <textarea
                          value={ftfForm.knowledgeAnswers}
                          onChange={(e) => setFtfForm({ ...ftfForm, knowledgeAnswers: e.target.value })}
                          placeholder="Student's answers...&#10;e.g.&#10;Q: What color? A: Black&#10;Q: What brand? A: Nike&#10;Q: Any marks? A: Has a scratch on the bottom&#10;Q: Where lost? A: Library 2nd floor"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 outline-none"
                          rows={5}
                        />
                        <label className="flex items-center gap-2 mt-2">
                          <input type="checkbox" checked={ftfForm.knowledgePassed}
                            onChange={(e) => setFtfForm({ ...ftfForm, knowledgePassed: e.target.checked })}
                            className="w-4 h-4 rounded accent-indigo-600" />
                          <span className="text-xs text-gray-500">Knowledge check passed — student correctly identified the item</span>
                        </label>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Admin Name *</label>
                        <input type="text" value={ftfForm.verifiedBy}
                          onChange={(e) => setFtfForm({ ...ftfForm, verifiedBy: e.target.value })}
                          placeholder="e.g. Admin User"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 outline-none" />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Notes (optional)</label>
                        <textarea value={ftfForm.notes}
                          onChange={(e) => setFtfForm({ ...ftfForm, notes: e.target.value })}
                          placeholder="Additional notes..."
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 outline-none" rows={2} />
                      </div>
                    </div>

                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={async () => {
                          if (!ftfForm.verifiedBy.trim()) return alert('Please enter the admin name');
                          if (!ftfForm.idVerified) return alert('Please verify the school ID first');
                          if (!ftfForm.knowledgePassed) return alert('Please confirm the knowledge check passed');
                          setClaiming(true);
                          try {
                            const res = await fetch(`${API_URL}/lost-items/${matchData.lost_item_id}/claim`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                found_item_id: matchData.found_item_id,
                                verified_by: ftfForm.verifiedBy,
                                id_verified: ftfForm.idVerified,
                                knowledge_passed: ftfForm.knowledgePassed,
                                notes: `Knowledge Answers: ${ftfForm.knowledgeAnswers || 'N/A'}. ${ftfForm.notes}`,
                              }),
                            });
                            const data = await res.json();
                            if (!res.ok) throw new Error(data.error || 'Claim failed');
                            setExpandedLog(null);
                            alert('✅ Item released! Claim recorded in activity log.');
                            activityLogsApi.getAll({ action: filterType !== 'all' ? filterType : undefined }).then(setActivityLogs).catch(console.error);
                          } catch (e) {
                            alert('❌ Error: ' + e.message);
                          } finally {
                            setClaiming(false);
                          }
                        }}
                        disabled={claiming || !ftfForm.verifiedBy.trim()}
                        className="flex-1 bg-green-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                      >
                        {claiming ? 'Processing...' : '✅ Approve & Release Item'}
                      </button>
                      <button onClick={() => setExpandedLog(null)}
                        className="px-6 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">No activity logs found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
