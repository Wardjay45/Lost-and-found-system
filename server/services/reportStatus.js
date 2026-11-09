import { legacyCancellationActor, legacyCancellationDetails } from '../../shared/activityLogs.mjs';
import { readAll } from './readAll.js';

const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };

export async function cancelItemReport(client, { table, id, actorId, reason, ownerOnly }) {
  const trimmedReason = typeof reason === 'string' ? reason.trim() : '';
  if (!trimmedReason || trimmedReason.length > 500) fail(400, 'Enter a cancellation reason of 1–500 characters.');
  const reportId = Number(id);
  if (!Number.isInteger(reportId) || reportId < 1 || reportId > 2147483647) fail(400, 'Choose a valid report.');
  const { data, error } = await client.rpc('cancel_item_report', {
    p_table: table, p_report_id: reportId, p_actor_id: actorId, p_reason: trimmedReason, p_owner_only: ownerOnly,
  });
  if (['PT400', 'PT403', 'PT404', 'PT409'].includes(error?.code)) fail(Number(error.code.slice(2)), error.message);
  if (error?.code === 'PGRST202') fail(503, 'Report cancellation needs database setup. Apply the cancellation migration and try again.');
  if (error || !data) fail(503, 'Unable to record the cancellation. Please try again.');
  return data;
}

export async function getReportCancellationActor(client, { table, id, ownerId }) {
  const lost = table === 'lost_items';
  const owner = lost ? 'reporter_id' : 'finder_id';
  const columns = 'id,item_id,cancel_reason,last_updated';
  const load = select => client.from(table).select(select)
    .eq('id', id).eq(owner, ownerId).eq('status', 'cancelled').maybeSingle();

  let result = await load(columns + ',cancellation_actor');
  if (['42703', 'PGRST204'].includes(result.error?.code)) result = await load(columns);
  if (result.error) throw result.error;
  const report = result.data;
  if (!report) fail(404, 'Cancelled report not found.');
  if (report.cancellation_actor) {
    const { role, name } = report.cancellation_actor;
    return { role, name: name || null };
  }

  const kind = lost ? 'Lost' : 'Found';
  const details = Object.values(legacyCancellationDetails(report, kind)).filter(Boolean);
  const logs = await Promise.all(details.map(detail => readAll(client.from('activity_logs')
    .select('action,details,role,user_name,timestamp').eq('action', 'cancel').eq('details', detail).order('id'))));
  return legacyCancellationActor(report, kind, logs.flat());
}

export function validateStatusChange(current, next) {
  if (['claimed', 'resolved', 'potential_match', 'matched'].includes(next)) {
    fail(400, next === 'potential_match' || next === 'matched' ? 'Record potential matches through Smart matching.' : 'Use verified handover to record an item recovery.');
  }
  if (next !== 'active') fail(400, 'Choose a valid report action.');
  if (!['pending', 'active'].includes(current)) fail(409, 'This report is no longer eligible for that action.');
}
