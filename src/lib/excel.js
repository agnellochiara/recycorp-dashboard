// Lectura y escritura de archivos Excel (.xlsx) para la carga y descarga de datos históricos: hace para
// Excel lo mismo que lib/csv.js hace para texto CSV, con el mismo formato de filas (encabezados normalizados)
// para poder reutilizar `validateRows` sin importar si el archivo subido fue .csv o .xlsx.
// La librería (pesada, ~0.5 MB) se carga de forma diferida: solo quien entra a Administración → Datos la baja.
import { saveBlob } from './exporter.js';
import { normHeaderKey } from './csv.js';

/** Lee un archivo .xlsx/.xls y devuelve filas como objetos {encabezado_normalizado: valor}. */
export async function parseExcelFile(file) {
  const XLSX = await import('xlsx');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  // Si el libro trae varias hojas (p. ej. el Excel del extractor), se prioriza la que parece tener los datos.
  const sheetName = wb.SheetNames.find((n) => /data|extractor|histor/i.test(n)) || wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
  return json.map((row) => {
    const out = {};
    for (const [k, v] of Object.entries(row)) out[normHeaderKey(k)] = v;
    return out;
  });
}

const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Descarga `rows` (array de objetos planos) como un .xlsx de una sola hoja, con las columnas en `headers`. */
export async function downloadRowsXlsx(rows, headers, filename) {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
  ws['!cols'] = headers.map((h) => ({ wch: Math.max(12, h.length + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Datos');
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  await saveBlob(new Blob([out], { type: MIME_XLSX }), filename);
}
