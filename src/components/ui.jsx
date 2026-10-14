// Primitivas visuales reutilizadas por todo el panel: tarjetas, botones, selects, modal, badges, toggles.
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, X, Loader2, Check } from 'lucide-react';

export function Card({ className = '', children, exportBlock = false, ...rest }) {
  return (
    <div className={`bg-surface border border-line rounded-2xl ${className}`} {...(exportBlock ? { 'data-export': true } : {})} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action, icon: Icon }) {
  return (
    <div className="flex items-start justify-between gap-3 p-4 pb-2">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {Icon && <Icon size={16} className="text-brand shrink-0" />}
          <h3 className="font-display font-semibold text-[15px] text-ink truncate">{title}</h3>
        </div>
        {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function Button({ variant = 'default', size = 'md', className = '', children, loading = false, disabled, ...rest }) {
  const base = 'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap';
  const sizes = { sm: 'text-xs px-2.5 py-1.5', md: 'text-sm px-3.5 py-2', lg: 'text-sm px-4 py-2.5' };
  const variants = {
    default: 'bg-brand text-white hover:opacity-90',
    secondary: 'bg-sunken text-ink hover:bg-line',
    outline: 'border border-line text-ink hover:bg-sunken bg-transparent',
    ghost: 'text-ink hover:bg-sunken bg-transparent',
    danger: 'bg-bad text-white hover:opacity-90',
  };
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} disabled={disabled || loading} {...rest}>
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  );
}

export function Badge({ tone = 'neutral', children, className = '' }) {
  const tones = {
    neutral: 'bg-sunken text-muted', good: 'bg-good/10 text-good', bad: 'bg-bad/10 text-bad',
    warn: 'bg-warn/10 text-warn', brand: 'bg-brand-soft text-brand',
  };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${tones[tone]} ${className}`}>{children}</span>;
}

export function Select({ value, onChange, options, placeholder = 'Seleccionar…', className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none bg-sunken border border-line rounded-lg text-sm pl-3 pr-8 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-brand/30"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
    </div>
  );
}

export function Segmented({ value, onChange, options, className = '' }) {
  return (
    <div className={`inline-flex rounded-lg bg-sunken p-1 ${className}`}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${value === o.value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
      <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${checked ? 'bg-brand' : 'bg-line'}`} onClick={() => onChange(!checked)}>
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
      </span>
      {label && <span className="text-sm text-ink">{label}</span>}
    </label>
  );
}

export function Modal({ open, onClose, title, children, width = 'max-w-lg' }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div ref={ref} className={`w-full ${width} bg-surface border border-line rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between p-4 border-b border-line sticky top-0 bg-surface">
          <h2 className="font-display font-semibold text-base">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-sunken text-muted"><X size={18} /></button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

export function Empty({ title = 'Sin datos', subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      {subtitle && <p className="text-xs text-muted mt-1 max-w-xs">{subtitle}</p>}
    </div>
  );
}

export function Spinner({ label = 'Cargando…' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-muted text-sm">
      <Loader2 size={16} className="animate-spin" /> {label}
    </div>
  );
}

export function MultiSelect({ value = [], onChange, options, placeholder = 'Todos' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  const toggle = (v) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  // En este panel, no seleccionar nada en un filtro equivale a "todos": un único botón "Todos" alcanza para
  // volver a ver todo sin desmarcar uno por uno, en vez de ofrecer también un botón "Ninguno" sin sentido aquí.
  const selectAll = () => { onChange([]); setOpen(false); };
  const label = value.length === 0 ? placeholder : value.length === 1 ? options.find((o) => o.value === value[0])?.label : `${value.length} seleccionados`;
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="flex items-center justify-between gap-2 w-full bg-sunken border border-line rounded-lg text-sm px-3 py-2 text-ink min-w-[140px]">
        <span className="truncate">{label}</span>
        <ChevronDown size={14} className="text-muted shrink-0" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-56 bg-surface border border-line rounded-lg shadow-lg p-1 flex flex-col">
          <button
            onClick={selectAll}
            className={`flex items-center justify-between px-2 py-1.5 rounded-md text-sm font-medium shrink-0 ${value.length === 0 ? 'text-brand bg-brand-soft/60' : 'text-ink hover:bg-sunken'}`}
          >
            {placeholder}
            {value.length === 0 && <Check size={14} />}
          </button>
          <div className="h-px bg-line my-1 shrink-0" />
          <div className="overflow-y-auto max-h-56">
            {options.map((o) => (
              <label key={o.value} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-sunken cursor-pointer text-sm">
                <input type="checkbox" checked={value.includes(o.value)} onChange={() => toggle(o.value)} className="accent-brand" />
                <span className="truncate">{o.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
