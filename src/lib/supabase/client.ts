import { createBrowserClient } from '@supabase/ssr';

// Client navigateur : n'utilise QUE la clé publique.
export const supabaseBrowser = () =>
  createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
