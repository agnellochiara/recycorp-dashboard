// Estado central de datos: sedes, registros (separados de los de referencia tipo madera_nv) y configuración
// (metas, segmentos, factores). Encapsula el adaptador demo/Supabase para que los componentes solo vean una
// API sencilla de lectura y mutación.
import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { dataAdapter } from '../services/adapters.js';
import { normalizeRecord } from '../lib/calc.js';
import { isMemo, EMPTY_FILTERS, mergeConfig } from '../lib/constants.js';

const DataContext = createContext(null);

function splitRecords(raw) {
  const all = raw.map(normalizeRecord);
  return { records: all.filter((r) => !isMemo(r)), memoRecords: all.filter(isMemo) };
}
// Reconstruye los registros "en bruto" (p,s,m,t,kg) a partir de los dos arreglos ya normalizados, para
// persistirlos tal como los espera el adaptador.
const rawOf = (records, memoRecords) => [...records, ...memoRecords].map((r) => ({ p: r.p, s: r.s, m: r.m, t: r.t, kg: r.kg }));

export function DataProvider({ children }) {
  // `config` nunca es null, ni siquiera mientras carga: así los cálculos que dependen de él (memoizados antes
  // del guard de "cargando" por las reglas de hooks) tienen siempre una configuración válida con la que trabajar.
  const [state, setState] = useState({ loading: true, error: null, sites: [], records: [], memoRecords: [], config: mergeConfig(null) });
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const raw = await dataAdapter.load();
      const { records, memoRecords } = splitRecords(raw.records);
      setState({ loading: false, error: null, sites: raw.sites, records, memoRecords, config: mergeConfig(raw.config) });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err?.message || 'No se pudieron cargar los datos.' }));
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const siteById = useMemo(() => Object.fromEntries(state.sites.map((s) => [s.id, s])), [state.sites]);

  const updateConfig = useCallback(async (nextConfig) => {
    const merged = mergeConfig(nextConfig);
    setState((s) => ({ ...s, config: merged }));
    await dataAdapter.sync('config', { sites: state.sites, records: rawOf(state.records, state.memoRecords), config: merged });
  }, [state.sites, state.records, state.memoRecords]);

  const updateSites = useCallback(async (nextSites) => {
    setState((s) => ({ ...s, sites: nextSites }));
    await dataAdapter.sync('sites', { sites: nextSites, records: rawOf(state.records, state.memoRecords), config: state.config });
  }, [state.records, state.memoRecords, state.config]);

  /** Reemplaza TODOS los registros (p. ej. tras una carga de CSV completa en modo "reemplazar"). */
  const replaceRecords = useCallback(async (nextRawRecords) => {
    const { records, memoRecords } = splitRecords(nextRawRecords);
    setState((s) => ({ ...s, records, memoRecords }));
    await dataAdapter.sync('records-replace', { sites: state.sites, records: nextRawRecords, config: state.config });
  }, [state.sites, state.config]);

  /** Agrega nuevos registros a los existentes (carga de CSV en modo "agregar"). */
  const appendRecords = useCallback(async (newRawRows) => {
    const merged = [...rawOf(state.records, state.memoRecords), ...newRawRows];
    const { records, memoRecords } = splitRecords(merged);
    setState((s) => ({ ...s, records, memoRecords }));
    await dataAdapter.sync('records-append', { sites: state.sites, records: merged, config: state.config, appended: newRawRows });
  }, [state.sites, state.records, state.memoRecords, state.config]);

  const resetDemo = useCallback(async () => {
    if (dataAdapter.mode !== 'demo') return;
    await dataAdapter.resetDemo();
    await reload();
  }, [reload]);

  const value = {
    ...state, siteById, filters, setFilters, mode: dataAdapter.mode,
    updateConfig, updateSites, replaceRecords, appendRecords, resetDemo, reload,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData debe usarse dentro de <DataProvider>');
  return ctx;
}
