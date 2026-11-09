import { useEffect, useState } from 'react';
import { cancellationActorLabel } from '../../../../shared/roles.mjs';
import { legacyCancellationActor } from '../../../../shared/activityLogs.mjs';
import { activityLogsApi } from '../../services/api';

export default function ReportCancellation({ report, kind }) {
  const [activity, setActivity] = useState(null);
  const needsLookup = !report.cancellation_actor && Boolean(report.cancel_reason?.trim() && report.last_updated);

  useEffect(() => {
    if (!needsLookup) return;
    const controller = new AbortController();
    activityLogsApi.getAll({ action: 'cancel' }, { signal: controller.signal })
      .then(logs => { if (!controller.signal.aborted) setActivity(Array.isArray(logs) ? logs : 'unavailable'); })
      .catch(() => { if (!controller.signal.aborted) setActivity('unavailable'); });
    return () => controller.abort();
  }, [needsLookup]);

  const actor = report.cancellation_actor || (Array.isArray(activity) ? legacyCancellationActor(report, kind, activity) : null);
  let label = cancellationActorLabel(actor?.role);
  if (needsLookup && activity === null) label = 'Checking cancellation activity…';
  if (needsLookup && activity === 'unavailable') label = 'Could not load cancellation activity';

  return (
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 rounded-lg text-red-700 dark:text-red-300">
      <p className="text-sm font-semibold break-words" role="status">{label}
        {actor?.name && <span className="font-normal"> · {actor.name}</span>}
      </p>
      <p className="mt-2 text-xs font-semibold">Cancellation reason</p>
      <p className="mt-0.5 text-sm whitespace-pre-wrap break-words">{report.cancel_reason || 'No reason recorded.'}</p>
    </div>
  );
}
