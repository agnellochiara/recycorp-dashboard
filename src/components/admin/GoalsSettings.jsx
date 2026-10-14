// Metas de valorización por segmento, asignación de empresas a segmentos y factores de emisión evitada.
import { useState } from 'react';
import { ChevronDown, Save, Plus, Trash2 } from 'lucide-react';
import { Button, Card, CardHeader, Select } from '../ui.jsx';
import { useData } from '../../context/DataContext.jsx';
import { MATERIALS } from '../../lib/constants.js';

const EQUIV_FIELDS = [
  { key: 'tCo2PerTree10y', label: 'tCO2e secuestradas por árbol en 10 años', step: 0.01 },
  { key: 'kgCo2PerCarKm', label: 'kg CO2 por km de auto', step: 0.01 },
  { key: 'tCo2PerHomeYear', label: 'tCO2e por hogar al año', step: 0.1 },
  { key: 'treesPerTonPaper', label: 'árboles salvados por tonelada de papel', step: 1 },
  { key: 'litersWaterPerTonPaper', label: 'litros de agua por tonelada de papel', step: 100 },
  { key: 'kwhPerTonPaper', label: 'kWh ahorrados por tonelada de papel', step: 10 },
];

export default function GoalsSettings() {
  const { config, updateConfig } = useData();
  const [draft, setDraft] = useState(structuredClone(config));
  const [advanced, setAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => { setSaving(true); try { await updateConfig(draft); } finally { setSaving(false); } };

  const setSeg = (id, patch) => setDraft((d) => ({ ...d, segments: d.segments.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
  const addSeg = () => setDraft((d) => ({ ...d, segments: [...d.segments, { id: `seg_${d.segments.length + 1}`, label: 'Nuevo segmento', goal: 50 }] }));
  const removeSeg = (id) => setDraft((d) => ({ ...d, segments: d.segments.filter((s) => s.id !== id), companySegments: Object.fromEntries(Object.entries(d.companySegments).map(([k, v]) => [k, v === id ? null : v])) }));
  const setCompanySeg = (company, segId) => setDraft((d) => ({ ...d, companySegments: { ...d.companySegments, [company]: segId || undefined } }));

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <CardHeader title="Segmentos y metas de valorización" subtitle="Cada empresa pertenece a un segmento con su propia meta (%). Esto es lo que alimenta el gráfico de valorización vs. meta." />
        <div className="px-4 pb-1 space-y-2">
          {draft.segments.map((s) => (
            <div key={s.id} className="flex items-center gap-2">
              <input value={s.label} onChange={(e) => setSeg(s.id, { label: e.target.value })} className="flex-1 bg-sunken border border-line rounded-lg px-2.5 py-1.5 text-sm" />
              <div className="flex items-center gap-1">
                <input type="number" min={0} max={100} value={s.goal} onChange={(e) => setSeg(s.id, { goal: Number(e.target.value) })} className="w-16 bg-sunken border border-line rounded-lg px-2 py-1.5 text-sm text-right" />
                <span className="text-sm text-muted">%</span>
              </div>
              <button onClick={() => removeSeg(s.id)} className="text-muted hover:text-bad p-1"><Trash2 size={14} /></button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addSeg}><Plus size={14} /> Agregar segmento</Button>
        </div>
      </Card>

      <Card className="p-4">
        <CardHeader title="Empresas por segmento" subtitle="Determina qué meta aplica a cada empresa." />
        <div className="px-4 pb-1 grid sm:grid-cols-2 gap-2">
          {draft.companies.map((c) => (
            <div key={c} className="flex items-center justify-between gap-2 bg-sunken rounded-lg px-3 py-1.5">
              <span className="text-sm truncate">{c}</span>
              <Select value={draft.companySegments[c] || ''} onChange={(v) => setCompanySeg(c, v)} options={draft.segments.map((s) => ({ value: s.id, label: s.label }))} placeholder="Meta general" className="w-40" />
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <button className="flex items-center gap-1.5 text-sm font-medium text-ink" onClick={() => setAdvanced((v) => !v)}>
          Factores de huella de carbono (avanzado) <ChevronDown size={14} className={`transition-transform ${advanced ? 'rotate-180' : ''}`} />
        </button>
        {advanced && (
          <div className="mt-3 space-y-3">
            <p className="text-xs text-muted">tCO₂e evitadas por tonelada reciclada, por material. Valores indicativos: reemplazar por los del inventario real.</p>
            <div className="grid sm:grid-cols-3 gap-2">
              {MATERIALS.filter((m) => m.category === 'aprovechables' || m.id === 'raee').map((m) => (
                <label key={m.id} className="flex items-center justify-between gap-2 text-xs bg-sunken rounded-lg px-2.5 py-1.5">
                  <span className="truncate">{m.label}</span>
                  <input
                    type="number" step="0.01" value={draft.factors.reciclaje[m.id] ?? 0}
                    onChange={(e) => setDraft((d) => ({ ...d, factors: { ...d.factors, reciclaje: { ...d.factors.reciclaje, [m.id]: Number(e.target.value) } } }))}
                    className="w-16 bg-surface border border-line rounded px-1.5 py-1 text-right"
                  />
                </label>
              ))}
            </div>
            <div className="grid sm:grid-cols-3 gap-2">
              {['compostaje', 'energetica', 'disposicion'].map((k) => (
                <label key={k} className="flex items-center justify-between gap-2 text-xs bg-sunken rounded-lg px-2.5 py-1.5">
                  <span className="capitalize">{k}</span>
                  <input type="number" step="0.01" value={draft.factors[k] ?? 0} onChange={(e) => setDraft((d) => ({ ...d, factors: { ...d.factors, [k]: Number(e.target.value) } }))} className="w-16 bg-surface border border-line rounded px-1.5 py-1 text-right" />
                </label>
              ))}
            </div>

            <p className="text-xs text-muted pt-2">Ecoequivalencias de impacto (tarjeta "Equivalencias de impacto"): factores de conversión de referencia pública.</p>
            <div className="grid sm:grid-cols-2 gap-2">
              {EQUIV_FIELDS.map(({ key, label, step }) => (
                <label key={key} className="flex items-center justify-between gap-2 text-xs bg-sunken rounded-lg px-2.5 py-1.5">
                  <span className="truncate">{label}</span>
                  <input
                    type="number" step={step} value={draft.factors.equiv[key] ?? 0}
                    onChange={(e) => setDraft((d) => ({ ...d, factors: { ...d.factors, equiv: { ...d.factors.equiv, [key]: Number(e.target.value) } } }))}
                    className="w-24 bg-surface border border-line rounded px-1.5 py-1 text-right"
                  />
                </label>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Button onClick={save} loading={saving}><Save size={14} /> Guardar configuración</Button>
    </div>
  );
}
