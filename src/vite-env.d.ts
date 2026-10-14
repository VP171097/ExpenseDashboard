/// <reference types="vite/client" />
interface ImportMetaEnv {
  /** Your Supabase project URL, e.g. https://abcd.supabase.co. Leave unset to run without accounts. */
  readonly VITE_SUPABASE_URL?: string
  /** The project's public anon key (safe in the browser; row-level security protects the data). */
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** name of the AI Edge Function in your project (default ask-tally) */
  readonly VITE_AI_FUNCTION?: string
}
interface ImportMeta { readonly env: ImportMetaEnv }
