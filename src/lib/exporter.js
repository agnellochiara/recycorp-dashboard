// Exportación de gráficos (PNG) y reportes (PDF) a partir del DOM renderizado.

function rgb(varName) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  const [r, g, b] = v.split(/\s+/).map(Number);
  return `rgb(${r}, ${g}, ${b})`;
}

export async function saveBlob(blob, filename) {
  if (typeof window !== 'undefined' && window.claude?.use) {
    try {
      const downloads = await window.claude.use('downloads');
      if (downloads?.save) { await downloads.save(blob, filename); return; }
    } catch { /* usar el método estándar */ }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function saveText(text, filename) {
  await saveBlob(new Blob([text], { type: 'text/csv;charset=utf-8' }), filename);
}

// html2canvas no hereda bien los estilos calculados de los SVG de Recharts: se inlinean en la copia.
function inlineSvgStyles(clonedDoc) {
  clonedDoc.querySelectorAll('svg *').forEach((el) => {
    const cs = window.getComputedStyle(el);
    ['fill', 'stroke', 'stroke-width', 'opacity', 'font-family', 'font-size', 'font-weight'].forEach((p) => {
      const v = cs.getPropertyValue(p);
      if (v) el.style.setProperty(p, v);
    });
  });
}

// html2canvas recorta el texto con `truncate` (overflow hidden + line-height ajustado): en la copia se deja visible.
function fixTruncate(clonedDoc) {
  clonedDoc.querySelectorAll('.truncate').forEach((el) => {
    el.style.overflow = 'visible';
    el.style.textOverflow = 'clip';
    el.style.paddingBottom = '2px';
  });
}

async function capture(node) {
  const { default: html2canvas } = await import('html2canvas');
  document.documentElement.classList.add('exporting');
  try {
    return await html2canvas(node, {
      scale: Math.min(2, window.devicePixelRatio > 1 ? 2 : 1.5),
      backgroundColor: rgb('--surface'),
      useCORS: true,
      logging: false,
      onclone: (doc) => { inlineSvgStyles(doc); fixTruncate(doc); },
    });
  } finally {
    document.documentElement.classList.remove('exporting');
  }
}

export async function exportNodePng(node, filename) {
  const canvas = await capture(node);
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
  await saveBlob(blob, filename);
}

/** Arma un PDF A4 con un título, líneas de resumen y todos los bloques `[data-export]` dentro de `container`. */
export async function exportReportPdf(container, { title, summaryLines = [], filename }) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = pdf.internal.pageSize.getWidth(); const H = pdf.internal.pageSize.getHeight();
  const M = 28; const innerW = W - M * 2;
  let y = M;

  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(16); pdf.setTextColor(20, 20, 20);
  pdf.text(title, M, y + 14); y += 28;
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(90, 90, 90);
  for (const line of summaryLines) { pdf.text(line, M, y); y += 13; }
  y += 6;

  const blocks = [...container.querySelectorAll('[data-export]')];

  // 1) Se captura cada bloque y se mide su ancho relativo en pantalla, para respetar la disposición del panel
  //    (p. ej. dos gráficos lado a lado) en lugar de estirarlos todos al ancho de la página.
  const cw = container.getBoundingClientRect().width || 1;
  const GAP = 8;
  const items = [];
  for (const node of blocks) {
    const canvas = await capture(node);
    const frac = Math.min(1, node.getBoundingClientRect().width / cw);
    items.push({ canvas, frac, ratio: canvas.height / canvas.width });
  }

  // 2) Agrupar en filas: los bloques consecutivos que caben en el ancho de la página van en la misma fila.
  const rows = [];
  let cur = [];
  const rowFrac = (r) => r.reduce((sum, it) => sum + it.frac, 0) + ((r.length - 1) * GAP) / innerW;
  for (const it of items) {
    if (cur.length && rowFrac([...cur, it]) > 1.01) { rows.push(cur); cur = []; }
    cur.push(it);
  }
  if (cur.length) rows.push(cur);

  // 3) Colocar filas; una fila que no cabe pasa a la página siguiente (o se reduce un poco si casi cabe).
  const maxH = H - M * 2;
  for (const row of rows) {
    const sized = row.map((it) => { const w = it.frac * innerW; return { ...it, w, h: it.ratio * w }; });
    let rowH = Math.max(...sized.map((it) => it.h));
    let k = 1;
    if (rowH > maxH) k = maxH / rowH;
    if (y + rowH * k > H - M) {
      const fit = (H - M - y) / rowH;
      if (fit >= 0.75) k = Math.min(k, fit); else { pdf.addPage(); y = M; k = Math.min(1, maxH / rowH); }
    }
    let x = M;
    for (const it of sized) {
      pdf.addImage(it.canvas.toDataURL('image/jpeg', 0.92), 'JPEG', x, y, it.w * k, it.h * k);
      x += it.w * k + GAP;
    }
    rowH *= k;
    y += rowH + 12;
  }

  await saveBlob(pdf.output('blob'), filename);
}
