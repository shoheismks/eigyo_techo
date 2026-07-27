import { DELIVERY_NOTE_STATUS_LABELS, normalizeDeliveryNote } from '../hooks/useDeliveryNotes.js';
import { formatPrice } from '../../products/hooks/useProducts.js';
import { formatDocumentRecipient } from '../../../shared/utils/documentRecipient.js';
import {
  DOCUMENT_ROWS_PER_PAGE,
  chunkDocumentRows,
  createPdfFileFromPages,
  documentMoney,
  escapeHtml,
  numberValue,
  renderDocumentShell,
  sanitizeFilePart,
  truncateText,
} from '../../../shared/services/documentModelService.js';

const ROWS_PER_PAGE = DOCUMENT_ROWS_PER_PAGE;

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function money(value, currency = 'JPY') {
  return documentMoney(value, currency);
}

function truncate(value = '', length = 28) {
  return truncateText(value, length);
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

function recipientText(context) {
  return formatDocumentRecipient({
    companyName: customerName(context),
    branchName: context.customer?.branchName || context.deliveryNote.snapshot?.customer?.branchName || context.salesOrder?.customerSnapshot?.branchName || '',
  }).text || '-';
}

function issuerName(context) {
  const issuer = context.issuer || {};
  return issuer.legalName || issuer.name || '営業手帳';
}

function deliveryAddress(context) {
  const shipmentAddress = context.shipment?.deliveryAddressSnapshot;
  return shipmentAddress?.address || context.customer?.address || context.salesOrder?.customerSnapshot?.address || '';
}

function deliveryNoteColumns(priceVisible) {
  const columns = [
    { key: 'no', label: 'No.', htmlWidth: '5%', pdfX: 40, pdfMax: 4, align: 'right' },
    { key: 'productCode', label: '商品コード', htmlWidth: '13%', pdfX: 62, pdfMax: 12 },
    { key: 'productName', label: '商品名', htmlWidth: priceVisible ? '22%' : '26%', pdfX: 122, pdfMax: priceVisible ? 21 : 25 },
    { key: 'specification', label: '規格/荷姿', htmlWidth: '14%', pdfX: priceVisible ? 244 : 260, pdfMax: 13 },
    { key: 'lot', label: 'ロット', htmlWidth: '10%', pdfX: priceVisible ? 310 : 335, pdfMax: 11 },
    { key: 'expiry', label: '賞味期限', htmlWidth: '10%', pdfX: priceVisible ? 365 : 395, pdfMax: 12 },
    { key: 'quantity', label: '数量', htmlWidth: '8%', pdfX: priceVisible ? 425 : 455, pdfMax: 8, align: 'right' },
    { key: 'unit', label: '単位', htmlWidth: '7%', pdfX: priceVisible ? 465 : 500, pdfMax: 5 },
  ];

  if (priceVisible) {
    columns.push(
      { key: 'unitPrice', label: '単価（税抜）', htmlWidth: '10%', pdfX: 500, pdfMax: 9, align: 'right' },
      { key: 'amount', label: '金額', htmlWidth: '11%', pdfX: 545, pdfMax: 9, align: 'right' },
    );
  }

  return columns;
}

function cellValue(columnKey, line, index, model) {
  const values = {
    no: String(index + 1),
    productCode: line.productCode || '-',
    productName: line.productName || '-',
    specification: line.specification || '-',
    lot: line.lotSnapshot?.lotNumber || line.lotSnapshot?.inventoryCode || '-',
    expiry: line.expirySnapshot || '',
    quantity: formatPrice(line.quantity) || '-',
    unit: line.unit || '-',
    unitPrice: money(line.unitPrice, model.currency),
    amount: money(line.amount, model.currency),
  };
  return values[columnKey] ?? '';
}

export function buildDeliveryNoteDocumentModel(context) {
  const note = normalizeDeliveryNote(context.deliveryNote, context.deliveryNote.userId);
  const totals = calculateDeliveryNoteTotals(note);
  const priceVisible = Boolean(note.priceVisible);
  const columns = deliveryNoteColumns(priceVisible);
  const pages = chunkDocumentRows(totals.lines);
  const issuer = context.issuer || {};

  return {
    documentType: 'deliveryNote',
    title: '納品書',
    continuationTitle: '納品書 続き',
    note,
    columns,
    pages,
    priceVisible,
    totals,
    currency: 'JPY',
    issuer: {
      name: issuerName(context),
      address: issuer.address || '',
      contact: [issuer.phone, issuer.email].filter(Boolean).join(' / '),
      logoUrl: issuer.logoUrl || '',
    },
    recipientText: recipientText(context),
    shipmentNumber: context.shipment?.shipmentNumber || '-',
    salesOrderNumber: context.salesOrder?.salesOrderNumber || '-',
    subject: context.salesOrder?.subject || '-',
    deliveryAddress: deliveryAddress(context) || '-',
    deliveryDate: note.deliveryDate || context.shipment?.plannedDeliveryDate || context.shipment?.shipmentDate || '-',
    statusLabel: DELIVERY_NOTE_STATUS_LABELS[note.status] || note.status || '-',
  };
}

function renderLineCells(model, line, absoluteIndex) {
  return `
    <tr>
      ${model.columns.map((column) => {
        const value = cellValue(column.key, line, absoluteIndex, model);
        const display = column.key === 'productName'
          ? truncate(value, 34)
          : column.key === 'specification'
            ? truncate(value, 20)
            : value;
        const className = column.align === 'right' ? ' class="num"' : '';
        return `<td${className}>${escapeHtml(display)}</td>`;
      }).join('')}
    </tr>
  `;
}

export function renderDeliveryNotePreviewHtml(context) {
  const model = buildDeliveryNoteDocumentModel(context);
  const pagesHtml = model.pages.map((pageLines, pageIndex) => `
    <section class="delivery-note-page">
      <div class="document-header">
        <div>
          <strong>${escapeHtml(model.issuer.name)}</strong><br>
          ${escapeHtml(model.issuer.address)}<br>
          ${escapeHtml(model.issuer.contact)}
        </div>
        <div>
          <div>納品番号: ${escapeHtml(model.note.deliveryNoteNumber || '-')}</div>
          <div>発行日: ${escapeHtml(model.note.issueDate || '-')}</div>
          <div>納品日: ${escapeHtml(model.deliveryDate)}</div>
          <div>Page ${pageIndex + 1} / ${model.pages.length}</div>
        </div>
      </div>
      ${pageIndex === 0 ? `
        <h2 class="document-title">${escapeHtml(model.title)}</h2>
        <div class="document-meta">
          <div class="document-recipient"><strong>宛先:</strong><br>${escapeHtml(model.recipientText).replace(/\n/g, '<br>')}</div>
          <div><strong>出荷番号:</strong> ${escapeHtml(model.shipmentNumber)}</div>
          <div><strong>受注番号:</strong> ${escapeHtml(model.salesOrderNumber)}</div>
          <div><strong>件名:</strong> ${escapeHtml(model.subject)}</div>
          <div style="grid-column: 1 / -1;"><strong>納品先住所:</strong> ${escapeHtml(model.deliveryAddress)}</div>
        </div>
      ` : `<h2 class="document-title">${escapeHtml(model.continuationTitle)}</h2>`}
      <table class="document-table">
        <thead>
          <tr>
            ${model.columns.map((column) => `<th style="width: ${column.htmlWidth};">${escapeHtml(column.label)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${pageLines.map((line, lineIndex) => renderLineCells(model, line, pageIndex * ROWS_PER_PAGE + lineIndex)).join('')}
        </tbody>
      </table>
      ${pageIndex === model.pages.length - 1 && model.priceVisible ? `
        <div class="document-total delivery-note-total">
          <div><span>小計</span><span>${escapeHtml(money(model.totals.subtotal))}</span></div>
          <div><span>消費税</span><span>${escapeHtml(money(model.totals.taxAmount))}</span></div>
          <div><strong>合計</strong><strong>${escapeHtml(money(model.totals.grandTotal))}</strong></div>
        </div>
      ` : ''}
      <p class="document-footer">検品後、内容に相違がある場合は速やかにご連絡ください。</p>
    </section>
  `).join('');

  return renderDocumentShell({
    className: 'delivery-note-preview-document',
    pageClassName: 'delivery-note-page',
    styles: `
      .delivery-note-preview-document .document-header { border-bottom-color: #111827; }
      .delivery-note-preview-document .document-table th { background: #f3f4f6; color: #111827; }
      .delivery-note-total { margin-top: 18px; margin-left: auto; width: 240px; font-size: 10pt; }
    `,
    pagesHtml,
  });
}

function pdfCellLinesForRow(model, row, absoluteIndex) {
  return model.columns.map((column) => ({
    text: truncate(cellValue(column.key, row, absoluteIndex, model), column.pdfMax),
    x: column.pdfX,
    size: 8,
  }));
}

export function createDeliveryNotePdfFile(context) {
  const model = buildDeliveryNoteDocumentModel(context);
  const totalPages = model.pages.length;
  const pdfPages = model.pages.map((pageLines, pageIndex) => {
    const headerY = pageIndex === 0 ? 645 : 705;
    const lines = [
      { text: model.title, x: 275, y: 805, size: 16 },
      { text: model.issuer.name, x: 40, y: 805, size: 10 },
      { text: model.issuer.address, x: 40, y: 790, size: 8 },
      { text: model.issuer.contact, x: 40, y: 777, size: 8 },
      { text: `納品番号: ${model.note.deliveryNoteNumber || '-'}`, x: 390, y: 805, size: 9 },
      { text: `発行日: ${model.note.issueDate || '-'}`, x: 390, y: 790, size: 9 },
      { text: `納品日: ${model.deliveryDate}`, x: 390, y: 775, size: 9 },
      { text: `Page ${pageIndex + 1} / ${totalPages}`, x: 390, y: 760, size: 9 },
    ];

    if (pageIndex === 0) {
      lines.push(
        { text: `宛先: ${model.recipientText.replace(/\n/g, ' / ')}`, x: 40, y: 735, size: 10 },
        { text: `出荷番号: ${model.shipmentNumber}`, x: 40, y: 720, size: 9 },
        { text: `受注番号: ${model.salesOrderNumber}`, x: 40, y: 705, size: 9 },
        { text: `件名: ${model.subject}`, x: 40, y: 690, size: 9 },
      );
    } else {
      lines.push({ text: model.continuationTitle, x: 40, y: 735, size: 10 });
    }

    model.columns.forEach((column) => {
      lines.push({ text: column.label, x: column.pdfX, y: headerY, size: 8 });
    });

    pageLines.forEach((row, lineIndex) => {
      const y = headerY - 18 - lineIndex * 18;
      pdfCellLinesForRow(model, row, pageIndex * ROWS_PER_PAGE + lineIndex).forEach((cell) => {
        lines.push({ ...cell, y });
      });
    });

    if (pageIndex === model.pages.length - 1 && model.priceVisible) {
      const totalY = Math.max(90, headerY - 36 - pageLines.length * 18);
      lines.push(
        { text: `小計 ${money(model.totals.subtotal)}`, x: 400, y: totalY, size: 9 },
        { text: `消費税 ${money(model.totals.taxAmount)}`, x: 400, y: totalY - 16, size: 9 },
        { text: `合計 ${money(model.totals.grandTotal)}`, x: 400, y: totalY - 32, size: 11 },
      );
    }

    lines.push({ text: `ステータス: ${model.statusLabel}`, x: 40, y: 55, size: 8 });
    return lines;
  });

  const fileName = `delivery_note_${sanitizeFilePart(model.note.deliveryNoteNumber || 'draft')}_${sanitizeFilePart(customerName(context))}_${model.note.issueDate || todayString()}.pdf`;
  return createPdfFileFromPages(pdfPages, fileName);
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
