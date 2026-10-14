// Valorización vs. meta — rediseñado para no mezclar metas de segmentos distintos en una sola línea.
//
// Modo "Por segmento" (vista general, por defecto): una línea por segmento de cliente (Retail, Educación,
// Hospitalidad…), cada una contra SU PROPIA meta real (línea punteada del mismo color). Es un gráfico general
// que sigue siendo accionable porque nunca combina objetivos de segmentos distintos en un solo número.
//
// Modo "Por empresa": un selector para elegir una empresa o un segmento completo, mostrando esa única entidad
// contra su única meta (sin ponderar). Útil para mirar de cerca un caso puntual.
//
// La pestaña "Por empresa" del panel (una sola empresa ya seleccionada) usa este mismo componente con
// `fixedCompany`, que oculta el selector: ya muestra una línea contra su propia meta, sin mezclar nada.
import { useMemo, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, Label } from 'recharts';
import { Target } from 'lucide-react';
import { ChartTooltip, axisTick, gridProps } from './common.jsx';
import { fmtPct } from '../../lib/format.js';
import { monthlyKpis } from '../../lib/calc.js';
import { companiesBySegment, seriesBySegment, goalForRecords, segmentOfCompany } from '../../lib/goals.js';
import { Segmented, Select, Empty } from '../ui.jsx';

const PALETTE = ['#1f7a5a', '#3f7fd6', '#c05ad6', '#e6a23c', '#9aa7bd', '#c23a3a'];
const colorFor = (i) => PALETTE[i % PALETTE.length];
const RATE_TICKS = [0, 20, 40, 60, 80, 100];

export default function RateChart({ records, siteById, config, sites, unit, fixedCompany = null, height = 300 }) {
  const [mode, setMode] = useState('segmento');
  const [scope, setScope] = useState(null); // "company:<name>" | "segment:<id>"

  const segGroups = useMemo(() => companiesBySegment(records, siteById, config), [records, siteById, config]);

  // ---- Modo "Por empresa" (o pestaña de una sola empresa, vía fixedCompany) ----
  const entity = useMemo(() => {
    if (fixedCompany) return { type: 'company', id: fixedCompany, label: fixedCompany };
    if (scope) {
      const [type, id] = scope.split(':');
      if (type === 'segment') { const g = segGroups.find((s) => s.id === id); return g ? { type: 'segment', id, label: g.label } : null; }
      return { type: 'company', id, label: id };
    }
    return segGroups[0]?.companies?.[0] ? { type: 'company', id: segGroups[0].companies[0], label: segGroups[0].companies[0] } : null;
  }, [fixedCompany, scope, segGroups]);

  const entitySeries = useMemo(() => {
    if ((mode !== 'empresa' && !fixedCompany) || !entity) return null;
    const ids = new Set(sites.filter((s) => (entity.type === 'segment' ? segmentOfCompany(s.company, config)?.id === entity.id : s.company === entity.id)).map((s) => s.id));
    const recs = records.filter((r) => ids.has(r.s));
    if (!recs.length) return { data: [], goal: null };
    const kpis = monthlyKpis(recs, config);
    const goal = goalForRecords(recs, siteById, config);
    return { data: kpis.map((k) => ({ p: k.p, label: k.label, rate: k.valRate })), goal: goal.value, mixed: goal.mixed };
  }, [mode, fixedCompany, entity, sites, records, config, siteById]);

  // ---- Modo "Por segmento" (general) ----
  const segData = useMemo(() => (mode === 'segmento' && !fixedCompany ? seriesBySegment(records, siteById, config) : null), [mode, fixedCompany, records, siteById, config]);

  const pickerOptions = useMemo(() => {
    const opts = [];
    for (const g of segGroups) {
      opts.push({ value: `segment:${g.id}`, label: `Segmento completo · ${g.label} (meta ${fmtPct(g.goal, 0)})` });
      for (const c of g.companies) opts.push({ value: `company:${c}`, label: `${c} (${g.label})` });
    }
    return opts;
  }, [segGroups]);

  const showToggle = !fixedCompany;

  return (
    <div>
      {showToggle && (
        <div className="flex flex-wrap items-center gap-2 mb-3 px-1">
          <Segmented value={mode} onChange={setMode} options={[{ value: 'segmento', label: 'Por segmento' }, { value: 'empresa', label: 'Por empresa / segmento' }]} />
          {mode === 'empresa' && (
            <Select
              value={scope ?? (entity ? `${entity.type}:${entity.id}` : '')}
              onChange={setScope}
              options={pickerOptions}
              placeholder={null}
              className="min-w-[240px] max-w-[320px]"
            />
          )}
        </div>
      )}

      {mode === 'segmento' && !fixedCompany ? (
        segData?.data?.length ? (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={segData.data} margin={{ top: 8, right: 56, left: 0, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: 'rgb(var(--line))' }} interval={segData.data.length > 12 ? 1 : 0} />
              <YAxis tick={axisTick} tickLine={false} axisLine={false} ticks={RATE_TICKS} domain={[0, 100]} tickFormatter={(v) => `${v}%`} width={42} />
              <Tooltip content={<ChartTooltip formatter={(v) => fmtPct(v)} />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {segData.segments.map((seg, i) => (
                <ReferenceLine key={`g-${seg.id}`} y={seg.goal} stroke={colorFor(i)} strokeDasharray="4 4" strokeOpacity={0.7} ifOverflow="extendDomain">
                  <Label position="right" value={`${fmtPct(seg.goal, 0)}`} fill={colorFor(i)} fontSize={10} offset={6} />
                </ReferenceLine>
              ))}
              {segData.segments.map((seg, i) => (
                <Line key={seg.id} type="monotone" dataKey={seg.id} name={seg.label} stroke={colorFor(i)} strokeWidth={2.25} dot={{ r: 2.5 }} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : <Empty title="Sin datos para graficar" />
      ) : entitySeries?.data?.length ? (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={entitySeries.data} margin={{ top: 8, right: 56, left: 0, bottom: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: 'rgb(var(--line))' }} interval={entitySeries.data.length > 12 ? 1 : 0} />
            <YAxis tick={axisTick} tickLine={false} axisLine={false} ticks={RATE_TICKS} domain={[0, 100]} tickFormatter={(v) => `${v}%`} width={42} />
            <Tooltip content={<ChartTooltip formatter={(v) => fmtPct(v)} />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {entitySeries.goal != null && (
              <ReferenceLine y={entitySeries.goal} stroke="rgb(var(--brand))" strokeDasharray="4 4" ifOverflow="extendDomain">
                <Label position="right" value={`Meta ${fmtPct(entitySeries.goal, 0)}`} fill="rgb(var(--brand))" fontSize={10} offset={6} />
              </ReferenceLine>
            )}
            <Line type="monotone" dataKey="rate" name={`Valorización · ${entity?.label ?? ''}`} stroke="rgb(var(--brand))" strokeWidth={2.25} dot={{ r: 2.5 }} />
          </LineChart>
        </ResponsiveContainer>
      ) : <Empty title="Sin datos para esta selección" subtitle="Elige otra empresa o segmento." />}

      {!fixedCompany && mode === 'empresa' && (
        <p className="flex items-center gap-1.5 text-xs text-muted mt-2 px-1">
          <Target size={12} /> La meta mostrada es siempre la propia de la entidad elegida: nunca una meta ponderada entre segmentos distintos.
        </p>
      )}
    </div>
  );
}
