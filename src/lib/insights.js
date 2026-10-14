// Resumen en lenguaje natural de una selección (usado en la pestaña "Por empresa").
import { describeAnomaly } from './analytics.js';
import { fmtMass, fmtPct, fmtSigned, periodLabel } from './format.js';

/** @returns {{tone:'good'|'bad'|'warn'|'neutral', text:string}[]} */
export function buildInsights({ label, unit, summary, goal, fluct, anomalies, memo, range, siteCount }) {
  const out = [];
  if (summary.total > 0) {
    const gap = summary.valRate - goal.value;
    out.push({
      tone: gap >= 0 ? 'good' : 'bad',
      text: `${label} generó ${fmtMass(summary.total, unit)} durante ${range} en ${siteCount} ${siteCount === 1 ? 'sede' : 'sedes'}. Valorizó el ${fmtPct(summary.valRate)} frente a una meta ${goal.mixed ? 'ponderada ' : ''}de ${fmtPct(goal.value, goal.mixed ? 1 : 0)}: ${gap >= 0 ? 'la cumple' : 'está por debajo'} (${fmtSigned(gap)} pp).`,
    });
  }
  const st = fluct.stats;
  if (st.latest) {
    const bits = [];
    if (st.mom != null) bits.push(`${fmtSigned(st.mom)} % vs el mes anterior`);
    if (st.vsPrev3 != null) bits.push(`${fmtSigned(st.vsPrev3)} % vs el promedio de los 3 meses previos`);
    if (st.yoy != null) bits.push(`${fmtSigned(st.yoy)} % vs el mismo mes del año anterior`);
    out.push({ tone: 'neutral', text: `En ${periodLabel(st.latest.p, true)} se generaron ${fmtMass(st.latest.total, unit)}${bits.length ? `: ${bits.join('; ')}` : ''}.` });
  }
  if (st.cv != null) {
    out.push({
      tone: st.cvLabel === 'Alta' ? 'bad' : st.cvLabel === 'Moderada' ? 'warn' : 'good',
      text: `La generación mensual es ${st.cvLabel.toLowerCase() === 'alta' ? 'muy variable' : st.cvLabel.toLowerCase()} (coeficiente de variación ${fmtPct(st.cv)}) y su tendencia reciente es ${st.trendLabel.toLowerCase()} (${fmtSigned(st.trendPct)} % por mes).`,
    });
  }
  if (anomalies.length) {
    const altas = anomalies.filter((a) => a.severity === 'alta').length;
    const a = anomalies[0];
    out.push({ tone: altas ? 'bad' : 'warn', text: `Hay ${anomalies.length} ${anomalies.length === 1 ? 'anomalía' : 'anomalías'} en el período (${altas} de nivel alto). La más reciente: ${a.siteName}, ${a.label}, ${a.streamLabel.toLowerCase()}. ${describeAnomaly(a, (kg) => fmtMass(kg, unit))}` });
  } else out.push({ tone: 'good', text: 'No se detectaron anomalías en el período seleccionado.' });
  if (memo) out.push({ tone: 'neutral', text: `La madera no valorizable (${fmtMass(memo.wood, unit)}) equivale al ${fmtPct((memo.wood / memo.gen) * 100)} de los residuos generales; ya está incluida en ellos.` });
  return out;
}
