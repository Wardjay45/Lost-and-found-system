import jwt from 'jsonwebtoken';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const speeds = ['Under 24 hours', '1–3 days', '4–7 days', '8+ days'];
const fail = (status, message, code) => { throw Object.assign(new Error(message), { status, code }); };

export function recoveryHours(record) {
  if (!record?.reported_at || !record?.recovered_at) return null;
  const hours = (Date.parse(record.recovered_at) - Date.parse(record.reported_at)) / 3600000;
  return Number.isFinite(hours) && hours >= 0 ? hours : null;
}

export function recoverySpeed(hours) {
  if (hours === null) return null;
  return speeds[hours < 24 ? 0 : hours < 96 ? 1 : hours < 192 ? 2 : 3];
}

export function summarizeRecoveries(records, feedback, startedAt) {
  const unique = [...new Map(records.map(record => [record.id, record])).values()];
  const ids = new Set(unique.map(record => record.id));
  const responses = [...new Map(feedback.filter(row => row.kind === 'recovery' && ids.has(row.recovery_id)).map(row => [row.recovery_id, row])).values()];
  const hours = unique.map(recoveryHours).filter(value => value !== null).sort((first, second) => first - second);
  const average = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  const distribution = speeds.map(label => ({ label, count: hours.filter(value => recoverySpeed(value) === label).length }));
  const months = new Map();
  for (const record of unique) {
    if (!Number.isFinite(Date.parse(record.recovered_at))) continue;
    const month = new Date(Date.parse(record.recovered_at) + 8 * 3600000).toISOString().slice(0, 7);
    if (!months.has(month)) months.set(month, []);
    months.get(month).push(record);
  }
  return {
    tracking_started_at: startedAt,
    confirmed_recoveries: unique.length,
    valid_durations: hours.length,
    excluded_durations: unique.length - hours.length,
    average_hours: average(hours),
    median_hours: hours.length ? (hours[Math.floor((hours.length - 1) / 2)] + hours[Math.floor(hours.length / 2)]) / 2 : null,
    recovery_responses: responses.length,
    general_responses: feedback.filter(row => row.kind === 'general').length,
    average_rating: average(responses.map(row => row.rating)),
    satisfaction_percent: responses.length ? Math.round(responses.filter(row => row.rating >= 4).length / responses.length * 1000) / 10 : null,
    response_rate_percent: unique.length ? Math.round(responses.length / unique.length * 1000) / 10 : null,
    speed_distribution: distribution,
    monthly: [...months.entries()].sort(([first], [second]) => first.localeCompare(second)).map(([month, returns]) => {
      const returnIds = new Set(returns.map(record => record.id));
      const ratings = responses.filter(row => returnIds.has(row.recovery_id));
      return { month, confirmed_recoveries: returns.length, average_hours: average(returns.map(recoveryHours).filter(value => value !== null)), average_rating: average(ratings.map(row => row.rating)), responses: ratings.length };
    }),
  };
}

