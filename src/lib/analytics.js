// Indicadores de fluctuación y detección de anomalías de la generación de residuos.
// Funciones puras sobre los registros "principales" (sin datos de referencia como madera_nv).
//
// Detección de anomalías (explicable, sin caja negra):
//   Para cada sede y cada flujo (total y cada categoría de residuo) se compara el valor de un mes con el
//   historial de ESA MISMA sede: la mediana de los hasta 6 meses anteriores (mínimo 4) como valor esperado
//   (robusta a tendencia/estacionalidad), y el promedio histórico completo de esa sede en ese flujo como
//   referencia de "tamaño típico". La desviación estadística se mide con una z robusta =
//   (valor − mediana) / escala, donde escala = máx(1,4826 × MAD, 10 % de la mediana).
//   Un mes es anómalo si se cumplen las TRES condiciones:
//     1) |z| ≥ 4 (estadísticamente inusual frente al ruido reciente de esa sede)
//     2) la desviación frente a la mediana reciente es ≥ 20 % (minDevPct)
//     3) el desvío en kg es ≥ 20 % del PROMEDIO HISTÓRICO de generación de esa sede en ese flujo (minAvgPct)
//   La condición (3) reemplaza un volumen fijo en kg (igual para una sede grande que para una pequeña) por un
//   porcentaje del propio promedio de cada sede: así una sede grande necesita un desvío mayor en kg para
//   calificar como anomalía, y una sede pequeña uno proporcionalmente menor — el criterio se adapta a la
//   escala de cada sede en vez de aplicar un estándar único.
//   Además se marca como anomalía un mes sin ningún registro dentro del historial de una sede.
import { MATERIAL_BY_ID } from './constants.js';
import { periodLabel } from './format.js';

export const ANOMALY_PARAMS = { window: 6, minPrev: 4, z: 4, minDevPct: 0.2, minAvgPct: 0.2, highZ: 8, highDevPct: 1, epsKg: 1 };

export const STREAM_LABEL = {
  total: 'Total',
  aprovechables: 'Reciclables',
  no_aprovechables: 'Residuos generales',
  organicos: 'Orgánicos',
  peligrosos: 'Peligrosos / RAEE',
};
export const STREAM_IDS = ['aprovechables', 'no_aprovechables', 'organicos', 'peligrosos'];

export const catOf = (r) => MATERIAL_BY_ID[r.m]?.category;

const median = (a) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y); const n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
};
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
const pstdev = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((v) => (v - m) ** 2))); };

const addMonths = (p, n) => {
  let y = Number(p.slice(0, 4)); let m = Number(p.slice(5, 7)) - 1 + n;
  y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
  return `${y}-${String(m + 1).padStart(2, '0')}`;
};
const monthRange = (a, b) => { const out = []; for (let p = a; p <= b; p = addMonths(p, 1)) out.push(p); return out; };

/* ------------------------------------------------------------------ Fluctuación */

/**
 * Meses "comparables": aquellos en que reportaron sedes que suman al menos el 80 % del volumen habitual.
 * El peso de cada sede es su promedio mensual; las sedes de referencia son las que reportan en los 3 últimos
 * meses. El primer mes de una sede, si es menos de la mitad de los tres meses siguientes, se considera parcial
 * (empezó a reportar a mitad de mes) y no cuenta como mes con datos completos de esa sede.
 */
