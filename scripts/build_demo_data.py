#!/usr/bin/env python3
"""
Convierte el Excel del extractor de Recycorp ("Data del Extractor") en src/data/demo.json,
el conjunto de datos que carga el modo demo.

Uso:  python3 scripts/build_demo_data.py ruta/al/archivo.xlsx

Agrega los registros diarios a nivel mensual (periodo + sede + material + tratamiento) y
imprime una conciliación contra el total del Excel. Los supuestos de mapeo están en MAPPING,
FORMATS y COMPANY: son la parte a revisar si algo no coincide con tu criterio.
"""
import json
import sys
from pathlib import Path

import pandas as pd

SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('Data_para_Dashboard_Recycorp_Chiara.xlsx')
OUT = Path(__file__).resolve().parent.parent / 'src' / 'data' / 'demo.json'

# "Tipo de residuos" del extractor → (material de la app, tratamiento de la app).
# None = se excluye de los totales.
MAPPING = {
    'Reciclaje Cartón':                ('carton', 'reciclaje'),
    'Reciclaje papel':                 ('papel', 'reciclaje'),
    'Reciclaje Film':                  ('film', 'reciclaje'),
    'Reciclaje PET':                   ('pet', 'reciclaje'),
    'Reciclaje Vidrio':                ('vidrio', 'reciclaje'),
    'Reciclaje Metal':                 ('metales', 'reciclaje'),
    'Reciclaje Mixto':                 ('mixto', 'reciclaje'),
    'Plástico duro':                   ('plastico_duro', 'reciclaje'),
    # Criterio del cliente: todos los orgánicos van a compostaje.
    'Residuos orgánicos':              ('organicos', 'compostaje'),
    # Criterio del cliente: los "generales valorizables" se suman a los residuos generales.
    'Residuos Generales Valorizables': ('no_aprovechables', 'disposicion'),
    'Residuos Generales':              ('no_aprovechables', 'disposicion'),
    # Madera valorizable: es un reciclable más (como el cartón o el metal), suma a los totales y a la
    # valorización. No confundir con la madera NO valorizable (más abajo), que es memo.
    'Madera Valorizables':             ('madera_v', 'reciclaje'),
    # Madera NO valorizable: ya forma parte de los residuos generales. Se guarda como dato de
    # referencia ("memo": material madera_nv) para saber qué fracción de los generales representa,
    # pero la app NO la suma a los totales.
    'Madera NO Valorizables':          ('madera_nv', 'disposicion'),
}
EXCLUDED_TYPES = []  # ningún tipo se excluye por completo (la madera valorizable dejó de excluirse: ver MAPPING)

# SUPUESTO: giro de cada cliente, inferido del nombre comercial (editable en "Sedes y empresas").
FORMATS = {
    'Casa Andina AQP': 'Hotel',
    'Farmacias Peruanas AQP': 'Farmacia',
    'Innova Schools AQP': 'Colegio',
    'Makro AQP': 'Mayorista',
    'Oechsle AQP': 'Tienda por departamento',
    'Oslo CD AQP': 'Centro de distribución',
    'Plaza Vea AQP': 'Supermercado',
    'Promart AQP': 'Mejoramiento del hogar',
    'Real Plaza AQP': 'Centro comercial',
    'UTP AQP': 'Universidad',
}

# Empresa (entidad que ve sus resultados en la pestaña "Por empresa") de cada cliente del extractor.
# Supermercados Peruanos agrupa a Makro, Plaza Vea y Oslo.
COMPANY = {
    'Casa Andina AQP': 'Casa Andina',
    'Farmacias Peruanas AQP': 'Farmacias Peruanas',
    'Innova Schools AQP': 'Innova Schools',
    'Makro AQP': 'Supermercados Peruanos',
    'Oechsle AQP': 'Oechsle',
    'Oslo CD AQP': 'Supermercados Peruanos',
    'Plaza Vea AQP': 'Supermercados Peruanos',
    'Promart AQP': 'Promart',
    'Real Plaza AQP': 'Real Plaza',
    'UTP AQP': 'UTP',
}

