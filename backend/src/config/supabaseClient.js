import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY 
  || process.env.SUPABASE_SECRET_KEY 
  || process.env.SUPABASE_KEY 
  || process.env.SUPABASE_ANON_KEY 
  || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = !!(SUPABASE_URL && SUPABASE_KEY);

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false },
      global: {
        fetch: (url, options = {}) => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2000);
          const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal;
          return fetch(url, {
            ...options,
            signal
          }).finally(() => clearTimeout(timeoutId));
        }
      }
    })
  : null;

if (isSupabaseConfigured) {
  console.log('[Supabase Client] Inicializado com sucesso em:', SUPABASE_URL);
} else {
  console.log('[Supabase Client] SUPABASE_URL/SUPABASE_KEY não configurados. Usando modo SQLite local.');
}



