import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { readAll } from './readAll.js';

export async function notificationSnapshot(db) {
  const [lost, found, messages] = await Promise.all([
    readAll(db.from('lost_items').select('id').order('id')),
    readAll(db.from('found_items').select('id').order('id')),
    readAll(db.from('messages').select('id, conversation_id').eq('sender', 'user').order('id')),
  ]);
  return { lost, found, messages };
}

// One database subscription for all connected admin browsers. Only invalidations
// cross the stream; clients fetch data through the authenticated snapshot route.
export function createNotificationRouter(db, { jwtSecret = process.env.JWT_SECRET || 'lost-and-found-secret-key-2026' } = {}) {
  const router = Router();
  const clients = new Set();
  let channel, sequence = 0;
  const broadcast = table => {
    for (const response of clients) response.write('data: ' + JSON.stringify({ table }) + '\n\n');
  };
  router.use(async (req, res, next) => {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) return res.status(401).json({ error: 'Sign in required' });
      const claims = jwt.verify(token, jwtSecret);
      const { data: user, error } = await db.from('users').select('role, status').eq('id', claims.id).single();
      if (error) return res.status(503).json({ error: 'Unable to verify notification access' });
      if (!user || !['admin', 'superadmin'].includes(user.role) || ['archived', 'suspended'].includes(user.status)) {
        return res.status(403).json({ error: 'Administrator access required' });
      }
      next();
    } catch { res.status(401).json({ error: 'Invalid token' }); }
  });
  router.get('/', async (_req, res) => {
    try { res.set('Cache-Control', 'no-store').json(await notificationSnapshot(db)); }
    catch { res.status(503).json({ error: 'Unable to load notifications' }); }
  });
  router.get('/stream', (req, res) => {
    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.flushHeaders();
    clients.add(res);
    if (!channel) {
      channel = db.channel('admin-notification-events:' + ++sequence);
      for (const table of ['lost_items', 'found_items', 'messages', 'conversations']) {
        channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => broadcast(table));
      }
      channel.subscribe(status => {
        if (status === 'SUBSCRIBED') broadcast('all');
      });
    }
    res.write('data: {"table":"all"}\n\n');
    const heartbeat = setInterval(() => res.write(': keepalive\n\n'), 20000);
    res.on('close', () => {
      clearInterval(heartbeat);
      clients.delete(res);
      if (!clients.size && channel) {
        const previous = channel;
        channel = null;
        void db.removeChannel(previous);
      }
    });
  });
  return router;
}
