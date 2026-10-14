// Filtros globales: año(s), mes(es), sede(s), material(es) y destino(s). No filtra por empresa: esa dimensión
// se navega con las pestañas "Visión general" / "Por empresa" del panel. El filtro de sede está disponible en
// ambas vistas; en "Por empresa" solo lista las sedes de la empresa activa.
import { RotateCcw } from 'lucide-react';
import { MultiSelect, Button } from './ui.jsx';
import { MATERIALS, TREATMENTS, MONTHS_SHORT, EMPTY_FILTERS } from '../lib/constants.js';
import { distinctYears } from '../lib/calc.js';

export default function FilterBar({ filters, setFilters, records, sites, companyScope }) {
  const years = distinctYears(records);
  const siteOptions = sites.filter((s) => !companyScope || s.company === companyScope).map((s) => ({ value: s.id, label: s.name }));
  const monthOptions = MONTHS_SHORT.map((m, i) => ({ value: i + 1, label: m }));
  const materialOptions = MATERIALS.map((m) => ({ value: m.id, label: m.label }));
  const treatmentOptions = TREATMENTS.map((t) => ({ value: t.id, label: t.label }));

  const set = (key) => (value) => setFilters((f) => ({ ...f, [key]: value }));
  const active = Object.values(filters).some((v) => v.length);

  return (
    <div className="flex flex-wrap items-center gap-2 no-export">
      <MultiSelect value={filters.years} onChange={set('years')} options={years.map((y) => ({ value: y, label: String(y) }))} placeholder="Todos los años" />
      <MultiSelect value={filters.months} onChange={set('months')} options={monthOptions} placeholder="Todos los meses" />
      <MultiSelect value={filters.sites} onChange={set('sites')} options={siteOptions} placeholder={companyScope ? 'Todas las sedes de la empresa' : 'Todas las sedes'} />
      <MultiSelect value={filters.materials} onChange={set('materials')} options={materialOptions} placeholder="Todos los materiales" />
      <MultiSelect value={filters.treatments} onChange={set('treatments')} options={treatmentOptions} placeholder="Todos los destinos" />
      {active && (
        <Button variant="ghost" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>
          <RotateCcw size={13} /> Limpiar
        </Button>
      )}
    </div>
  );
}
