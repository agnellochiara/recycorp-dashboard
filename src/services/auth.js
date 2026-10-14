// Autenticación: PIN local en modo demo (sin backend), email + contraseña en modo Supabase, con el rol de
// administrador resuelto siempre en el servidor (RPC `is_admin()`, respaldada por RLS) — nunca en el cliente.
import { supabase, SUPABASE_ENABLED } from './supabaseClient.js';

const PIN_SESSION_KEY = 'recycorp_demo_admin';
const DEMO_PIN = import.meta.env.VITE_DEMO_ADMIN_PIN || 'recycorp';

export const authService = {
  mode: SUPABASE_ENABLED ? 'supabase' : 'demo',

  async getSession() {
    if (SUPABASE_ENABLED) {
      const { data } = await supabase.auth.getSession();
      if (!data?.session) return { isAdmin: false, user: null };
      const { data: isAdmin } = await supabase.rpc('is_admin');
      return { isAdmin: Boolean(isAdmin), user: data.session.user };
    }
    try { return { isAdmin: sessionStorage.getItem(PIN_SESSION_KEY) === '1', user: null }; }
    catch { return { isAdmin: false, user: null }; }
  },

  async signIn(credentials) {
    if (SUPABASE_ENABLED) {
      const { error } = await supabase.auth.signInWithPassword({ email: credentials.email, password: credentials.password });
      if (error) return { ok: false, error: 'Correo o contraseña incorrectos.' };
      const { data: isAdmin } = await supabase.rpc('is_admin');
      if (!isAdmin) { await supabase.auth.signOut(); return { ok: false, error: 'Esta cuenta no tiene permisos de administrador.' }; }
      return { ok: true };
    }
    if (credentials.pin === DEMO_PIN) {
      try { sessionStorage.setItem(PIN_SESSION_KEY, '1'); } catch { /* sin almacenamiento: la sesión dura solo en memoria */ }
      return { ok: true };
    }
    return { ok: false, error: 'PIN incorrecto.' };
  },

  async signOut() {
    if (SUPABASE_ENABLED) { await supabase.auth.signOut(); return; }
    try { sessionStorage.removeItem(PIN_SESSION_KEY); } catch { /* ignorar */ }
  },

  /** Suscribe `cb` a cambios de sesión (solo relevante en modo Supabase); devuelve una función para cancelar. */
  onChange(cb) {
    if (!SUPABASE_ENABLED) return () => {};
    const { data: sub } = supabase.auth.onAuthStateChange(() => cb());
    return () => sub.subscription.unsubscribe();
  },
};
