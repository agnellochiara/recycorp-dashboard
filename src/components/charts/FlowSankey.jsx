// Flujo de residuos como diagrama de Sankey: tipo de residuo → destino final.
import { Sankey, ResponsiveContainer, Layer, Rectangle, Tooltip } from 'recharts';
import { CATEGORIES, TREATMENTS } from '../../lib/constants.js';
import { fmtMass } from '../../lib/format.js';
import { Empty } from '../ui.jsx';

const CAT_COLOR = { aprovechables: '#1f7a5a', no_aprovechables: '#7b6fae', organicos: '#5fa83e', peligrosos: '#c23a3a' };
// Etiquetas cortas para que no se corten contra el borde del gráfico (el nombre completo se ve en el tooltip).
const SHORT_LABEL = { disposicion: 'Relleno sanitario', energetica: 'Valorización energ.' };

function buildSankeyData(matrix) {
  const catNodes = CATEGORIES.filter((c) => TREATMENTS.some((t) => (matrix[c.id]?.[t.id] || 0) > 0));
  const trtNodes = TREATMENTS.filter((t) => CATEGORIES.some((c) => (matrix[c.id]?.[t.id] || 0) > 0));
  const nodes = [
    ...catNodes.map((c) => ({ name: c.label, color: CAT_COLOR[c.id] || '#9aa7bd' })),
    ...trtNodes.map((t) => ({ name: SHORT_LABEL[t.id] || t.label, color: t.color })),
  ];
  const catIndex = Object.fromEntries(catNodes.map((c, i) => [c.id, i]));
  const trtIndex = Object.fromEntries(trtNodes.map((t, i) => [t.id, catNodes.length + i]));
  const links = [];
  for (const c of catNodes) {
    for (const t of trtNodes) {
      const v = matrix[c.id]?.[t.id] || 0;
      if (v > 0) links.push({ source: catIndex[c.id], target: trtIndex[t.id], value: v, color: CAT_COLOR[c.id] });
    }
  }
  // Total que pasa por cada nodo, para mostrarlo junto al nombre.
  nodes.forEach((n, i) => { n.value = links.reduce((s, l) => s + (l.source === i || l.target === i ? l.value : 0), 0); });
  return { nodes, links };
}

function Node({ x, y, width, height, index, payload, containerWidth, unit }) {
  const isLeft = x < containerWidth / 2;
  const tx = isLeft ? x - 8 : x + width + 8;
  return (
    <Layer key={`node-${index}`}>
      <Rectangle x={x} y={y} width={width} height={height} fill={payload.color} fillOpacity={0.9} radius={2} />
      <text x={tx} y={y + height / 2 - 7} textAnchor={isLeft ? 'end' : 'start'} dominantBaseline="middle" className="fill-ink" fontSize={12} fontWeight={500}>
        {payload.name}
      </text>
      <text x={tx} y={y + height / 2 + 9} textAnchor={isLeft ? 'end' : 'start'} dominantBaseline="middle" className="fill-muted" fontSize={11}>
        {fmtMass(payload.value, unit)}
      </text>
    </Layer>
  );
}

// Punto medio de la curva de Bézier cúbica del enlace (misma fórmula que usa recharts para dibujarla),
// para colocar ahí la etiqueta con el valor en toneladas/kg.
function midPoint(sourceX, sourceY, sourceControlX, targetControlX, targetY, targetX) {
  const b = (p0, p1, p2, p3) => 0.125 * p0 + 0.375 * p1 + 0.375 * p2 + 0.125 * p3;
  return { x: b(sourceX, sourceControlX, targetControlX, targetX), y: b(sourceY, sourceY, targetY, targetY) };
}

function Link({ sourceX, targetX, sourceY, targetY, sourceControlX, targetControlX, linkWidth, payload, unit }) {
  const d = `M${sourceX},${sourceY}C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`;
  const mid = midPoint(sourceX, sourceY, sourceControlX, targetControlX, targetY, targetX);
  const showLabel = linkWidth >= 14;
  return (
    <Layer>
      <path d={d} fill="none" stroke={payload.color || '#9aa7bd'} strokeOpacity={0.35} strokeWidth={Math.max(1, linkWidth)} />
      {showLabel && (
        <text
          x={mid.x} y={mid.y} textAnchor="middle" dominantBaseline="middle" fontSize={11} fontWeight={600}
          className="fill-ink" stroke="rgb(var(--surface))" strokeWidth={3} paintOrder="stroke"
        >
          {fmtMass(payload.value, unit)}
        </text>
      )}
    </Layer>
  );
}

function SankeyTooltip({ active, payload, unit }) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  if (!p) return null;
  const isLink = p.source != null && p.target != null && p.value != null;
  if (!isLink) return null;
  return (
    <div className="bg-surface border border-line rounded-lg shadow-lg px-3 py-2 text-xs">
      <div className="font-medium text-ink">{p.source.name} → {p.target.name}</div>
      <div className="text-muted mt-0.5">{fmtMass(p.value, unit)}</div>
    </div>
  );
}

export default function FlowSankey({ matrix, unit, height = 340 }) {
  const data = buildSankeyData(matrix);
  if (!data.nodes.length || !data.links.length) return <Empty title="Sin datos" />;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <Sankey
        data={data}
        node={<Node unit={unit} />}
        link={<Link unit={unit} />}
        nodePadding={32}
        nodeWidth={10}
        margin={{ top: 12, right: 130, bottom: 12, left: 110 }}
        iterations={32}
      >
        <Tooltip content={<SankeyTooltip unit={unit} />} />
      </Sankey>
    </ResponsiveContainer>
  );
}
