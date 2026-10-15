import { CATEGORIES, MATERIAL_BY_ID, TREATMENTS, TREATMENT_BY_ID } from './constants.js';
import { periodLabel } from './format.js';

export const normalizeRecord = (r) => ({ p: r.p, s: r.s, m: r.m, t: r.t, kg: Number(r.kg) || 0, y: Number(r.p.slice(0, 4)), mo: Number(r.p.slice(5, 7)) });

export function filterRecords(records, f, { skipPeriod = false } = {}) {
  const Y = !skipPeriod && f.years.length ? new Set(f.years) : null;
  const M = !skipPeriod && f.months.length ? new Set(f.months) : null;
  const S = f.sites.length ? new Set(f.sites) : null;
  const MAT = f.materials.length ? new Set(f.materials) : null;
  const T = f.treatments.length ? new Set(f.treatments) : null;
  return records.filter((r) => (!Y || Y.has(r.y)) && (!M || M.has(r.mo)) && (!S || S.has(r.s)) && (!MAT || MAT.has(r.m)) && (!T || T.has(r.t)));
}

export function co2Of(r, factors) {
  if (r.t === 'reciclaje') return (r.kg / 1000) * (factors.reciclaje?.[r.m] ?? 0);
  if (r.t === 'compostaje') return (r.kg / 1000) * (factors.compostaje ?? 0);
  if (r.t === 'energetica') return (r.kg / 1000) * (factors.energetica ?? 0);
  return (r.kg / 1000) * (factors.disposicion ?? 0);
}

export function summarize(records, config) {
  const out = { total: 0, valorized: 0, recycled: 0, co2: 0, byTreatment: Object.fromEntries(TREATMENTS.map((t) => [t.id, 0])) };
  for (const r of records) {
    out.total += r.kg;
    out.byTreatment[r.t] = (out.byTreatment[r.t] || 0) + r.kg;
    if (TREATMENT_BY_ID[r.t]?.valorized) out.valorized += r.kg;
    if (TREATMENT_BY_ID[r.t]?.recycled) out.recycled += r.kg;
    out.co2 += co2Of(r, config.factors);
  }
  out.valRate = out.total ? (out.valorized / out.total) * 100 : 0;
  out.recRate = out.total ? (out.recycled / out.total) * 100 : 0;
  return out;
}

export const prevPeriod = (p) => {
  const y = Number(p.slice(0, 4)); const m = Number(p.slice(5, 7));
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
};

export function monthDelta(records, filters) {
  const periods = [...new Set(records.map((r) => r.p))].sort();
  if (!periods.length) return null;
  const last = filters.months.length === 1 && filters.years.length === 1 ? `${filters.years[0]}-${String(filters.months[0]).padStart(2, '0')}` : periods[periods.length - 1];
  if (!periods.includes(last)) return null;
  const prev = prevPeriod(last);
  const a = records.filter((r) => r.p === last).reduce((s, r) => s + r.kg, 0);
  const b = records.filter((r) => r.p === prev).reduce((s, r) => s + r.kg, 0);
  if (!periods.includes(prev) || b === 0) return null;
  return { last, prev, a, b, pct: ((a - b) / b) * 100 };
}

export function monthlySeries(records, dim = 'material') {
  const keys = dim === 'material' ? MATERIAL_BY_ID : null;
  const byP = new Map();
  for (const r of records) {
    const id = dim === 'material' ? r.m : MATERIAL_BY_ID[r.m]?.category;
    if (!id) continue;
    let row = byP.get(r.p);
    if (!row) { row = { p: r.p }; byP.set(r.p, row); }
    row[id] = (row[id] || 0) + r.kg;
  }
  return [...byP.values()].sort((a, b) => a.p.localeCompare(b.p));
}

export function monthlyKpis(records, config) {
  const byP = new Map();
  for (const r of records) {
    let row = byP.get(r.p);
    if (!row) { row = { p: r.p, label: periodLabel(r.p), total: 0, valorized: 0, recycled: 0, co2: 0 }; byP.set(r.p, row); }
    row.total += r.kg;
    if (TREATMENT_BY_ID[r.t]?.valorized) row.valorized += r.kg;
    if (TREATMENT_BY_ID[r.t]?.recycled) row.recycled += r.kg;
    row.co2 += co2Of(r, config.factors);
  }
  return [...byP.values()].sort((a, b) => a.p.localeCompare(b.p)).map((r) => ({ ...r, valRate: r.total ? (r.valorized / r.total) * 100 : 0, recRate: r.total ? (r.recycled / r.total) * 100 : 0 }));
}

export function byMaterial(records) {
  const acc = new Map();
  for (const r of records) acc.set(r.m, (acc.get(r.m) || 0) + r.kg);
  return [...acc.entries()].map(([id, kg]) => ({ id, label: MATERIAL_BY_ID[id]?.label || id, color: MATERIAL_BY_ID[id]?.color, kg }));
}

export function byCategory(records) {
  const acc = new Map();
  for (const r of records) { const c = MATERIAL_BY_ID[r.m]?.category; if (c) acc.set(c, (acc.get(c) || 0) + r.kg); }
  return [...acc.entries()].map(([id, kg]) => ({ id, label: CATEGORIES.find((c) => c.id === id)?.label || id, kg }));
}

export function bySite(records, sites) {
  const acc = new Map();
  for (const r of records) {
    const a = acc.get(r.s) || { total: 0, valorized: 0 };
    a.total += r.kg;
    if (TREATMENT_BY_ID[r.t]?.valorized) a.valorized += r.kg;
    acc.set(r.s, a);
  }
  const byId = Object.fromEntries(sites.map((s) => [s.id, s]));
  return [...acc.entries()].map(([id, a]) => ({
    id, name: byId[id]?.name || id, format: byId[id]?.format || '—',
    total: a.total, valorized: a.valorized, rest: a.total - a.valorized, rate: a.total ? (a.valorized / a.total) * 100 : 0,
  }));
}

export function byCompany(records, sites) {
  const companyOf = Object.fromEntries(sites.map((s) => [s.id, s.company]));
  const acc = new Map();
  for (const r of records) {
    const company = companyOf[r.s];
    if (!company) continue;
    const a = acc.get(company) || { total: 0, valorized: 0 };
    a.total += r.kg;
    if (TREATMENT_BY_ID[r.t]?.valorized) a.valorized += r.kg;
    acc.set(company, a);
  }
  return [...acc.entries()].map(([company, a]) => ({
    id: company, name: company,
    total: a.total, valorized: a.valorized, rest: a.total - a.valorized, rate: a.total ? (a.valorized / a.total) * 100 : 0,
  }));
}

/** Matriz categoría de residuo → tratamiento (kg). */
export function flowMatrix(records) {
  const m = Object.fromEntries(CATEGORIES.map((c) => [c.id, Object.fromEntries(TREATMENTS.map((t) => [t.id, 0]))]));
  for (const r of records) { const c = MATERIAL_BY_ID[r.m]?.category; if (c && m[c][r.t] !== undefined) m[c][r.t] += r.kg; }
  return m;
}

export const distinctYears = (records) => [...new Set(records.map((r) => r.y))].sort((a, b) => b - a);
export const distinctPeriods = (records) => [...new Set(records.map((r) => r.p))].sort();
