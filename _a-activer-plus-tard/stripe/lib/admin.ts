import 'server-only';
import { createClient } from '@supabase/supabase-js';

// Clé service_role : contourne la sécurité par ligne. Réservé au serveur (webhooks, routes API).
export const supabaseAdmin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
