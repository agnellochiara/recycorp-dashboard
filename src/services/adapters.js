// Adaptador de datos: unifica el modo demo (localStorage, con los datos reales de Arequipa como semilla) y el
// modo Supabase detrás de una sola interfaz { load(), sync(intent, next) }, para que el resto de la app no
// necesite saber cuál de los dos está activo.
import { supabase, SUPABASE_ENABLED } from './supabaseClient.js';
import { getDemoState } from '../lib/demoData.js';
import { mergeConfig } from '../lib/constants.js';

const LS_KEY = 'recycorp_demo_v1';

function loadDemo() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (Array.isArray(saved.sites) && Array.isArray(saved.records)) {
        return { sites: saved.sites, records: saved.records, config: mergeConfig(saved.config) };
      }
    }
  } catch { /* localStorage no disponible o datos corruptos: se reinicia con la semilla real */ }
  const seed = getDemoState();
  saveDemo(seed);
  return seed;
}

function saveDemo(state) {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ sites: state.sites, records: state.records, config: state.config })); }
  catch { /* almacenamiento lleno o bloqueado (modo privado, por ejemplo): se continúa solo en memoria */ }
}

/* ------------------------------------------------------------------ Supabase */

async function loadSupabase() {
  const [sitesRes, recordsRes, cfgRes] = await Promise.all([
    supabase.from('sites').select('*').order('id'),
    supabase.from('records').select('period,site,material,treatment,kg'),
    supabase.from('app_config').select('value').eq('id', 1).maybeSingle(),
  ]);
  if (sitesRes.error) throw sitesRes.error;
  if (recordsRes.error) throw recordsRes.error;
  if (cfgRes.error) throw cfgRes.error;
  return {
    sites: (sitesRes.data || []).map((s) => ({ id: s.id, name: s.name, company: s.company, format: s.format, district: s.district || '', status: s.status || 'Activo' })),
    records: (recordsRes.data || []).map((r) => ({ p: r.period, s: r.site, m: r.material, t: r.treatment, kg: Number(r.kg) })),
    config: mergeConfig(cfgRes.data?.value),
  };
}

async function insertInChunks(table, rows, size = 500) {
  for (let i = 0; i < rows.length; i += size) {
    const { error } = await supabase.from(table).insert(rows.slice(i, i + size));
    if (error) throw error;
  }
}

async function syncSupabase(intent, next) {
  if (intent === 'config') {
    const { error } = await supabase.from('app_config').upsert({ id: 1, value: next.config });
    if (error) throw error;
    return;
  }
  if (intent === 'sites') {
    const rows = next.sites.map((s) => ({ id: s.id, name: s.name, company: s.company, format: s.format, district: s.district || '', status: s.status || 'Activo' }));
    const { error } = await supabase.from('sites').upsert(rows);
    if (error) throw error;
    return;
  }
  if (intent === 'records-replace') {
    const { error: delErr } = await supabase.from('records').delete().not('site', 'is', null);
    if (delErr) throw delErr;
    await insertInChunks('records', next.records.map((r) => ({ period: r.p, site: r.s, material: r.m, treatment: r.t, kg: r.kg })));
    return;
  }
  if (intent === 'records-append') {
    await insertInChunks('records', next.appended.map((r) => ({ period: r.p, site: r.s, material: r.m, treatment: r.t, kg: r.kg })));
  }
}

/* ------------------------------------------------------------------ Interfaz pública */

export const dataAdapter = {
  mode: SUPABASE_ENABLED ? 'supabase' : 'demo',
  async load() {
    return SUPABASE_ENABLED ? loadSupabase() : loadDemo();
  },
  async sync(intent, next) {
    if (SUPABASE_ENABLED) return syncSupabase(intent, next);
    saveDemo(next);
  },
  /** Solo en modo demo: vuelve a la semilla de datos reales, descartando ediciones locales. */
  async resetDemo() {
    if (SUPABASE_ENABLED) throw new Error('resetDemo solo está disponible en modo demo.');
    const seed = getDemoState();
    saveDemo(seed);
    return seed;
  },
};
