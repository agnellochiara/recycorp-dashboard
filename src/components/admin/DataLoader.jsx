// Carga de datos por CSV o Excel: plantilla y exportación descargables en ambos formatos, validación con
// errores por línea (tolerante a variantes de nombres de empresa/sede — ver lib/csv.js), y elección entre
// reemplazar todo el histórico o agregarlo al existente.
import { useRef, useState } from 'react';
import { UploadCloud, Download, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { Button, Segmented, Card } from '../ui.jsx';
import { parseCsvText, validateRows, templateCsv, recordsToCsv, templateRows, recordsToRows, IMPORT_HEADERS } from '../../lib/csv.js';
import { parseExcelFile, downloadRowsXlsx } from '../../lib/excel.js';
import { saveText } from '../../lib/exporter.js';
import { useData } from '../../context/DataContext.jsx';

export default function DataLoader() {
  const { sites, records, memoRecords, replaceRecords, appendRecords } = useData();
  const [mode, setMode] = useState('append');
  const [result, setResult] = useState(null); // {rows, errors, excluded}
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const inputRef = useRef(null);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDone(false);
    const isExcel = /\.xlsx?$/i.test(file.name);
    const raw = isExcel ? await parseExcelFile(file) : parseCsvText(await file.text());
    setResult(validateRows(raw, sites));
    e.target.value = '';
  };

  const apply = async () => {
    if (!result?.rows?.length) return;
    setBusy(true);
    try {
      if (mode === 'replace') await replaceRecords(result.rows);
      else await appendRecords(result.rows);
      setDone(true); setResult(null);
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => downloadRowsXlsx(templateRows(sites), IMPORT_HEADERS, 'plantilla_recycorp.xlsx')}>
          <Download size={14} /> Descargar plantilla (Excel)
        </Button>
        <Button variant="outline" size="sm" onClick={() => downloadRowsXlsx(recordsToRows([...records, ...memoRecords], sites), IMPORT_HEADERS, 'recycorp_datos_actuales.xlsx')}>
          <Download size={14} /> Exportar datos actuales (Excel)
        </Button>
        <Button variant="ghost" size="sm" onClick={() => saveText(templateCsv(sites), 'plantilla_recycorp.csv')}>
          <Download size={14} /> Plantilla CSV
        </Button>
        <Button variant="ghost" size="sm" onClick={() => saveText(recordsToCsv([...records, ...memoRecords], sites), 'recycorp_datos_actuales.csv')}>
          <Download size={14} /> Datos actuales en CSV
        </Button>
      </div>

      <Card className="p-4">
        <p className="text-sm font-medium text-ink mb-2">Importar datos (Excel o CSV)</p>
        <div className="flex items-center gap-3 flex-wrap">
          <Segmented value={mode} onChange={setMode} options={[{ value: 'append', label: 'Agregar al histórico' }, { value: 'replace', label: 'Reemplazar todo' }]} />
          <Button size="sm" onClick={() => inputRef.current?.click()}><UploadCloud size={14} /> Elegir archivo</Button>
          <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={onFile} />
        </div>
        <p className="text-xs text-muted mt-2 flex items-start gap-1.5">
          <Info size={12} className="shrink-0 mt-0.5" />
          Acepta tanto la plantilla de esta plataforma como el Excel original del extractor (columnas de empresa,
          cliente y sede): los nombres se hacen coincidir con lo ya guardado aunque no estén escritos exactamente igual.
        </p>
        {mode === 'replace' && <p className="text-xs text-warn mt-2">Esto reemplaza TODOS los registros existentes por el contenido del archivo.</p>}

        {result && (
          <div className="mt-3 space-y-2">
            <p className="text-sm text-ink">
              <CheckCircle2 size={14} className="inline text-good mr-1" /> {result.rows.length} filas válidas
              {result.excluded > 0 && <span className="text-muted"> · {result.excluded} excluidas (madera valorizable)</span>}
              {result.errors.length > 0 && <span className="text-bad"> · {result.errors.length} con errores</span>}
            </p>
            {result.errors.length > 0 && (
              <div className="max-h-40 overflow-y-auto bg-sunken rounded-lg p-2 space-y-1">
                {result.errors.slice(0, 50).map((e, i) => (
                  <p key={i} className="text-xs text-bad flex gap-1.5"><AlertCircle size={12} className="shrink-0 mt-0.5" /> Línea {e.line}: {e.message}</p>
                ))}
                {result.errors.length > 50 && <p className="text-xs text-muted">… y {result.errors.length - 50} más.</p>}
              </div>
            )}
            <Button onClick={apply} loading={busy} disabled={!result.rows.length}>
              {mode === 'replace' ? 'Reemplazar datos' : 'Agregar al histórico'} ({result.rows.length} filas)
            </Button>
          </div>
        )}
        {done && <p className="text-sm text-good mt-2 flex items-center gap-1.5"><CheckCircle2 size={14} /> Datos actualizados.</p>}
      </Card>
    </div>
  );
}
