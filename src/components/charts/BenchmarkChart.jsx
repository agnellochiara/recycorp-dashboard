// Ranking de sedes por generación o tasa de valorización (barras horizontales).
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, LabelList } from 'recharts';
import { ChartTooltip, axisTick, gridProps } from './common.jsx';
import { fmtMass, fmtPct } from '../../lib/format.js';
import { Empty } from '../ui.jsx';

// "AQP" es redundante en todos los nombres (todas las sedes están en Arequipa): se quita para dejar más
// espacio al nombre real de la sede y que no se corte ni se apriete contra el borde del gráfico.
const shortName = (name) => name.replace(/\s*AQP\b/i, '');

function Tick({ x, y, payload }) {
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fontSize={12} fill="rgb(var(--ink))">
      {shortName(payload.value)}
    </text>
  );
}

export default function BenchmarkChart({ rows, unit, metric = 'rate', height }) {
  if (!rows?.length) return <Empty title="Sin datos" />;
  const sorted = [...rows].sort((a, b) => (metric === 'rate' ? b.rate - a.rate : b.total - a.total));
  const dataKey = metric === 'rate' ? 'rate' : 'total';
  const rowH = sorted.length > 14 ? 26 : sorted.length > 8 ? 30 : 36;
  const chartHeight = height ?? Math.max(200, sorted.length * rowH + 30);

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart data={sorted} layout="vertical" margin={{ top: 4, right: 44, left: 4, bottom: 0 }} barCategoryGap="28%">
        <CartesianGrid {...gridProps} horizontal={false} />
        <XAxis type="number" tick={axisTick} tickLine={false} axisLine={false} tickFormatter={(v) => (metric === 'rate' ? `${v}%` : fmtMass(v, unit, false))} domain={metric === 'rate' ? [0, 100] : [0, 'auto']} />
        <YAxis type="category" dataKey="name" tick={<Tick />} tickLine={false} axisLine={false} width={220} interval={0} />
        <Tooltip content={<ChartTooltip formatter={(v) => (metric === 'rate' ? fmtPct(v) : fmtMass(v, unit))} labelFormatter={(l) => shortName(l)} />} />
        <Bar dataKey={dataKey} radius={[0, 4, 4, 0]} maxBarSize={22}>
          {sorted.map((r, i) => <Cell key={i} fill={metric === 'rate' ? (r.rate >= 50 ? 'rgb(var(--good))' : r.rate >= 25 ? 'rgb(var(--warn))' : 'rgb(var(--bad))') : 'rgb(var(--brand))'} />)}
          <LabelList
            dataKey={dataKey} position="right" fontSize={11} fill="rgb(var(--muted))"
            formatter={(v) => (metric === 'rate' ? fmtPct(v, 0) : fmtMass(v, unit, false))}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
