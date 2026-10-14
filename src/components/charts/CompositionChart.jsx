// Composición de los residuos por tipo de material (dona) con detalle en tabla.
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { ChartTooltip } from './common.jsx';
import { fmtMass, fmtPct } from '../../lib/format.js';
import { Empty } from '../ui.jsx';

export default function CompositionChart({ byMaterial, unit, total, height = 260 }) {
  const rows = (byMaterial || []).filter((m) => m.kg > 0).sort((a, b) => b.kg - a.kg);
  if (!rows.length || !total) return <Empty title="Sin datos" />;

  return (
    <div className="flex flex-col sm:flex-row gap-4 items-center">
      <div className="shrink-0">
        <ResponsiveContainer width={180} height={height}>
          <PieChart>
            <Pie data={rows} dataKey="kg" nameKey="label" innerRadius={52} outerRadius={82} paddingAngle={1.5} stroke="none">
              {rows.map((r, i) => <Cell key={i} fill={r.color || '#9aa7bd'} />)}
            </Pie>
            <Tooltip content={<ChartTooltip formatter={(v) => fmtMass(v, unit)} />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex-1 min-w-0 w-full space-y-1.5 max-h-64 overflow-y-auto">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-2 text-sm">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: r.color || '#9aa7bd' }} />
            <span className="flex-1 truncate text-ink">{r.label}</span>
            <span className="text-muted tabular-nums">{fmtMass(r.kg, unit)}</span>
            <span className="text-ink font-medium w-12 text-right tabular-nums">{fmtPct((r.kg / total) * 100, 0)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