export function comparablePeriods(records) {
  const bySite = new Map(); // sede → Map(periodo → kg)
  for (const r of records) {
    if (!bySite.has(r.s)) bySite.set(r.s, new Map());
    const m = bySite.get(r.s); m.set(r.p, (m.get(r.p) || 0) + r.kg);
  }
  const periods = [...new Set(records.map((r) => r.p))].sort();
  const partial = new Set();
  for (const [s, m] of bySite) {
    const ps = [...m.keys()].sort();
    if (ps.length >= 4) {
      const next = median(ps.slice(1, 4).map((p) => m.get(p)));
      if (m.get(ps[0]) < 0.5 * next) partial.add(`${s}|${ps[0]}`);
    }
  }
  const weight = (s) => { const m = bySite.get(s); return [...m.values()].reduce((a, v) => a + v, 0) / m.size; };
  const reporting = (p) => [...bySite.entries()].filter(([s, m]) => m.has(p) && !partial.has(`${s}|${p}`)).map(([s]) => s);
  const ref = new Set(periods.slice(-3).flatMap((p) => [...bySite.entries()].filter(([, m]) => m.has(p)).map(([s]) => s)));
  const refW = [...ref].reduce((sum, s) => sum + weight(s), 0);
  const coverage = (p) => (refW > 0 ? reporting(p).filter((s) => ref.has(s)).reduce((sum, s) => sum + weight(s), 0) / refW : 1);
  const comparable = new Set(periods.filter((p) => coverage(p) >= 0.8));
  return { periods, comparable, excluded: periods.filter((p) => !comparable.has(p)) };
}

/** "abr 2025, may 2025 y jun 2025" o, si son muchos, "abr 2025 – feb 2026". */
export function listPeriods(ps) {
  if (!ps.length) return '';
  const l = ps.map((p) => periodLabel(p, true));
  if (l.length <= 3) return l.length === 1 ? l[0] : `${l.slice(0, -1).join(', ')} y ${l[l.length - 1]}`;
  return `${l[0]} – ${l[l.length - 1]} (${l.length} meses)`;
}

const cvLabel = (cv) => (cv < 10 ? 'Estable' : cv < 20 ? 'Moderada' : 'Alta');
const trendLabel = (pct) => (pct > 1.5 ? 'Creciente' : pct < -1.5 ? 'Decreciente' : 'Estable');

/** Estadísticos de una serie mensual { p → kg } restringida a los meses comparables. */
export function seriesStats(totalsByP, comparable) {
  const ps = [...comparable].filter((p) => totalsByP.has(p)).sort();
  const rows = ps.map((p, i) => {
    const prevP = addMonths(p, -1); const yoyP = addMonths(p, -12);
    const total = totalsByP.get(p);
    const win = ps.slice(Math.max(0, i - 2), i + 1).map((q) => totalsByP.get(q));
    return {
      p, label: periodLabel(p), total, ma3: mean(win),
      mom: totalsByP.has(prevP) && comparable.has(prevP) && totalsByP.get(prevP) > 0 ? ((total - totalsByP.get(prevP)) / totalsByP.get(prevP)) * 100 : null,
      yoy: totalsByP.has(yoyP) && comparable.has(yoyP) && totalsByP.get(yoyP) > 0 ? ((total - totalsByP.get(yoyP)) / totalsByP.get(yoyP)) * 100 : null,
    };
  });
  const vals = rows.map((r) => r.total);
  const last = rows[rows.length - 1];
  const stats = { n: rows.length, latest: last || null };
  if (last && rows.length >= 4) {
    const prev3 = mean(vals.slice(-4, -1));
    stats.vsPrev3 = prev3 > 0 ? ((last.total - prev3) / prev3) * 100 : null;
  } else stats.vsPrev3 = null;
  stats.yoy = last?.yoy ?? null;
  stats.mom = last?.mom ?? null;
  if (rows.length >= 4 && mean(vals) > 0) {
    stats.cv = (pstdev(vals) / mean(vals)) * 100; stats.cvLabel = cvLabel(stats.cv);
    const peak = rows.reduce((a, r) => (r.total > a.total ? r : a), rows[0]);
    const low = rows.reduce((a, r) => (r.total < a.total ? r : a), rows[0]);
    stats.peak = { p: peak.p, kg: peak.total }; stats.low = { p: low.p, kg: low.total };
    // Tendencia: pendiente por mínimos cuadrados de los últimos 6 meses comparables, en % del promedio por mes.
    const y = vals.slice(-6); const n = y.length; const xm = (n - 1) / 2; const ym = mean(y);
    const num = y.reduce((s, v, i) => s + (i - xm) * (v - ym), 0); const den = y.reduce((s, _v, i) => s + (i - xm) ** 2, 0);
    stats.trendPct = ym > 0 && den > 0 ? ((num / den) / ym) * 100 : 0; stats.trendLabel = trendLabel(stats.trendPct);
    stats.trendMonths = n;
  } else { stats.cv = null; stats.peak = null; stats.low = null; stats.trendPct = null; }
  return { rows, stats };
}

