// Matriz categoría de residuo × destino (tratamiento), como mapa de calor tabular.
import { CATEGORIES, TREATMENTS } from '../../lib/constants.js';
import { fmtMass } from '../../lib/format.js';
import { Empty } from '../ui.jsx';

export default function FlowMatrix({ matrix, unit }) {
  const max = Math.max(1, ...CATEGORIES.flatMap((c) => TREATMENTS.map((t) => matrix[c.id]?.[t.id] || 0)));
  const total = CATEGORIES.reduce((s, c) => s + TREATMENTS.reduce((s2, t) => s2 + (matrix[c.id]?.[t.id] || 0), 0), 0);
  if (!total) return <Empty title="Sin datos" />;

  const alpha = (v) => (v <= 0 ? 0 : 0.12 + 0.75 * Math.sqrt(v / max));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse min-w-[480px]">
        <thead>
          <tr>
            <th className="text-left font-medium text-muted p-1.5"></th>
            {TREATMENTS.map((t) => <th key={t.id} className="text-left font-medium text-muted p-1.5 whitespace-nowrap">{t.label}</th>)}
            <th className="text-right font-medium text-muted p-1.5">Total</th>
          </tr>
        </thead>
        <tbody>
          {CATEGORIES.map((c) => {
            const rowTotal = TREATMENTS.reduce((s, t) => s + (matrix[c.id]?.[t.id] || 0), 0);
            if (!rowTotal) return null;
            return (
              <tr key={c.id} className="border-t border-line">
                <td className="p-1.5 font-medium text-ink whitespace-nowrap">{c.label}</td>
                {TREATMENTS.map((t) => {
                  const v = matrix[c.id]?.[t.id] || 0;
                  return (
                    <td key={t.id} className="p-1.5 tabular-nums" style={{ background: v ? `rgb(var(--brand) / ${alpha(v)})` : 'transparent' }}>
                      {v ? fmtMass(v, unit, false) : '—'}
                    </td>
                  );
                })}
                <td className="p-1.5 text-right font-medium tabular-nums">{fmtMass(rowTotal, unit)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
