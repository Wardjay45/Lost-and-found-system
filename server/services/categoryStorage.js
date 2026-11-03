import { createClient } from '@supabase/supabase-js';

let client;

// Server-only: mutations must pass the router's admin check before using this
// client. Public/mobile category reads keep their existing RLS restrictions.
export function configuredCategoryStorage() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Category storage is not configured.');
  }
  client ??= createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
