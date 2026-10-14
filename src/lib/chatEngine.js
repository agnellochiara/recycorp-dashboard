// Motor de preguntas y respuestas sobre los datos cargados.
//
// No usa IA generativa: interpreta la pregunta (intención + empresa/sede + período + tipo de residuo) y calcula la
// respuesta directamente con las mismas funciones que alimentan el panel. Por eso las cifras siempre coinciden con
// los gráficos, no se inventa nada y funciona sin conexión ni claves. Lo que no entiende, lo dice.
import { MATERIALS, MATERIAL_BY_ID, MONTHS_LONG } from './constants.js';
import { byMaterial, summarize } from './calc.js';
import { fluctuation, detectAnomalies, describeAnomaly, comparablePeriods, listPeriods } from './analytics.js';
import { goalForRecords, goalForSite } from './goals.js';
import { fmtMass, fmtNum, fmtPct, fmtSigned, periodLabel } from './format.js';

export const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s%]/g, ' ').replace(/\s+/g, ' ').trim();
const has = (t, re) => re.test(t);
const kgTxt = (kg) => fmtMass(kg, 't');
const MONTH_KEYS = MONTHS_LONG.map((m) => norm(m));
const MONTH_ABBR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const NUM_WORDS = { un: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, doce: 12 };

/* ------------------------------------------------------------------ Entidades (empresa / marca / sede) */

function buildEntities(sites) {
  const E = [];
  const companies = [...new Set(sites.map((s) => s.company).filter(Boolean))];
  const idsOf = (fn) => sites.filter(fn).map((s) => s.id);
  for (const c of companies) {
    const keys = [norm(c)];
    if (norm(c) === 'innova schools') keys.push('innova');
    if (norm(c) === 'supermercados peruanos') keys.push('supermercados');
    E.push({ kind: 'company', label: c, keys, ids: idsOf((s) => s.company === c) });
  }
  const brandOf = (s) => s.name.split(' · ')[0].replace(/\s+AQP$/i, '');
  const brands = [...new Set(sites.map(brandOf))];
  for (const b of brands) {
    const ids = idsOf((s) => brandOf(s) === b);
    const companyIds = E.find((e) => e.kind === 'company' && norm(e.label) === norm(b))?.ids;
    if (companyIds && companyIds.length === ids.length) continue; // marca = empresa: ya está
    E.push({ kind: 'brand', label: b, keys: [norm(b), norm(b.replace(/\s+CD$/i, ''))], ids });
  }
  for (const s of sites) {
    const noAqp = s.name.replace(/\sAQP\b/i, '');
    E.push({ kind: 'site', label: s.name, keys: [norm(s.name), norm(noAqp)], ids: [s.id] });
    const sede = s.name.split(' · ')[1];
    if (sede && norm(sede) !== 'principal') E.push({ kind: 'sede', label: s.name, keys: [norm(sede)], ids: [s.id], sedeOnly: true });
  }
  return E;
}

function matchEntities(t, E) {
  const pairs = E.flatMap((e) => e.keys.map((k) => ({ e, k }))).filter((x) => x.k).sort((a, b) => b.k.length - a.k.length);
  let work = ` ${t} `; const found = [];
  for (const { e, k } of pairs) {
    if (work.includes(` ${k} `)) {
      work = work.split(` ${k} `).join('  ');
      const prev = found.find((f) => f.kind === e.kind && f.label === e.label);
      if (!prev) found.push(e);
    }
  }
  // Las sedes por nombre corto solo cuentan si no se nombró nada más específico (evita "premium" suelto vs. empresa).
  const strong = found.filter((f) => !f.sedeOnly);
  return strong.length ? strong : found;
}

/* ------------------------------------------------------------------ Período */

