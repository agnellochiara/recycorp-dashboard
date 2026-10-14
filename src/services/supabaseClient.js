// Cliente de Supabase, solo si las variables de entorno están presentes. En modo demo esto es `null` y
// nunca se usa: toda la app pasa por `dataAdapter`, que elige la implementación correcta.
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const SUPABASE_ENABLED = Boolean(url && anonKey);

export const supabase = SUPABASE_ENABLED
  ? createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;
