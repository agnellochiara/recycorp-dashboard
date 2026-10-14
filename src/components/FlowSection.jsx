// Tarjeta "Flujo de residuos": alterna entre tabla (categoría × destino) y diagrama de Sankey.
import { useState } from 'react';
import { Card, CardHeader, Segmented } from './ui.jsx';
import FlowMatrix from './charts/FlowMatrix.jsx';
import FlowSankey from './charts/FlowSankey.jsx';

export default function FlowSection({ matrix, unit }) {
  const [view, setView] = useState('sankey');
  return (
    <Card exportBlock>
      <CardHeader
        title="Flujo de residuos"
        subtitle="Tipo de residuo × destino final"
        action={<Segmented value={view} onChange={setView} options={[{ value: 'sankey', label: 'Sankey' }, { value: 'tabla', label: 'Tabla' }]} />}
      />
      <div className="px-4 pb-4">
        {view === 'sankey' ? <FlowSankey matrix={matrix} unit={unit} /> : <FlowMatrix matrix={matrix} unit={unit} />}
      </div>
    </Card>
  );
}