function parsePeriod(t, periods, intent) {
  if (!periods.length) return { kind: 'all', set: new Set(), label: 'todo el período' };
  const latest = periods[periods.length - 1];
  const years = [...t.matchAll(/\b(20\d\d)\b/g)].map((m) => Number(m[1]));
  const months = [];
  MONTH_KEYS.forEach((k, i) => { if (new RegExp(`\\b${k}\\b`).test(t)) months.push(i + 1); });
  MONTH_ABBR.forEach((k, i) => { if (new RegExp(`\\b${k}\\.?\\s*(de\\s*)?20\\d\\d\\b`).test(t) && !months.includes(i + 1)) months.push(i + 1); });
  const latestYear = Number(latest.slice(0, 4));

  const lastN = t.match(/ultim[oa]s?\s+(\d+|un|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|doce)\s+mes/);
  if (lastN) {
    const n = Number(lastN[1]) || NUM_WORDS[lastN[1]] || 3;
    const set = new Set(periods.slice(-n)); const arr = periods.slice(-n);
    return { kind: 'last', set, label: `los últimos ${arr.length} meses (${periodLabel(arr[0], true)} – ${periodLabel(arr[arr.length - 1], true)})` };
  }
  if (months.length) {
    const y = years[0] ?? (() => { const cand = periods.filter((p) => Number(p.slice(5, 7)) === months[0]).map((p) => Number(p.slice(0, 4))); return cand.length ? Math.max(...cand) : latestYear; })();
    const set = new Set(months.map((m) => `${y}-${String(m).padStart(2, '0')}`));
    return { kind: 'month', set, label: [...set].map((p) => periodLabel(p, true)).join(' y ') };
  }
  if (years.length) return { kind: 'year', set: new Set(periods.filter((p) => years.includes(Number(p.slice(0, 4))))), label: years.join(' y '), year: years[0] };
  if (has(t, /\b(ano pasado|ano anterior)\b/)) { const y = latestYear - 1; return { kind: 'year', set: new Set(periods.filter((p) => Number(p.slice(0, 4)) === y)), label: String(y), year: y }; }
  if (has(t, /\b(este ano|ano actual|en lo que va del ano|lo que va del ano)\b/)) return { kind: 'year', set: new Set(periods.filter((p) => Number(p.slice(0, 4)) === latestYear)), label: String(latestYear), year: latestYear };
  if (has(t, /\b(ultimo mes|mes pasado|este mes|mes actual|mes reciente|ultimo periodo)\b/)) return { kind: 'month', set: new Set([latest]), label: periodLabel(latest, true), latest: true };
  if (intent === 'total' && has(t, /\bmes anterior\b/) && periods.length > 1) { const p = periods[periods.length - 2]; return { kind: 'month', set: new Set([p]), label: periodLabel(p, true) }; }
  return { kind: 'all', set: new Set(periods), label: `todo el período (${periodLabel(periods[0], true)} – ${periodLabel(latest, true)})` };
}

/* ------------------------------------------------------------------ Tipo de residuo / tratamiento */

const MATERIAL_TERMS = [
  [/\bplastico duro\b/, { m: ['plastico_duro'], label: 'plástico duro' }],
  [/\bcarton\b/, { m: ['carton'], label: 'cartón' }],
  [/\bpapel\b/, { m: ['papel'], label: 'papel' }],
  [/\bfilm\b/, { m: ['film'], label: 'film' }],
  [/\bpet\b/, { m: ['pet'], label: 'plástico PET' }],
  [/\bvidrio\b/, { m: ['vidrio'], label: 'vidrio' }],
  [/\bmetal(es)?\b/, { m: ['metales'], label: 'metales' }],
  [/\bmixto\b/, { m: ['mixto'], label: 'reciclaje mixto' }],
  [/\borganic\w*\b/, { m: ['organicos'], label: 'orgánicos' }],
  [/\b(generales|no aprovechables?|residuos comunes|basura comun)\b/, { m: ['no_aprovechables'], label: 'residuos generales' }],
  [/\b(reciclables|aprovechables)\b/, { cat: 'aprovechables', label: 'reciclables' }],
  [/\b(peligrosos|raee)\b/, { cat: 'peligrosos', label: 'peligrosos / RAEE' }],
];

function parseWaste(t) {
  for (const [re, v] of MATERIAL_TERMS) {
    if (re.test(t)) {
      const ids = v.m || MATERIALS.filter((m) => m.category === v.cat).map((m) => m.id);
      return { ids, label: v.label, cat: v.cat || MATERIAL_BY_ID[v.m[0]]?.category, single: v.m ? v.m[0] : null };
    }
  }
  return null;
}
function parseTreatment(t) {
  if (has(t, /\b(relleno|disposicion|rellenos)\b/)) return { id: 'disposicion', label: 'relleno sanitario / seguridad' };
  if (has(t, /\bcompost\w*\b/)) return { id: 'compostaje', label: 'compostaje' };
  if (has(t, /\b(reciclaje|reciclado|reciclamos|reciclaron|reciclo)\b/) && !has(t, /\b(tasa|porcentaje|%)\b/)) return { id: 'reciclaje', label: 'reciclaje' };
  return null;
}

