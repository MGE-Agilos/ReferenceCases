// Public config. The anon key is safe to expose (RLS-protected). No secrets here.
window.APP_CONFIG = {
  SUPABASE_URL: 'https://<PROJECT_REF>.supabase.co',
  SUPABASE_ANON_KEY: '<ANON_KEY>',
  FUNCTION_URL: 'https://<PROJECT_REF>.supabase.co/functions/v1/generate-case',
  DB_SCHEMA: 'refcases',
};
