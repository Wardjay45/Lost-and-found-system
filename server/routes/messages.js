import { Router } from 'express';
import supabase from '../db.js';
import { readAll } from '../services/readAll.js';
import { createConversationAccess } from '../services/conversationAccess.js';
import { createProductionAccess } from '../services/productionAccess.js';

export function createMessagesRouter({ client = supabase, jwtSecret = () => process.env.JWT_SECRET } = {}) {
  const router = Router(), access = createConversationAccess(client);
  router.use(createProductionAccess(client, { jwtSecret }));
  const handle = operation => async (req, res) => {
    try { await operation(req, res); }
    catch (error) { res.status(error.status || 503).json({ error: error.status ? error.message : 'Messages are unavailable. Please try again.' }); }
  };
  const check = result => { if (result.error) throw result.error; return result.data; };
  const validId = value => Number.isSafeInteger(Number(value)) && Number(value) > 0;
  router.post('/conversations', handle(async (req, res) => {
    let id = req.body.recipient_id;
    if (!id && typeof req.body.name === 'string') {
      const users = check(await client.from('users').select('id').eq('name', req.body.name.trim()).limit(2));
      if (users.length !== 1) return res.status(409).json({ error: 'Select the recipient account rather than a shared name.' });
      id = users[0].id;
    }
    res.status(201).json(await access.forUser(await access.recipient(id), true));
  }));
  router.get('/conversations', handle(async (_req, res) => {
    const rows = await readAll(client.from('conversations').select('*').not('name', 'in', '(Lost & Found Office,Admin Support)').order('id'));
    res.json(await Promise.all(rows.map(async conversation => {
      const messages = check(await client.from('messages').select('text,sender,time').eq('conversation_id', String(conversation.id)).order('time', { ascending: false }).order('id', { ascending: false }).limit(1));
      const owner = conversation.user_id ? check(await client.from('users').select('student_id,email').eq('id', conversation.user_id).maybeSingle()) : null;
      return { ...conversation, account_label: owner?.student_id || owner?.email || (conversation.user_id ? 'Account #' + conversation.user_id : 'Legacy conversation'), last_message: messages[0] || null };
    })));
  }));
  router.get('/count', handle(async (_req, res) => {
    const result = await client.from('messages').select('id', { count: 'exact', head: true }).eq('sender', 'user');
    if (result.error) throw result.error;
    res.json({ count: result.count || 0 });
  }));
  router.get('/:conversationId', handle(async (req, res) => {
    if (!validId(req.params.conversationId)) return res.status(400).json({ error: 'Choose a valid conversation.' });
    res.json(await readAll(client.from('messages').select('*').eq('conversation_id', String(req.params.conversationId)).order('time').order('id')));
  }));
  router.post('/', handle(async (req, res) => {
    const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
    if (!text || text.length > 5000) return res.status(400).json({ error: 'Enter a message of 1–5,000 characters.' });
    let conversationId = req.body.conversation_id;
    if (req.body.recipient_id) conversationId = (await access.forUser(await access.recipient(req.body.recipient_id), true)).id;
    if (!validId(conversationId)) return res.status(400).json({ error: 'Choose a conversation or recipient account.' });
    const exists = check(await client.from('conversations').select('id').eq('id', Number(conversationId)).maybeSingle());
    if (!exists) return res.status(404).json({ error: 'Conversation not found.' });
    const row = check(await client.from('messages').insert({ conversation_id: String(conversationId), sender: 'admin', text, time: new Date().toISOString() }).select().single());
    if (!row) throw new Error('Message not saved');
    res.status(201).json(row);
  }));
  return router;
}
export default createMessagesRouter();
