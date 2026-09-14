// Delete old system conversations from Supabase
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function cleanup() {
  console.log('Cleaning up old system conversations...\n');

  // Delete "Admin Support" and "Lost & Found Office" conversations
  const { data: deleted, error } = await supabase
    .from('conversations')
    .delete()
    .in('name', ['Admin Support', 'Lost & Found Office'])
    .select();

  if (error) {
    console.error('Delete failed:', error.message);
    return;
  }

  console.log(`Deleted ${deleted.length} system conversations:`);
  deleted.forEach(c => console.log(`  - ${c.name} (id: ${c.id})`));

  // Also delete orphaned messages
  const { error: msgError } = await supabase
    .from('messages')
    .delete()
    .is('conversation_id', null);

  if (!msgError) console.log('\nAlso cleaned up orphaned messages.');

  console.log('\nDone! Restart your Express server for changes to take effect.');
}

cleanup();