import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Building2 } from 'lucide-react';
import { useData } from '../context/DataContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import Header from './Header.jsx';
import LoginModal from './LoginModal.jsx';
import AdminPanel from './admin/AdminPanel.jsx';
import FilterBar from './FilterBar.jsx';
import KpiCards from './KpiCards.jsx';
import Analysis from './Analysis.jsx';
import FluctuationSection from './FluctuationSection.jsx';
import ChatWidget from './ChatWidget.jsx';
import RateChart from './charts/RateChart.jsx';
import TrendChart, { AnomalyStrip } from './charts/TrendChart.jsx';
import CompositionChart from './charts/CompositionChart.jsx';
import BenchmarkChart from './charts/BenchmarkChart.jsx';
import FlowSection from './FlowSection.jsx';
import ImpactEquivalents from './ImpactEquivalents.jsx';
import { Card, CardHeader, Segmented, Spinner, Empty } from './ui.jsx';
import { filterRecords, summarize, monthlyKpis, byMaterial, flowMatrix, bySite, byCompany, distinctPeriods } from '../lib/calc.js';
import { MATERIAL_BY_ID } from '../lib/constants.js';
import { fluctuation, detectAnomalies, anomaliesInFilters, anomalyCountByPeriod } from '../lib/analytics.js';
import { goalForRecords } from '../lib/goals.js';
import { computeImpact } from '../lib/impact.js';
import { periodLabel } from '../lib/format.js';
import { exportNodePng, exportReportPdf } from '../lib/exporter.js';

const slugify = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// Qué se compara en los rankings de sedes/empresas: la tasa de valorización, o el volumen generado —
// de todo, o solo de una categoría de residuo (para responder "quién genera más reciclables/orgánicos/generales").
const BENCH_METRICS = [
  { value: 'rate', label: '% Valorización' },
  { value: 'total', label: 'Volumen total' },
  { value: 'aprovechables', label: 'Reciclables' },
  { value: 'organicos', label: 'Orgánicos' },
  { value: 'no_aprovechables', label: 'Generales' },
];
const benchSubtitle = (metric) => BENCH_METRICS.find((m) => m.value === metric)?.label || 'Tasa de valorización';

