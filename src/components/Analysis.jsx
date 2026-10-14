// Tarjeta "Resumen": lectura en lenguaje natural de la selección actual (se usa en la pestaña "Por empresa",
// y también sirve en la vista general). Las frases se generan con `buildInsights`, a partir de los mismos
// cálculos que alimentan el resto del panel — nada se redacta a mano por fuera de los datos.
import { CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react';
import { Card, CardHeader } from './ui.jsx';
import { buildInsights } from '../lib/insights.js';

const ICON = { good: CheckCircle2, bad: XCircle, warn: AlertTriangle, neutral: Info };
const TONE_CLS = { good: 'text-good', bad: 'text-bad', warn: 'text-warn', neutral: 'text-muted' };

export default function Analysis({ label, unit, summary, goal, fluct, anomalies, memo, range, siteCount }) {
  const insights = buildInsights({ label, unit, summary, goal, fluct, anomalies, memo, range, siteCount });
  return (
    <Card exportBlock>
      <CardHeader title="Resumen" subtitle={range} />
      <div className="p-4 pt-1 space-y-2.5">
        {insights.map((ins, i) => {
          const Icon = ICON[ins.tone] || Info;
          return (
            <div key={i} className="flex items-start gap-2 text-sm">
              <Icon size={15} className={`${TONE_CLS[ins.tone]} shrink-0 mt-0.5`} />
              <p className="text-ink leading-snug">{ins.text}</p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
