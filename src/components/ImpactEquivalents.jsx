// Tarjeta "Equivalencias de impacto": traduce la huella evitada y el papel/cartón reciclado a términos
// cotidianos. Son estimaciones orientativas (ver src/lib/impact.js) — no sustituyen un inventario de ciclo de
// vida real, pero ayudan a comunicar el impacto a quien no interpreta toneladas de CO2 directamente.
import { TreePine, Car, Home, Droplets, Zap, Info } from 'lucide-react';
import { Card, CardHeader } from './ui.jsx';
import { fmtNum } from '../lib/format.js';

function Tile({ icon: Icon, value, label, color }) {
  return (
    <div className="flex items-start gap-2.5 bg-sunken rounded-xl p-3">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}1a`, color }}>
        <Icon size={16} />
      </div>
      <div className="min-w-0">
        <div className="font-display text-base font-bold text-ink leading-tight">{value}</div>
        <div className="text-xs text-muted leading-snug">{label}</div>
      </div>
    </div>
  );
}

export default function ImpactEquivalents({ impact }) {
  if (!impact.co2) return null;
  const tiles = [
    { icon: TreePine, color: '#1f7a5a', value: `${fmtNum(impact.trees, 0)}`, label: 'árboles equivalentes (secuestro en 10 años)' },
    { icon: Car, color: '#3f7fd6', value: `${fmtNum(impact.carKm, 0)} km`, label: 'no recorridos en auto' },
    { icon: Home, color: '#e6a23c', value: fmtNum(impact.homesYear, impact.homesYear < 10 ? 1 : 0), label: 'hogares con electricidad por un año' },
  ];
  if (impact.paperT > 0) {
    tiles.push(
      { icon: TreePine, color: '#5fa83e', value: `${fmtNum(impact.paperTrees, 0)}`, label: 'árboles salvados por el papel/cartón reciclado' },
      { icon: Droplets, color: '#1f9d8a', value: `${fmtNum(impact.paperWaterL / 1000, 0)} m³`, label: 'de agua ahorrada (papel/cartón)' },
      { icon: Zap, color: '#c05ad6', value: `${fmtNum(impact.paperKwh, 0)} kWh`, label: 'de energía ahorrada (papel/cartón)' },
    );
  }

  return (
    <Card exportBlock>
      <CardHeader title="Equivalencias de impacto" subtitle="Estimaciones orientativas a partir de la huella evitada" />
      <div className="px-4 pb-4 grid sm:grid-cols-3 gap-2.5">
        {tiles.map((t, i) => <Tile key={i} {...t} />)}
      </div>
      <p className="px-4 pb-4 -mt-1 flex items-start gap-1.5 text-[11px] text-muted">
        <Info size={12} className="shrink-0 mt-0.5" />
        Calculadas con factores de conversión públicos de referencia (no un inventario de ciclo de vida propio); ajustables en Administración → Metas y segmentos.
      </p>
    </Card>
  );
}
