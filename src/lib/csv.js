import Papa from 'papaparse';
import { MATERIALS, MEMO_MATERIALS, MEMO_IDS, TREATMENTS } from './constants.js';

const stripAccents = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const norm = (s) => stripAccents(s).toLowerCase().trim().replace(/\s+/g, ' ');

const MATERIAL_ALIASES = Object.fromEntries([...MATERIALS, ...MEMO_MATERIALS].flatMap((m) => [[norm(m.label), m.id], [m.id, m.id]]));
Object.assign(MATERIAL_ALIASES, {
  plastico: 'pet', 'plastico pet': 'pet', 'carton y papel': 'carton', organico: 'organicos', 'residuos organicos': 'organicos',
  metal: 'metales', 'residuos generales': 'no_aprovechables', 'residuos generales valorizables': 'no_aprovechables', 'reciclaje mixto': 'mixto',
  'madera no valorizables': 'madera_nv', 'madera no valorizable': 'madera_nv',
  // Nombres tal como salen del extractor de Recycorp
  'reciclaje carton': 'carton', 'reciclaje papel': 'papel', 'reciclaje film': 'film', 'reciclaje pet': 'pet',
  'reciclaje vidrio': 'vidrio', 'reciclaje metal': 'metales',
});
const TREATMENT_ALIASES = Object.fromEntries(TREATMENTS.flatMap((t) => [[norm(t.label), t.id], [t.id, t.id]]));
Object.assign(TREATMENT_ALIASES, {
  relleno: 'disposicion', 'relleno sanitario': 'disposicion', 'relleno sanitario y seguridad': 'disposicion', 'disposicion final': 'disposicion',
  compost: 'compostaje', 'valorizacion energetica': 'energetica', energia: 'energetica',
});

function matchMaterial(v) { return MATERIAL_ALIASES[norm(v)]; }
function matchTreatment(v) { return TREATMENT_ALIASES[norm(v)]; }
function matchSite(v, sites) {
  const n = norm(v);
  return sites.find((s) => norm(s.id) === n || norm(s.name) === n)?.id;
}

/** Interpreta 2025-03, 03/2025, 3-2025 → "2025-03". Devuelve null si el mes no está entre 1 y 12. */
function parsePeriod(v) {
  const s = String(v ?? '').trim();
  let y; let mo;
  let m = s.match(/^(\d{4})[-/](\d{1,2})(?:[-/]\d{1,2})?$/);
  if (m) { y = Number(m[1]); mo = Number(m[2]); } else {
    m = s.match(/^(\d{1,2})[-/](\d{4})$/);
    if (!m) return null;
    mo = Number(m[1]); y = Number(m[2]);
  }
  if (mo < 1 || mo > 12 || y < 1990 || y > 2100) return null;
  return `${y}-${String(mo).padStart(2, '0')}`;
}

/**
 * Convierte texto numérico a número aceptando los formatos habituales de Excel:
 * 12500.5 · 12500,5 · 12,500.5 · 12.500,5 · 12 500,5. Si hay un solo separador de miles
 * agrupado en tres cifras ("12,500") se interpreta como miles; un único punto ("12.5") es decimal.
 */
export function parseNumber(v) {
  let s = String(v ?? '').replace(/[\s ']/g, '');
  if (s === '' || !/^[0-9.,]+$/.test(s)) return NaN;
  const dots = (s.match(/\./g) || []).length; const commas = (s.match(/,/g) || []).length;
  if (dots && commas) {
    const decimal = s.lastIndexOf(',') > s.lastIndexOf('.') ? ',' : '.';
    const thousands = decimal === ',' ? '.' : ',';
    s = s.split(thousands).join('').replace(decimal, '.');
  } else if (commas) {
    s = commas > 1 || /^\d{1,3},\d{3}$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if (dots > 1) {
    s = s.replace(/\./g, '');
  }
  return /^\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
}

export function parseCsvText(text) {
  const { data } = Papa.parse(text.trim(), { header: true, skipEmptyLines: true, transformHeader: (h) => norm(h).replace(/\s+/g, '_') });
  return data;
}

/** Valida y normaliza filas crudas (de CSV) contra el catálogo de sedes. Devuelve { rows, errors }. */
export function validateRows(rawRows, sites) {
  const rows = []; const errors = [];
  rawRows.forEach((raw, i) => {
    const line = i + 2; // +1 por el encabezado, +1 por índice 1-based
    const get = (...keys) => keys.map((k) => raw[k]).find((v) => v !== undefined && v !== '');
    const p = parsePeriod(get('periodo', 'mes', 'period'));
    const s = matchSite(get('local', 'sede', 'site'), sites);
    const m = matchMaterial(get('tipo_residuo', 'material', 'tipo'));
    const t = matchTreatment(get('tratamiento', 'treatment', 'destino'));
    const kg = parseNumber(get('kg', 'peso', 'cantidad'));
    const issues = [];
    if (!p) issues.push(`periodo inválido: "${get('periodo', 'mes', 'period') ?? ''}"`);
    if (!s) issues.push(`sede desconocida: "${get('local', 'sede', 'site') ?? ''}"`);
    if (!m) issues.push(`tipo de residuo desconocido: "${get('tipo_residuo', 'material', 'tipo') ?? ''}"`);
    if (!t) issues.push(`tratamiento desconocido: "${get('tratamiento', 'treatment', 'destino') ?? ''}"`);
    if (m && t && MEMO_IDS.has(m) && t !== 'disposicion') issues.push('la madera no valorizable solo admite el tratamiento "Relleno sanitario / seguridad"');
    if (!Number.isFinite(kg) || kg < 0) issues.push(`cantidad inválida: "${get('kg', 'peso', 'cantidad') ?? ''}"`);
    if (issues.length) errors.push({ line, message: issues.join('; ') });
    else rows.push({ p, s, m, t, kg });
  });
  return { rows, errors };
}

export function templateCsv(sites) {
  const site = sites[0]?.name || 'Makro AQP · Avelino';
  return [
    'periodo,local,tipo_residuo,tratamiento,kg',
    `2026-01,${site},Cartón,Reciclaje,1200`,
    `2026-01,${site},Orgánicos,Compostaje,800`,
    `2026-01,${site},No aprovechables,Relleno sanitario / seguridad,2100`,
  ].join('\n');
}

export function recordsToCsv(records, sites) {
  const mat = Object.fromEntries([...MATERIALS, ...MEMO_MATERIALS].map((m) => [m.id, m.label]));
  const trt = Object.fromEntries(TREATMENTS.map((t) => [t.id, t.label]));
  const siteName = Object.fromEntries(sites.map((s) => [s.id, s.name]));
  const header = 'periodo,local,tipo_residuo,tratamiento,kg';
  const lines = records.map((r) => `${r.p},"${siteName[r.s] || r.s}","${mat[r.m] || r.m}","${trt[r.t] || r.t}",${r.kg}`);
  return [header, ...lines].join('\n');
}
