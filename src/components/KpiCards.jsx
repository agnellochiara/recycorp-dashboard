import { Scale, Recycle, Leaf, Target, TrendingUp, TrendingDown } from 'lucide-react';
import { Card } from './ui.jsx';
import { fmtMass, fmtNum, fmtPct, fmtSigned } from '../lib/format.js';
import { monthDelta } from '../lib/calc.js';

function Kpi({ icon: Icon, label, value, sub, delta, tone = 'neutral' }) {
  const toneCls = { good: 'text-good', bad: 'text-bad', neutral: 'text-muted' }[tone];
  return (
    <Card className="p-4" exportBlock>
      <div className="flex items-center gap-2 text-muted text-xs mb-2">
        <Icon size={14} /> {label}
      </div>
      <div className="font-display text-2xl font-bold text-ink leading-tight">{value}</div>
      {sub && <div className={`text-xs mt-1 ${toneCls}`}>{sub}</div>}
      {delta != null && (
        <div className={`flex items-center gap-1 text-xs mt-1 ${delta >= 0 ? 'text-good' : 'text-bad'}`}>
          {delta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />} {fmtSigned(delta)}% vs. mes anterior
        </div>
      )}
    </Card>
  );
}

export default function KpiCards({ records, filters, summary, goal, unit }) {
  const delta = monthDelta(records, filters);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Kpi icon={Scale} label="Total generado" value={fmtMass(summary.total, unit)} delta={delta?.pct} />
      <Kpi
        icon={Target}
        label={`Valorización${goal.mixed ? ' (meta ponderada)' : ''}`}
        value={fmtPct(summary.valRate)}
        sub={`Meta: ${fmtPct(goal.value, goal.mixed ? 1 : 0)} · ${summary.valRate >= goal.value ? 'cumple' : `${fmtSigned(summary.valRate - goal.value)} pp`}`}
        tone={summary.valRate >= goal.value ? 'good' : 'bad'}
      />
      <Kpi icon={Recycle} label="Reciclaje" value={fmtPct(summary.recRate)} sub={fmtMass(summary.recycled, unit)} />
      <Kpi icon={Leaf} label="Huella evitada" value={`${fmtNum(summary.co2, summary.co2 < 100 ? 1 : 0)} tCO₂e`} sub="vs. disposición en relleno" />
    </div>
  );
}
