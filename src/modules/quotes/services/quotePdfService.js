import { DEFAULT_QUOTE_TAX_RATE, calculateQuoteTotals, quoteValidUntilDisplay } from '../hooks/useQuotes.js';
import { productDisplayName } from '../../products/hooks/useProducts.js';
import { DEFAULT_QUOTE_TERMS_SUMMARY, TERMS_FIELDS, normalizeVisibleTerms, termsSummary } from './termsTemplateService.js';
import { formatDocumentRecipient } from '../../../shared/utils/documentRecipient.js';

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

function taxRateLabel(taxBreakdown = [], defaultTaxRate = DEFAULT_QUOTE_TAX_RATE) {
  const rates = [...new Set(
    (Array.isArray(taxBreakdown) ? taxBreakdown : [])
      .map((item) => item.rate)
      .filter((rate) => rate !== '' && rate !== null && rate !== undefined)
      .map((rate) => `${rate}%`),
  )];

  return rates.length > 0 ? rates.join(' / ') : `${defaultTaxRate}%`;
}

function quoteTermsSummaryText(quote = {}, issuer = null) {
  return quote.quoteTermsSummary || quote.issuerSnapshot?.defaultQuoteTermsSummary || issuer?.defaultQuoteTermsSummary || DEFAULT_QUOTE_TERMS_SUMMARY;
}

function hasQuantityInput(lines = []) {
  return lines.some((line) => String(line.quantity ?? '').trim() !== '');
}

function hasExpirationColumn(lines = []) {
  return lines.some((line) => String(line.expirationText || line.inventoryExpiryDate || line.shelfLife || '').trim());
}

function recipientFromContext(customer = {}, contacts = []) {
  const contact = contacts.find((item) => item?.name || item?.contactName) || {};
  return formatDocumentRecipient({
    companyName: customer?.companyName || customer?.name || '',
    branchName: customer?.branchName || '',
    departmentName: customer?.departmentName || contact?.departmentName || contact?.department || '',
    contactName: customer?.contactName || contact?.name || contact?.contactName || '',
  });
}

function customerOfficeSummary(customer = {}) {
  return [
    customer?.companyName || customer?.name,
    customer?.branchName,
    customer?.address,
    customer?.contactName && `${customer.departmentName ? `${customer.departmentName} ` : ''}${customer.contactName}`,
  ].filter(Boolean).join(' / ');
}

