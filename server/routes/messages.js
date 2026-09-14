import { Router } from 'express';
import supabase from '../db.js';

const router = Router();

const OFFICE_NAME = 'Lost & Found Office';

// Find or create a conversation for a specific user
async function findOrCreateUserConversation(userName) {
  if (!userName) return null;

  // Try to find existing conversation for this user
  const { data: existing } = await supabase
    .from('conversations')
    .select('*')
    .eq('name', userName)
    .single();

  if (existing) return existing;

  // Create new conversation for this user
  const { data: created } = await supabase
    .from('conversations')
    .insert({ name: userName, avatar: userName.charAt(0).toUpperCase() })
    .select()
    .single();

  return created;
}

// POST /api/messages/conversations — admin manually creates a conversation with a user
router.post('/conversations', async (req, res) => {
  try {
    const { name, avatar } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const conv = await findOrCreateUserConversation(name);
    if (!conv) return res.status(500).json({ error: 'Failed to create conversation' });

    // Update avatar if provided
    if (avatar && conv.avatar !== avatar) {
      const { data: updated } = await supabase
        .from('conversations')
        .update({ avatar })
        .eq('id', conv.id)
        .select()
        .single();
      res.status(201).json(updated || conv);
    } else {
      res.status(201).json(conv);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/messages/conversations — returns all user conversations for admin sidebar
router.get('/conversations', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .not('name', 'in', `(${OFFICE_NAME},Admin Support)`)
      .order('id');

    if (error) throw error;

    // For each conversation, get the last message
    const enriched = await Promise.all((data || []).map(async (conv) => {
      const { data: msgs } = await supabase
        .from('messages')
        .select('text, sender, time')
        .eq('conversation_id', conv.id)
        .order('time', { ascending: false })
        .limit(1);

      const lastMsg = msgs && msgs.length > 0 ? msgs[0] : null;
      return { ...conv, last_message: lastMsg };
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/messages/:conversationId — get messages for a specific conversation
router.get('/:conversationId', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', req.params.conversationId)
      .order('time');

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/messages/count — returns total message count (for admin sidebar badge)
router.get('/count', async (req, res) => {
  try {
    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true });

    if (error) throw error;
    res.json({ count: count || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/messages — send a message. Creates user conversation if needed.
router.post('/', async (req, res) => {
  try {
    const { sender, sender_name, text } = req.body;
    if (!text) return res.status(400).json({ error: 'text is required' });

    let conversationId = req.body.conversation_id;

    // If no conversation_id but sender_name provided, find/create the user's conversation
    if (!conversationId && sender_name) {
      const conv = await findOrCreateUserConversation(sender_name);
      if (conv) conversationId = conv.id;
    }

    if (!conversationId) {
      return res.status(400).json({ error: 'conversation_id or sender_name is required' });
    }

    const finalSender = sender || (sender_name ? 'user' : 'admin');

    const { data, error } = await supabase
      .from('messages')
      .insert({ conversation_id: conversationId, sender: finalSender, text })
      .select()
      .single();

    if (error) throw error;

    // Return conversation info so clients know the ID
    res.status(201).json({ ...data, conversation_id: conversationId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;