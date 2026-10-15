# Recycorp · Panel de gestión de residuos y valorización

Panel de BI para el seguimiento de generación de residuos y valorización de las sedes de Recycorp en Arequipa,
construido con React + Vite + Tailwind. Funciona en dos modos:

- **Modo demo** (por defecto): datos reales del extractor de Recycorp empaquetados en el propio build
  (`src/data/demo.json`), persistidos localmente en el navegador. No requiere backend.
- **Modo Supabase**: backend real con autenticación, base de datos y permisos (`supabase/schema.sql`).

## Qué incluye

- **Visión general / Por empresa**: dos vistas con enlaces profundos (`#/empresa/<slug>`).
- **Valorización vs. meta, sin mezclar metas de segmentos distintos**: el gráfico general muestra una línea
  por segmento de cliente (Retail, Educación, Hospitalidad…) contra su propia meta real; un selector aparte
  permite elegir una empresa o un segmento puntual para verlo contra su única meta. Nunca se combina una meta
  ponderada entre segmentos en una sola línea (ver `src/components/charts/RateChart.jsx`).
- **Detección de anomalías basada en el promedio de cada sede**: un mes se marca como atípico cuando se aparta
  de forma estadísticamente inusual del historial reciente de esa sede, con un umbral del **20 %** tanto sobre
  el valor esperado como sobre el **promedio histórico de generación de esa misma sede** — no un volumen fijo
  en kilos igual para todas las sedes (ver `src/lib/analytics.js`).
- **Fluctuación**: variación mes a mes, vs. promedio de 3 meses, interanual, tendencia y volatilidad, excluyendo
  los meses con cobertura de sedes incompleta.
- **Flujo de residuos**: categoría × destino, alternando entre tabla y diagrama de Sankey (con el valor de
  cada flujo y el total de cada nodo visibles en el propio diagrama).
- **Equivalencias de impacto**: la huella evitada y el papel/cartón reciclado traducidos a términos cotidianos
  (árboles, km de auto, hogares con electricidad, agua y energía ahorradas), con una oración explicando cada
  una — factores ajustables en Administración → Metas y segmentos → Factores (avanzado, visible solo para
  administradores).
- **Filtros**: año, mes, sede, material y destino — el filtro de sede funciona también en "Por empresa",
  acotado a las sedes de la empresa activa; cada filtro trae un botón "Todos" para no tener que marcar uno por
  uno.
- **Metas sin mezclar segmentos**: la vista general no muestra una meta consolidada cuando se ven todas las
  empresas a la vez (cada segmento de cliente tiene su propia meta real); al entrar a una empresa sí se compara
  contra su meta.
- **Asistente de datos sin IA generativa**: responde preguntas en lenguaje natural calculando directamente sobre
  los mismos datos del panel (`src/lib/chatEngine.js`).
- **Exportación** a PNG (por bloque) y PDF (reporte completo, respetando la disposición del panel).
- **Administración**: carga y descarga de datos por Excel o CSV (reemplazar o agregar al histórico), gestión de
  sedes, metas por segmento y factores de huella de carbono — protegida por sesión de administrador. La
  importación acepta tanto la plantilla propia como el Excel crudo del extractor de Recycorp (columnas de
  empresa, cliente y sede), haciendo coincidir los nombres de forma tolerante a variantes (mayúsculas, tildes,
  "AQP" de más o de menos, sufijos legales de la empresa) en vez de exigir que estén escritos exactamente igual.

## Desarrollo

```bash
npm install
npm run dev
```

Para regenerar `src/data/demo.json` a partir de un Excel del extractor:

```bash
python3 scripts/build_demo_data.py "Data para Dashboard.xlsx"
```

## Build

```bash
npm run build          # build estándar (dist/)
npm run build:single    # un único archivo HTML autocontenido (dist-single/index.html)
```

El build de archivo único sirve para enviar una demostración por correo o abrirla sin servidor.

## Configuración (modo Supabase, opcional)

1. Crear un proyecto en [supabase.com](https://supabase.com).
2. Ejecutar `supabase/schema.sql` en el SQL Editor.
3. Crear un usuario (Authentication → Users) y marcarlo como administrador:
   `update public.profiles set is_admin = true where id = '<uuid>';`
4. Copiar `.env.example` a `.env` y completar `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
5. Cargar los datos iniciales desde el panel de administración (CSV) una vez desplegado.

Sin esas variables de entorno, la app funciona en modo demo automáticamente.

Ver `docs/GUIA_DESPLIEGUE.md` para el despliegue paso a paso (Netlify / Vercel / GitHub Pages).

## Estructura

```
src/
  lib/         cálculos puros (sin React): catálogo, formato, agregaciones, metas, analítica, CSV, chat
  services/    adaptador de datos (demo/Supabase) y autenticación
  context/     estado global de React (datos, autenticación)
  components/  UI, gráficos y panel de administración
scripts/       generación de src/data/demo.json a partir del Excel del extractor
supabase/      esquema SQL para el modo backend real
```
