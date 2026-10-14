import { Recycle, Sun, Moon, Download, FileDown, LogIn, LogOut, Settings, Database } from 'lucide-react';
import { Button, Segmented } from './ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Header({ unit, setUnit, theme, setTheme, onLogin, onOpenAdmin, onExportPng, onExportPdf, exporting }) {
  const { isAdmin, signOut, loading } = useAuth();

  return (
    <header className="sticky top-0 z-30 bg-surface/90 backdrop-blur border-b border-line no-export">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-brand text-white flex items-center justify-center shrink-0">
            <Recycle size={18} />
          </div>
          <div className="min-w-0">
            <h1 className="font-display font-bold text-base leading-tight truncate">Recycorp</h1>
            <p className="text-[11px] text-muted leading-tight">Gestión de residuos y valorización</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Segmented value={unit} onChange={setUnit} options={[{ value: 'kg', label: 'kg' }, { value: 't', label: 't' }]} className="hidden sm:inline-flex" />

          <Button variant="ghost" size="sm" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title="Cambiar tema">
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </Button>

          <Button variant="outline" size="sm" onClick={onExportPng} loading={exporting === 'png'} title="Exportar gráfico como imagen" className="hidden sm:inline-flex">
            <Download size={14} /> PNG
          </Button>
          <Button variant="outline" size="sm" onClick={onExportPdf} loading={exporting === 'pdf'} title="Exportar reporte como PDF">
            <FileDown size={14} /> PDF
          </Button>

          {!loading && (isAdmin ? (
            <>
              <Button variant="secondary" size="sm" onClick={onOpenAdmin} title="Panel de administración">
                <Settings size={14} /> <span className="hidden sm:inline">Administrar</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={signOut} title="Cerrar sesión"><LogOut size={14} /></Button>
            </>
          ) : (
            <Button variant="secondary" size="sm" onClick={onLogin}>
              <LogIn size={14} /> <span className="hidden sm:inline">Ingresar</span>
            </Button>
          ))}
        </div>
      </div>
    </header>
  );
}

export function DataSourceBadge({ mode }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-muted">
      <Database size={11} /> {mode === 'demo' ? 'Modo demo (datos locales)' : 'Conectado a Supabase'}
    </span>
  );
}
