import { DELIVERY_NOTE_STATUS_LABELS, normalizeDeliveryNote } from '../hooks/useDeliveryNotes.js';
import { formatPrice } from '../../products/hooks/useProducts.js';

const A4_WIDTH = 595;
const A4_HEIGHT = 842;
const ROWS_PER_PAGE = 20;

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function numberValue(value) {
  if (value === '' || value === null || value === undefined) return 0;
  const parsed = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value) {
  if (value === '' || value === null || value === undefined) return '-';
  return `${numberValue(value).toLocaleString('ja-JP')}円`;
}

function truncate(value = '', length = 28) {
  const text = String(value || '');
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

function sanitizeFilePart(value = '') {
  return String(value || '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '_')
    .slice(0, 80);
}

function chunkLines(lines, size = ROWS_PER_PAGE) {
  const chunks = [];
  for (let index = 0; index < lines.length; index += size) {
    chunks.push(lines.slice(index, index + size));
  }
  return chunks.length > 0 ? chunks : [[]];
}

export function calculateDeliveryNoteTotals(note = {}) {
  const deliveryNote = normalizeDeliveryNote(note, note.userId);
  const lines = deliveryNote.deliveryNoteLines.map((line) => {
    const quantity = numberValue(line.quantity);
    const unitPrice = line.unitPrice === '' ? '' : numberValue(line.unitPrice);
    const amount = line.amount === '' ? (unitPrice === '' ? '' : quantity * unitPrice) : numberValue(line.amount);
    const taxRate = line.taxRate === '' ? '' : numberValue(line.taxRate);
    const taxAmount = line.taxAmount === '' ? (amount === '' || taxRate === '' ? '' : Math.round(amount * (taxRate / 100))) : numberValue(line.taxAmount);
    return { ...line, quantity, unitPrice, amount, taxRate, taxAmount };
  });
  const subtotal = lines.reduce((sum, line) => sum + numberValue(line.amount), 0);
  const taxAmount = lines.reduce((sum, line) => sum + numberValue(line.taxAmount), 0);
  return { lines, subtotal, taxAmount, grandTotal: subtotal + taxAmount };
}

export function buildDeliveryNotePdfContext({ deliveryNote, shipment, salesOrder, customer, issuer }) {
  const note = normalizeDeliveryNote(deliveryNote, deliveryNote.userId);
  const snapshot = note.snapshot || {};
  return {
    deliveryNote: note,
    shipment: shipment || snapshot.shipment || null,
    salesOrder: salesOrder || snapshot.salesOrder || null,
    customer: customer || snapshot.customer || null,
    issuer: issuer || snapshot.issuer || null,
    generatedAt: new Date().toISOString(),
  };
}

function customerName(context) {
  return context.customer?.companyName || context.deliveryNote.snapshot?.customer?.companyName || context.salesOrder?.customerSnapshot?.companyName || '-';
}

function issuerName(context) {
  const issuer = context.issuer || {};
  return issuer.legalName || issuer.name || '営業手帳';
}

function deliveryAddress(context) {
  const shipmentAddress = context.shipment?.deliveryAddressSnapshot;
  return shipmentAddress?.address || context.customer?.address || context.salesOrder?.customerSnapshot?.address || '';
}

function renderHtmlTable(note, lines) {
  const priceVisible = Boolean(note.priceVisible);
  return `
    <table class="delivery-note-table">
      <thead>
        <tr>
          <th style="width: 5%;">No.</th>
          <th style="width: 13%;">商品コード</th>
          <th style="width: 24%;">商品名</th>
          <th style="width: 14%;">規格/荷姿</th>
          <th style="width: 10%;">ロット</th>
          <th style="width: 10%;">賞味期限</th>
          <th style="width: 8%;">数量</th>
          <th style="width: 7%;">単位</th>
          ${priceVisible ? '<th style="width: 10%;">単価</th><th style="width: 11%;">金額</th>' : ''}
        </tr>
      </thead>
      <tbody>
        ${lines.map((line, index) => `
          <tr>
            <td class="num">${index + 1}</td>
            <td>${escapeHtml(line.productCode || '-')}</td>
            <td>${escapeHtml(truncate(line.productName || '-', 34))}</td>
            <td>${escapeHtml(truncate(line.specification || '-', 20))}</td>
            <td>${escapeHtml(line.lotSnapshot?.lotNumber || line.lotSnapshot?.inventoryCode || '-')}</td>
            <td>${escapeHtml(line.expirySnapshot || '')}</td>
            <td class="num">${escapeHtml(formatPrice(line.quantity) || '-')}</td>
            <td>${escapeHtml(line.unit || '-')}</td>
            ${priceVisible ? `<td class="money">${escapeHtml(money(line.unitPrice))}</td><td class="money">${escapeHtml(money(line.amount))}</td>` : ''}
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

export function renderDeliveryNotePreviewHtml(context) {
  const note = normalizeDeliveryNote(context.deliveryNote, context.deliveryNote.userId);
  const totals = calculateDeliveryNoteTotals(note);
  const pages = chunkLines(totals.lines);
  const priceVisible = Boolean(note.priceVisible);

  return `
    <article class="quote-preview-document quote-a4-preview delivery-note-preview-document">
      <style>
        .delivery-note-preview-document { width: min(100%, 794px); background: #f3f4f6; color: #111827; border: 1px solid #dbe3ef; border-radius: 8px; padding: 16px; font-family: "Yu Gothic", "Meiryo", system-ui, sans-serif; box-sizing: border-box; }
        .delivery-note-page { min-height: 1123px; background: #fff; padding: 34px; box-sizing: border-box; page-break-after: always; }
        .delivery-note-page:last-child { page-break-after: auto; }
        .delivery-note-header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #111827; padding-bottom: 14px; margin-bottom: 18px; }
        .delivery-note-title { text-align: center; font-size: 25px; letter-spacing: .18em; margin: 10px 0 18px; }
        .delivery-note-meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 18px; font-size: 12px; margin: 12px 0 18px; }
        .delivery-note-table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 8.5pt; }
        .delivery-note-table th, .delivery-note-table td { border-bottom: 1px solid #d1d5db; padding: 5px 4px; text-align: left; vertical-align: top; }
        .delivery-note-table th { background: #f3f4f6; color: #111827; font-weight: 700; }
        .delivery-note-table .num, .delivery-note-table .money { text-align: right; }
        .delivery-note-total { margin-top: 18px; margin-left: auto; width: 240px; font-size: 10pt; }
        .delivery-note-total div { display: flex; justify-content: space-between; border-bottom: 1px solid #e5e7eb; padding: 5px 0; }
        .delivery-note-footer { margin-top: 18px; font-size: 9pt; color: #4b5563; }
        @media (max-width: 767px) { .delivery-note-preview-document { padding: 8px; } .delivery-note-page { padding: 14px; min-height: auto; overflow-x: auto; } }
      </style>
      ${pages.map((pageLines, pageIndex) => `
        <section class="delivery-note-page">
          <div class="delivery-note-header">
            <div>
              <strong>${escapeHtml(issuerName(context))}</strong><br>
              ${escapeHtml(context.issuer?.address || '')}<br>
              ${escapeHtml([context.issuer?.phone, context.issuer?.email].filter(Boolean).join(' / '))}
            </div>
            <div>
              <div>納品番号: ${escapeHtml(note.deliveryNoteNumber || '-')}</div>
              <div>発行日: ${escapeHtml(note.issueDate || '-')}</div>
              <div>納品日: ${escapeHtml(note.deliveryDate || context.shipment?.plannedDeliveryDate || context.shipment?.shipmentDate || '-')}</div>
              <div>Page ${pageIndex + 1} / ${pages.length}</div>
            </div>
          </div>
          ${pageIndex === 0 ? `
            <h2 class="delivery-note-title">納品書</h2>
            <div class="delivery-note-meta">
              <div><strong>納品先:</strong> ${escapeHtml(customerName(context))}</div>
              <div><strong>出荷番号:</strong> ${escapeHtml(context.shipment?.shipmentNumber || '-')}</div>
              <div><strong>受注番号:</strong> ${escapeHtml(context.salesOrder?.salesOrderNumber || '-')}</div>
              <div><strong>件名:</strong> ${escapeHtml(context.salesOrder?.subject || '-')}</div>
              <div style="grid-column: 1 / -1;"><strong>納品先住所:</strong> ${escapeHtml(deliveryAddress(context) || '-')}</div>
            </div>
          ` : `<h2 class="delivery-note-title">納品書 続き</h2>`}
          ${renderHtmlTable(note, pageLines)}
          ${pageIndex === pages.length - 1 && priceVisible ? `
            <div class="delivery-note-total">
              <div><span>小計</span><span>${escapeHtml(money(totals.subtotal))}</span></div>
              <div><span>消費税</span><span>${escapeHtml(money(totals.taxAmount))}</span></div>
              <div><strong>合計</strong><strong>${escapeHtml(money(totals.grandTotal))}</strong></div>
            </div>
          ` : ''}
          <p class="delivery-note-footer">検品後、内容に相違がある場合は速やかにご連絡ください。</p>
        </section>
      `).join('')}
    </article>
  `;
}

export function createDeliveryNotePdfFile(context) {
  const note = normalizeDeliveryNote(context.deliveryNote, context.deliveryNote.userId);
  const totals = calculateDeliveryNoteTotals(note);
  const pages = chunkLines(totals.lines);
  const priceVisible = Boolean(note.priceVisible);
  const totalPages = pages.length;
  const pdfPages = pages.map((pageLines, pageIndex) => {
    const headerY = pageIndex === 0 ? 645 : 705;
    const lines = [
      { text: '納品書', x: 275, y: 805, size: 16 },
      { text: issuerName(context), x: 40, y: 805, size: 10 },
      { text: context.issuer?.address || '', x: 40, y: 790, size: 8 },
      { text: [context.issuer?.phone, context.issuer?.email].filter(Boolean).join(' / '), x: 40, y: 777, size: 8 },
      { text: `納品番号: ${note.deliveryNoteNumber || '-'}`, x: 390, y: 805, size: 9 },
      { text: `発行日: ${note.issueDate || '-'}`, x: 390, y: 790, size: 9 },
      { text: `納品日: ${note.deliveryDate || context.shipment?.plannedDeliveryDate || context.shipment?.shipmentDate || '-'}`, x: 390, y: 775, size: 9 },
      { text: `Page ${pageIndex + 1} / ${totalPages}`, x: 390, y: 760, size: 9 },
    ];

    if (pageIndex === 0) {
      lines.push(
        { text: `納品先: ${customerName(context)}`, x: 40, y: 735, size: 10 },
        { text: `出荷番号: ${context.shipment?.shipmentNumber || '-'}`, x: 40, y: 720, size: 9 },
        { text: `受注番号: ${context.salesOrder?.salesOrderNumber || '-'}`, x: 40, y: 705, size: 9 },
        { text: `件名: ${context.salesOrder?.subject || '-'}`, x: 40, y: 690, size: 9 },
      );
    } else {
      lines.push({ text: '納品書 続き', x: 40, y: 735, size: 10 });
    }

    lines.push(
      { text: 'No', x: 40, y: headerY, size: 8 },
      { text: '商品コード', x: 62, y: headerY, size: 8 },
      { text: '商品名', x: 122, y: headerY, size: 8 },
      { text: '規格', x: 250, y: headerY, size: 8 },
      { text: 'ロット', x: 315, y: headerY, size: 8 },
      { text: '賞味期限', x: 370, y: headerY, size: 8 },
      { text: '数量', x: 430, y: headerY, size: 8 },
      { text: '単位', x: 470, y: headerY, size: 8 },
    );
    if (priceVisible) {
      lines.push(
        { text: '単価', x: 500, y: headerY, size: 8 },
        { text: '金額', x: 545, y: headerY, size: 8 },
      );
    }

    pageLines.forEach((line, lineIndex) => {
      const y = headerY - 18 - lineIndex * 18;
      lines.push(
        { text: String(pageIndex * ROWS_PER_PAGE + lineIndex + 1), x: 40, y, size: 8 },
        { text: truncate(line.productCode || '-', 12), x: 62, y, size: 8 },
        { text: truncate(line.productName || '-', 24), x: 122, y, size: 8 },
        { text: truncate(line.specification || '-', 12), x: 250, y, size: 8 },
        { text: truncate(line.lotSnapshot?.lotNumber || line.lotSnapshot?.inventoryCode || '-', 11), x: 315, y, size: 8 },
        { text: truncate(line.expirySnapshot || '', 12), x: 370, y, size: 8 },
        { text: String(formatPrice(line.quantity) || '-'), x: 430, y, size: 8 },
        { text: line.unit || '-', x: 470, y, size: 8 },
      );
      if (priceVisible) {
        lines.push(
          { text: money(line.unitPrice), x: 500, y, size: 8 },
          { text: money(line.amount), x: 545, y, size: 8 },
        );
      }
    });

    if (pageIndex === pages.length - 1 && priceVisible) {
      const totalY = Math.max(90, headerY - 36 - pageLines.length * 18);
      lines.push(
        { text: `小計 ${money(totals.subtotal)}`, x: 400, y: totalY, size: 9 },
        { text: `消費税 ${money(totals.taxAmount)}`, x: 400, y: totalY - 16, size: 9 },
        { text: `合計 ${money(totals.grandTotal)}`, x: 400, y: totalY - 32, size: 11 },
      );
    }

    lines.push({ text: `ステータス: ${DELIVERY_NOTE_STATUS_LABELS[note.status] || note.status || '-'}`, x: 40, y: 55, size: 8 });
    return lines;
  });

  const pdf = buildUnicodePdf(pdfPages);
  const blob = new Blob([pdf], { type: 'application/pdf' });
  const fileName = `delivery_note_${sanitizeFilePart(note.deliveryNoteNumber || 'draft')}_${sanitizeFilePart(customerName(context))}_${note.issueDate || todayString()}.pdf`;
  return new File([blob], fileName, { type: 'application/pdf' });
}

export function downloadDeliveryNotePdf(context) {
  const file = createDeliveryNotePdfFile(context);
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return file.name;
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
  return `BT /F1 ${size} Tf 1 0 0 1 ${x} ${y} Tm <${utf16Hex(text)}> Tj ET`;
}

function buildUnicodePdf(pages) {
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
    const content = ['0.15 w', '40 700 m 555 700 l S', ...lines.map(textOp)].join('\n');
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
