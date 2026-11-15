export const DEFAULT_MATCH_MESSAGE = 'We found a potential match for your lost item. Please visit the Campus Lost and Found Office and bring a valid school ID. The administrator will verify ownership.';

const LEGACY_MATCH_MESSAGE = 'Our system has found an item that may match your lost report ({similarity}% similarity). Please visit the Campus Lost and Found Office within three (3) days and bring a valid school ID. The administrator will verify ownership before the item is released.';

export function resolveMatchTemplate(template) {
  return !template?.trim() || template.trim() === LEGACY_MATCH_MESSAGE ? DEFAULT_MATCH_MESSAGE : template;
}

export async function sendMatchNotification(match, { fetcher, apiUrl, template, reporterName }) {
  const recipientId = match.lost_item?.reporter_id;
  if (!recipientId) return { delivered: false, warning: 'Potential match saved. This report has no linked reporter account, so a message could not be delivered.' };
  const text = resolveMatchTemplate(template)
    .replaceAll('{userName}', reporterName || match.lost_item?.reporter_name || 'Reporter')
    .replaceAll('{itemDescription}', match.lost_item?.description || 'your item')
    .replaceAll('{similarity}', String(Math.round(match.score * 100)));
  try {
    const response = await fetcher(apiUrl + '/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sender: 'admin', recipient_id: recipientId, text }) });
    if (!response.ok) throw new Error('Message delivery failed.');
    return { delivered: true };
  } catch {
    return { delivered: false, warning: 'Potential match saved, but its message was not delivered. Send the reporter a message from the Inbox.' };
  }
}