const totalsMap = (records) => { const m = new Map(); for (const r of records) m.set(r.p, (m.get(r.p) || 0) + r.kg); return m; };

/**
 * Fluctuación de la generación total y por tipo de residuo. Solo usa meses comparables
 * (se excluyen los meses con cobertura de sedes incompleta, p. ej. cuando aún se incorporaban sedes).
 * @param coverageRecords conjunto más amplio sobre el que medir qué meses son comparables (útil al analizar
 *   un solo material: la cobertura se mide con el total de la sede, no solo con ese material).
 */
export function fluctuation(records, coverageRecords = records) {
  const { comparable, excluded } = comparablePeriods(coverageRecords);
  const total = seriesStats(totalsMap(records), comparable);
  const streams = STREAM_IDS.map((id) => {
    const recs = records.filter((r) => catOf(r) === id);
    if (!recs.length) return null;
    return { id, label: STREAM_LABEL[id], ...seriesStats(totalsMap(recs), comparable) };
  }).filter(Boolean);
  return { rows: total.rows, stats: total.stats, streams, excluded };
}

/* ------------------------------------------------------------------ Anomalías */

/** Series { "sede|flujo" → Map(periodo → kg) } con el total y cada categoría. */
function buildSeries(records) {
  const series = new Map();
  const add = (key, p, kg) => { if (!series.has(key)) series.set(key, new Map()); const m = series.get(key); m.set(p, (m.get(p) || 0) + kg); };
  for (const r of records) {
    add(`${r.s}|total`, r.p, r.kg);
    const c = catOf(r); if (c) add(`${r.s}|${c}`, r.p, r.kg);
  }
  return series;
}

/**
 * Mediana (y escala robusta) de los hasta `window` meses anteriores a `p`, más el PROMEDIO de TODO el
 * historial anterior a `p` (no solo la ventana) — ese promedio es el "tamaño típico" de esa sede en ese flujo,
 * y es lo que fija el piso de materialidad de la anomalía como un % de sí mismo, en vez de un kg fijo.
 */
function baselineAt(m, p, params) {
  const priorAll = [...m.keys()].filter((q) => q < p).sort();
  if (priorAll.length < params.minPrev) return null;
  const trailing = priorAll.slice(-params.window).map((q) => m.get(q));
  const med = median(trailing);
  const mad = 1.4826 * median(trailing.map((v) => Math.abs(v - med)));
  const scale = Math.max(mad, 0.1 * med, 1);
  const avg = mean(priorAll.map((q) => m.get(q)));
  return { med, scale, avg };
}

/**
 * Detecta meses atípicos por sede y flujo. Si el total de una sede en un mes es anómalo se informa una sola
 * entrada (con los flujos que la explican); si no, se informan las categorías anómalas.
 */