function readHash(companies) {
  const m = window.location.hash.match(/^#\/empresa\/(.+)$/);
  if (!m) return { tab: 'overview', company: null };
  const slug = decodeURIComponent(m[1]);
  const company = companies.find((c) => slugify(c) === slug);
  return company ? { tab: 'company', company } : { tab: 'overview', company: null };
}

export default function Dashboard() {
  const { loading, error, sites, records, memoRecords, config, siteById, filters, setFilters, mode, reload } = useData();
  const { isAdmin } = useAuth();
  const [{ tab, company }, setRoute] = useState(() => readHash(config?.companies || []));
  const [unit, setUnit] = useState('t');
  const [benchMetric, setBenchMetric] = useState('rate');
  const [theme, setTheme] = useState(() => (document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'));
  const [loginOpen, setLoginOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [exporting, setExporting] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); try { localStorage.setItem('recycorp_theme', theme); } catch { /* ignorar */ } }, [theme]);
  useEffect(() => { try { const saved = localStorage.getItem('recycorp_theme'); if (saved) setTheme(saved); } catch { /* ignorar */ } }, []);

  useEffect(() => {
    const onHash = () => setRoute(readHash(config?.companies || []));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [config]);
  // Si el enlace llegó con una empresa en el hash antes de que los datos terminaran de cargar, se resuelve aquí.
  useEffect(() => { if (config?.companies?.length) setRoute((r) => (r.company ? r : readHash(config.companies))); }, [config]);

  const goOverview = useCallback(() => { window.location.hash = '#/'; setRoute({ tab: 'overview', company: null }); }, []);
  // Al cambiar de empresa se limpia el filtro de sede: una sede elegida para otra empresa no aplica aquí y
  // dejaría la selección vacía en silencio si se mantuviera.
  const goCompany = useCallback((c) => {
    window.location.hash = `#/empresa/${encodeURIComponent(slugify(c))}`;
    if (c !== company) setFilters((f) => ({ ...f, sites: [] }));
    setRoute({ tab: 'company', company: c });
  }, [company, setFilters]);

  const scoped = useMemo(() => {
    if (tab !== 'company' || !company) return { records, memoRecords, sites };
    const ids = new Set(sites.filter((s) => s.company === company).map((s) => s.id));
    return { records: records.filter((r) => ids.has(r.s)), memoRecords: memoRecords.filter((r) => ids.has(r.s)), sites: sites.filter((s) => s.company === company) };
  }, [tab, company, records, memoRecords, sites]);

  const filtered = useMemo(() => filterRecords(scoped.records, filters), [scoped.records, filters]);
  const forFluct = useMemo(() => filterRecords(scoped.records, filters, { skipPeriod: true }), [scoped.records, filters]);
  const coverageScope = useMemo(() => (filters.sites.length ? scoped.records.filter((r) => filters.sites.includes(r.s)) : scoped.records), [scoped.records, filters.sites]);
  const filteredMemo = useMemo(() => filterRecords(scoped.memoRecords, { ...filters, materials: [], treatments: [] }), [scoped.memoRecords, filters]);

  const summary = useMemo(() => summarize(filtered, config), [filtered, config]);
  const goal = useMemo(() => goalForRecords(filtered, siteById, config), [filtered, siteById, config]);
  const monthly = useMemo(() => monthlyKpis(filtered, config), [filtered, config]);
  const matByMaterial = useMemo(() => byMaterial(filtered), [filtered]);
  const matrix = useMemo(() => flowMatrix(filtered), [filtered]);
  const benchRecords = useMemo(
    () => (benchMetric === 'rate' || benchMetric === 'total' ? filtered : filtered.filter((r) => MATERIAL_BY_ID[r.m]?.category === benchMetric)),
    [filtered, benchMetric]
  );
  const siteRows = useMemo(() => bySite(benchRecords, scoped.sites), [benchRecords, scoped.sites]);
  const companyRows = useMemo(() => byCompany(benchRecords, scoped.sites), [benchRecords, scoped.sites]);
  const impact = useMemo(() => computeImpact(filtered, summary.co2, config.factors.equiv), [filtered, summary.co2, config.factors.equiv]);
  const fluct = useMemo(() => fluctuation(forFluct, coverageScope), [forFluct, coverageScope]);
  const allAnomalies = useMemo(() => detectAnomalies(forFluct, siteById), [forFluct, siteById]);
  const anomalies = useMemo(() => anomaliesInFilters(allAnomalies, filters), [allAnomalies, filters]);
  const countByPeriod = useMemo(() => anomalyCountByPeriod(allAnomalies), [allAnomalies]);

  const memoInfo = useMemo(() => {
    const kg = filteredMemo.reduce((s, r) => s + r.kg, 0);
    if (!kg) return null;
    const gen = matByMaterial.find((m) => m.id === 'no_aprovechables')?.kg || 0;
    return { wood: kg, gen: Math.max(gen, 1) };
  }, [filteredMemo, matByMaterial]);

  const periods = useMemo(() => distinctPeriods(filtered), [filtered]);
  const range = periods.length ? `${periodLabel(periods[0], true)} – ${periodLabel(periods[periods.length - 1], true)}` : 'sin datos';
  const siteCount = new Set(filtered.map((r) => r.s)).size;

  const doExportPng = async () => { setExporting('png'); try { await exportNodePng(containerRef.current, `recycorp_${tab}_${Date.now()}.png`); } finally { setExporting(null); } };
  const doExportPdf = async () => {
    setExporting('pdf');
    try {
      await exportReportPdf(containerRef.current, {
        title: `Recycorp · ${tab === 'company' ? company : 'Visión general'}`,
        summaryLines: [`Período: ${range}`, `Total generado: ${summary.total.toFixed(0)} kg · Valorización: ${summary.valRate.toFixed(1)}%`],
        filename: `recycorp_${tab === 'company' ? slugify(company) : 'general'}_${Date.now()}.pdf`,
      });
    } finally { setExporting(null); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Spinner label="Cargando datos de Recycorp…" /></div>;
  if (error) return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="p-6 max-w-sm text-center">
        <p className="text-sm text-bad mb-3">{error}</p>
        <button onClick={reload} className="text-sm text-brand font-medium">Reintentar</button>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen pb-24">
      <Header unit={unit} setUnit={setUnit} theme={theme} setTheme={setTheme} onLogin={() => setLoginOpen(true)} onOpenAdmin={() => setAdminOpen(true)} onExportPng={doExportPng} onExportPdf={doExportPdf} exporting={exporting} />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5 space-y-5" ref={containerRef}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented
            value={tab} onChange={(v) => (v === 'overview' ? goOverview() : goCompany(company || config.companies[0]))}
            options={[{ value: 'overview', label: 'Visión general' }, { value: 'company', label: 'Por empresa' }]}
          />
          <FilterBar filters={filters} setFilters={setFilters} records={scoped.records} sites={sites} companyScope={tab === 'company' ? company : null} />
        </div>

        {tab === 'company' && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-export">
            {config.companies.map((c) => (
              <button
                key={c} onClick={() => goCompany(c)}
                className={`flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${c === company ? 'bg-brand text-white' : 'bg-sunken text-muted hover:text-ink'}`}
              >
                <Building2 size={13} /> {c}
              </button>
            ))}
          </div>
        )}

        {!filtered.length ? (
          <Card className="p-10"><Empty title="Sin registros para esta selección" subtitle="Ajusta los filtros o elige otra empresa." /></Card>
        ) : (
          <>
            <KpiCards records={filtered} filters={filters} summary={summary} goal={goal} unit={unit} />

            {memoInfo && (
              <Card className="p-3 flex items-center gap-2 text-xs text-muted bg-sunken/50" exportBlock>
                Madera no valorizable (referencia, ya incluida en residuos generales): <b className="text-ink">{memoInfo.wood.toLocaleString('es-PE', { maximumFractionDigits: 0 })} kg</b> · {((memoInfo.wood / memoInfo.gen) * 100).toFixed(1)}% de los residuos generales.
              </Card>
            )}

            <ImpactEquivalents impact={impact} />

            <div className="grid lg:grid-cols-2 gap-4">
              <Card exportBlock>
                <CardHeader title="Valorización vs. meta" subtitle={tab === 'company' ? `Meta propia de ${company}` : 'Sin mezclar metas de segmentos distintos'} />
                <div className="px-4 pb-4"><RateChart records={filtered} siteById={siteById} sites={scoped.sites} config={config} unit={unit} fixedCompany={tab === 'company' ? company : null} /></div>
              </Card>
              <Card exportBlock>
                <CardHeader title="Generación mensual" subtitle="Valorizado vs. no valorizado" />
                <div className="px-4 pb-2">
                  <TrendChart data={monthly} unit={unit} anomalyCountByPeriod={countByPeriod} />
                  <AnomalyStrip data={monthly} anomalyCountByPeriod={countByPeriod} />
                </div>
              </Card>
            </div>

            <Card exportBlock>
              <CardHeader title="Composición por material" />
              <div className="px-4 pb-4"><CompositionChart byMaterial={matByMaterial} unit={unit} total={summary.total} /></div>
            </Card>

            <Card exportBlock>
              <CardHeader
                title={tab === 'company' ? `Ranking por sede · ${company}` : 'Ranking de empresas'}
                subtitle={benchSubtitle(benchMetric)}
                action={<Segmented value={benchMetric} onChange={setBenchMetric} options={BENCH_METRICS} className="no-export" />}
              />
              <div className="px-4 pb-4">
                <BenchmarkChart rows={tab === 'company' ? siteRows : companyRows} unit={unit} metric={benchMetric === 'rate' ? 'rate' : 'total'} />
              </div>
            </Card>

            {tab === 'overview' && (
              <Card exportBlock>
                <CardHeader title="Ranking de sedes" subtitle={benchSubtitle(benchMetric)} />
                <div className="px-4 pb-4"><BenchmarkChart rows={siteRows} unit={unit} metric={benchMetric === 'rate' ? 'rate' : 'total'} /></div>
              </Card>
            )}

            <FlowSection matrix={matrix} unit={unit} />

            <div className="grid lg:grid-cols-3 gap-4 items-start">
              <div className="lg:col-span-1">
                <Analysis label={tab === 'company' ? company : 'Todas las empresas'} unit={unit} summary={summary} goal={goal} fluct={fluct} anomalies={anomalies} memo={memoInfo} range={range} siteCount={siteCount} />
              </div>
              <div className="lg:col-span-2">
                <FluctuationSection fluct={fluct} anomalies={anomalies} unit={unit} />
              </div>
            </div>
          </>
        )}
      </main>

      <ChatWidget records={scoped.records} memoRecords={scoped.memoRecords} sites={scoped.sites} config={config} scopeCompany={tab === 'company' ? company : null} />
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
      {isAdmin && <AdminPanel open={adminOpen} onClose={() => setAdminOpen(false)} />}

      <footer className="text-center text-[11px] text-muted py-6 no-export">
        Recycorp · {mode === 'demo' ? 'Modo demo' : 'Conectado a Supabase'}
      </footer>
    </div>
  );
}
