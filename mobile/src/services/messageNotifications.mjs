// Queries are scoped to the existing name-based conversation contract.
// Read every page so a long conversation does not hide its newest messages.
export async function loadMessageConversation(db, userName) {
  const { data: conversation, error } = await db.from('conversations').select('id, name')
    .eq('name', userName).order('id').limit(1).maybeSingle();
  if (error) throw error;
  if (!conversation) return { conversationId: null, messages: [] };
  const messages = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error: messageError } = await db.from('messages').select('*')
      .eq('conversation_id', String(conversation.id)).order('time').order('id').range(offset, offset + 999);
    if (messageError) throw messageError;
    if (!Array.isArray(data)) throw new Error('Unable to load messages');
    messages.push(...data);
    if (data.length < 1000) break;
  }
  return { conversationId: conversation.id, messages };
}