/* ------------------------------------------------------------------ Intención */

function detectIntent(t, entityCount) {
  if (has(t, /\b(ayuda|que puedes|que sabes|como funcionas|que puedo preguntar|ejemplos?)\b/)) return 'help';
  if (has(t, /\b(que datos|cuantas sedes|cuantos meses|cobertura|hasta cuando|desde cuando|cuantas empresas|que periodo)\b/)) return 'coverage';
  if (has(t, /\b(anomali\w*|atipic\w*|inusual\w*|raro\w*|picos?|alertas?|sospechos\w*|desvio\w*|fuera de lo normal)\b/)) return 'anomalies';
  if (has(t, /\bmadera\b/)) return 'wood';
  if (has(t, /\b(huella|carbono|co2|emision\w*)\b/)) return 'carbon';
  if (has(t, /\b(meta|metas|cumpl\w*|objetivo\w*)\b/)) return 'goal';
  if ((has(t, /\b(compar\w*|versus|vs|contra|diferencia entre)\b/) && entityCount >= 2) || has(t, /\bcompar\w*\b/)) return 'compare';
  if (has(t, /\b(top \d+|ranking|(que|cual|cuales|cuantas?)\s+(sedes?|empresas?|locales?|clientes?)|(sedes?|empresas?)\s+(genera|generan|recicla|reciclan|valoriza|valorizan|tiene|tienen))\b/)
      || (has(t, /\b(mas|menos|mayor|menor|peor|mejor|maxim\w*|minim\w*)\b/) && has(t, /\b(sedes?|empresas?|locales?|clientes?)\b/))) return 'ranking';
  if (has(t, /\b(que mes|en que mes|cual mes|mes con mas|mes con menos)\b/)) return 'peak';
  if (has(t, /\b(valoriz\w*|tasa|reciclaje|reciclamos|reciclan|porcentaje de reciclaje)\b/) && !has(t, /\b(cuanto|cuantos|cuantas|toneladas|kilos|kg)\b/)) return 'rate';
  if (has(t, /\b(vari\w*|fluctu\w*|aument\w*|crecio|crece|cayo|bajo|baja|disminu\w*|cambio|tendencia|volatil\w*|estabil\w*|subio|sube|interanual|mes anterior|vs mes|respecto)\b/)) return 'fluctuation';
  if (has(t, /\b(composicion|compon\w*|distribucion|desglose|proporcion|por material|por tipo|que tipo de residuos|de que esta compuest\w*|que porcentaje)\b/)) return 'composition';
  if (has(t, /\b(cuanto|cuantos|cuantas|total|genero|generamos|generaron|generan|toneladas|kilos|kg|volumen|residuos|basura|reciclamos|valorizamos)\b/)) return 'total';
  return 'unknown';
}

/* ------------------------------------------------------------------ Motor */

