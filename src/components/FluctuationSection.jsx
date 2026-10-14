// Variación de la generación mes a mes y detección de anomalías.
import { useState } from 'react';
import { ChevronDown, AlertTriangle, TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';
import { Card, CardHeader, Badge, Empty } from './ui.jsx';
import { fmtMass, fmtSigned, fmtPct } from '../lib/format.js';
import { describeAnomaly, listPeriods } from '../lib/analytics.js';

function StatTile({ label, value, tone }) {
  const toneCls = tone === 'good' ? 'text-good' : tone === 'bad' ? 'text-bad' : 'text-ink';
  return (
    <div className="bg-sunken rounded-xl p-3">
      <div className="text-[11px] text-muted mb-1">{label}</div>
      <div className={`font-display text-lg font-semibold ${toneCls}`}>{value}</div>
    </div>
  );
}

const trendIcon = (pct) => (pct > 1.5 ? TrendingUp : pct < -1.5 ? TrendingDown : Minus);

export default function FluctuationSection({ fluct, anomalies, unit }) {
  const [explain, setExplain] = useState(false);
  const { stats, streams, excluded } = fluct;
  const TrendIcon = stats.trendPct != null ? trendIcon(stats.trendPct) : Minus;

  return (
    <div className="space-y-4">
      <Card exportBlock>
        <CardHeader
          title="Variación de la generación"
          subtitle={stats.latest ? `Último mes comparable: ${stats.latest.label}` : 'Sin meses comparables aún'}
        />
        <div className="p-4 pt-1">
          {!stats.latest ? (
            <Empty title="Todavía no hay suficientes meses comparables" subtitle="Se necesitan al menos 4 meses con cobertura completa de sedes." />
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-3">
                <StatTile label="Último mes" value={fmtMass(stats.latest.total, unit)} />
                <StatTile label="vs. mes anterior" value={stats.mom != null ? `${fmtSigned(stats.mom)}%` : '—'} tone={stats.mom == null ? undefined : stats.mom >= 0 ? 'good' : 'bad'} />
                <StatTile label="vs. prom. 3 meses" value={stats.vsPrev3 != null ? `${fmtSigned(stats.vsPrev3)}%` : '—'} tone={stats.vsPrev3 == null ? undefined : stats.vsPrev3 >= 0 ? 'good' : 'bad'} />
                <StatTile label="vs. mismo mes año ant." value={stats.yoy != null ? `${fmtSigned(stats.yoy)}%` : '—'} tone={stats.yoy == null ? undefined : stats.yoy >= 0 ? 'good' : 'bad'} />
              </div>
              {stats.cv != null && (
                <div className="flex flex-wrap items-center gap-3 text-sm text-ink bg-brand-soft/40 rounded-lg px-3 py-2">
                  <span className="flex items-center gap-1.5"><TrendIcon size={14} /> Tendencia reciente: <b>{stats.trendLabel.toLowerCase()}</b> ({fmtSigned(stats.trendPct)}%/mes)</span>
                  <span className="text-muted">·</span>
                  <span>Volatilidad: <b>{stats.cvLabel.toLowerCase()}</b> (CV {fmtPct(stats.cv, 0)})</span>
                </div>
              )}
              {streams.length > 0 && (
                <div className="mt-3 grid sm:grid-cols-2 gap-2">
                  {streams.map((s) => (
                    <div key={s.id} className="flex items-center justify-between text-sm px-3 py-2 rounded-lg bg-sunken">
                      <span className="text-muted">{s.label}</span>
                      <span className={s.stats.mom >= 0 ? 'text-good' : 'text-bad'}>{s.stats.mom != null ? `${fmtSigned(s.stats.mom)}%` : '—'}</span>
                    </div>
                  ))}
                </div>
              )}
              {excluded.length > 0 && (
                <p className="text-xs text-muted mt-3 flex items-start gap-1.5">
                  <Info size={13} className="shrink-0 mt-0.5" />
                  Se excluyeron de estas comparaciones {excluded.length === 1 ? 'el mes' : 'los meses'} con cobertura de sedes incompleta: {listPeriods(excluded)}.
                </p>
              )}
            </>
          )}
        </div>
      </Card>

      <Card exportBlock>
        <CardHeader
          title="Anomalías detectadas"
          subtitle={`${anomalies.length} ${anomalies.length === 1 ? 'mes atípico' : 'meses atípicos'} en el período seleccionado`}
          action={
            <button onClick={() => setExplain((v) => !v)} className="flex items-center gap-1 text-xs text-brand font-medium">
              ¿Cómo se detectan? <ChevronDown size={13} className={`transition-transform ${explain ? 'rotate-180' : ''}`} />
            </button>
          }
        />
        {explain && (
          <div className="px-4 pb-2 text-xs text-muted leading-relaxed bg-sunken/60 mx-4 rounded-lg p-3 mb-1">
            Para cada sede y cada tipo de flujo (total, reciclables, residuos generales, orgánicos, peligrosos) se compara el valor de un
            mes con el historial de <b>esa misma sede</b>: su mediana reciente (valor esperado) y su <b>promedio histórico de generación</b>
            (tamaño típico). Un mes se marca como anomalía cuando se cumplen a la vez tres condiciones: (1) es estadísticamente inusual frente
            al comportamiento reciente de esa sede, (2) se aparta al menos un <b>20&nbsp;%</b> del valor esperado, y (3) ese desvío en kg
            representa al menos un <b>20&nbsp;% del promedio histórico de generación de esa sede</b> en ese flujo. Esta última condición es la
            que define qué es "grande": en vez de un volumen fijo en kilos igual para todas las sedes, se usa un porcentaje del propio
            promedio de cada una — así una sede grande necesita un desvío mayor en kg para calificar como anomalía, y una sede pequeña uno
            proporcionalmente menor. También se marca un mes sin ningún registro dentro del historial de una sede.
          </div>
        )}
        <div className="px-4 pb-4">
          {!anomalies.length ? (
            <Empty title="Sin anomalías en este período" subtitle="La generación se mantuvo dentro de lo esperado para cada sede." />
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {anomalies.map((a) => (
                <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg bg-sunken">
                  <AlertTriangle size={16} className={`shrink-0 mt-0.5 ${a.severity === 'alta' ? 'text-bad' : 'text-warn'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-ink">{a.siteName}</span>
                      <Badge tone="neutral">{a.label}</Badge>
                      <Badge tone="neutral">{a.streamLabel}</Badge>
                      <Badge tone={a.severity === 'alta' ? 'bad' : 'warn'}>{a.severity === 'alta' ? 'Alta' : 'Media'}</Badge>
                    </div>
                    <p className="text-xs text-muted mt-1">{describeAnomaly(a, (kg) => fmtMass(kg, unit))}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
