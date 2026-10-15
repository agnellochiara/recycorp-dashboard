// Catálogos, factores de emisión, segmentos y metas por defecto.

export const CATEGORIES = [
  { id: 'aprovechables', label: 'Aprovechables' },
  { id: 'no_aprovechables', label: 'No aprovechables' },
  { id: 'peligrosos', label: 'Peligrosos / RAEE' },
  { id: 'organicos', label: 'Orgánicos' },
];

export const MATERIALS = [
  { id: 'carton', label: 'Cartón', category: 'aprovechables', color: '#b5792f' },
  { id: 'pet', label: 'Plástico PET', category: 'aprovechables', color: '#3f7fd6' },
  { id: 'vidrio', label: 'Vidrio', category: 'aprovechables', color: '#1f9d8a' },
  { id: 'metales', label: 'Metales', category: 'aprovechables', color: '#9aa7bd' },
  { id: 'film', label: 'Film', category: 'aprovechables', color: '#c05ad6' },
  { id: 'papel', label: 'Papel', category: 'aprovechables', color: '#e6c84a' },
  { id: 'plastico_duro', label: 'Plástico duro', category: 'aprovechables', color: '#2a5fa8' },
  { id: 'mixto', label: 'Reciclaje mixto', category: 'aprovechables', color: '#b0a08a' },
  { id: 'madera_v', label: 'Madera valorizable', category: 'aprovechables', color: '#c9a06b' },
  { id: 'no_aprovechables', label: 'No aprovechables', category: 'no_aprovechables', color: '#7b6fae' },
  { id: 'raee', label: 'RAEE', category: 'peligrosos', color: '#d6567f' },
  { id: 'peligrosos', label: 'Peligrosos', category: 'peligrosos', color: '#c23a3a' },
  { id: 'organicos', label: 'Orgánicos', category: 'organicos', color: '#5fa83e' },
];

/**
 * Materiales "memo": dato de referencia que YA está incluido en otro material, por lo que no se suma a los totales.
 * `madera_nv` (madera NO valorizable) es una fracción de los residuos generales (no_aprovechables) — se guarda
 * como referencia, pero no se suma de nuevo. La madera VALORIZABLE es distinta: es un reciclable más (material
 * `madera_v` arriba, con tratamiento "reciclaje") y sí suma a los totales y a la valorización.
 */
export const MEMO_MATERIALS = [
  { id: 'madera_nv', label: 'Madera no valorizable', parent: 'no_aprovechables', category: 'no_aprovechables', color: '#8a5a3c', treatment: 'disposicion' },
];
export const MEMO_IDS = new Set(MEMO_MATERIALS.map((m) => m.id));
export const isMemo = (r) => MEMO_IDS.has(r.m);

export const MATERIAL_BY_ID = Object.fromEntries([...MATERIALS, ...MEMO_MATERIALS].map((m) => [m.id, m]));

export const TREATMENTS = [
  { id: 'reciclaje', label: 'Reciclaje', color: '#1fa971', valorized: true, recycled: true },
  { id: 'compostaje', label: 'Compostaje', color: '#8fbf3f', valorized: true, recycled: true },
  { id: 'energetica', label: 'Valorización energética', color: '#e6a23c', valorized: true, recycled: false },
  { id: 'disposicion', label: 'Relleno sanitario / seguridad', color: '#7b8494', valorized: false, recycled: false },
];
export const TREATMENT_BY_ID = Object.fromEntries(TREATMENTS.map((t) => [t.id, t]));

export const MONTHS_LONG = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
export const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export const EMPTY_FILTERS = { years: [], months: [], sites: [], materials: [], treatments: [] };

