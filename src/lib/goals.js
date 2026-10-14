// Metas de valorización por segmento de cliente.
// Cada empresa pertenece a un segmento (Retail, Educación…) con su meta; sin segmento se usa la meta general.
import { TREATMENT_BY_ID } from './constants.js';
import { periodLabel } from './format.js';

/** Segmento (objeto) de una empresa, o null. */
export function segmentOfCompany(company, config) {
  const id = config.companySegments?.[company];
  return (config.segments || []).find((s) => s.id === id) || null;
}

/** Meta (%) aplicable a una sede. */
export function goalForSite(site, config) {
  return segmentOfCompany(site?.company, config)?.goal ?? config.goals.valorizacion;
}

/**
 * Meta aplicable a un conjunto de registros. Si abarca varios segmentos, es la meta ponderada por volumen
 * generado (Σ meta × kg / Σ kg). Devuelve { value, mixed, labels }.
 * Se usa para KPIs puntuales (un número); para una serie en el tiempo comparada contra metas reales por
 * segmento, usar `seriesBySegment` en vez de esto (ver nota en RateChart).
 */
export function goalForRecords(records, siteById, config) {
  const kgBySeg = new Map(); // etiqueta → { goal, kg }
  let total = 0; let acc = 0;
  for (const r of records) {
    const site = siteById[r.s];
    const seg = segmentOfCompany(site?.company, config);
    const goal = seg?.goal ?? config.goals.valorizacion;
    const label = seg?.label ?? 'Sin segmento';
    total += r.kg; acc += goal * r.kg;
    const x = kgBySeg.get(label) || { goal, kg: 0 };
    x.kg += r.kg; kgBySeg.set(label, x);
  }
  const goals = new Set([...kgBySeg.values()].map((x) => x.goal));
  if (!total) return { value: config.goals.valorizacion, mixed: false, labels: [] };
  return { value: acc / total, mixed: goals.size > 1, labels: [...kgBySeg.keys()] };
}

/** Meta ponderada mes a mes (para un KPI puntual de una selección mixta). */
export function monthlyGoals(records, siteById, config) {
  const byP = new Map();
  for (const r of records) {
    const seg = segmentOfCompany(siteById[r.s]?.company, config);
    const goal = seg?.goal ?? config.goals.valorizacion;
    const x = byP.get(r.p) || { kg: 0, acc: 0 };
    x.kg += r.kg; x.acc += goal * r.kg; byP.set(r.p, x);
  }
  return new Map([...byP].map(([p, x]) => [p, x.kg ? x.acc / x.kg : config.goals.valorizacion]));
}

/** Todas las empresas presentes en `records`, agrupadas por su segmento. */
export function companiesBySegment(records, siteById, config) {
  const bySeg = new Map(); // segLabel → { goal, companies: Set }
  const noSeg = new Set();
  for (const r of records) {
    const company = siteById[r.s]?.company; if (!company) continue;
    const seg = segmentOfCompany(company, config);
    if (seg) { const x = bySeg.get(seg.id) || { id: seg.id, label: seg.label, goal: seg.goal, companies: new Set() }; x.companies.add(company); bySeg.set(seg.id, x); }
    else noSeg.add(company);
  }
  const segs = [...bySeg.values()].map((x) => ({ ...x, companies: [...x.companies].sort() }));
  if (noSeg.size) segs.push({ id: '__none', label: 'Sin segmento', goal: config.goals.valorizacion, companies: [...noSeg].sort() });
  return segs;
}

/**
 * Serie mensual de tasa de valorización, UNA LÍNEA POR SEGMENTO (no una meta ponderada).
 * Pensada para el gráfico general de "Valorización vs meta": cada segmento tiene su propia meta real, así que
 * las líneas nunca mezclan objetivos distintos (a diferencia de una meta ponderada por volumen entre segmentos).
 * Devuelve { segments: [{id,label,goal}], data: [{p, label, [segId]: tasa|null, ...}] }.
 */
export function seriesBySegment(records, siteById, config) {
  const byPSeg = new Map(); // periodo → Map(segId → {total, valorized})
  const segMeta = new Map();
  for (const r of records) {
    const site = siteById[r.s]; if (!site) continue;
    const seg = segmentOfCompany(site.company, config);
    const segId = seg?.id ?? '__none';
    if (!segMeta.has(segId)) segMeta.set(segId, { id: segId, label: seg?.label ?? 'Sin segmento', goal: seg?.goal ?? config.goals.valorizacion });
    let row = byPSeg.get(r.p); if (!row) { row = new Map(); byPSeg.set(r.p, row); }
    const x = row.get(segId) || { total: 0, valorized: 0 };
    x.total += r.kg;
    if (TREATMENT_BY_ID[r.t]?.valorized) x.valorized += r.kg;
    row.set(segId, x);
  }
  const periods = [...byPSeg.keys()].sort();
  const segments = [...segMeta.values()].sort((a, b) => a.label.localeCompare(b.label));
  const data = periods.map((p) => {
    const row = { p, label: periodLabel(p, true) };
    const bySeg = byPSeg.get(p);
    for (const seg of segments) {
      const x = bySeg.get(seg.id);
      row[seg.id] = x && x.total ? (x.valorized / x.total) * 100 : null;
    }
    return row;
  });
  return { segments, data };
}
