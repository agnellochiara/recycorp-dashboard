// Piezas compartidas entre los gráficos de recharts: tooltip con estilo del panel, formateadores de eje.
export function ChartTooltip({ active, payload, label, formatter, labelFormatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface border border-line rounded-lg shadow-lg px-3 py-2 text-xs max-w-xs">
      {label != null && <div className="font-medium text-ink mb-1">{labelFormatter ? labelFormatter(label) : label}</div>}
      <div className="space-y-0.5">
        {payload.filter((p) => p.value != null).map((p, i) => (
          <div key={i} className="flex items-center gap-2 justify-between">
            <span className="flex items-center gap-1.5 text-muted">
              <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
              {p.name}
            </span>
            <span className="font-medium text-ink">{formatter ? formatter(p.value, p) : p.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const axisTick = { fontSize: 11, fill: 'rgb(var(--muted))' };
export const gridProps = { stroke: 'rgb(var(--line))', strokeDasharray: '3 3', vertical: false };
