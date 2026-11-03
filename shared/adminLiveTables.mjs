export const adminLiveTables = [
  'lost_items', 'found_items', 'matches', 'activity_logs', 'messages',
  'conversations', 'categories', 'users', 'qr_locations',
];
// Recovery tables deny anonymous SELECT. Keep their updates on the authenticated
// API fallback rather than making the shared realtime channel fail to subscribe.
export const adminPublicationTables = [...adminLiveTables, 'feedback', 'item_recoveries'];
