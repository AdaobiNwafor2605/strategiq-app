import { createClient } from '@supabase/supabase-js';

// Public anon key only — never use the service_role key here.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