/** Segmentos de cliente con su meta de valorización (% del total generado). */
export const DEFAULT_SEGMENTS = [
  { id: 'retail', label: 'Retail', goal: 70 },
  { id: 'educacion', label: 'Educación', goal: 50 },
  { id: 'hospitalidad', label: 'Entretenimiento y hospitalidad', goal: 20 },
];
/** Segmento de cada empresa. Las empresas sin segmento usan la meta general (`goals.valorizacion`). */
export const DEFAULT_COMPANY_SEGMENTS = {
  'Casa Andina': 'hospitalidad',
  'Farmacias Peruanas': 'retail',
  'Innova Schools': 'educacion',
  'Oechsle': 'retail',
  'Promart': 'retail',
  'Real Plaza': 'retail',
  'Supermercados Peruanos': 'retail', // Makro, Plaza Vea y Oslo
  'UTP': 'educacion',
};

export const DEFAULT_CONFIG = {
  goals: { valorizacion: 70 }, // meta general: solo para empresas sin segmento
  segments: DEFAULT_SEGMENTS,
  companySegments: DEFAULT_COMPANY_SEGMENTS,
  factors: {
    // tCO2e evitadas por tonelada gestionada. Valores indicativos: reemplazar por los del inventario real.
    reciclaje: { carton: 2.9, papel: 3.0, pet: 1.6, film: 1.1, plastico_duro: 1.4, vidrio: 0.35, metales: 3.2, mixto: 0.8, madera_v: 0.9, raee: 1.9, peligrosos: 0, no_aprovechables: 0, organicos: 0 },
    compostaje: 0.25,
    energetica: 0.3,
    disposicion: 0,
    // Ecoequivalencias de impacto (valores indicativos de referencia pública, p. ej. EPA): convierten la huella
    // evitada y el papel/cartón reciclado en términos cotidianos. Ver src/lib/impact.js.
    equiv: {
      tCo2PerTree10y: 0.06, // tCO2e que secuestra un árbol joven a lo largo de 10 años
      kgCo2PerCarKm: 0.25, // kg de CO2 por kilómetro recorrido en un auto promedio
      tCo2PerHomeYear: 8.3, // tCO2e del consumo eléctrico anual de un hogar promedio
      treesPerTonPaper: 17, // árboles salvados por tonelada de papel/cartón reciclado
      litersWaterPerTonPaper: 26000, // litros de agua ahorrados por tonelada de papel/cartón reciclado
      kwhPerTonPaper: 4100, // kWh ahorrados por tonelada de papel/cartón reciclado
    },
  },
  companies: ['Casa Andina', 'Farmacias Peruanas', 'Innova Schools', 'Oechsle', 'Promart', 'Real Plaza', 'Supermercados Peruanos', 'UTP'],
  formats: ['Centro comercial', 'Centro de distribución', 'Colegio', 'Farmacia', 'Hotel', 'Mayorista', 'Mejoramiento del hogar', 'Supermercado', 'Tienda por departamento', 'Universidad'],
};

/** Completa una configuración guardada con los valores por defecto (p. ej. materiales agregados después). */
export function mergeConfig(saved) {
  const c = saved || {};
  return {
    ...DEFAULT_CONFIG,
    ...c,
    goals: { ...DEFAULT_CONFIG.goals, ...(c.goals || {}) },
    segments: Array.isArray(c.segments) ? c.segments : DEFAULT_CONFIG.segments,
    companySegments: c.companySegments && typeof c.companySegments === 'object' ? c.companySegments : DEFAULT_CONFIG.companySegments,
    factors: {
      ...DEFAULT_FACTORS_FALLBACK(), ...(c.factors || {}),
      reciclaje: { ...DEFAULT_CONFIG.factors.reciclaje, ...(c.factors?.reciclaje || {}) },
      equiv: { ...DEFAULT_CONFIG.factors.equiv, ...(c.factors?.equiv || {}) },
    },
    companies: Array.isArray(c.companies) ? c.companies : DEFAULT_CONFIG.companies,
    formats: Array.isArray(c.formats) ? c.formats : DEFAULT_CONFIG.formats,
  };
}
function DEFAULT_FACTORS_FALLBACK() { return DEFAULT_CONFIG.factors; }
