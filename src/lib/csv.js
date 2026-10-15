import Papa from 'papaparse';
import { MATERIALS, MEMO_MATERIALS, MEMO_IDS, TREATMENTS, MONTHS_LONG } from './constants.js';

const stripAccents = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const norm = (s) => stripAccents(s).toLowerCase().trim().replace(/\s+/g, ' ');
/**
 * Clave de columna a partir de un encabezado real (CSV o Excel): minúsculas, sin tildes, y CUALQUIER
 * puntuación o espacio colapsado a "_" (no solo espacios) — así "Tipo de residuos" y "Peso (kg)", tal como
 * los trae el Excel del extractor, se normalizan a "tipo_de_residuos" y "peso_kg" de forma predecible, en vez
 * de dejar paréntesis u otra puntuación que nunca coincidiría con ningún alias.
 */
export function normHeaderKey(h) {
  return stripAccents(h).toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}
// Quita sufijos legales habituales ("S.A.C.", "Sociedad Anónima Cerrada"…) para comparar solo el nombre comercial.
const stripLegal = (s) => norm(s).replace(/\b(s\.?a\.?c\.?|s\.?a\.?a\.?|s\.?a\.?|e\.?i\.?r\.?l\.?|s\.?r\.?l\.?|sociedad anonima( cerrada| abierta)?)\b\.?/g, '').replace(/\s+/g, ' ').trim();

const MATERIAL_ALIASES = Object.fromEntries([...MATERIALS, ...MEMO_MATERIALS].flatMap((m) => [[norm(m.label), m.id], [m.id, m.id]]));
Object.assign(MATERIAL_ALIASES, {
  plastico: 'pet', 'plastico pet': 'pet', 'carton y papel': 'carton', organico: 'organicos', 'residuos organicos': 'organicos',
  metal: 'metales', 'residuos generales': 'no_aprovechables', 'residuos generales valorizables': 'no_aprovechables', 'reciclaje mixto': 'mixto',
  'madera no valorizables': 'madera_nv', 'madera no valorizable': 'madera_nv',
  'madera valorizables': 'madera_v', 'madera valorizable': 'madera_v',
  // Nombres tal como salen del extractor de Recycorp
  'reciclaje carton': 'carton', 'reciclaje papel': 'papel', 'reciclaje film': 'film', 'reciclaje pet': 'pet',
  'reciclaje vidrio': 'vidrio', 'reciclaje metal': 'metales',
});
const TREATMENT_ALIASES = Object.fromEntries(TREATMENTS.flatMap((t) => [[norm(t.label), t.id], [t.id, t.id]]));
Object.assign(TREATMENT_ALIASES, {
  relleno: 'disposicion', 'relleno sanitario': 'disposicion', 'relleno sanitario y seguridad': 'disposicion', 'disposicion final': 'disposicion',
  compost: 'compostaje', 'valorizacion energetica': 'energetica', energia: 'energetica',
});

/**
 * "Tipo de residuos" tal como lo registra el extractor de Recycorp: cada valor ya implica tanto el material
 * como el tratamiento (independientemente de lo que diga una columna "destino", que el propio extractor no usa
 * para esto — ver scripts/build_demo_data.py, que es la fuente de verdad de este mapeo). Permite subir el Excel
 * crudo del extractor tal cual, sin tener que preparar una columna de tratamiento aparte.
 */
const TIPO_OVERRIDE = {
  'reciclaje carton': ['carton', 'reciclaje'], 'reciclaje papel': ['papel', 'reciclaje'], 'reciclaje film': ['film', 'reciclaje'],
  'reciclaje pet': ['pet', 'reciclaje'], 'reciclaje vidrio': ['vidrio', 'reciclaje'], 'reciclaje metal': ['metales', 'reciclaje'],
  'reciclaje mixto': ['mixto', 'reciclaje'], 'plastico duro': ['plastico_duro', 'reciclaje'],
  'residuos organicos': ['organicos', 'compostaje'],
  'residuos generales valorizables': ['no_aprovechables', 'disposicion'], 'residuos generales': ['no_aprovechables', 'disposicion'],
  'madera no valorizables': ['madera_nv', 'disposicion'], 'madera no valorizable': ['madera_nv', 'disposicion'],
  // Madera valorizable: es un reciclable más (suma a totales y a valorización), a diferencia de la NO
  // valorizable (memo: ya está contada dentro de los generales, no se vuelve a sumar — ver MEMO_MATERIALS).
  'madera valorizables': ['madera_v', 'reciclaje'], 'madera valorizable': ['madera_v', 'reciclaje'],
};
// Tipos que se excluyen por completo (ninguno por ahora: la madera valorizable dejó de excluirse — suma como
// reciclable — y la NO valorizable se guarda como memo, no se excluye).
const TIPO_EXCLUDED = new Set();

