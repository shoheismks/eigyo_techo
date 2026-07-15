import { calculateQuoteTotals } from '../hooks/useQuotes.js';
import { productDisplayName } from '../../products/hooks/useProducts.js';

const A4_WIDTH = 595;
const A4_HEIGHT = 842;
const ROWS_PER_PAGE = 20;

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

function money(value, currency = 'JPY') {
  if (value === '' || value === null || value === undefined) return '-';
  const text = numberValue(value).toLocaleString('ja-JP');
  return currency === 'JPY' ? `${text}円` : `${text} ${currency}`;
}

function truncate(value = '', length = 28) {
  const text = String(value || '');
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

function productName(productId, products = []) {
  return productDisplayName(products.find((product) => product.id === productId), '');
}

function inventoryLabel(inventoryId, inventories = []) {
  const inventory = inventories.find((item) => item.id === inventoryId);
  if (!inventory) return '';
  return [
    inventory.inventoryCode || inventory.inventory_code,
    inventory.inventoryName || inventory.name,
    inventory.stockType,
    inventory.owner,
    inventory.lot && `LOT ${inventory.lot}`,
  ].filter(Boolean).join(' / ');
}

function quoteLinesWithFallback(quote = {}, products = [], inventories = []) {
  if (Array.isArray(quote.quoteLines) && quote.quoteLines.length > 0) {
    return quote.quoteLines;
  }

  const productIds = Array.isArray(quote.productIds) ? quote.productIds : [];
  const inventoryIds = Array.isArray(quote.inventoryIds) ? quote.inventoryIds : [];
  if (productIds.length === 0 && inventoryIds.length === 0) {
    return [{
      id: 'fallback',
      productName: quote.memo || '商品',
      description: quote.memo || '商品',
      quantity: quote.quantity,
      unit: quote.unit,
      unitPrice: quote.unitPrice,
      costPrice: quote.costPrice,
      taxRate: quote.defaultTaxRate ?? quote.taxRate ?? '10',
    }];
  }

  return (productIds.length > 0 ? productIds : ['']).map((productId, index) => {
    const inventoryId = inventoryIds[index] || inventories.find((inventory) => inventory.productId === productId)?.id || '';
    const inventory = inventories.find((item) => item.id === inventoryId);
    return {
      id: `${productId || 'product'}-${index}`,
      productId,
      inventoryId,
      productName: productName(productId, products) || inventory?.productName || '商品',
      description: productName(productId, products) || inventory?.productName || '商品',
      quantity: quote.quantity,
      unit: quote.unit || inventory?.unit || 'kg',
      unitPrice: quote.unitPrice,
      costPrice: quote.costPrice || inventory?.cost || inventory?.costPrice,
      expirationText: inventory?.expiryDate || inventory?.expirationDate || '',
      taxRate: quote.defaultTaxRate ?? quote.taxRate ?? '10',
    };
  });
}

export function buildQuotePdfContext({
  quote,
  customer,
  contacts = [],
  products = [],
  inventories = [],
  suppliers = [],
  financials,
}) {
  const selectedContacts = contacts.filter((contact) => (quote.contactIds ?? []).includes(contact.id));
  const selectedInventories = inventories.filter((inventory) => (quote.inventoryIds ?? []).includes(inventory.id));
  const supplier = suppliers.find((item) => item.id === quote.supplierId);
  const quoteLines = quoteLinesWithFallback(quote, products, inventories);
  const totals = financials ?? calculateQuoteTotals({ ...quote, quoteLines });

  return {
    quote: { ...quote, quoteLines },
    customer,
    contacts: selectedContacts,
    products,
    inventories,
    selectedInventories,
    supplier,
    financials: totals,
    generatedAt: new Date().toISOString(),
  };
}

function chunkLines(lines, size = ROWS_PER_PAGE) {
  const chunks = [];
  for (let index = 0; index < lines.length; index += size) {
    chunks.push(lines.slice(index, index + size));
  }
  return chunks.length > 0 ? chunks : [[]];
}

function lineName(line, products = []) {
  return line.productName || line.description || productName(line.productId, products) || '-';
}

function renderLineCells(line, index, quote, products) {
  return `
    <tr>
      <td class="num">${index + 1}</td>
      <td>${escapeHtml(line.productCode || '-')}</td>
      <td>${escapeHtml(truncate(lineName(line, products), 42))}</td>
      <td>${escapeHtml(truncate(line.packageStyle || '-', 20))}</td>
      <td>${escapeHtml(line.temperatureZone || '-')}</td>
      <td>${escapeHtml(line.expirationText || '')}</td>
      <td class="num">${escapeHtml(line.quantity || '-')}</td>
      <td>${escapeHtml(line.unit || '-')}</td>
      <td class="money">${escapeHtml(money(line.unitPrice, quote.currency))}</td>
      <td class="money">${escapeHtml(money(line.amount, quote.currency))}</td>
      <td>${escapeHtml(truncate(line.memo || '', 24))}</td>
    </tr>
  `;
}

export function renderQuotePreviewHtml(context) {
  const { quote, customer, contacts, products, supplier, financials, generatedAt } = context;
  const contactNames = contacts.map((contact) => contact.name).filter(Boolean).join(', ') || '-';
  const lines = calculateQuoteTotals(quote).lines;
  const pages = chunkLines(lines);
  const issueDate = quote.issueDate || quote.submittedDate || generatedAt.slice(0, 10);
  const finalPageIndex = pages.length - 1;

  return `
    <article class="quote-preview-document quote-a4-preview">
      <style>
        .quote-a4-preview { width: min(100%, 794px); background: #f3f4f6; color: #111827; border: 1px solid #dbe3ef; border-radius: 8px; padding: 16px; font-family: "Yu Gothic", "Meiryo", system-ui, sans-serif; box-sizing: border-box; }
        .quote-page { min-height: 1123px; background: #fff; padding: 32px; box-sizing: border-box; page-break-after: always; }
        .quote-page:last-child { page-break-after: auto; }
        .quote-header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #1d4ed8; padding-bottom: 14px; margin-bottom: 14px; }
        .quote-logo { width: 46px; height: 46px; border-radius: 8px; display: grid; place-items: center; background: #1d4ed8; color: #fff; font-weight: 800; }
        .quote-title { text-align: center; font-size: 24px; letter-spacing: .12em; margin: 12px 0; }
        .quote-meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 18px; margin: 12px 0; font-size: 12px; }
        .quote-table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 8.5pt; }
        .quote-table th, .quote-table td { border-bottom: 1px solid #d1d5db; padding: 5px 4px; text-align: left; vertical-align: top; }
        .quote-table th { background: #eff6ff; color: #1e3a8a; font-weight: 700; }
        .quote-table .num, .quote-table .money { text-align: right; }
        .quote-summary { display: grid; grid-template-columns: 1fr 260px; gap: 24px; margin-top: 16px; }
        .quote-total div { display: flex; justify-content: space-between; border-bottom: 1px solid #e5e7eb; padding: 5px 0; }
        .quote-total strong { font-size: 15px; }
        .quote-conditions { font-size: 10pt; line-height: 1.7; }
        .quote-footer { margin-top: 10px; text-align: right; font-size: 9pt; color: #6b7280; }
        @media (max-width: 767px) { .quote-a4-preview { padding: 8px; } .quote-page { padding: 14px; min-height: auto; overflow-x: auto; } .quote-summary { grid-template-columns: 1fr; } }
      </style>
      ${pages.map((pageLines, pageIndex) => `
        <section class="quote-page">
          <div class="quote-header">
            <div>
              <div class="quote-logo">営</div>
              <p><strong>営業手帳</strong><br>食品営業CRM<br>sample@example.com</p>
            </div>
            <div>
              <div>見積番号: ${escapeHtml(quote.quoteNumber || '-')}</div>
              <div>作成日: ${escapeHtml(issueDate)}</div>
              <div>有効期限: ${escapeHtml(quote.validUntil || '-')}</div>
              <div>Page ${pageIndex + 1} / ${pages.length}</div>
            </div>
          </div>
          ${pageIndex === 0 ? `
            <h2 class="quote-title">御見積書</h2>
            <div class="quote-meta">
              <div><strong>御宛先:</strong> ${escapeHtml(customer?.companyName || '-')}</div>
              <div><strong>御担当者:</strong> ${escapeHtml(contactNames)}</div>
              <div><strong>件名:</strong> ${escapeHtml(quote.projectName || '-')}</div>
              <div><strong>仕入先:</strong> ${escapeHtml(supplier?.name || supplier?.companyName || '-')}</div>
            </div>
          ` : `<h2 class="quote-title">御見積書 続き</h2>`}
          <table class="quote-table">
            <thead>
              <tr>
                <th style="width: 4%;">No.</th>
                <th style="width: 10%;">商品コード</th>
                <th style="width: 20%;">商品名</th>
                <th style="width: 12%;">規格/荷姿</th>
                <th style="width: 8%;">温度帯</th>
                <th style="width: 11%;">賞味期限</th>
                <th style="width: 7%;">数量</th>
                <th style="width: 6%;">単位</th>
                <th style="width: 10%;">単価</th>
                <th style="width: 10%;">金額</th>
                <th style="width: 12%;">備考</th>
              </tr>
            </thead>
            <tbody>
              ${pageLines.map((line, lineIndex) => renderLineCells(line, pageIndex * ROWS_PER_PAGE + lineIndex, quote, products)).join('')}
            </tbody>
          </table>
          ${pageIndex === finalPageIndex ? `
            <div class="quote-summary">
              <div class="quote-conditions">
                <div><strong>支払条件:</strong> ${escapeHtml(quote.paymentTerms || '-')}</div>
                <div><strong>配送条件:</strong> ${escapeHtml(quote.deliveryTerms || '-')}</div>
                <div><strong>納期:</strong> ${escapeHtml(quote.deliveryDate || '-')}</div>
                <div><strong>備考:</strong><br>${escapeHtml(quote.remarks || quote.memo || '-').replace(/\n/g, '<br>')}</div>
              </div>
              <div class="quote-total">
                <div><span>小計</span><span>${escapeHtml(money(financials.subtotal, quote.currency))}</span></div>
                <div><span>値引</span><span>${escapeHtml(money(quote.discount || 0, quote.currency))}</span></div>
                <div><span>運賃</span><span>${escapeHtml(money(quote.freight || 0, quote.currency))}</span></div>
                <div><span>消費税</span><span>${escapeHtml(money(financials.taxAmount, quote.currency))}</span></div>
                <div><strong>合計</strong><strong>${escapeHtml(money(financials.grandTotal, quote.currency))}</strong></div>
              </div>
            </div>
          ` : ''}
          <div class="quote-footer">明細ヘッダーは各ページ再表示 / 顧客向けPDFには社内原価・利益を表示しません</div>
        </section>
      `).join('')}
    </article>
  `;
}

export function createQuotePdfFile(context) {
  const { quote, customer, contacts, products, supplier, financials, generatedAt } = context;
  const rows = calculateQuoteTotals(quote).lines;
  const pages = chunkLines(rows);
  const issueDate = quote.issueDate || quote.submittedDate || generatedAt.slice(0, 10);
  const contactNames = contacts.map((contact) => contact.name).filter(Boolean).join(', ') || '-';
  const pdfPages = pages.map((pageRows, pageIndex) => {
    const isLast = pageIndex === pages.length - 1;
    const lines = [
      { text: '御見積書', x: 260, y: 800, size: 16 },
      { text: `営業手帳 食品営業CRM`, x: 40, y: 805, size: 9 },
      { text: `見積番号: ${quote.quoteNumber || '-'}`, x: 400, y: 805, size: 9 },
      { text: `作成日: ${issueDate}`, x: 400, y: 790, size: 9 },
      { text: `有効期限: ${quote.validUntil || '-'}`, x: 400, y: 775, size: 9 },
      { text: `Page ${pageIndex + 1} / ${pages.length}`, x: 400, y: 760, size: 9 },
    ];

    if (pageIndex === 0) {
      lines.push(
        { text: `御宛先: ${customer?.companyName || '-'}`, x: 40, y: 760, size: 10 },
        { text: `御担当者: ${contactNames}`, x: 40, y: 745, size: 9 },
        { text: `件名: ${quote.projectName || '-'}`, x: 40, y: 730, size: 9 },
        { text: `仕入先: ${supplier?.name || supplier?.companyName || '-'}`, x: 40, y: 715, size: 9 },
      );
    } else {
      lines.push({ text: '御見積書 続き', x: 40, y: 745, size: 10 });
    }

    const headerY = pageIndex === 0 ? 690 : 720;
    lines.push(
      { text: 'No', x: 40, y: headerY, size: 8 },
      { text: '商品コード', x: 62, y: headerY, size: 8 },
      { text: '商品名', x: 122, y: headerY, size: 8 },
      { text: '規格/荷姿', x: 245, y: headerY, size: 8 },
      { text: '温度帯', x: 310, y: headerY, size: 8 },
      { text: '賞味期限', x: 355, y: headerY, size: 8 },
      { text: '数量', x: 420, y: headerY, size: 8 },
      { text: '単位', x: 455, y: headerY, size: 8 },
      { text: '単価', x: 485, y: headerY, size: 8 },
      { text: '金額', x: 540, y: headerY, size: 8 },
    );

    pageRows.forEach((line, lineIndex) => {
      const y = headerY - 18 - lineIndex * 18;
      lines.push(
        { text: String(pageIndex * ROWS_PER_PAGE + lineIndex + 1), x: 40, y, size: 8 },
        { text: truncate(line.productCode || '-', 12), x: 62, y, size: 8 },
        { text: truncate(lineName(line, products), 22), x: 122, y, size: 8 },
        { text: truncate(line.packageStyle || '-', 12), x: 245, y, size: 8 },
        { text: line.temperatureZone || '-', x: 310, y, size: 8 },
        { text: truncate(line.expirationText || '', 12), x: 355, y, size: 8 },
        { text: String(line.quantity || '-'), x: 420, y, size: 8 },
        { text: line.unit || '-', x: 455, y, size: 8 },
        { text: money(line.unitPrice, quote.currency), x: 485, y, size: 8 },
        { text: money(line.amount, quote.currency), x: 540, y, size: 8 },
      );
    });

    if (isLast) {
      const totalY = Math.max(110, headerY - 36 - pageRows.length * 18);
      lines.push(
        { text: `小計: ${money(financials.subtotal, quote.currency)}`, x: 390, y: totalY, size: 9 },
        { text: `値引: ${money(quote.discount || 0, quote.currency)}`, x: 390, y: totalY - 16, size: 9 },
        { text: `運賃: ${money(quote.freight || 0, quote.currency)}`, x: 390, y: totalY - 32, size: 9 },
        { text: `消費税: ${money(financials.taxAmount, quote.currency)}`, x: 390, y: totalY - 48, size: 9 },
        { text: `合計: ${money(financials.grandTotal, quote.currency)}`, x: 390, y: totalY - 66, size: 11 },
        { text: `支払条件: ${quote.paymentTerms || '-'}`, x: 40, y: totalY, size: 9 },
        { text: `配送条件: ${quote.deliveryTerms || '-'}`, x: 40, y: totalY - 16, size: 9 },
        { text: `納期: ${quote.deliveryDate || '-'}`, x: 40, y: totalY - 32, size: 9 },
        { text: `備考: ${truncate(quote.remarks || quote.memo || '-', 46)}`, x: 40, y: totalY - 48, size: 9 },
      );
    }

    return lines;
  });
  const pdf = buildUnicodePdf(pdfPages);
  const blob = new Blob([pdf], { type: 'application/pdf' });
  const fileName = `${quote.quoteNumber || 'quote'}-${Date.now()}.pdf`.replace(/[\\/:*?"<>|]/g, '-');
  return new File([blob], fileName, { type: 'application/pdf' });
}

export function downloadQuotePdf(context) {
  const file = createQuotePdfFile(context);
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
    const content = [
      '0.15 w',
      '40 700 m 555 700 l S',
      ...lines.map(textOp),
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
