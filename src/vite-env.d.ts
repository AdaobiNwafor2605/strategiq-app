/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_LANDING_ONLY?: string;
  readonly VITE_TALLY_FORM_URL?: string;
  readonly VITE_PULSE_CHECK_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
