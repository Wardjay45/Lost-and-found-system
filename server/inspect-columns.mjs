// Print the actual columns of each table in the live Supabase database.
// Useful before rewriting `select('*')` into explicit column lists, so we
// don't reference a column that doesn't exist yet.
//
// Usage: node server/inspect-columns.mjs
import supabase from './db.js';

const TABLES = ['lost_items', 'found_items', 'matches', 'messages', 'activity_logs', 'users', 'categories'];

async function main() {
  for (const t of TABLES) {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    if (error) {
      console.log(`${t}: ERROR — ${error.message}`);
      continue;
    }
    const cols = Object.keys((data && data[0]) || {});
    console.log(`${t}: ${cols.join(', ')}`);
  }
}

main();
