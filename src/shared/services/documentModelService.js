export const A4_WIDTH = 595;
export const A4_HEIGHT = 842;
export const DOCUMENT_ROWS_PER_PAGE = 20;

export function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function numberValue(value) {
  if (value === '' || value === null || value === undefined) return 0;
  const parsed = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function documentMoney(value, currency = 'JPY') {
  if (value === '' || value === null || value === undefined) return '-';
  const text = numberValue(value).toLocaleString('ja-JP');
  return currency === 'JPY' ? `${text}円` : `${text} ${currency}`;
}

export function truncateText(value = '', length = 28) {
  const text = String(value || '');
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

export function sanitizeFilePart(value = '') {
  return String(value || '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '_')
    .slice(0, 80);
}

export function chunkDocumentRows(lines, size = DOCUMENT_ROWS_PER_PAGE) {
  const chunks = [];
  for (let index = 0; index < lines.length; index += size) {
    chunks.push(lines.slice(index, index + size));
  }
  return chunks.length > 0 ? chunks : [[]];
}

export function renderDocumentShell({
  className = '',
  pageClassName = 'document-page',
  styles = '',
  pagesHtml = '',
  extraHtml = '',
} = {}) {
  return `
    <article class="quote-preview-document quote-a4-preview ${escapeHtml(className)}">
      <style>
        .quote-a4-preview { width: min(100%, 794px); background: #f3f4f6; color: #111827; border: 1px solid #dbe3ef; border-radius: 8px; padding: 16px; font-family: "Yu Gothic", "Meiryo", system-ui, sans-serif; box-sizing: border-box; }
        .${pageClassName} { min-height: 1123px; background: #fff; padding: 32px; box-sizing: border-box; page-break-after: always; }
        .${pageClassName}:last-child { page-break-after: auto; }
        .document-header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #1d4ed8; padding-bottom: 14px; margin-bottom: 14px; }
        .document-title { text-align: center; font-size: 24px; letter-spacing: .12em; margin: 12px 0; }
        .document-meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 18px; margin: 12px 0; font-size: 12px; }
        .document-recipient { grid-column: 1 / -1; line-height: 1.7; font-size: 13px; }
        .document-table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 8.5pt; }
        .document-table th, .document-table td { border-bottom: 1px solid #d1d5db; padding: 5px 4px; text-align: left; vertical-align: top; }
        .document-table th { background: #eff6ff; color: #1e3a8a; font-weight: 700; }
        .document-table .num, .document-table .money { text-align: right; }
        .document-summary { display: grid; gap: 24px; margin-top: 16px; }
        .document-total div { display: flex; justify-content: space-between; border-bottom: 1px solid #e5e7eb; padding: 5px 0; }
        .document-total strong { font-size: 15px; }
        .document-conditions { font-size: 10pt; line-height: 1.7; }
        .document-footer { margin-top: 10px; text-align: right; font-size: 9pt; color: #6b7280; }
        @media (max-width: 767px) { .quote-a4-preview { padding: 8px; } .${pageClassName} { padding: 14px; min-height: auto; overflow-x: auto; } .document-summary { grid-template-columns: 1fr !important; } }
        ${styles}
      </style>
      ${pagesHtml}
      ${extraHtml}
    </article>
  `;
}

function utf16Hex(value = '') {
  return [...String(value)].map((char) => {
    const code = char.codePointAt(0);
    if (code > 0xffff) {
      const high = Math.floor((code - 0x10000) / 0x400) + 0xd800;
      const low = ((code - 0x10000) % 0x400) + 0xdc00;
      return `${high.toString(16).padStart(4, '0')}${low.toString(16).padStart(4, '0')}`;
    }
    return code.toString(16).padStart(4, '0');
  }).join('');
}

function textOp({ text, x, y, size = 9 }) {
  if (!text) return '';
  return `BT /F1 ${size} Tf 1 0 0 1 ${x} ${y} Tm <${utf16Hex(text)}> Tj ET`;
}

export function buildUnicodePdf(pages) {
  const objects = [];
  const catalogId = 1;
  const pagesId = 2;
  const fontId = 3;
  const cidFontId = 4;
  const descriptorId = 5;
  const pageIds = [];

  objects[catalogId] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[fontId] = `<< /Type /Font /Subtype /Type0 /BaseFont /HeiseiKakuGo-W5 /Encoding /UniJIS-UCS2-H /DescendantFonts [${cidFontId} 0 R] >>`;
  objects[cidFontId] = `<< /Type /Font /Subtype /CIDFontType0 /BaseFont /HeiseiKakuGo-W5 /CIDSystemInfo << /Registry (Adobe) /Ordering (Japan1) /Supplement 5 >> /FontDescriptor ${descriptorId} 0 R >>`;
  objects[descriptorId] = '<< /Type /FontDescriptor /FontName /HeiseiKakuGo-W5 /Flags 4 /FontBBox [0 -200 1000 900] /ItalicAngle 0 /Ascent 880 /Descent -120 /CapHeight 700 /StemV 80 >>';

  pages.forEach((lines) => {
    const pageId = objects.length;
    const contentId = pageId + 1;
    pageIds.push(pageId);
    const content = [
      '0.15 w',
      '40 700 m 555 700 l S',
      ...lines.map(textOp).filter(Boolean),
    ].join('\n');
    objects[pageId] = `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${A4_WIDTH} ${A4_HEIGHT}] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  });

  objects[pagesId] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let index = 1; index < objects.length; index += 1) {
    offsets[index] = pdf.length;
    pdf += `${index} 0 obj\n${objects[index]}\nendobj\n`;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let index = 1; index < objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return pdf;
}

export function createPdfFileFromPages(pages, fileName) {
  const pdf = buildUnicodePdf(pages);
  const blob = new Blob([pdf], { type: 'application/pdf' });
  return new File([blob], fileName, { type: 'application/pdf' });
}
