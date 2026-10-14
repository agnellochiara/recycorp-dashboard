// Datos del modo demo: registros reales del extractor de Recycorp (Arequipa), agregados por mes.
// Se generan con `python3 scripts/build_demo_data.py <archivo.xlsx>` → src/data/demo.json
import raw from '../data/demo.json';
import { DEFAULT_CONFIG } from './constants.js';

export const DEMO_META = raw.meta;

export function getDemoState() {
  return {
    sites: raw.sites.map((s) => ({ ...s })),
    records: raw.records.map(([p, s, m, t, kg]) => ({ p, s, m, t, kg })),
    config: structuredClone(DEFAULT_CONFIG),
  };
}