export function createEngine({ records, memoRecords = [], sites, config, scopeCompany = null }) {
  const scopeSites = scopeCompany ? sites.filter((s) => s.company === scopeCompany) : sites;
  const scopeIds = new Set(scopeSites.map((s) => s.id));
  const scopeRecords = records.filter((r) => scopeIds.has(r.s));
  const scopeMemo = memoRecords.filter((r) => scopeIds.has(r.s));
  const siteById = Object.fromEntries(sites.map((s) => [s.id, s]));
  const entities = buildEntities(sites);
  const scopeLabel = scopeCompany || 'todas las empresas';
  const allPeriods = [...new Set(scopeRecords.map((r) => r.p))].sort();
  const anomalyCache = new Map();
  const anomaliesFor = (ids) => {
    const key = [...ids].sort().join(',');
    if (!anomalyCache.has(key)) anomalyCache.set(key, detectAnomalies(scopeRecords.filter((r) => ids.has(r.s)), siteById));
    return anomalyCache.get(key);
  };

  const examples = scopeCompany
    ? ['¿Cuánto generamos el último mes?', '¿Cumplimos la meta de valorización?', '¿Cómo varió la generación vs el mes anterior?', '¿Qué anomalías hubo recientemente?', '¿Qué sede recicla menos?']
    : ['¿Cuánto generamos el último mes?', '¿Qué sedes tienen la menor tasa de valorización?', '¿Hay anomalías en los últimos meses?', 'Compara Real Plaza con Oechsle', '¿Cuánto cartón se recicló en 2026?'];

  function answer(question) {
    const rawQ = String(question || '').trim();
    if (!rawQ) return { text: 'Escribe una pregunta sobre la generación de residuos, la valorización, las metas, las variaciones o las anomalías.', chips: examples.slice(0, 3) };
    const t = norm(rawQ);

    // 1) ¿de qué empresa / sede habla?
    const matched = matchEntities(t, entities);
    const outside = matched.filter((e) => e.ids.some((id) => !scopeIds.has(id)));
    if (scopeCompany && outside.length) {
      return { text: `Esta vista solo muestra los resultados de **${scopeCompany}**, así que no puedo responder sobre ${outside.map((e) => e.label).join(', ')}. Pregúntame por tus sedes o por tu empresa en general.`, chips: examples.slice(0, 3) };
    }
    const ids = new Set(matched.length ? matched.flatMap((e) => e.ids) : scopeIds);
    const focusLabel = matched.length ? matched.map((e) => e.label).join(' + ') : scopeLabel;
    let intent = detectIntent(t, matched.length);
    const recs0 = scopeRecords.filter((r) => ids.has(r.s));
    const periods = [...new Set(recs0.map((r) => r.p))].sort();
    const period = parsePeriod(t, periods, intent);
    // Solo se nombró una empresa/sede o un período: se responde con el resumen de generación y valorización.
    if (intent === 'unknown' && (matched.length || period.kind !== 'all')) intent = 'total';
    const waste = parseWaste(t);
    const treatment = parseTreatment(t);
    const inPeriod = recs0.filter((r) => period.set.has(r.p));
    const ctx = { t, ids, matched, focusLabel, intent, period, waste, treatment, recs0, inPeriod, periods };

    if (intent === 'help') return help();
    if (intent === 'coverage') return coverage();
    if (!recs0.length) return { text: 'No encontré datos para esa selección.', chips: examples.slice(0, 3) };
    if (intent !== 'fluctuation' && intent !== 'anomalies' && intent !== 'coverage' && intent !== 'peak' && period.kind !== 'all' && !inPeriod.length) {
      return { text: `No tengo datos de **${focusLabel}** para ${period.label}. Los datos disponibles van de ${periodLabel(periods[0], true)} a ${periodLabel(periods[periods.length - 1], true)}.`, chips: examples.slice(0, 3) };
    }
    const fn = { anomalies, wood, carbon, goal, compare, ranking, rate, fluctuation: fluct, peak, composition, total }[intent];
    if (!fn) return unknown();
    return fn(ctx);
  }

  /* ---------- respuestas ---------- */

  function help() {
    return {
      text: `Puedo responder con los datos cargados${scopeCompany ? ` de **${scopeCompany}**` : ''} sobre: **cuánto se generó** (por mes, año, sede o tipo de residuo), **tasa de valorización y metas**, **comparaciones** y **rankings** de sedes, **variaciones** (vs mes anterior, promedio de 3 meses, año anterior), **tendencia y volatilidad**, **anomalías**, **composición**, **huella de carbono** y **madera no valorizable**. Prueba con estas preguntas:`,
      chips: examples,
    };
  }

  function unknown() {
    return { text: 'No estoy seguro de haber entendido. Puedo responder sobre cuánto se generó, valorización y metas, comparaciones, rankings de sedes, variaciones, anomalías, composición y huella de carbono. Intenta con alguno de estos ejemplos:', chips: examples };
  }

  function coverage() {
    const sm = summarize(scopeRecords, config);
    const companies = new Set(scopeSites.map((s) => s.company)).size;
    return {
      text: `Hay datos de **${new Set(scopeRecords.map((r) => r.s)).size} sedes**${scopeCompany ? '' : ` de ${companies} empresas`} entre **${periodLabel(allPeriods[0], true)}** y **${periodLabel(allPeriods[allPeriods.length - 1], true)}** (${allPeriods.length} meses), con un total de **${kgTxt(sm.total)}**. Las cifras se calculan al momento con los mismos datos del panel.`,
      chips: examples.slice(0, 3),
    };
  }

  function scoped(c) {
    let r = c.inPeriod;
    if (c.waste) { const set = new Set(c.waste.ids); r = r.filter((x) => set.has(x.m)); }
    if (c.treatment) r = r.filter((x) => x.t === c.treatment.id);
    return r;
  }
  const filterTag = (c) => [c.waste?.label, c.treatment ? `con destino ${c.treatment.label}` : null].filter(Boolean).join(' ');

  function total(c) {
    const r = scoped(c); const sm = summarize(r, config);
    if (!r.length) return { text: `No hay registros de ${filterTag(c) || 'residuos'} para **${c.focusLabel}** en ${c.period.label}.`, chips: examples.slice(0, 3) };
    const all = !c.matched.length && !scopeCompany;
    const subject = all ? `Entre todas las empresas se ${c.waste || c.treatment ? 'registraron' : 'generaron'}` : `**${c.focusLabel}** ${c.waste || c.treatment ? 'registró' : 'generó'}`;
    let text = `${subject} **${kgTxt(sm.total)}**${filterTag(c) ? ` de ${filterTag(c)}` : ''} en ${c.period.label}.`;
    if (!c.waste && !c.treatment) text += ` Se valorizó el **${fmtPct(sm.valRate)}**.`;
    if (c.period.kind === 'month') {
      const idx = c.periods.indexOf([...c.period.set][0]);
      if (idx > 0) {
        const prevP = c.periods[idx - 1];
        let pr = c.recs0.filter((x) => x.p === prevP);
        if (c.waste) { const set = new Set(c.waste.ids); pr = pr.filter((x) => set.has(x.m)); }
        if (c.treatment) pr = pr.filter((x) => x.t === c.treatment.id);
        const pk = pr.reduce((s, x) => s + x.kg, 0);
        if (pk > 0) text += ` Frente a ${periodLabel(prevP, true)} (${kgTxt(pk)}) es ${fmtSigned(((sm.total - pk) / pk) * 100)} %.`;
      }
    }
    return { text, chips: ['¿Cómo se compone?', '¿Cuál es la tasa de valorización?', '¿Hay anomalías recientes?'] };
  }

  function rate(c) {
    const r = scoped(c); if (!r.length) return total(c);
    const sm = summarize(r, config); const g = goalForRecords(r, siteById, config);
    const gap = sm.valRate - g.value;
    const goalTxt = g.mixed ? `meta ponderada de ${fmtPct(g.value)}` : `meta de ${fmtPct(g.value, 0)}`;
    return {
      text: `La tasa de valorización de **${c.focusLabel}** en ${c.period.label} es **${fmtPct(sm.valRate)}** (${kgTxt(sm.valorized)} de ${kgTxt(sm.total)}). Frente a su ${goalTxt}: **${fmtSigned(gap)} pp** (${gap >= 0 ? 'cumple' : 'por debajo'}).`,
      chips: ['¿Qué sede recicla menos?', '¿Cómo varió vs el mes anterior?', '¿Cumplimos la meta?'],
    };
  }

  function fluct(c) {
    const base = c.waste ? scopeRecords.filter((r) => c.ids.has(r.s) && c.waste.ids.includes(r.m)) : scopeRecords.filter((r) => c.ids.has(r.s));
    const coverage = scopeRecords.filter((r) => c.ids.has(r.s));
    const { stats, excluded } = fluctuation(base, coverage);
    if (!stats.latest) {
      return { text: `Todavía no hay suficientes meses comparables para medir la variación de **${c.focusLabel}**${c.waste ? ` en ${c.waste.label}` : ''} (se necesitan al menos 4 meses con cobertura completa de sedes).`, chips: examples.slice(0, 3) };
    }
    const bits = [];
    if (stats.mom != null) bits.push(`${fmtSigned(stats.mom)} % vs el mes anterior`);
    if (stats.vsPrev3 != null) bits.push(`${fmtSigned(stats.vsPrev3)} % vs el promedio de los 3 meses previos`);
    if (stats.yoy != null) bits.push(`${fmtSigned(stats.yoy)} % vs el mismo mes del año anterior`);
    let text = `En ${stats.latest.label} **${c.focusLabel}** generó ${kgTxt(stats.latest.total)}${c.waste ? ` de ${c.waste.label}` : ''}${bits.length ? `: ${bits.join('; ')}` : ' (sin un mes previo comparable para calcular la variación)'}.`;
    if (stats.cv != null) text += ` La generación mensual es de volatilidad **${stats.cvLabel.toLowerCase()}** (CV ${fmtPct(stats.cv, 0)}) con una tendencia **${stats.trendLabel.toLowerCase()}** (${fmtSigned(stats.trendPct)} %/mes).`;
    if (excluded.length) text += ` Se excluyeron de la comparación ${excluded.length === 1 ? 'el mes' : `los ${excluded.length} meses`} con cobertura de sedes incompleta.`;
    return { text, chips: ['¿Hay anomalías recientes?', '¿Cumplimos la meta?', '¿Qué mes generó más?'] };
  }

  function goal(c) {
    const r = c.inPeriod; const groups = new Map();
    for (const x of r) { if (!groups.has(x.s)) groups.set(x.s, []); groups.get(x.s).push(x); }
    const rows = [...groups.entries()].map(([id, list]) => {
      const sm = summarize(list, config); const g = goalForSite(siteById[id], config);
      return { name: siteById[id]?.name || id, rate: sm.valRate, goal: g, gap: sm.valRate - g, kg: sm.total };
    }).sort((a, b) => a.gap - b.gap);
    const ok = rows.filter((x) => x.gap >= 0).length;
    const all = summarize(r, config); const g = goalForRecords(r, siteById, config);
    return {
      text: `En ${c.period.label}, la valorización de **${c.focusLabel}** fue **${fmtPct(all.valRate)}** frente a una meta ${g.mixed ? 'ponderada ' : ''}de **${fmtPct(g.value, g.mixed ? 1 : 0)}** (${fmtSigned(all.valRate - g.value)} pp). **${ok} de ${rows.length} ${rows.length === 1 ? 'sede cumple' : 'sedes cumplen'}** la meta de su segmento.`,
      table: { headers: ['Sede', 'Valorización', 'Meta', 'Diferencia'], rows: rows.map((x) => [x.name, fmtPct(x.rate), fmtPct(x.goal, 0), `${fmtSigned(x.gap)} pp ${x.gap >= 0 ? '✓' : ''}`]) },
      chips: ['¿Qué sede recicla menos?', '¿Hay anomalías recientes?'],
    };
  }

  function compare(c) {
    let groups = c.matched.length >= 2 ? c.matched : null;
    if (!groups) {
      if (c.matched.length === 1 || scopeCompany) groups = scopeSites.filter((s) => c.ids.has(s.id)).map((s) => ({ label: s.name, ids: [s.id] }));
      else return { text: 'Indícame al menos dos empresas o sedes para comparar, por ejemplo: «Compara Real Plaza con Oechsle en 2026».', chips: examples.slice(0, 3) };
    }
    const rows = groups.map((e) => {
      const list = c.inPeriod.filter((r) => e.ids.includes(r.s));
      const sm = summarize(list, config); const g = goalForRecords(list, siteById, config);
      return { label: e.label, total: sm.total, rate: sm.valRate, goal: g.value, co2: sm.co2, ok: list.length > 0 };
    }).filter((x) => x.ok);
    if (rows.length < 2) return { text: `No hay datos suficientes para comparar en ${c.period.label}.`, chips: examples.slice(0, 3) };
    const top = [...rows].sort((a, b) => b.total - a.total)[0]; const best = [...rows].sort((a, b) => b.rate - a.rate)[0];
    return {
      text: `Comparación en ${c.period.label}: **${top.label}** genera más residuos (${kgTxt(top.total)}) y **${best.label}** tiene la mejor tasa de valorización (${fmtPct(best.rate)}).`,
      table: { headers: ['', 'Generación', 'Valorización', 'Meta', 'Huella evitada'], rows: rows.map((x) => [x.label, kgTxt(x.total), fmtPct(x.rate), fmtPct(x.goal, 0), `${fmtNum(x.co2, x.co2 < 100 ? 1 : 0)} tCO₂e`]) },
      chips: ['¿Cuál varió más vs el mes anterior?', '¿Hay anomalías recientes?'],
    };
  }

  function ranking(c) {
    const { t } = c;
    const byCompany = has(t, /\b(empresas?|clientes?)\b/) && !scopeCompany;
    const byRate = has(t, /\b(valoriz\w*|tasa|recicl\w*|porcentaje)\b/);
    const asc = byRate ? has(t, /\b(menos|menor|peor|minim\w*|bajo|baja|mas bajo)\b/) : has(t, /\b(menos|menor|minim\w*|mas bajo|baja)\b/);
    const nMatch = t.match(/\b(?:top|los|las)\s+(\d+)\b/); const n = Math.min(10, nMatch ? Number(nMatch[1]) : 5);
    const r = scoped(c); const groups = new Map();
    for (const x of r) {
      const key = byCompany ? siteById[x.s]?.company : x.s;
      if (!groups.has(key)) groups.set(key, []); groups.get(key).push(x);
    }
    let rows = [...groups.entries()].map(([key, list]) => {
      const sm = summarize(list, config);
      return { name: byCompany ? key : (siteById[key]?.name || key), total: sm.total, rate: sm.valRate };
    });
    rows.sort((a, b) => (byRate ? a.rate - b.rate : a.total - b.total) * (asc ? 1 : -1));
    rows = rows.slice(0, n);
    const what = byRate ? 'tasa de valorización' : 'generación de residuos';
    const dim = byCompany ? 'empresas' : 'sedes';
    return {
      text: `${asc ? 'Menor' : 'Mayor'} ${what} por ${byCompany ? 'empresa' : 'sede'} en ${c.period.label}${filterTag(c) ? ` (${filterTag(c)})` : ''}: **${rows[0]?.name}** con ${byRate ? fmtPct(rows[0].rate) : kgTxt(rows[0].total)}. ${rows.length > 1 ? `Las ${rows.length} ${dim} ${asc ? 'más bajas' : 'más altas'}:` : ''}`,
      table: (c.waste || c.treatment)
        ? { headers: ['#', byCompany ? 'Empresa' : 'Sede', 'Cantidad'], rows: rows.map((x, i) => [String(i + 1), x.name, kgTxt(x.total)]) }
        : { headers: ['#', byCompany ? 'Empresa' : 'Sede', 'Generación', 'Valorización'], rows: rows.map((x, i) => [String(i + 1), x.name, kgTxt(x.total), fmtPct(x.rate)]) },
      chips: ['¿Hay anomalías recientes?', '¿Cumplimos la meta?'],
    };
  }

  function peak(c) {
    const recs = c.recs0.filter((r) => (c.waste ? c.waste.ids.includes(r.m) : true));
    const { comparable } = comparablePeriods(c.recs0);
    const byP = new Map(); for (const r of recs) if (comparable.has(r.p)) byP.set(r.p, (byP.get(r.p) || 0) + r.kg);
    const rows = [...byP.entries()].sort((a, b) => a[1] - b[1]);
    if (rows.length < 2) return { text: 'Aún no hay suficientes meses comparables para responder.', chips: examples.slice(0, 3) };
    const low = has(c.t, /\b(menos|menor|minim\w*|valle|bajo)\b/);
    const list = (low ? rows : [...rows].reverse()).slice(0, 3);
    return {
      text: `${low ? 'El mes con menor' : 'El mes con mayor'} generación${c.waste ? ` de ${c.waste.label}` : ''} de **${c.focusLabel}** fue **${periodLabel(list[0][0], true)}** con ${kgTxt(list[0][1])}. Solo se consideran los meses con cobertura completa de sedes.`,
      table: { headers: ['Mes', 'Generación'], rows: list.map(([p, kg]) => [periodLabel(p, true), kgTxt(kg)]) },
      chips: ['¿Cómo varió vs el mes anterior?', '¿Hay anomalías recientes?'],
    };
  }

  function anomalies(c) {
    let list = anomaliesFor(c.ids);
    if (c.waste?.cat) list = list.filter((a) => a.stream === c.waste.cat || a.stream === 'total');
    const totalN = list.length; const altasTotal = list.filter((a) => a.severity === 'alta').length;
    let shown = list; let scopeTxt;
    if (c.period.kind !== 'all') { shown = list.filter((a) => c.period.set.has(a.p)); scopeTxt = c.period.label; }
    else {
      const recent = new Set(c.periods.slice(-3)); shown = list.filter((a) => recent.has(a.p));
      scopeTxt = `los últimos 3 meses (${periodLabel(c.periods[Math.max(0, c.periods.length - 3)], true)} – ${periodLabel(c.periods[c.periods.length - 1], true)})`;
    }
    if (!shown.length) {
      return { text: `No detecté anomalías en **${c.focusLabel}** en ${scopeTxt}. En todo el historial hay ${totalN} (${altasTotal} de nivel alto).`, chips: ['¿Cómo varió vs el mes anterior?', '¿Cumplimos la meta?'] };
    }
    const top = shown.slice(0, 6);
    return {
      text: `Detecté **${shown.length} ${shown.length === 1 ? 'anomalía' : 'anomalías'}** en **${c.focusLabel}** en ${scopeTxt} (${shown.filter((a) => a.severity === 'alta').length} de nivel alto). En todo el historial hay ${totalN}. Son meses que se apartan de forma marcada del comportamiento habitual de esa sede; pueden deberse a estacionalidad, eventos, cambios operativos o datos incompletos. ${shown.length > top.length ? `Muestro las ${top.length} más recientes:` : ''}`,
      table: { headers: ['Mes', 'Sede', 'Flujo', 'Real', 'Esperado', 'Desvío'], rows: top.map((a) => [a.label, a.siteName, a.streamLabel, kgTxt(a.actual), kgTxt(a.expected), a.type === 'faltante' ? 'sin datos' : `${fmtSigned(a.devPct * 100, 0)} %`]) },
      detail: top.slice(0, 3).map((a) => `${a.siteName} · ${a.label}: ${describeAnomaly(a, kgTxt)}`),
      chips: ['¿Cómo varió vs el mes anterior?', '¿Cuál es la tasa de valorización?'],
    };
  }

  function composition(c) {
    const r = c.inPeriod; const mat = byMaterial(r); const tot = mat.reduce((s, m) => s + m.kg, 0);
    if (!tot) return { text: 'No hay datos para esa selección.', chips: examples.slice(0, 3) };
    const rows = mat.sort((a, b) => b.kg - a.kg).slice(0, 7);
    return {
      text: `Composición de los residuos de **${c.focusLabel}** en ${c.period.label} (${kgTxt(tot)} en total): el principal componente es **${rows[0].label}** con el ${fmtPct((rows[0].kg / tot) * 100)}.`,
      table: { headers: ['Tipo de residuo', 'Cantidad', '% del total'], rows: rows.map((m) => [m.label, kgTxt(m.kg), fmtPct((m.kg / tot) * 100)]) },
      chips: ['¿Cuál es la tasa de valorización?', '¿Cómo varió vs el mes anterior?'],
    };
  }

  function carbon(c) {
    const r = scoped(c); const sm = summarize(r, config);
    if (!r.length) return total(c);
    return {
      text: `La huella de carbono evitada por **${c.focusLabel}** en ${c.period.label} es de **${fmtNum(sm.co2, sm.co2 < 100 ? 1 : 0)} tCO₂e** (${fmtNum(sm.total ? sm.co2 / (sm.total / 1000) : 0, 2)} tCO₂e por tonelada gestionada). Ojo: usa factores de emisión de ejemplo; reemplázalos por los de tu inventario en «Metas y parámetros».`,
      chips: ['¿Cuál es la tasa de valorización?', '¿Cuánto generamos el último mes?'],
    };
  }

  function wood(c) {
    const ids = c.ids; const mem = scopeMemo.filter((r) => ids.has(r.s) && c.period.set.has(r.p));
    const kg = mem.reduce((s, r) => s + r.kg, 0);
    const gen = c.inPeriod.filter((r) => r.m === 'no_aprovechables').reduce((s, r) => s + r.kg, 0);
    if (!kg) return { text: `No hay madera no valorizable registrada para **${c.focusLabel}** en ${c.period.label}.`, chips: examples.slice(0, 3) };
    const sitesTxt = [...new Set(mem.map((r) => siteById[r.s]?.name))].join(', ');
    return {
      text: `La madera no valorizable de **${c.focusLabel}** en ${c.period.label} es **${kgTxt(kg)}**, el **${fmtPct((kg / gen) * 100)}** de sus residuos generales (${kgTxt(gen)}). Se registra en: ${sitesTxt}. Ya está incluida en los generales, por eso no se suma al total.`,
      chips: ['¿Cuánto generamos el último mes?'],
    };
  }

  return { answer, examples, scopeLabel };
}