export function createRecoveryFeedbackService({ repository, jwtSecret }) {
  async function authorize(token, role) {
    if (!jwtSecret) fail(503, 'Feedback sessions are not configured. Contact the administrator.');
    let claims;
    try { claims = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] }); }
    catch { fail(401, 'Please sign in again to continue.', 'SESSION_REQUIRED'); }
    if (!Number.isSafeInteger(Number(claims.id)) || Number(claims.id) <= 0) fail(401, 'Invalid session.');
    const user = await repository.user(Number(claims.id));
    const allowedRoles = role === 'admin' ? ['admin', 'superadmin'] : [role];
    if (!user || user.status !== 'active' || !allowedRoles.includes(user.role) || claims.role !== user.role) fail(403, 'This account cannot perform this action.');
    if (role === 'student' && (claims.auth_method !== 'google' || !user.google_subject || claims.google_subject !== user.google_subject)) {
      fail(403, 'Sign in with your linked school Google account to leave feedback. Legacy accounts need administrator-assisted linking.', 'GOOGLE_REAUTH_REQUIRED');
    }
    return user;
  }

  async function mine(actor) {
    const [records, feedback] = await Promise.all([repository.recoveries(actor.id), repository.feedback(actor.id)]);
    return records.map(record => ({ ...record, recovery_hours: recoveryHours(record), speed: recoverySpeed(recoveryHours(record)), feedback: feedback.find(row => row.kind === 'recovery' && row.recovery_id === record.id) || null }));
  }

  async function submit(actor, fields = {}) {
    if (actor.role !== 'student') fail(403, 'Only students can submit feedback.');
    const comment = typeof fields.comment === 'string' ? fields.comment.trim() : '';
    if (!['recovery', 'general'].includes(fields.kind) || !Number.isInteger(fields.rating) || fields.rating < 1 || fields.rating > 5 ||
        typeof fields.comment !== 'string' || comment.length > 1000 || !uuid.test(fields.request_id || '') ||
        (fields.kind === 'recovery' ? !uuid.test(fields.recovery_id || '') : fields.recovery_id !== null && fields.recovery_id !== undefined)) {
      fail(400, 'Choose a rating from 1 to 5 and enter at most 1,000 characters. Use a valid feedback request.');
    }
    if (fields.kind === 'recovery') {
      const record = await repository.recovery(fields.recovery_id);
      if (!record) fail(404, 'No confirmed handover was found for this item.');
      if (record.owner_id !== actor.id) fail(403, 'Only the recovered item owner can leave this feedback.');
    }
    const record = { user_id: actor.id, user_name: actor.name, kind: fields.kind, recovery_id: fields.kind === 'recovery' ? fields.recovery_id : null, rating: fields.rating, comment, request_id: fields.request_id.toLowerCase() };
    try { return await repository.insertFeedback(record); }
    catch (error) {
      if (error.code !== '23505') throw error;
      const existing = (await repository.feedback(actor.id)).find(row => row.request_id === record.request_id);
      if (existing && ['kind', 'recovery_id', 'rating', 'comment'].every(key => existing[key] === record[key])) return existing;
      fail(409, 'Feedback has already been submitted. Refresh to view the saved response.');
    }
  }

  async function list() {
    const [feedback, records] = await Promise.all([repository.feedback(), repository.recoveries()]);
    const returns = new Map(records.map(record => [record.id, record]));
    return feedback.map(row => {
      const recovery = returns.get(row.recovery_id);
      const hours = recovery ? recoveryHours(recovery) : null;
      return { ...row, item_description: recovery?.item_description || null, recovery_hours: hours, speed: recoverySpeed(hours) };
    }).sort((first, second) => Date.parse(second.created_at) - Date.parse(first.created_at));
  }

  async function summary() {
    const [records, feedback, started] = await Promise.all([repository.recoveries(), repository.feedback(), repository.trackingStart()]);
    return summarizeRecoveries(records, feedback, started);
  }

  async function claim(actor, lostId, fields = {}) {
    if (!['admin', 'superadmin'].includes(actor.role)) fail(403, 'Administrator access is required.');
    if (!Number.isSafeInteger(Number(lostId)) || Number(lostId) <= 0 || !Number.isSafeInteger(Number(fields.found_item_id)) || Number(fields.found_item_id) <= 0 ||
        fields.id_verified !== true || fields.knowledge_passed !== true || fields.notes !== undefined && (typeof fields.notes !== 'string' || fields.notes.length > 1000)) {
      fail(400, 'Select the matched item and complete school ID and knowledge verification. Notes must be at most 1,000 characters.');
    }
    try {
      const recovery = await repository.completeRecovery(actor, Number(lostId), { found_item_id: Number(fields.found_item_id), notes: fields.notes || '' });
      return { success: true, recovery, lost_item: { id: recovery.lost_item_id, status: 'claimed', resolved_date: recovery.recovered_at }, message: 'Item returned. Verified handover recorded.' };
    } catch (error) {
      if (error.code === 'P0001' || error.code === '23505') fail(409, error.code === '23505' ? 'This item has already been returned.' : error.message);
      throw error;
    }
  }

  return { authorize, mine, submit, list, summary, claim };
}
