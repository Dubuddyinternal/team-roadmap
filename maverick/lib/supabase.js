import { createClient } from '@supabase/supabase-js';

let client = null;

/* Returns the browser Supabase client, or null when the env vars are not set
   (so the public pages still build and render without a database). */
export function getSupabase() {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || typeof window === 'undefined') return null;
  client = createClient(url, key);
  return client;
}
