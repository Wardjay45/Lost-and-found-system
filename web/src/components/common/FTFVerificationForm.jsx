import { useState, useEffect, useRef } from 'react';
import request from '../../services/api';
import { loadPotentialMatch } from '../../services/potentialMatch.mjs';
import { showToast } from './Toast';
import HandoverPhotoInput from './HandoverPhotoInput';
import { normalizeKnowledgeAnswers } from '../../../../shared/claimVerification.mjs';

/**
 * Face-to-Face Verification Form
 * Auto-detects the matched found item from activity logs.
 * Admin verifies the student's identity and knowledge, then releases the item.
 */
export default function FTFVerificationForm({ lostItem, onComplete, onCancel }) {
  const formPanel = useRef(null);
  const [foundItemId, setFoundItemId] = useState('');
  const [foundItemName, setFoundItemName] = useState('');
  const [loadingMatch, setLoadingMatch] = useState(true);
  const [idVerified, setIdVerified] = useState(false);
  const [knowledgeAnswers, setKnowledgeAnswers] = useState('');
  const [knowledgePassed, setKnowledgePassed] = useState(false);
  const [verifiedBy, setVerifiedBy] = useState('');
  const [notes, setNotes] = useState('');
  const [handoverImage, setHandoverImage] = useState(null);
  const [preparingPhoto, setPreparingPhoto] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState('');
  const [errorField, setErrorField] = useState(null);
  const [autoMatched, setAutoMatched] = useState(false);
  const [matchError, setMatchError] = useState('');
  const [lookupRevision, setLookupRevision] = useState(0);
  const claimLock = useRef(false);
  const requirements = [
    { complete: Boolean(foundItemId), message: 'Select the saved matched found item.', selector: '[aria-label="Found Item ID"]' },
    { complete: idVerified, message: 'Verify the student’s school ID.', selector: '[aria-label="School ID Verified"]' },
    { complete: Boolean(normalizeKnowledgeAnswers(knowledgeAnswers)), message: 'Record the ownership questions and answers (1–1,000 characters; N/A is not accepted).', selector: '[aria-label="Student answers"]' },
    { complete: knowledgePassed, message: 'Confirm that the knowledge check passed.', selector: '[aria-label="Knowledge check passed"]' },
    { complete: Boolean(handoverImage), message: 'Upload a handover photo and check its preview.', selector: '[aria-label="Upload handover photo"]' },
    { complete: Boolean(verifiedBy.trim()), message: 'Enter the name of the admin in charge.', selector: '[aria-label="Admin in charge"]' },
  ];
  const missingRequirements = requirements.filter(requirement => !requirement.complete);
  const visibleError = errorField && requirements.find(requirement => requirement.selector === errorField)?.complete ? '' : error;

  // Use the same explicit saved pair as the comparison above the release form.
  useEffect(() => {
    const controller = new AbortController();
    setFoundItemId(''); setFoundItemName(''); setAutoMatched(false); setLoadingMatch(true); setMatchError('');
    loadPotentialMatch(lostItem.id, 'lost_items', request, { signal: controller.signal })
      .then(match => {
        if (controller.signal.aborted) return;
        if (match?.found_item?.id) { setFoundItemId(String(match.found_item.id)); setFoundItemName(match.found_item.description || match.found_item.item_id || ''); setAutoMatched(true); }
      })
      .catch(error => { if (!controller.signal.aborted) setMatchError(error.message || 'Unable to load the saved match.'); })
      .finally(() => { if (!controller.signal.aborted) setLoadingMatch(false); });
    return () => controller.abort();
  }, [lostItem.id, lookupRevision]);

  const handleClaim = async () => {
    if (claimLock.current) return;
    if (loadingMatch || matchError || preparingPhoto) return;
    if (missingRequirements.length) {
      const missing = missingRequirements[0];
      setError(missing.message);
      setErrorField(missing.selector);
      const field = formPanel.current?.querySelector(missing.selector);
      if (field?.type === 'file') formPanel.current?.querySelector('.handover-photo-actions button')?.focus();
      else field?.focus();
      return;
    }
    setError('');
    setErrorField(null);
    claimLock.current = true;
    setClaiming(true);
    try {
      const data = await request('/lost-items/' + lostItem.id + '/claim', {
        method: 'POST',
        body: JSON.stringify({
          found_item_id: foundItemId,
          verified_by: verifiedBy,
          handover_image: handoverImage,
          id_verified: idVerified,
          knowledge_passed: knowledgePassed,
          knowledge_answers: knowledgeAnswers.trim(),
          notes: notes.trim(),
        }),
      });
      if (data?.success !== true) throw new Error('The server did not confirm this handover.');
      showToast('Item released! Claim verified and recorded.', 'success');
      if (onComplete) onComplete();
    } catch (e) {
      setError(e.message);
    } finally {
      claimLock.current = false;
      setClaiming(false);
    }
  };

  return (
    <div ref={formPanel} className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-200 dark:border-indigo-800 space-y-3">
      <h4 className="text-sm font-semibold text-indigo-700 dark:text-indigo-400">
        ✅ Face-to-Face Verification
      </h4>

      {loadingMatch ? (
        <div className="bg-white dark:bg-gray-700 p-3 rounded-lg text-xs text-gray-500">
          🔍 Finding matched item...
        </div>
      ) : matchError ? (
        <div className="ui-alert ui-alert-error" role="alert">{matchError}<button type="button" className="ui-button ui-button-secondary" onClick={() => setLookupRevision(value => value + 1)}>Retry matched item</button></div>
      ) : autoMatched ? (
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
              aria-label="Found Item ID"
              min="1"
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
          aria-label="School ID Verified"
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
          aria-label="Student answers"
          aria-required="true"
          maxLength={1000}
          value={knowledgeAnswers}
          onChange={(e) => setKnowledgeAnswers(e.target.value)}
          placeholder="Record student's answers here..."
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 outline-none"
          rows={4}
        />
        <p className="text-xs text-gray-500">Required: record the questions asked and the student’s answers (up to 1,000 characters).</p>
        <label className="flex items-center gap-2 mt-2">
          <input
            type="checkbox"
            aria-label="Knowledge check passed"
            checked={knowledgePassed}
            onChange={(e) => setKnowledgePassed(e.target.checked)}
            className="w-4 h-4 rounded accent-indigo-600"
          />
          <span className="text-xs text-gray-500">Student correctly identified the item — knowledge check passed</span>
        </label>
      </div>

      <HandoverPhotoInput value={handoverImage} onChange={setHandoverImage} onBusyChange={setPreparingPhoto} disabled={claiming} />

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Admin in charge *</label>
        <input
          type="text"
          aria-label="Admin in charge"
          value={verifiedBy}
          onChange={(e) => setVerifiedBy(e.target.value)}
          placeholder="Enter the name of the admin in charge"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 outline-none"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Notes (optional)</label>
        <textarea
          aria-label="Notes (optional)"
          maxLength={1000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Additional notes..."
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 outline-none"
          rows={2}
        />
      </div>

      {visibleError && (
        <div role="alert" className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-3 py-2 rounded-lg text-xs">
          {visibleError}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleClaim}
          disabled={claiming || loadingMatch || !!matchError || preparingPhoto}
          className="flex-1 bg-green-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {claiming ? 'Processing...' : loadingMatch ? 'Loading matched item...' : preparingPhoto ? 'Preparing handover photo...' : '✅ Approve & Release Item'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={async () => {
              if (claimLock.current) return;
              claimLock.current = true; setClaiming(true); setError(''); setErrorField(null);
              try { await onCancel(foundItemId); } catch (error) { setError(error.message); }
              finally { claimLock.current = false; setClaiming(false); }
            }}
            disabled={claiming || loadingMatch || !!matchError}
            className="flex-1 bg-red-500 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-red-600 disabled:opacity-50 transition-colors"
          >
            Cancel Potential Match
          </button>
        )}
      </div>
    </div>
  );
}
