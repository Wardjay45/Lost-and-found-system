import { parseReadState } from '../../../shared/notifications.mjs';
export const notificationReadKey = account => 'lf-notifications-v3:' + account;

export function loadNotificationReadState(storage, account) {
  try {
    const current = storage.getItem(notificationReadKey(account));
    if (current !== null) return parseReadState(current);
    // Older report receipts represented a list visit, not an individual view.
    // Message receipts already represented viewed conversations and remain valid.
    const previous = parseReadState(storage.getItem('lf-notifications-v2:' + account));
    return { messages: previous.messages || [] };
  } catch { return {}; }
}
