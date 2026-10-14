// Generación mensual total (barras: valorizado vs. resto) con marcadores de anomalía opcionales.
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell } from 'recharts';
import { AlertTriangle } from 'lucide-react';
import { ChartTooltip, axisTick, gridProps } from './common.jsx';
import { fmtMass, niceTicks } from '../../lib/format.js';

export default function TrendChart({ data, unit, anomalyCountByPeriod, height = 260 }) {
  if (!data?.length) return null;
  const rows = data.map((d) => ({ ...d, resto: d.total - d.valorized, anomalias: anomalyCountByPeriod?.get(d.p) || 0 }));
  const maxY = Math.max(1, ...rows.map((r) => r.total));
  const { max, ticks } = niceTicks(maxY, 5);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap={rows.length > 14 ? '15%' : '28%'}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: 'rgb(var(--line))' }} interval={rows.length > 12 ? 1 : 0} />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} ticks={ticks} domain={[0, max]} tickFormatter={(v) => fmtMass(v, unit, false)} width={48} />
        <Tooltip content={<ChartTooltip formatter={(v) => fmtMass(v, unit)} />} />
        <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => ({ valorized: 'Valorizado', resto: 'No valorizado' }[v] || v)} />
        <Bar dataKey="valorized" name="Valorizado" stackId="a" fill="rgb(var(--good))" radius={[0, 0, 0, 0]}>
          {rows.map((r, i) => <Cell key={i} fillOpacity={r.anomalias ? 1 : 0.9} />)}
        </Bar>
        <Bar dataKey="resto" name="No valorizado" stackId="a" fill="rgb(var(--line))" radius={[3, 3, 0, 0]} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Fila de íconos de alerta debajo del eje, alineada por mes, para señalar cuántas anomalías hubo. */
export function AnomalyStrip({ data, anomalyCountByPeriod }) {
  if (!data?.length || !anomalyCountByPeriod?.size) return null;
  const withAnomalies = data.filter((d) => anomalyCountByPeriod.get(d.p));
  if (!withAnomalies.length) return null;
  return (
    <div className="flex items-center gap-3 flex-wrap text-xs text-muted mt-1 px-1">
      <AlertTriangle size={12} className="text-warn" />
      {withAnomalies.map((d) => (
        <span key={d.p}>{d.label}: <b className="text-ink">{anomalyCountByPeriod.get(d.p)}</b></span>
      ))}
    </div>
  );
}
