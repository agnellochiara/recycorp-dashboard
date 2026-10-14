// Widget flotante de preguntas y respuestas. No usa IA generativa: el motor (chatEngine.js) interpreta la
// pregunta y calcula la respuesta con las mismas funciones que alimentan el panel.
import { useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, X, Send, Sparkles } from 'lucide-react';
import { createEngine } from '../lib/chatEngine.js';

function TableView({ table }) {
  return (
    <div className="overflow-x-auto mt-1.5 -mx-1">
      <table className="w-full text-[11px] border-collapse">
        <thead><tr>{table.headers.map((h, i) => <th key={i} className="text-left font-medium text-muted px-1.5 py-1 whitespace-nowrap">{h}</th>)}</tr></thead>
        <tbody>
          {table.rows.map((row, i) => (
            <tr key={i} className="border-t border-line/70">
              {row.map((cell, j) => <td key={j} className="px-1.5 py-1 whitespace-nowrap text-ink">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Bubble({ msg }) {
  const mine = msg.role === 'user';
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[88%] rounded-xl px-3 py-2 text-[13px] leading-snug ${mine ? 'bg-brand text-white' : 'bg-sunken text-ink'}`}>
        <p dangerouslySetInnerHTML={{ __html: msg.text.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>') }} />
        {msg.table && <TableView table={msg.table} />}
        {msg.detail?.map((d, i) => <p key={i} className="text-[11px] text-muted mt-1.5 border-t border-line/60 pt-1.5">{d}</p>)}
        {msg.chips?.length > 0 && !mine && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {msg.chips.map((c, i) => (
              <button key={i} type="button" data-chip={c} className="text-[11px] bg-surface border border-line rounded-full px-2.5 py-1 text-ink hover:bg-brand-soft hover:border-brand/30 transition-colors">
                {c}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChatWidget({ records, memoRecords, sites, config, scopeCompany }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState(() => [{ role: 'bot', text: `Hola 👋 Pregúntame lo que quieras sobre ${scopeCompany ? `los datos de **${scopeCompany}**` : 'los datos del panel'}: generación, metas, variaciones o anomalías.`, chips: ['¿Cuánto generamos el último mes?', '¿Cumplimos la meta de valorización?', '¿Hay anomalías recientes?'] }]);
  const scrollRef = useRef(null);
  const engine = useMemo(() => createEngine({ records, memoRecords, sites, config, scopeCompany }), [records, memoRecords, sites, config, scopeCompany]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, open]);

  const ask = (text) => {
    const q = (text ?? input).trim();
    if (!q) return;
    const res = engine.answer(q);
    setMessages((m) => [...m, { role: 'user', text: q }, { role: 'bot', ...res }]);
    setInput('');
  };

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="no-export fixed bottom-5 right-5 z-40 w-12 h-12 rounded-full bg-brand text-white shadow-lg flex items-center justify-center hover:opacity-90"
        aria-label="Abrir chat"
      >
        {open ? <X size={20} /> : <MessageCircle size={20} />}
      </button>

      {open && (
        <div className="no-export fixed bottom-20 right-5 z-40 w-[min(380px,calc(100vw-2.5rem))] h-[min(560px,calc(100vh-7rem))] bg-surface border border-line rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-line bg-brand-soft/40">
            <Sparkles size={15} className="text-brand" />
            <div>
              <p className="text-sm font-semibold text-ink leading-tight">Asistente de datos</p>
              <p className="text-[10px] text-muted leading-tight">Respuestas calculadas, sin IA generativa</p>
            </div>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2.5" onClick={(e) => { const chip = e.target.closest('[data-chip]'); if (chip) ask(chip.dataset.chip); }}>
            {messages.map((m, i) => <Bubble key={i} msg={m} />)}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); ask(); }} className="flex items-center gap-2 p-2.5 border-t border-line">
            <input
              value={input} onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe tu pregunta…"
              className="flex-1 bg-sunken rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
            <button type="submit" className="w-9 h-9 rounded-lg bg-brand text-white flex items-center justify-center shrink-0 disabled:opacity-40" disabled={!input.trim()}>
              <Send size={15} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
