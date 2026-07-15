import { calculateQuoteTotals } from '../hooks/useQuotes.js';
import { productDisplayName } from '../../products/hooks/useProducts.js';

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pdfSafe(value = '') {
  return String(value)
    .replace(/[^\x20-\x7e]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .slice(0, 120);
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
    inventory.quantity && `${inventory.quantity}${inventory.unit || ''}`,
    inventory.cost && `原価 ${money(inventory.cost)}`,
    inventory.firmDeadline && `Firm ${inventory.firmDeadline}`,
    inventory.expirationDate && `賞味 ${inventory.expirationDate}`,
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
      description: quote.memo || '商品',
      quantity: quote.quantity,
      unit: quote.unit,
      unitPrice: quote.unitPrice,
      costPrice: quote.costPrice,
    }];
  }

  return (productIds.length > 0 ? productIds : ['']).map((productId, index) => {
    const inventoryId = inventoryIds[index] || inventories.find((inventory) => inventory.productId === productId)?.id || '';
    const inventory = inventories.find((item) => item.id === inventoryId);
    return {
      id: `${productId || 'product'}-${index}`,
      productId,
      inventoryId,
      description: productName(productId, products) || inventory?.productName || '商品',
      quantity: quote.quantity,
      unit: quote.unit || inventory?.unit || 'kg',
      unitPrice: quote.unitPrice,
      costPrice: quote.costPrice || inventory?.cost || inventory?.costPrice,
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

export function renderQuotePreviewHtml(context) {
  const { quote, customer, contacts, products, inventories, supplier, financials, generatedAt } = context;
  const contactNames = contacts.map((contact) => contact.name).filter(Boolean).join(', ') || '-';
  const lines = calculateQuoteTotals(quote).lines;
  const issueDate = quote.issueDate || quote.submittedDate || generatedAt.slice(0, 10);

  return `
    <article class="quote-preview-document">
      <style>
        .quote-preview-document { width: min(100%, 794px); min-height: 1123px; background: #fff; color: #111827; border: 1px solid #dbe3ef; border-radius: 8px; padding: 32px; font-family: system-ui, sans-serif; box-sizing: border-box; }
        .quote-preview-document h2 { margin: 0; font-size: 28px; letter-spacing: 0.12em; text-align: center; }
        .quote-preview-header { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 24px; }
        .quote-preview-logo { width: 48px; height: 48px; border-radius: 8px; display: grid; place-items: center; background: #1d4ed8; color: #fff; font-weight: 800; }
        .quote-preview-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 18px; margin: 18px 0; }
        .quote-preview-document table { width: 100%; border-collapse: collapse; margin: 18px 0; font-size: 13px; }
        .quote-preview-document th, .quote-preview-document td { border: 1px solid #dbe3ef; padding: 8px; text-align: left; vertical-align: top; }
        .quote-preview-document th { background: #eff6ff; color: #1e3a8a; }
        .quote-preview-number { text-align: right; font-size: 13px; line-height: 1.8; }
        .quote-preview-total { margin-left: auto; width: min(100%, 320px); }
        .quote-preview-total div { display: flex; justify-content: space-between; border-bottom: 1px solid #e5e7eb; padding: 6px 0; }
        .quote-preview-total strong { font-size: 18px; }
        .quote-preview-signature { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; margin-top: 36px; }
        .quote-preview-signature div { border-top: 1px solid #9ca3af; padding-top: 8px; min-height: 42px; }
        @media (max-width: 767px) { .quote-preview-document { padding: 16px; min-height: auto; } .quote-preview-header, .quote-preview-grid, .quote-preview-signature { grid-template-columns: 1fr; display: grid; } }
      </style>
      <div class="quote-preview-header">
        <div>
          <div class="quote-preview-logo">営</div>
          <p><strong>営業手帳</strong><br>食品営業CRM<br>〒000-0000<br>東京都</p>
        </div>
        <div class="quote-preview-number">
          見積番号: ${escapeHtml(quote.quoteNumber || '-')}<br>
          作成日: ${escapeHtml(issueDate)}<br>
          有効期限: ${escapeHtml(quote.validUntil || '-')}
        </div>
      </div>
      <h2>御見積書</h2>
      <div class="quote-preview-grid">
        <div><strong>宛先:</strong> ${escapeHtml(customer?.companyName || '-')}</div>
        <div><strong>担当者:</strong> ${escapeHtml(contactNames)}</div>
        <div><strong>案件:</strong> ${escapeHtml(quote.projectName || '-')}</div>
        <div><strong>仕入先:</strong> ${escapeHtml(supplier?.name || supplier?.companyName || '-')}</div>
        <div><strong>支払条件:</strong> ${escapeHtml(quote.paymentTerms || '-')}</div>
        <div><strong>納品条件:</strong> ${escapeHtml(quote.deliveryTerms || '-')}</div>
      </div>
      <table>
        <thead>
          <tr>
            <th>商品</th>
            <th>利用在庫</th>
            <th>数量</th>
            <th>単位</th>
            <th>販売単価</th>
            <th>金額</th>
          </tr>
        </thead>
        <tbody>
          ${lines.map((line) => `
            <tr>
              <td>${escapeHtml(line.description || productName(line.productId, products) || '-')}</td>
              <td>${escapeHtml(inventoryLabel(line.inventoryId, inventories) || '-')}</td>
              <td>${escapeHtml(line.quantity || '-')}</td>
              <td>${escapeHtml(line.unit || '-')}</td>
              <td>${escapeHtml(money(line.unitPrice, quote.currency))}</td>
              <td>${escapeHtml(money(line.amount, quote.currency))}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="quote-preview-total">
        <div><span>小計</span><span>${escapeHtml(money(financials.subtotal, quote.currency))}</span></div>
        <div><span>運賃</span><span>${escapeHtml(money(quote.freight || 0, quote.currency))}</span></div>
        <div><span>値引</span><span>${escapeHtml(money(quote.discount || 0, quote.currency))}</span></div>
        <div><span>消費税</span><span>${escapeHtml(money(financials.taxAmount, quote.currency))}</span></div>
        <div><strong>合計</strong><strong>${escapeHtml(money(financials.grandTotal, quote.currency))}</strong></div>
      </div>
      <p><strong>備考</strong><br>${escapeHtml(quote.remarks || quote.memo || '-').replace(/\n/g, '<br>')}</p>
      <div class="quote-preview-signature">
        <div>担当者署名</div>
        <div>お客様確認欄</div>
      </div>
    </article>
  `;
}

export function createQuotePdfFile(context) {
  const { quote, customer, contacts, products, inventories, supplier, financials, generatedAt } = context;
  const rows = calculateQuoteTotals(quote).lines;
  const textLines = [
    'QUOTE',
    `Quote No: ${quote.quoteNumber || '-'}`,
    `Issue Date: ${quote.issueDate || quote.submittedDate || generatedAt.slice(0, 10)}`,
    `Valid Until: ${quote.validUntil || '-'}`,
    `Customer: ${customer?.companyName || '-'}`,
    `Customer Code: ${customer?.customerCode || '-'}`,
    `Contacts: ${contacts.map((contact) => contact.name).filter(Boolean).join(', ') || '-'}`,
    `Project: ${quote.projectName || '-'}`,
    `Supplier: ${supplier?.name || supplier?.companyName || '-'}`,
    `Supplier Code: ${supplier?.supplierCode || '-'}`,
    'Items:',
    ...rows.map((line, index) => {
      const name = line.description || productName(line.productId, products) || '-';
      const inventory = inventoryLabel(line.inventoryId, inventories) || '-';
      return `${index + 1}. ${name} / ${inventory} / ${line.quantity || '-'} ${line.unit || ''} x ${money(line.unitPrice, quote.currency)} = ${money(line.amount, quote.currency)}`;
    }),
    `Subtotal: ${money(financials.subtotal, quote.currency)}`,
    `Freight: ${money(quote.freight || 0, quote.currency)}`,
    `Discount: ${money(quote.discount || 0, quote.currency)}`,
    `Tax: ${money(financials.taxAmount, quote.currency)}`,
    `Total: ${money(financials.grandTotal, quote.currency)}`,
    `Gross Margin Amount: ${money(financials.grossMarginAmount, quote.currency)}`,
    `Gross Margin Rate: ${financials.grossMarginRate || '-'}`,
    `Payment Terms: ${quote.paymentTerms || '-'}`,
    `Delivery Terms: ${quote.deliveryTerms || '-'}`,
    `Remarks: ${quote.remarks || quote.memo || '-'}`,
    'Signature: ______________________________',
  ];
  const pdf = buildSimplePdf(textLines);
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

function buildSimplePdf(lines) {
  const content = [
    'BT',
    '/F1 18 Tf',
    '50 790 Td',
    `(${pdfSafe(lines[0])}) Tj`,
    '/F1 9 Tf',
    ...lines.slice(1).flatMap((line) => ['0 -18 Td', `(${pdfSafe(line)}) Tj`]),
    'ET',
  ].join('\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return pdf;
}
