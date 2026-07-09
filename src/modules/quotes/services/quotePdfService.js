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
    .slice(0, 110);
}

function money(value, currency = 'JPY') {
  if (value === '' || value === null || value === undefined) return '-';
  const numberValue = Number(String(value).replace(/,/g, ''));
  const text = Number.isFinite(numberValue) ? numberValue.toLocaleString('ja-JP') : value;
  return `${text} ${currency}`;
}

export function buildQuotePdfContext({
  quote,
  customer,
  contacts = [],
  products = [],
  inventories = [],
  suppliers = [],
  financials = {},
}) {
  const selectedContacts = contacts.filter((contact) => (quote.contactIds ?? []).includes(contact.id));
  const selectedProducts = products.filter((product) => (quote.productIds ?? []).includes(product.id));
  const selectedInventories = inventories.filter((inventory) => (quote.inventoryIds ?? []).includes(inventory.id));
  const supplier = suppliers.find((item) => item.id === quote.supplierId);

  return {
    quote,
    customer,
    contacts: selectedContacts,
    products: selectedProducts,
    inventories: selectedInventories,
    supplier,
    financials,
    generatedAt: new Date().toISOString(),
  };
}

export function renderQuotePreviewHtml(context) {
  const { quote, customer, contacts, products, inventories, supplier, financials, generatedAt } = context;
  const contactNames = contacts.map((contact) => contact.name).filter(Boolean).join(', ') || '-';
  const productRows = products.length > 0 ? products : [{ id: 'empty', name: '商品未選択' }];

  return `
    <article class="quote-preview-document">
      <style>
        .quote-preview-document { background: #fff; color: #111827; border: 1px solid #dbe3ef; border-radius: 8px; padding: 24px; font-family: system-ui, sans-serif; }
        .quote-preview-document h2 { margin: 0 0 12px; font-size: 24px; }
        .quote-preview-document table { width: 100%; border-collapse: collapse; margin: 16px 0; }
        .quote-preview-document th, .quote-preview-document td { border: 1px solid #dbe3ef; padding: 8px; text-align: left; vertical-align: top; }
        .quote-preview-document th { background: #eff6ff; }
        .quote-preview-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 18px; }
        .quote-preview-total { text-align: right; font-size: 18px; font-weight: 700; }
        @media (max-width: 767px) { .quote-preview-document { padding: 16px; } .quote-preview-grid { grid-template-columns: 1fr; } }
      </style>
      <h2>見積書</h2>
      <div class="quote-preview-grid">
        <div><strong>見積番号:</strong> ${escapeHtml(quote.quoteNumber || '-')}</div>
        <div><strong>作成日:</strong> ${escapeHtml(quote.submittedDate || generatedAt.slice(0, 10))}</div>
        <div><strong>宛先:</strong> ${escapeHtml(customer?.companyName || '-')}</div>
        <div><strong>担当者:</strong> ${escapeHtml(contactNames)}</div>
        <div><strong>仕入先:</strong> ${escapeHtml(supplier?.name || supplier?.companyName || '-')}</div>
        <div><strong>有効期限:</strong> ${escapeHtml(quote.validUntil || '-')}</div>
      </div>
      <table>
        <thead>
          <tr>
            <th>商品</th>
            <th>在庫/LOT</th>
            <th>数量</th>
            <th>単価</th>
            <th>原価</th>
            <th>粗利率</th>
          </tr>
        </thead>
        <tbody>
          ${productRows.map((product) => {
            const linkedInventory = inventories.find((inventory) => inventory.productId === product.id) || inventories[0];
            return `
              <tr>
                <td>${escapeHtml(product.name || '-')}<br>${escapeHtml([product.manufacturerName, product.origin, product.temperatureZone].filter(Boolean).join(' / '))}</td>
                <td>${escapeHtml(linkedInventory ? [linkedInventory.inventoryStatus, linkedInventory.lot && `LOT ${linkedInventory.lot}`, linkedInventory.quantity && `${linkedInventory.quantity}${linkedInventory.unit}`].filter(Boolean).join(' / ') : '-')}</td>
                <td>${escapeHtml(quote.quantity || '-')} ${escapeHtml(quote.unit || '')}</td>
                <td>${escapeHtml(money(quote.unitPrice, quote.currency))}</td>
                <td>${escapeHtml(money(quote.costPrice, quote.currency))}</td>
                <td>${escapeHtml(financials.grossMarginRate || quote.grossMarginRate || '-')}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
      <p class="quote-preview-total">合計: ${escapeHtml(money(financials.totalAmount || quote.totalAmount, quote.currency))}</p>
      <div class="quote-preview-grid">
        <div><strong>粗利額:</strong> ${escapeHtml(money(financials.grossMarginAmount || quote.grossMarginAmount, quote.currency))}</div>
        <div><strong>粗利率:</strong> ${escapeHtml(financials.grossMarginRate || quote.grossMarginRate || '-')}</div>
        <div><strong>支払条件:</strong> ${escapeHtml(quote.paymentTerms || '-')}</div>
        <div><strong>納品条件:</strong> ${escapeHtml(quote.deliveryTerms || '-')}</div>
      </div>
      <p><strong>備考:</strong><br>${escapeHtml(quote.remarks || quote.memo || '-').replace(/\n/g, '<br>')}</p>
    </article>
  `;
}

export function createQuotePdfFile(context) {
  const { quote, customer, contacts, products, inventories, supplier, financials, generatedAt } = context;
  const lines = [
    'QUOTE',
    `Quote No: ${quote.quoteNumber || '-'}`,
    `Date: ${quote.submittedDate || generatedAt.slice(0, 10)}`,
    `Customer: ${customer?.companyName || '-'}`,
    `Contacts: ${contacts.map((contact) => contact.name).filter(Boolean).join(', ') || '-'}`,
    `Supplier: ${supplier?.name || supplier?.companyName || '-'}`,
    `Valid Until: ${quote.validUntil || '-'}`,
    `Products: ${products.map((product) => product.name).filter(Boolean).join(', ') || '-'}`,
    `Inventories: ${inventories.map((inventory) => [inventory.inventoryStatus, inventory.lot, inventory.quantity && `${inventory.quantity}${inventory.unit}`].filter(Boolean).join(' / ')).join(', ') || '-'}`,
    `Quantity: ${quote.quantity || '-'} ${quote.unit || ''}`,
    `Unit Price: ${money(quote.unitPrice, quote.currency)}`,
    `Cost: ${money(quote.costPrice, quote.currency)}`,
    `Total: ${money(financials.totalAmount || quote.totalAmount, quote.currency)}`,
    `Gross Margin Amount: ${money(financials.grossMarginAmount || quote.grossMarginAmount, quote.currency)}`,
    `Gross Margin Rate: ${financials.grossMarginRate || quote.grossMarginRate || '-'}`,
    `Payment Terms: ${quote.paymentTerms || '-'}`,
    `Delivery Terms: ${quote.deliveryTerms || '-'}`,
    `Memo: ${quote.remarks || quote.memo || '-'}`,
  ];
  const pdf = buildSimplePdf(lines);
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
    '/F1 10 Tf',
    ...lines.slice(1).flatMap((line) => ['0 -22 Td', `(${pdfSafe(line)}) Tj`]),
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