d = pd.read_excel(SRC, sheet_name='Data del Extractor')
d.columns = ['fecha', 'anio', 'mes', 'cliente', 'sede', 'tipo', 'consol', 'destino', 'kg']
d['cliente'] = d['cliente'].map(lambda s: ' '.join(str(s).split()))   # "Farmacias Peruanas  AQP" (doble espacio)
d['sede'] = d['sede'].map(lambda s: ' '.join(str(s).split()))
d['periodo'] = d['anio'].astype(str) + '-' + d['mes'].astype(str).str.zfill(2)

unknown = sorted(set(d['tipo']) - set(MAPPING))
assert not unknown, f'Tipos de residuo sin mapear: {unknown}'
unknown_c = sorted(set(d['cliente']) - set(FORMATS) - set(COMPANY))
assert not unknown_c, f'Clientes sin formato o empresa: {unknown_c}'

# Sedes: una por cliente + sede (el nombre de sede se repite entre clientes: "Principal", "Yanahuara"…)
pairs = sorted(d[['cliente', 'sede']].drop_duplicates().itertuples(index=False), key=lambda r: (r.cliente.lower(), r.sede.lower()))
sites, site_id = [], {}
for i, (cliente, sede) in enumerate(pairs, start=1):
    sid = f'S{i:02d}'
    site_id[(cliente, sede)] = sid
    sites.append({'id': sid, 'name': f'{cliente} · {sede}', 'company': COMPANY[cliente], 'format': FORMATS[cliente], 'district': '', 'status': 'Activo'})

d['material'] = d['tipo'].map(lambda t: MAPPING[t][0] if MAPPING[t] else None)
d['tratamiento'] = d['tipo'].map(lambda t: MAPPING[t][1] if MAPPING[t] else None)
d['site'] = [site_id[(c, s)] for c, s in zip(d['cliente'], d['sede'])]

excluded = d[d['tipo'].isin(EXCLUDED_TYPES)]
kept = d[d['material'].notna()]      # incluye la madera no valorizable (memo)
agg = (kept.groupby(['periodo', 'site', 'material', 'tratamiento'], as_index=False)['kg'].sum()
       .assign(kg=lambda x: x['kg'].round(2)))
agg = agg[agg['kg'] > 0].sort_values(['periodo', 'site', 'material', 'tratamiento'])

records = [[r.periodo, r.site, r.material, r.tratamiento, float(r.kg)] for r in agg.itertuples()]
payload = {
    'meta': {
        'fuente': SRC.name,
        'filas_origen': int(len(d)),
        'excluido': {'tipo': 'Madera Valorizables', 'filas': int(len(excluded)), 'kg': round(float(excluded['kg'].sum()), 1)},
    },
    'sites': sites,
    'records': records,
}
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

# ---- Conciliación ----
memo = agg[agg.material == 'madera_nv']
main = agg[agg.material != 'madera_nv']
gen = main[main.material == 'no_aprovechables']
tot_src = d['kg'].sum(); tot_main = main['kg'].sum()
val = main[main.tratamiento != 'disposicion']['kg'].sum()
print(f'Filas origen: {len(d):,} · sedes: {len(sites)} · clientes: {d.cliente.nunique()} · periodos: {d.periodo.nunique()} ({d.periodo.min()} → {d.periodo.max()})')
print(f'Total origen:                   {tot_src:>14,.1f} kg')
print(f'Excluido (Madera Valorizables): {excluded["kg"].sum():>11,.1f} kg en {len(excluded)} filas')
print(f'Madera NO valorizable (memo, incluida en generales, no suma): {memo.kg.sum():,.1f} kg')
print(f'Total del demo (sin memo):      {tot_main:>14,.1f} kg   (origen − madera valorizable − madera no valorizable = {tot_src - excluded.kg.sum() - memo.kg.sum():,.1f})')
print(f'Valorizado: {val:,.1f} kg = {val / tot_main * 100:.1f} %')
print(f'Residuos generales (incluye generales valorizables): {gen.kg.sum():,.1f} kg · madera NV = {memo.kg.sum() / gen.kg.sum() * 100:.1f} % de los generales')
by_company = (pd.DataFrame(sites).groupby('company')['id'].apply(list)).to_dict()
print('Empresas:', {k: len(v) for k, v in by_company.items()})
assert abs(agg.kg.sum() - (tot_src - excluded.kg.sum())) < 1, 'La conciliación no cuadra'
print(f'Registros mensuales generados: {len(records):,} (incluye {len(memo)} de madera NV) · archivo: {OUT.stat().st_size / 1024:.0f} KB')
