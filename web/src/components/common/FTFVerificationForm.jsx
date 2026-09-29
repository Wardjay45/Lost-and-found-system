import { useState, useEffect } from 'react';

const API_URL = '/api';

/**
 * Face-to-Face Verification Form
 * Auto-detects the matched found item from activity logs.
 * Admin verifies the student's identity and knowledge, then releases the item.
 */
export default function FTFVerificationForm({ lostItem, onComplete, onCancel }) {
  const [foundItemId, setFoundItemId] = useState('');
  const [foundItemName, setFoundItemName] = useState('');
  const [loadingMatch, setLoadingMatch] = useState(true);
  const [idVerified, setIdVerified] = useState(false);
  const [knowledgeAnswers, setKnowledgeAnswers] = useState('');
  const [knowledgePassed, setKnowledgePassed] = useState(false);
  const [verifiedBy, setVerifiedBy] = useState('');
  const [notes, setNotes] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState('');

  // Auto-detect the matched found item from activity logs
  useEffect(() => {
    const findMatchedItem = async () => {
      try {
        const res = await fetch(`${API_URL}/activity-logs?action=match`);
        if (!res.ok) return;
        const logs = await res.json();
        // Search logs for a match containing this lost item
        for (const log of logs) {
          try {
            const data = JSON.parse(log.details);
            if (data.lost_item_id === lostItem.id && data.found_item_id) {
              setFoundItemId(data.found_item_id);
              setFoundItemName(data.found_item_name || '');
              return;
            }
          } catch {}
        }
      } catch (e) {
        console.error('Failed to find matched item:', e);
      } finally {
        setLoadingMatch(false);
      }
    };
    if (lostItem?.id) findMatchedItem();
  }, [lostItem?.id]);

  const handleClaim = async () => {
    if (!verifiedBy.trim()) {
      setError('Please enter the admin name');
      return;
    }
    if (!idVerified) {
      setError('Please verify the school ID first');
      return;
    }
    if (!knowledgePassed) {
      setError('Please confirm the knowledge check passed');
      return;
    }
    if (!foundItemId) {
      setError('Could not find the matched found item. Please use Smart Matching to complete the handover.');
      return;
    }
    setError('');
    setClaiming(true);
    try {
      const res = await fetch(`${API_URL}/lost-items/${lostItem.id}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          found_item_id: foundItemId,
          verified_by: verifiedBy,
          id_verified: idVerified,
          knowledge_passed: knowledgePassed,
          notes: `Q&A: ${knowledgeAnswers || 'N/A'}. ${notes}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Claim failed');
      alert('✅ Item released! Claim verified and recorded.');
      if (onComplete) onComplete();
    } catch (e) {
      setError(e.message);
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-200 dark:border-indigo-800 space-y-3">
      <h4 className="text-sm font-semibold text-indigo-700 dark:text-indigo-400">
        ✅ Face-to-Face Verification
      </h4>

      {loadingMatch ? (
        <div className="bg-white dark:bg-gray-700 p-3 rounded-lg text-xs text-gray-500">
          🔍 Finding matched item...
        </div>
      ) : foundItemId ? (
        <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
          <p className="text-xs text-green-700 dark:text-green-400">
            🔗 Matched with Found Item: <strong>{foundItemName || `#${foundItemId}`}</strong>
          </p>
        </div>
      ) : (
        <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
          <p className="text-xs text-amber-700 dark:text-amber-400">
            ⚠️ Could not auto-detect matched found item. Please use Smart Matching to complete.
          </p>
          <div className="mt-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Found Item ID *</label>
            <input
              type="number"
              value={foundItemId}
              onChange={(e) => setFoundItemId(e.target.value)}
              placeholder="Enter manually"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
        </div>
      )}

      <label className="flex items-center gap-3 p-3 bg-white dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 cursor-pointer">
        <input
          type="checkbox"
          checked={idVerified}
          onChange={(e) => setIdVerified(e.target.checked)}
          className="w-5 h-5 rounded accent-indigo-600"
        />
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">🪪 School ID Verified</p>
          <p className="text-xs text-gray-500">Student presented a valid school ID matching the reporter: {lostItem.reporter_name || lostItem.reporterName || 'N/A'}</p>
        </div>
      </label>

      <div className="p-3 bg-white dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600">
        <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">❓ Knowledge Check (Q&A)</p>
        <p className="text-xs text-gray-500 mb-2">
          Ask the student to describe the lost item. Suggested questions:
        </p>
        <ul className="text-xs text-gray-400 mb-2 list-disc pl-4">
          <li>What color/brand is the item?</li>
          <li>Any distinguishing marks or features?</li>
          <li>Where and when was it lost?</li>
          <li>What was inside (if wallet/bag)?</li>
        </ul>
        <textarea
          value={knowledgeAnswers}
          onChange={(e) => setKnowledgeAnswers(e.target.value)}
          placeholder="Record student's answers here..."
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 outline-none"
          rows={4}
        />
        <label className="flex items-center gap-2 mt-2">
          <input
            type="checkbox"
            checked={knowledgePassed}
            onChange={(e) => setKnowledgePassed(e.target.checked)}
            className="w-4 h-4 rounded accent-indigo-600"
          />
          <span className="text-xs text-gray-500">Student correctly identified the item — knowledge check passed</span>
        </label>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Admin Name *</label>
        <input
          type="text"
          value={verifiedBy}
          onChange={(e) => setVerifiedBy(e.target.value)}
          placeholder="e.g. Admin User"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 outline-none"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Additional notes..."
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 outline-none"
          rows={2}
        />
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-3 py-2 rounded-lg text-xs">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleClaim}
          disabled={claiming || loadingMatch}
          className="flex-1 bg-green-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {claiming ? 'Processing...' : loadingMatch ? 'Loading matched item...' : '✅ Approve & Release Item'}
        </button>
        {onCancel && (
          <button
            onClick={() => onCancel(foundItemId)}
            disabled={claiming}
            className="flex-1 bg-red-500 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-red-600 disabled:opacity-50 transition-colors"
          >
            ❌ Cancel Approval
          </button>
        )}
      </div>
    </div>
  );
}