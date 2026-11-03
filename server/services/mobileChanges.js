import { Router } from 'express';
import { randomUUID } from 'node:crypto';

export const mobileLiveTables = ['lost_items', 'found_items', 'matches', 'activity_logs', 'messages', 'conversations', 'categories', 'qr_locations', 'item_recoveries', 'feedback'];

// Relay invalidations only. All row data is fetched through account-scoped APIs.
export function createMobileChangesRouter(db, { waitMs = 20000, idleMs = 30000 } = {}) {
  const router = Router(), epoch = randomUUID(), waiting = new Set(), history = [];
  let revision = 0, channel, subscribed = false, idle;
  const cursor = () => epoch + ':' + revision;
  function changed(since) {
    const [key, value] = String(since || '').split(':');
    const last = Number(value);
    if (key !== epoch || !Number.isSafeInteger(last) || last < 0 || last > revision || last < revision - history.length) return ['all'];
    return [...new Set(history.filter(event => event.revision > last).map(event => event.table))];
  }
  function publish(table) {
    history.push({ revision: ++revision, table });
    if (history.length > 100) history.shift();
    for (const finish of [...waiting]) finish();
  }
  function connect() {
    clearTimeout(idle);
    if (channel) return;
    const current = db.channel('mobile-data-events:' + randomUUID());
    channel = current;
    for (const table of mobileLiveTables) current.on('postgres_changes', { event: '*', schema: 'public', table }, () => publish(table));
    current.subscribe(status => {
      if (channel !== current) return;
      subscribed = status === 'SUBSCRIBED';
      // A reconnect may have missed events. Always reconcile the snapshots.
      publish('all');
    });
  }
  function release() {
    if (waiting.size) return;
    clearTimeout(idle);
    idle = setTimeout(() => {
      const previous = channel; channel = null; subscribed = false;
      if (previous) void db.removeChannel(previous);
    }, idleMs);
    idle.unref?.();
  }
  router.get('/', (req, res) => {
    if (!req.actor) return res.status(401).json({ error: 'Sign in required.' });
    res.set('Cache-Control', 'no-store');
    connect();
    let timer, finished = false;
    const finish = () => {
      if (finished) return;
      finished = true; clearTimeout(timer); waiting.delete(finish);
      res.off('close', cancel);
      const tables = changed(req.query.cursor);
      res.json({ cursor: cursor(), tables: subscribed ? tables : ['all'], realtime: subscribed });
      release();
    };
    const cancel = () => {
      if (finished) return;
      finished = true; clearTimeout(timer); waiting.delete(finish); release();
    };
    res.on('close', cancel);
    if (changed(req.query.cursor).length) return finish();
    waiting.add(finish);
    timer = setTimeout(finish, waitMs);
  });
  return router;
}