function truncate(value = '', length = 28) {
  const text = String(value || '');
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

function productName(productId, products = []) {
  return productDisplayName(products.find((product) => product.id === productId), '');
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
      taxRate: quote.defaultTaxRate ?? quote.taxRate ?? DEFAULT_QUOTE_TAX_RATE,
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
      taxRate: quote.defaultTaxRate ?? quote.taxRate ?? DEFAULT_QUOTE_TAX_RATE,
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
  issuer,
  financials,
}) {
  const selectedContacts = contacts.filter((contact) => (quote.contactIds ?? []).includes(contact.id));
  const selectedInventories = inventories.filter((inventory) => (quote.inventoryIds ?? []).includes(inventory.id));
  const supplier = suppliers.find((item) => item.id === quote.supplierId);
  const quoteLines = quoteLinesWithFallback(quote, products, inventories);
  const totals = financials ?? calculateQuoteTotals({ ...quote, quoteLines });
  const transactionCustomer = quote.transactionCustomerSnapshot || customer;
  const billingCustomer = quote.billingCustomerSnapshot || transactionCustomer;
  const shippingCustomer = quote.shippingCustomerSnapshot || transactionCustomer;
  const validUntilDisplay = quoteValidUntilDisplay(quote);

  return {
    quote: { ...quote, quoteLines },
    validUntilDisplay,
    customer: transactionCustomer,
    billingCustomer,
    shippingCustomer,
    contacts: selectedContacts,
    products,
    inventories,
    selectedInventories,
    supplier,
    issuer: quote.issuerSnapshot || issuer || null,
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

function splitText(value = '', size = 52) {
  const text = String(value || '');
  const lines = [];
  text.split('\n').forEach((paragraph) => {
    if (!paragraph) {
      lines.push('');
      return;
    }
    for (let index = 0; index < paragraph.length; index += size) {
      lines.push(paragraph.slice(index, index + size));
    }
  });
  return lines;
}

function quoteColumns(showExpiration) {
  const columns = [
    { key: 'no', label: 'No.', htmlWidth: '4%', pdfX: 40, pdfMax: 4, align: 'right' },
    { key: 'productCode', label: '商品コード', htmlWidth: showExpiration ? '9%' : '10%', pdfX: 62, pdfMax: 12 },
    { key: 'productName', label: '商品名', htmlWidth: showExpiration ? '20%' : '25%', pdfX: 122, pdfMax: showExpiration ? 19 : 24 },
    { key: 'packageStyle', label: '規格/荷姿', htmlWidth: showExpiration ? '12%' : '13%', pdfX: showExpiration ? 236 : 255, pdfMax: 12 },
    { key: 'temperatureZone', label: '温度帯', htmlWidth: showExpiration ? '7%' : '8%', pdfX: showExpiration ? 300 : 332, pdfMax: 6 },
  ];

  if (showExpiration) {
    columns.push({ key: 'expirationText', label: '賞味期限', htmlWidth: '10%', pdfX: 342, pdfMax: 11 });
  }

  columns.push(
    { key: 'quantity', label: '数量', htmlWidth: '7%', pdfX: showExpiration ? 398 : 382, pdfMax: 7, align: 'right' },
    { key: 'unit', label: '単位', htmlWidth: showExpiration ? '5%' : '6%', pdfX: showExpiration ? 430 : 423, pdfMax: 4 },
    { key: 'unitPrice', label: '単価（税抜）', htmlWidth: showExpiration ? '10%' : '11%', pdfX: showExpiration ? 458 : 456, pdfMax: 10, align: 'right' },
    { key: 'amount', label: '金額', htmlWidth: showExpiration ? '9%' : '9%', pdfX: showExpiration ? 512 : 510, pdfMax: 9, align: 'right' },
    { key: 'memo', label: '備考', htmlWidth: '7%', pdfX: 552, pdfMax: 5 },
  );

  return columns;
}

function cellValue(columnKey, line, index, quote, products) {
  const values = {
    no: String(index + 1),
    productCode: line.productCode || '-',
    productName: lineName(line, products),
    packageStyle: line.packageStyle || '-',
    temperatureZone: line.temperatureZone || '-',
    expirationText: line.expirationText || '',
    quantity: line.quantity || '-',
    unit: line.unit || '-',
    unitPrice: money(line.unitPrice, quote.currency),
    amount: money(line.amount, quote.currency),
    memo: line.memo || '',
  };
  return values[columnKey] ?? '';
}

function visibleTermsEntries(quote = {}) {
  const visibleTerms = normalizeVisibleTerms(quote.visibleTerms);
  const snapshot = quote.termsSnapshot || {};
  return TERMS_FIELDS
    .filter((field) => visibleTerms[field.key] !== false)
    .map((field) => ({ ...field, value: snapshot[field.key] || '' }))
    .filter((field) => field.value.trim());
}

function buildTermsModel(quote = {}, issuer = null) {
  const entries = visibleTermsEntries(quote);
  return {
    version: quote.termsVersion || '-',
    effectiveDate: quote.termsEffectiveDate || '-',
    summary: termsSummary(quote.termsSnapshot),
    entries,
    specialTerms: quote.specialTerms || '',
    issuerContact: issuer?.contactPerson || '-',
    acceptedByCustomerName: quote.acceptedByCustomerName || '-',
    acceptedAt: quote.acceptedAt ? String(quote.acceptedAt).slice(0, 10) : '-',
    acceptanceMethod: quote.acceptanceMethod || '-',
  };
}

export function buildQuoteDocumentModel(context, documentType = 'quote') {
  const { quote, customer, billingCustomer, shippingCustomer, contacts, products, issuer, financials, generatedAt, validUntilDisplay } = context;
  const calculated = calculateQuoteTotals(quote);
  const lines = calculated.lines;
  const showTotals = hasQuantityInput(lines);
  const showExpiration = hasExpirationColumn(lines);
  const pages = chunkLines(lines);
  const issueDate = quote.issueDate || quote.submittedDate || generatedAt.slice(0, 10);
  const finalPageIndex = pages.length - 1;
  const selectedIssuer = issuer || {};
  const issuerName = selectedIssuer.legalName || selectedIssuer.name || '営業手帳';
  const columns = quoteColumns(showExpiration);

  return {
    documentType,
    title: documentType === 'confirmation' ? '成約確認書' : '御見積書',
    continuationTitle: documentType === 'confirmation' ? '成約確認書 続き' : '御見積書 続き',
    quote,
    products,
    columns,
    pages,
    finalPageIndex,
    showTotals,
    showExpiration,
    issueDate,
    validUntilDisplay,
    financials: financials || calculated,
    generatedAt,
    issuer: {
      name: issuerName,
      address: selectedIssuer.address || '',
      contact: [selectedIssuer.phone, selectedIssuer.email].filter(Boolean).join(' / '),
      registrationNumber: selectedIssuer.registrationNumber || '',
      contactPerson: selectedIssuer.contactPerson || '',
      bankAccount: selectedIssuer.bankAccount || '',
      logoUrl: selectedIssuer.logoUrl || '',
    },
    recipient: recipientFromContext(customer, contacts),
    billingSummary: customerOfficeSummary(billingCustomer) || '-',
    shippingSummary: customerOfficeSummary(shippingCustomer) || '-',
    quoteTermsSummary: quoteTermsSummaryText(quote, selectedIssuer),
    terms: buildTermsModel(quote, selectedIssuer),
  };
}

function renderLineCells(model, line, absoluteIndex) {
  return `
    <tr>
      ${model.columns.map((column) => {
        if (column.pdfOnlyBelow) {
          return `<td>${escapeHtml(truncate(cellValue(column.key, line, absoluteIndex, model.quote, model.products), 24))}</td>`;
        }
        const value = cellValue(column.key, line, absoluteIndex, model.quote, model.products);
        const display = column.key === 'productName'
          ? truncate(value, 42)
          : column.key === 'packageStyle'
            ? truncate(value, 20)
            : value;
        const className = column.align === 'right' ? ' class="num"' : '';
        return `<td${className}>${escapeHtml(display)}</td>`;
      }).join('')}
    </tr>
  `;
}

function renderTermsHtml(model) {
  if (model.terms.entries.length === 0 && !model.terms.specialTerms) return '';
  return `
    <section class="quote-terms-section">
      <h3>取引条件・約款</h3>
      <p class="quote-terms-meta">約款バージョン: ${escapeHtml(model.terms.version)} / 適用開始日: ${escapeHtml(model.terms.effectiveDate)}</p>
      <div class="quote-terms-summary">
        ${model.terms.summary.map((item) => `<p>${escapeHtml(item)}</p>`).join('')}
      </div>
      ${model.terms.entries.map((entry) => `
        <div class="quote-term-block">
          <strong>${escapeHtml(entry.label)}</strong>
          <p>${escapeHtml(entry.value).replace(/\n/g, '<br>')}</p>
        </div>
      `).join('')}
      ${model.terms.specialTerms ? `
        <div class="quote-term-block important">
          <strong>個別特記事項</strong>
          <p>${escapeHtml(model.terms.specialTerms).replace(/\n/g, '<br>')}</p>
        </div>
      ` : ''}
      <div class="quote-acceptance-box">
        <p>上記内容および添付約款を確認し、合意します。</p>
        <div><span>発行元担当者</span><span>${escapeHtml(model.terms.issuerContact)}</span></div>
        <div><span>顧客担当者</span><span>${escapeHtml(model.terms.acceptedByCustomerName)}</span></div>
        <div><span>確認日</span><span>${escapeHtml(model.terms.acceptedAt)}</span></div>
        <div><span>確認方法</span><span>${escapeHtml(model.terms.acceptanceMethod)}</span></div>
      </div>
    </section>
  `;
}

export function renderQuotePreviewHtml(context) {
  const model = buildQuoteDocumentModel(context, 'quote');
  return renderQuoteDocumentHtml(model);
}

export function renderConfirmationPreviewHtml(context) {
  const model = buildQuoteDocumentModel(context, 'confirmation');
  return renderQuoteDocumentHtml(model, { includeTerms: true });
}

function renderQuoteDocumentHtml(model, { includeTerms = false } = {}) {
  return `
    <article class="quote-preview-document quote-a4-preview${model.documentType === 'confirmation' ? ' confirmation-preview-document' : ''}">
      <style>
        .quote-a4-preview { width: min(100%, 794px); background: #f3f4f6; color: #111827; border: 1px solid #dbe3ef; border-radius: 8px; padding: 16px; font-family: "Yu Gothic", "Meiryo", system-ui, sans-serif; box-sizing: border-box; }
        .quote-page { min-height: 1123px; background: #fff; padding: 32px; box-sizing: border-box; page-break-after: always; }
        .quote-page:last-child { page-break-after: auto; }
        .quote-header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #1d4ed8; padding-bottom: 14px; margin-bottom: 14px; }
        .quote-logo-note { display: inline-block; border: 1px solid #d1d5db; color: #4b5563; font-size: 9pt; padding: 4px 8px; margin-bottom: 8px; }
        .quote-title { text-align: center; font-size: 24px; letter-spacing: .12em; margin: 12px 0; }
        .quote-meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 18px; margin: 12px 0; font-size: 12px; }
        .quote-recipient { grid-column: 1 / -1; line-height: 1.7; font-size: 13px; }
        .quote-table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 8.5pt; }
        .quote-table th, .quote-table td { border-bottom: 1px solid #d1d5db; padding: 5px 4px; text-align: left; vertical-align: top; }
        .quote-table th { background: #eff6ff; color: #1e3a8a; font-weight: 700; }
        .quote-table .num, .quote-table .money { text-align: right; }
        .quote-summary { display: grid; grid-template-columns: ${model.showTotals ? '1fr 260px' : '1fr'}; gap: 24px; margin-top: 16px; }
        .quote-total div { display: flex; justify-content: space-between; border-bottom: 1px solid #e5e7eb; padding: 5px 0; }
        .quote-total strong { font-size: 15px; }
        .quote-conditions { font-size: 10pt; line-height: 1.7; }
        .quote-footer { margin-top: 10px; text-align: right; font-size: 9pt; color: #6b7280; }
        .quote-terms-section { margin-top: 20px; page-break-before: auto; font-size: 9pt; line-height: 1.65; color: #111827; }
        .quote-terms-section h3 { border-bottom: 1px solid #9ca3af; padding-bottom: 5px; margin: 0 0 8px; }
        .quote-terms-meta { color: #4b5563; margin: 0 0 8px; }
        .quote-terms-summary { border-left: 3px solid #1d4ed8; background: #eff6ff; padding: 8px 10px; margin-bottom: 10px; }
        .quote-terms-summary p { margin: 0 0 4px; }
        .quote-term-block { break-inside: avoid; border-bottom: 1px solid #e5e7eb; padding: 8px 0; }
        .quote-term-block p { margin: 4px 0 0; white-space: pre-wrap; }
        .quote-term-block.important { border: 1px solid #bfdbfe; background: #eff6ff; padding: 10px; }
        .quote-acceptance-box { break-inside: avoid; border: 1px solid #111827; margin-top: 14px; padding: 10px; }
        .quote-acceptance-box div { display: grid; grid-template-columns: 120px 1fr; border-top: 1px solid #e5e7eb; padding: 7px 0; }
        @media (max-width: 767px) { .quote-a4-preview { padding: 8px; } .quote-page { padding: 14px; min-height: auto; overflow-x: auto; } .quote-summary { grid-template-columns: 1fr; } }
      </style>
      ${model.pages.map((pageLines, pageIndex) => `
        <section class="quote-page">
          <div class="quote-header">
            <div>
              ${model.issuer.logoUrl ? '<span class="quote-logo-note">会社ロゴ登録済み</span>' : ''}
              <p><strong>${escapeHtml(model.issuer.name)}</strong><br>${escapeHtml(model.issuer.address)}${model.issuer.contact ? `<br>${escapeHtml(model.issuer.contact)}` : ''}</p>
              ${model.issuer.registrationNumber ? `<p>登録番号: ${escapeHtml(model.issuer.registrationNumber)}</p>` : ''}
            </div>
            <div>
              <div>見積番号: ${escapeHtml(model.quote.quoteNumber || '-')}</div>
              <div>作成日: ${escapeHtml(model.issueDate)}</div>
              <div>有効期限: ${escapeHtml(model.validUntilDisplay || '-')}</div>
              <div>Page ${pageIndex + 1} / ${model.pages.length}</div>
            </div>
          </div>
          ${pageIndex === 0 ? `
            <h2 class="quote-title">${escapeHtml(model.title)}</h2>
            <div class="quote-meta">
              <div class="quote-recipient"><strong>宛先:</strong><br>${escapeHtml(model.recipient.text || '-').replace(/\n/g, '<br>')}</div>
              <div><strong>請求先:</strong><br>${escapeHtml(model.billingSummary)}</div>
              <div><strong>納品先:</strong><br>${escapeHtml(model.shippingSummary)}</div>
              <div><strong>発行元担当者:</strong> ${escapeHtml(model.issuer.contactPerson || '-')}</div>
            </div>
          ` : `<h2 class="quote-title">${escapeHtml(model.continuationTitle)}</h2>`}
          <table class="quote-table">
            <thead>
              <tr>
                ${model.columns.map((column) => `<th style="width: ${column.htmlWidth};">${escapeHtml(column.label)}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${pageLines.map((line, lineIndex) => renderLineCells(model, line, pageIndex * ROWS_PER_PAGE + lineIndex)).join('')}
            </tbody>
          </table>
          ${pageIndex === model.finalPageIndex ? `
            <div class="quote-summary">
              <div class="quote-conditions">
                <div><strong>支払条件:</strong> ${escapeHtml(model.quote.paymentTerms || '-')}</div>
                <div><strong>配送条件:</strong> ${escapeHtml(model.quote.deliveryTerms || '-')}</div>
                <div><strong>納期:</strong> ${escapeHtml(model.quote.deliveryDate || '-')}</div>
                ${model.quote.remarks || model.quote.memo ? `<div><strong>備考:</strong><br>${escapeHtml(model.quote.remarks || model.quote.memo).replace(/\n/g, '<br>')}</div>` : ''}
                ${model.issuer.bankAccount ? `<div><strong>振込先:</strong> ${escapeHtml(model.issuer.bankAccount)}</div>` : ''}
                <div><strong>重要条件:</strong><br>${escapeHtml(model.quoteTermsSummary).replace(/\n/g, '<br>')}</div>
              </div>
              ${model.showTotals ? `<div class="quote-total">
                <div><span>小計</span><span>${escapeHtml(money(model.financials.subtotal, model.quote.currency))}</span></div>
                <div><span>値引き</span><span>${escapeHtml(money(model.quote.discount || 0, model.quote.currency))}</span></div>
                <div><span>運賃</span><span>${escapeHtml(money(model.quote.freight || 0, model.quote.currency))}</span></div>
                <div><span>消費税 ${escapeHtml(taxRateLabel(model.financials.taxBreakdown, model.quote.defaultTaxRate))}</span><span>${escapeHtml(money(model.financials.taxAmount, model.quote.currency))}</span></div>
                <div><strong>合計</strong><strong>${escapeHtml(money(model.financials.grandTotal, model.quote.currency))}</strong></div>
              </div>` : ''}
            </div>
          ` : ''}
          <div class="quote-footer">成約時には、別途発行する成約確認書および適用約款に基づきます。</div>
        </section>
      `).join('')}
      ${includeTerms ? renderTermsHtml(model) : ''}
    </article>
  `;
}

function termsPdfLines(model) {
  return [
    `約款バージョン: ${model.terms.version} / 適用開始日: ${model.terms.effectiveDate}`,
    ...model.terms.summary.flatMap((item) => splitText(`重要条件: ${item}`, 58)),
    ...model.terms.entries.flatMap((entry) => [
      `【${entry.label}】`,
      ...splitText(entry.value, 58),
    ]),
    ...(model.terms.specialTerms ? ['【個別特記事項】', ...splitText(model.terms.specialTerms, 58)] : []),
    '上記内容および添付約款を確認し、合意します。',
    `発行元担当者: ${model.terms.issuerContact} / 顧客担当者: ${model.terms.acceptedByCustomerName}`,
    `確認日: ${model.terms.acceptedAt} / 確認方法: ${model.terms.acceptanceMethod}`,
  ].filter((line) => line !== undefined && line !== null);
}

function pdfCellLinesForRow(model, row, absoluteIndex) {
  const lines = [];
  model.columns.forEach((column) => {
    if (column.pdfOnlyBelow) return;
    const value = cellValue(column.key, row, absoluteIndex, model.quote, model.products);
    lines.push({
      text: truncate(value, column.pdfMax),
      x: column.pdfX,
      size: 8,
    });
  });
  if (row.memo) {
    lines.push({
      text: `備考: ${truncate(row.memo, 44)}`,
      x: 40,
      yOffset: 9,
      size: 7,
    });
  }
  return lines;
}

export function createQuotePdfFile(context, documentType = 'quote') {
  const model = buildQuoteDocumentModel(context, documentType);
  const termsPages = documentType === 'confirmation' ? chunkLines(termsPdfLines(model), 34) : [];
  const totalPdfPages = model.pages.length + termsPages.length;
  const pdfPages = model.pages.map((pageRows, pageIndex) => {
    const isLast = pageIndex === model.pages.length - 1;
    const lines = [
      { text: model.title, x: 260, y: 800, size: 16 },
      { text: model.issuer.logoUrl ? '会社ロゴ登録済み' : '', x: 40, y: 820, size: 8 },
      { text: model.issuer.name, x: 40, y: 805, size: 9 },
      { text: model.issuer.address, x: 40, y: 790, size: 8 },
      { text: model.issuer.contact, x: 40, y: 777, size: 8 },
      { text: model.issuer.registrationNumber ? `登録番号: ${model.issuer.registrationNumber}` : '', x: 40, y: 764, size: 8 },
      { text: `見積番号: ${model.quote.quoteNumber || '-'}`, x: 400, y: 805, size: 9 },
      { text: `作成日: ${model.issueDate}`, x: 400, y: 790, size: 9 },
      { text: `有効期限: ${model.validUntilDisplay || '-'}`, x: 400, y: 775, size: 9 },
      { text: `Page ${pageIndex + 1} / ${totalPdfPages}`, x: 400, y: 760, size: 9 },
    ];

    if (pageIndex === 0) {
      const recipientLines = model.recipient.lines.length ? model.recipient.lines : ['-'];
      lines.push({ text: '宛先:', x: 40, y: 745, size: 9 });
      recipientLines.forEach((line, index) => {
        lines.push({ text: line, x: 78, y: 745 - index * 14, size: index === 0 ? 10 : 9 });
      });
      lines.push({ text: `請求先: ${truncate(model.billingSummary, 36)}`, x: 40, y: 710, size: 8 });
      lines.push({ text: `納品先: ${truncate(model.shippingSummary, 36)}`, x: 40, y: 697, size: 8 });
      lines.push({ text: `発行元担当者: ${model.issuer.contactPerson || '-'}`, x: 360, y: 715, size: 9 });
    } else {
      lines.push({ text: model.continuationTitle, x: 40, y: 745, size: 10 });
    }

    const headerY = pageIndex === 0 ? 670 : 720;
    model.columns
      .filter((column) => !column.pdfOnlyBelow)
      .forEach((column) => lines.push({ text: column.label, x: column.pdfX, y: headerY, size: 8 }));

    pageRows.forEach((row, lineIndex) => {
      const y = headerY - 18 - lineIndex * 18;
      pdfCellLinesForRow(model, row, pageIndex * ROWS_PER_PAGE + lineIndex).forEach((cell) => {
        lines.push({ ...cell, y: y - (cell.yOffset || 0) });
      });
    });

    if (isLast) {
      const totalY = Math.max(110, headerY - 36 - pageRows.length * 18);
      if (model.showTotals) {
        lines.push(
          { text: `小計 ${money(model.financials.subtotal, model.quote.currency)}`, x: 390, y: totalY, size: 9 },
          { text: `値引き ${money(model.quote.discount || 0, model.quote.currency)}`, x: 390, y: totalY - 16, size: 9 },
          { text: `運賃 ${money(model.quote.freight || 0, model.quote.currency)}`, x: 390, y: totalY - 32, size: 9 },
          { text: `消費税 ${taxRateLabel(model.financials.taxBreakdown, model.quote.defaultTaxRate)}: ${money(model.financials.taxAmount, model.quote.currency)}`, x: 390, y: totalY - 48, size: 9 },
          { text: `合計 ${money(model.financials.grandTotal, model.quote.currency)}`, x: 390, y: totalY - 66, size: 11 },
        );
      }
      lines.push(
        { text: `支払条件: ${model.quote.paymentTerms || '-'}`, x: 40, y: totalY, size: 9 },
        { text: `配送条件: ${model.quote.deliveryTerms || '-'}`, x: 40, y: totalY - 16, size: 9 },
        { text: `納期: ${model.quote.deliveryDate || '-'}`, x: 40, y: totalY - 32, size: 9 },
        { text: `備考: ${truncate(model.quote.remarks || model.quote.memo || '-', 46)}`, x: 40, y: totalY - 48, size: 9 },
        { text: `振込先: ${truncate(model.issuer.bankAccount || '-', 46)}`, x: 40, y: totalY - 64, size: 9 },
        { text: `重要条件: ${truncate(model.quoteTermsSummary, 46) || '-'}`, x: 40, y: totalY - 80, size: 9 },
      );
    }

    lines.push({ text: '成約時には、別途発行する成約確認書および適用約款に基づきます。', x: 250, y: 40, size: 7 });
    return lines;
  });

  termsPages.forEach((termsPage, termsPageIndex) => {
    const pageNumber = model.pages.length + termsPageIndex + 1;
    pdfPages.push([
      { text: '取引条件・約款', x: 40, y: 805, size: 14 },
      { text: `見積番号: ${model.quote.quoteNumber || '-'} / Page ${pageNumber} / ${totalPdfPages}`, x: 360, y: 805, size: 9 },
      ...termsPage.map((line, index) => ({
        text: line,
        x: 40,
        y: 775 - index * 19,
        size: line.startsWith('【') ? 10 : 8,
      })),
    ]);
  });

  const pdf = buildUnicodePdf(pdfPages);
  const blob = new Blob([pdf], { type: 'application/pdf' });
  const prefix = documentType === 'confirmation' ? 'confirmation' : 'quote';
  const fileName = `${model.quote.quoteNumber || prefix}-${prefix}-${Date.now()}.pdf`.replace(/[\\/:*?"<>|]/g, '-');
  return new File([blob], fileName, { type: 'application/pdf' });
}

export function createConfirmationPdfFile(context) {
  return createQuotePdfFile(context, 'confirmation');
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

export function downloadConfirmationPdf(context) {
  const file = createConfirmationPdfFile(context);
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
  if (!text) return '';
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
