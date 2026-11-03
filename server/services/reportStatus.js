export function validateStatusChange(current, next, reason) {
  const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
  if (['claimed', 'resolved', 'potential_match', 'matched'].includes(next)) {
    fail(400, next === 'potential_match' || next === 'matched' ? 'Record potential matches through Smart matching.' : 'Use verified handover to record an item recovery.');
  }
  if (!['active', 'cancelled'].includes(next)) fail(400, 'Choose a valid report action.');
  if (next === 'cancelled' && (typeof reason !== 'string' || !reason.trim() || reason.trim().length > 500)) fail(400, 'Enter a cancellation reason of 1–500 characters.');
  if (next === current) return;
  if (next === 'active' && current !== 'pending' || next === 'cancelled' && !['pending', 'active'].includes(current)) fail(409, 'This report is no longer eligible for that action.');
}