export function detectAnomalies(records, siteById, params = ANOMALY_PARAMS) {
  const series = buildSeries(records);
  const allPeriods = [...new Set(records.map((r) => r.p))].sort();
  if (!allPeriods.length) return [];
  const globalLast = allPeriods[allPeriods.length - 1];
  const raw = [];

  for (const [key, m] of series) {
    const [s, stream] = key.split('|');
    const ps = [...m.keys()].sort();
    for (const p of ps) {
      const b = baselineAt(m, p, params);
      if (!b) continue;
      const x = m.get(p); const diff = x - b.med; const z = diff / b.scale; const devPct = diff / Math.max(b.med, 1);
      const avgFloor = Math.max(params.minAvgPct * b.avg, params.epsKg);
      if (Math.abs(z) >= params.z && Math.abs(devPct) >= params.minDevPct && Math.abs(diff) >= avgFloor) {
        raw.push({ s, stream, p, actual: x, expected: b.med, diff, devPct, z, avg: b.avg, type: 'desvio' });
      }
    }
    if (stream === 'total') {
      // Meses sin ningún registro dentro del historial de la sede.
      for (const p of monthRange(ps[0], globalLast)) {
        if (m.has(p)) continue;
        const b = baselineAt(m, p, params);
        if (b && b.med >= params.epsKg) raw.push({ s, stream, p, actual: 0, expected: b.med, diff: -b.med, devPct: -1, z: null, avg: b.avg, type: 'faltante' });
      }
    }
  }

  const bySiteMonth = new Map();
  for (const a of raw) { const k = `${a.s}|${a.p}`; if (!bySiteMonth.has(k)) bySiteMonth.set(k, []); bySiteMonth.get(k).push(a); }

  const out = [];
  for (const [k, list] of bySiteMonth) {
    const [s, p] = k.split('|');
    const totalA = list.find((a) => a.stream === 'total');
    const chosen = totalA ? [totalA] : list;
    for (const a of chosen) {
      let drivers = [];
      if (a.stream === 'total') {
        drivers = STREAM_IDS.map((id) => {
          const m = series.get(`${s}|${id}`); if (!m) return null;
          const b = baselineAt(m, p, params); if (!b) return null;
          const d = (m.get(p) || 0) - b.med;
          return { stream: id, label: STREAM_LABEL[id], diff: d };
        }).filter((d) => d && Math.abs(d.diff) >= 0.15 * Math.abs(a.diff) && Math.sign(d.diff) === Math.sign(a.diff))
          .sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff)).slice(0, 2);
      }
      const high = a.type === 'desvio' && (Math.abs(a.z) >= params.highZ || Math.abs(a.devPct) >= params.highDevPct);
      out.push({
        id: `${s}|${p}|${a.stream}`, s, siteName: siteById[s]?.name || s, company: siteById[s]?.company || '',
        stream: a.stream, streamLabel: STREAM_LABEL[a.stream] || a.stream, p, label: periodLabel(p, true),
        actual: a.actual, expected: a.expected, diff: a.diff, devPct: a.devPct, z: a.z, avg: a.avg, type: a.type,
        dir: a.diff >= 0 ? 'up' : 'down', severity: high ? 'alta' : 'media', drivers,
      });
    }
  }
  const sev = { alta: 0, media: 1 };
  return out.sort((a, b) => b.p.localeCompare(a.p) || sev[a.severity] - sev[b.severity] || Math.abs(b.z ?? 99) - Math.abs(a.z ?? 99));
}

/** Anomalías cuyo mes cae dentro del período filtrado (años y meses). */
export function anomaliesInFilters(anomalies, filters) {
  const Y = filters.years?.length ? new Set(filters.years) : null;
  const M = filters.months?.length ? new Set(filters.months) : null;
  return anomalies.filter((a) => (!Y || Y.has(Number(a.p.slice(0, 4)))) && (!M || M.has(Number(a.p.slice(5, 7)))));
}

/** Cantidad de anomalías por mes (para marcarlas en el gráfico). */
export function anomalyCountByPeriod(anomalies) {
  const m = new Map();
  for (const a of anomalies) m.set(a.p, (m.get(a.p) || 0) + 1);
  return m;
}

/** Texto corto que describe qué pasó: "+3,5 t sobre lo esperado (unas 4 veces lo habitual)". */
export function describeAnomaly(a, fmt) {
  if (a.type === 'faltante') return `Sin registros este mes; lo habitual eran ${fmt(a.expected)}.`;
  const dir = a.diff >= 0 ? 'por encima' : 'por debajo';
  const pct = Math.abs(a.devPct) * 100;
  const times = a.expected > 0 ? a.actual / a.expected : 0;
  const size = a.diff >= 0 && times >= 4 ? `unas ${Math.round(times)} veces lo habitual` : `${pct.toFixed(0)} %`;
  const why = a.drivers?.length ? ` Lo explica ${a.drivers.map((d) => `${d.label.toLowerCase()} (${d.diff >= 0 ? '+' : '−'}${fmt(Math.abs(d.diff))})`).join(' y ')}.` : '';
  return `${fmt(Math.abs(a.diff))} ${dir} de lo habitual (${size}): ${fmt(a.actual)} frente a ${fmt(a.expected)} esperados.${why}`;
}
