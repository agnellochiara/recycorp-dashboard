// Alta y edición de sedes (nombre, empresa, formato y estado).
import { useState } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';
import { Button, Card, Select } from '../ui.jsx';
import { useData } from '../../context/DataContext.jsx';

const blank = () => ({ id: '', name: '', company: '', format: '', district: '', status: 'Activo' });

export default function SitesManager() {
  const { sites, config, updateSites } = useData();
  const [rows, setRows] = useState(sites);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  const companyOptions = config.companies.map((c) => ({ value: c, label: c }));
  const formatOptions = config.formats.map((f) => ({ value: f, label: f }));

  const save = async () => { setSaving(true); try { await updateSites(rows); } finally { setSaving(false); } };
  const update = (id, patch) => setRows((r) => r.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const remove = (id) => setRows((r) => r.filter((s) => s.id !== id));
  const addDraft = () => {
    if (!draft?.id || !draft?.name || !draft?.company) return;
    setRows((r) => [...r, draft]);
    setDraft(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{rows.length} sedes</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setDraft(blank())}><Plus size={14} /> Nueva sede</Button>
          <Button size="sm" onClick={save} loading={saving}><Save size={14} /> Guardar cambios</Button>
        </div>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="text-left text-xs text-muted border-b border-line">
              <th className="p-2">ID</th><th className="p-2">Nombre</th><th className="p-2">Empresa</th><th className="p-2">Formato</th><th className="p-2">Estado</th><th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {draft && (
              <tr className="border-b border-line bg-brand-soft/30">
                <td className="p-1.5"><input value={draft.id} onChange={(e) => setDraft({ ...draft, id: e.target.value })} placeholder="S20" className="w-20 bg-surface border border-line rounded px-2 py-1 text-xs" /></td>
                <td className="p-1.5"><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Marca · Sede" className="w-full bg-surface border border-line rounded px-2 py-1 text-xs" /></td>
                <td className="p-1.5"><Select value={draft.company} onChange={(v) => setDraft({ ...draft, company: v })} options={companyOptions} className="w-36" /></td>
                <td className="p-1.5"><Select value={draft.format} onChange={(v) => setDraft({ ...draft, format: v })} options={formatOptions} className="w-36" /></td>
                <td className="p-1.5 text-xs text-muted">Activo</td>
                <td className="p-1.5"><Button size="sm" onClick={addDraft}>Añadir</Button></td>
              </tr>
            )}
            {rows.map((s) => (
              <tr key={s.id} className="border-b border-line last:border-0">
                <td className="p-2 text-xs text-muted">{s.id}</td>
                <td className="p-2"><input value={s.name} onChange={(e) => update(s.id, { name: e.target.value })} className="w-full bg-transparent border-b border-transparent hover:border-line focus:border-brand focus:outline-none text-sm" /></td>
                <td className="p-2"><Select value={s.company} onChange={(v) => update(s.id, { company: v })} options={companyOptions} className="w-36" /></td>
                <td className="p-2"><Select value={s.format} onChange={(v) => update(s.id, { format: v })} options={formatOptions} className="w-36" /></td>
                <td className="p-2">
                  <Select value={s.status} onChange={(v) => update(s.id, { status: v })} options={[{ value: 'Activo', label: 'Activo' }, { value: 'Inactivo', label: 'Inactivo' }]} className="w-28" />
                </td>
                <td className="p-2"><button onClick={() => remove(s.id)} className="text-muted hover:text-bad"><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