function matchMaterial(v) { return MATERIAL_ALIASES[norm(v)]; }
function matchTreatment(v) { return TREATMENT_ALIASES[norm(v)]; }

// --- Coincidencia difusa de nombres (empresa, sede) -------------------------------------------------------
// El histórico real de la clienta no siempre escribe un nombre exactamente igual a como quedó guardado en la
// plataforma (mayúsculas, tildes, "AQP" de más o de menos, abreviaturas). En vez de exigir una coincidencia
// exacta, se admite una razonablemente parecida: distancia de edición normalizada + contención como texto.
function levenshtein(a, b) {
  const m = a.length; const n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] : 1 + Math.min(prev[j], cur[j - 1], prev[j - 1]);
    prev = cur;
  }
  return prev[n];
}
const similarity = (a, b) => (a === b ? 1 : 1 - levenshtein(a, b) / (Math.max(a.length, b.length) || 1));

/** Mejor candidato de `candidates` ({key, norm}) para `valueNorm`, o null si ninguno supera el umbral. */
function fuzzyBest(valueNorm, candidates, threshold = 0.74) {
  if (!valueNorm) return null;
  let best = null; let bestScore = 0;
  for (const c of candidates) {
    if (!c.norm) continue;
    let score = similarity(valueNorm, c.norm);
    if (c.norm.includes(valueNorm) || valueNorm.includes(c.norm)) score = Math.max(score, 0.85);
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return bestScore >= threshold ? best : null;
}

/** Nombre de empresa del archivo → nombre canónico guardado en la plataforma (o null si no hay un match razonable). */
export function matchCompanyName(v, companies) {
  if (!v) return null;
  const n = stripLegal(v);
  const exact = companies.find((c) => stripLegal(c) === n);
  if (exact) return exact;
  const best = fuzzyBest(n, companies.map((c) => ({ key: c, norm: stripLegal(c) })));
  return best?.key ?? null;
}

const sepNorm = (s) => norm(s).replace(/[·|/]/g, '-').replace(/\s*-\s*/g, ' - ');

// Palabras que suelen faltar o sobrar al escribir una sede a mano ("AQP", "Av") sin que eso deba impedir el
// match: no cuentan para ver si el valor subido queda "cubierto" por el nombre guardado.
const SITE_STOPWORDS = new Set(['aqp', 'av', 'avenida']);
const wordTokens = (s) => stripAccents(String(s ?? '')).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/**
 * Qué tan bien `valueRaw` identifica a la sede `candidateRaw`: combina similitud de caracteres (para typos o
 * tildes) con cobertura de palabras (para cuando falta "AQP", "Av" u otro relleno en medio del nombre, algo
 * que la similitud de caracteres sola penaliza demasiado por estar en medio del texto y no al final).
 */
function siteScore(valueRaw, candidateRaw) {
  const a = norm(valueRaw); const b = norm(candidateRaw);
  let score = similarity(a, b);
  if (b.includes(a) || a.includes(b)) score = Math.max(score, 0.85);
  const at = wordTokens(valueRaw).filter((w) => !SITE_STOPWORDS.has(w));
  if (at.length) {
    const bt = new Set(wordTokens(candidateRaw));
    const coverage = at.filter((w) => bt.has(w)).length / at.length;
    if (coverage === 1) score = Math.max(score, 0.95);
    else if (coverage >= 0.66) score = Math.max(score, 0.8);
  }
  return score;
}

function bestSite(valueRaw, pool, threshold) {
  if (!valueRaw || !pool.length) return undefined;
  let best = null; let bestScore = 0;
  for (const s of pool) {
    const sc = siteScore(valueRaw, s.name);
    if (sc > bestScore) { bestScore = sc; best = s; }
  }
  return bestScore >= threshold ? best.id : undefined;
}

/** Identificador de sede (id, nombre completo, o "Marca · Local") → id de sede, con tolerancia a variantes. */
function matchSite(v, sites, companyHint) {
  if (!v) return undefined;
  const n = norm(v);
  let hit = sites.find((s) => norm(s.id) === n || norm(s.name) === n);
  if (hit) return hit.id;
  const nSep = sepNorm(v);
  hit = sites.find((s) => sepNorm(s.name) === nSep);
  if (hit) return hit.id;
  const pool = companyHint ? sites.filter((s) => s.company === companyHint) : sites;
  return bestSite(v, pool.length ? pool : sites, 0.78);
}

/** Variante de `matchSite` para archivos con "cliente" (marca) y "sede" (local) en columnas separadas. */
function matchSiteFromParts(cliente, sede, sites, companyHint) {
  if (!cliente && !sede) return undefined;
  for (const combo of [cliente && sede ? `${cliente} · ${sede}` : null, sede, cliente].filter(Boolean)) {
    const hit = matchSite(combo, sites, companyHint);
    if (hit) return hit;
  }
  return undefined;
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

/** Deriva el período también de columnas separadas "año" + "mes" (número o nombre), o de una "fecha". */
function derivePeriod(get) {
  const direct = parsePeriod(get('periodo', 'period'));
  if (direct) return direct;
  const anio = get('anio', 'ano', 'year');
  const mesRaw = get('mes', 'month');
  if (anio && mesRaw !== undefined && mesRaw !== '') {
    const y = Number(String(anio).trim());
    let mo = Number(String(mesRaw).trim());
    if (!Number.isFinite(mo)) mo = MONTHS_LONG.findIndex((ml) => norm(ml) === norm(mesRaw)) + 1 || NaN;
    if (Number.isFinite(y) && mo >= 1 && mo <= 12) return `${y}-${String(mo).padStart(2, '0')}`;
  }
  const fromMes = parsePeriod(mesRaw);
  if (fromMes) return fromMes;
  const fecha = get('fecha', 'date');
  if (fecha) {
    const d = fecha instanceof Date ? fecha : new Date(fecha);
    if (!Number.isNaN(d.getTime())) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  return null;
}

/**
 * Convierte texto numérico a número aceptando los formatos habituales de Excel:
 * 12500.5 · 12500,5 · 12,500.5 · 12.500,5 · 12 500,5. Si hay un solo separador de miles
 * agrupado en tres cifras ("12,500") se interpreta como miles; un único punto ("12.5") es decimal.
 */
export function parseNumber(v) {
  if (typeof v === 'number') return v;
  let s = String(v ?? '').replace(/[\s ']/g, '');
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
  const { data } = Papa.parse(text.trim(), { header: true, skipEmptyLines: true, transformHeader: normHeaderKey });
  return data;
}

/**
 * Valida y normaliza filas crudas (de CSV o Excel) contra el catálogo de sedes. Acepta tanto el formato propio
 * de la plataforma (columnas periodo/local/tipo_residuo/tratamiento/kg) como el Excel crudo del extractor
 * (año, mes, cliente, sede, tipo, destino, kg — ver scripts/build_demo_data.py): el "cliente"/"sede" del
 * archivo se hace coincidir con la sede ya guardada (y su empresa) de forma tolerante, y si hay una columna de
 * empresa, su nombre se transforma al nombre canónico de la plataforma en vez de exigir que esté escrito igual.
 * Devuelve { rows, errors, excluded }.
 */
export function validateRows(rawRows, sites) {
  const companies = [...new Set(sites.map((s) => s.company).filter(Boolean))];
  const rows = []; const errors = []; let excluded = 0;
  rawRows.forEach((raw, i) => {
    const line = i + 2; // +1 por el encabezado, +1 por índice 1-based
    const get = (...keys) => keys.map((k) => raw[k]).find((v) => v !== undefined && v !== '');

    const tipoRaw = get('tipo_residuo', 'material', 'tipo', 'tipo_de_residuos', 'tipo_de_residuo');
    const tipoNorm = norm(tipoRaw);
    if (TIPO_EXCLUDED.has(tipoNorm)) { excluded += 1; return; }

    const p = derivePeriod(get);

    const localRaw = get('local', 'site');
    const clienteRaw = get('cliente', 'marca', 'brand');
    const sedeRaw = get('sede');
    const empresaRaw = get('empresa', 'company');
    const companyHint = empresaRaw ? matchCompanyName(empresaRaw, companies) : null;
    let s = localRaw ? matchSite(localRaw, sites, companyHint) : undefined;
    if (!s && clienteRaw && sedeRaw) s = matchSiteFromParts(clienteRaw, sedeRaw, sites, companyHint);
    if (!s && sedeRaw && !clienteRaw) s = matchSite(sedeRaw, sites, companyHint);
    if (!s && clienteRaw && !sedeRaw) s = matchSite(clienteRaw, sites, companyHint);
    // Si hubo pista de empresa pero no se encontró nada dentro de sus propias sedes (p. ej. porque la "empresa"
    // del archivo en realidad no coincide con ninguna, o el match quedó demasiado acotado), se reintenta sin
    // acotar en vez de dar error por una pista que puede no ser fiable.
    if (!s && companyHint) {
      s = (localRaw && matchSite(localRaw, sites))
        || (clienteRaw && sedeRaw && matchSiteFromParts(clienteRaw, sedeRaw, sites))
        || (sedeRaw && !clienteRaw && matchSite(sedeRaw, sites))
        || (clienteRaw && !sedeRaw && matchSite(clienteRaw, sites))
        || undefined;
    }
    const siteDisplay = localRaw || (clienteRaw && sedeRaw ? `${clienteRaw} · ${sedeRaw}` : null) || sedeRaw || clienteRaw || '';

    const override = TIPO_OVERRIDE[tipoNorm];
    const m = override ? override[0] : matchMaterial(tipoRaw);
    const t = override ? override[1] : matchTreatment(get('tratamiento', 'treatment', 'destino'));
    const kg = parseNumber(get('kg', 'peso', 'cantidad', 'peso_kg'));

    const issues = [];
    if (!p) issues.push(`periodo inválido: "${get('periodo', 'period') ?? get('mes', 'month') ?? ''}"`);
    if (!s) issues.push(`sede desconocida: "${siteDisplay}"`);
    if (!m) issues.push(`tipo de residuo desconocido: "${tipoRaw ?? ''}"`);
    if (!t) issues.push(`tratamiento desconocido: "${get('tratamiento', 'treatment', 'destino') ?? ''}"`);
    if (m && t && MEMO_IDS.has(m) && t !== 'disposicion') issues.push('la madera no valorizable solo admite el tratamiento "Relleno sanitario / seguridad"');
    if (!Number.isFinite(kg) || kg < 0) issues.push(`cantidad inválida: "${get('kg', 'peso', 'cantidad', 'peso_kg') ?? ''}"`);
    if (issues.length) errors.push({ line, message: issues.join('; ') });
    else rows.push({ p, s, m, t, kg });
  });
  return { rows, errors, excluded };
}

const materialLabel = Object.fromEntries([...MATERIALS, ...MEMO_MATERIALS].map((m) => [m.id, m.label]));
const treatmentLabel = Object.fromEntries(TREATMENTS.map((t) => [t.id, t.label]));
export const IMPORT_HEADERS = ['periodo', 'local', 'tipo_residuo', 'tratamiento', 'kg'];

/** Filas (objetos planos) de los registros actuales, en el formato propio de la plataforma — para CSV y Excel. */
export function recordsToRows(records, sites) {
  const siteName = Object.fromEntries(sites.map((s) => [s.id, s.name]));
  return records.map((r) => ({ periodo: r.p, local: siteName[r.s] || r.s, tipo_residuo: materialLabel[r.m] || r.m, tratamiento: treatmentLabel[r.t] || r.t, kg: r.kg }));
}

export function templateRows(sites) {
  const site = sites[0]?.name || 'Makro AQP · Avelino';
  return [
    { periodo: '2026-01', local: site, tipo_residuo: 'Cartón', tratamiento: 'Reciclaje', kg: 1200 },
    { periodo: '2026-01', local: site, tipo_residuo: 'Orgánicos', tratamiento: 'Compostaje', kg: 800 },
    { periodo: '2026-01', local: site, tipo_residuo: 'No aprovechables', tratamiento: 'Relleno sanitario / seguridad', kg: 2100 },
  ];
}

const rowsToCsv = (rows) => [IMPORT_HEADERS.join(','), ...rows.map((r) => IMPORT_HEADERS.map((h) => `"${String(r[h]).replace(/"/g, '""')}"`).join(','))].join('\n');
export function templateCsv(sites) { return rowsToCsv(templateRows(sites)); }
export function recordsToCsv(records, sites) { return rowsToCsv(recordsToRows(records, sites)); }
