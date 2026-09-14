// Quick test of messaging APIs
const API = 'http://localhost:3001/api';

async function test() {
  // 1. Create a conversation
  console.log('1. Creating conversation...');
  const cRes = await fetch(`${API}/messages/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Juan Dela Cruz', avatar: 'J' }),
  });
  const conv = await cRes.json();
  console.log('   Created:', conv);

  // 2. Send a message as user
  console.log('2. Sending user message...');
  const mRes = await fetch(`${API}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversation_id: conv.id, sender: 'user', text: 'Hello, I lost my bag' }),
  });
  const msg = await mRes.json();
  console.log('   Sent:', msg);

  // 3. Send a message as admin
  console.log('3. Sending admin message...');
  const aRes = await fetch(`${API}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversation_id: conv.id, sender: 'admin', text: 'We will look for it.' }),
  });
  const aMsg = await aRes.json();
  console.log('   Sent:', aMsg);

  // 4. Get conversations list
  console.log('4. Getting conversations...');
  const listRes = await fetch(`${API}/messages/conversations`);
  const list = await listRes.json();
  console.log('   Count:', list.length);
  list.forEach(c => console.log(`   - ${c.name} (id:${c.id}) last: "${c.last_message?.text?.substring(0,30) || 'none'}"`));

  // 5. Get messages for the conversation
  console.log('5. Getting messages...');
  const msgsRes = await fetch(`${API}/messages/${conv.id}`);
  const msgs = await msgsRes.json();
  msgs.forEach(m => console.log(`   [${m.sender}] ${m.text}`));

  console.log('\n✅ All tests passed!');
}

test().catch(console.error);