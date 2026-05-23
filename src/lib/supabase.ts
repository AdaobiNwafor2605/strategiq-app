import { createClient } from '@supabase/supabase-js';

// Public client only: anon/publishable key in VITE_SUPABASE_ANON_KEY — never service_role / sb_secret_*.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
