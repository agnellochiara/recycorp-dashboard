import { MONTHS_SHORT } from './constants.js';

const nf = (min, max) => new Intl.NumberFormat('es-PE', { minimumFractionDigits: min, maximumFractionDigits: max });
const F0 = nf(0, 0);
const F1 = nf(1, 1);
const F2 = nf(2, 2);

export const unitScale = (unit) => (unit === 't' ? 1000 : 1);
export const unitLabel = (unit) => (unit === 't' ? 't' : 'kg');

/** Convierte kg a la unidad elegida (sin formatear). */
export const toUnit = (kg, unit) => kg / unitScale(unit);

/** Masa con unidad. Toneladas con 1-2 decimales según magnitud. */
export function fmtMass(kg, unit = 't', withUnit = true) {
  const v = toUnit(kg, unit);
  const s = unit === 't' ? (Math.abs(v) >= 100 ? F0.format(v) : Math.abs(v) >= 10 ? F1.format(v) : F2.format(v)) : F0.format(v);
  return withUnit ? `${s} ${unitLabel(unit)}` : s;
}
export const fmtNum = (v, d = 0) => (d === 0 ? F0 : d === 1 ? F1 : F2).format(v);
export const fmtPct = (v, d = 1) => `${(d === 0 ? F0 : F1).format(v)}%`;
export const fmtSigned = (v, d = 1) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${(d === 0 ? F0 : F1).format(Math.abs(v))}`;

export function periodLabel(p, long = false) {
  const [y, m] = p.split('-').map(Number);
  return long ? `${MONTHS_SHORT[m - 1]} ${y}` : `${MONTHS_SHORT[m - 1]} ${String(y).slice(2)}`;
}

/** Escala "bonita" para ejes: devuelve { max, ticks } con pasos 1/2/2.5/5 × 10^k. */
export function niceTicks(maxValue, target = 4) {
  if (!maxValue || maxValue <= 0) return { max: 1, ticks: [0, 1] };
  const raw = maxValue / target;
  const exp = 10 ** Math.floor(Math.log10(raw));
  const f = raw / exp;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * exp;
  const max = Math.ceil(maxValue / step - 1e-9) * step;
  const ticks = [];
  for (let v = 0; v <= max + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return { max, ticks };
}
