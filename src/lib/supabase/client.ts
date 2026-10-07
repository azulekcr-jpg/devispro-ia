import { createBrowserClient } from '@supabase/ssr';

// Vrai si les deux variables publiques Supabase sont présentes (elles sont intégrées au site à la compilation).
export const isSupabaseConfigured = (): boolean =>
  !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// Client navigateur : n'utilise QUE la clé publique.
export const supabaseBrowser = () =>
  createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
