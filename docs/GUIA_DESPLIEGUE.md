# Guía de despliegue

## Opción rápida: archivo único (sin servidor)

```bash
npm run build:single
```

Esto genera `dist-single/index.html`: un único archivo con todo incluido (CSS, JS y los datos reales de Arequipa
empaquetados). Se puede abrir directamente en un navegador, adjuntar a un correo, o subir a cualquier hosting
estático sin configuración. Funciona siempre en modo demo (no hay backend al que conectarse desde un archivo
abierto con `file://`, salvo que se despliegue en un servidor real — ver más abajo).

## Netlify

1. Conectar el repositorio en Netlify (o usar `netlify deploy` desde la CLI).
2. Build command: `npm run build` · Publish directory: `dist`.
3. Si se usa Supabase, agregar `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en Site settings → Environment
   variables, y volver a desplegar.
4. El archivo `netlify.toml` incluido ya configura la reescritura de rutas para que `#/empresa/...` funcione
   al recargar la página.

## Vercel

1. Importar el repositorio en Vercel.
2. Framework preset: Vite. Build command: `npm run build` · Output directory: `dist`.
3. Variables de entorno (si se usa Supabase): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, en Project
   Settings → Environment Variables.

## GitHub Pages (vía GitHub Actions)

El flujo `.github/workflows/deploy.yml` incluido compila el proyecto y publica `dist/` en GitHub Pages en cada
push a `main`. Para activarlo:

1. En el repositorio: Settings → Pages → Source: "GitHub Actions".
2. Si se usa Supabase, agregar `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` como secrets del repositorio
   (Settings → Secrets and variables → Actions) — el workflow ya los referencia.
3. Como GitHub Pages sirve el sitio bajo una subruta, `vite.config.js` ya usa `base: './'`, así que no hace
   falta tocar nada más.

## Configurar el modo Supabase (backend real)

Ver la sección correspondiente en `README.md`. En resumen: crear el proyecto, correr `supabase/schema.sql`,
dar de alta al primer administrador y completar las variables de entorno antes de desplegar.

## Primera carga de datos en producción

1. Desplegar la app (en modo demo ya trae los datos reales de Arequipa; en modo Supabase, la base empieza vacía).
2. Si es Supabase: ingresar como administrador y, en Administración → Datos (CSV), subir el CSV con el histórico
   (se puede exportar como punto de partida la plantilla o los datos actuales del modo demo).
3. Revisar en Administración → Sedes que las 19 sedes y sus empresas estén correctas.
4. Revisar en Administración → Metas y segmentos que las metas por segmento reflejen las acordadas con cada
   cliente.
