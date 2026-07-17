import { DEFAULT_QUOTE_TAX_RATE, calculateQuoteTotals } from '../hooks/useQuotes.js';
import { productDisplayName } from '../../products/hooks/useProducts.js';
import { DEFAULT_QUOTE_TERMS_SUMMARY, TERMS_FIELDS, normalizeVisibleTerms, termsSummary } from './termsTemplateService.js';

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

  return {
    quote: { ...quote, quoteLines },
    customer,
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

function visibleTermsEntries(quote = {}) {
  const visibleTerms = normalizeVisibleTerms(quote.visibleTerms);
  const snapshot = quote.termsSnapshot || {};
  return TERMS_FIELDS
    .filter((field) => visibleTerms[field.key] !== false)
    .map((field) => ({ ...field, value: snapshot[field.key] || '' }))
    .filter((field) => field.value.trim());
}

function renderTermsHtml(quote = {}) {
  const entries = visibleTermsEntries(quote);
  if (entries.length === 0 && !quote.specialTerms) return '';
  return `
    <section class="quote-terms-section">
      <h3>取引条件・約款</h3>
      <p class="quote-terms-meta">約款バージョン: ${escapeHtml(quote.termsVersion || '-')} / 適用開始日: ${escapeHtml(quote.termsEffectiveDate || '-')}</p>
      <div class="quote-terms-summary">
        ${termsSummary(quote.termsSnapshot).map((item) => `<p>${escapeHtml(item)}</p>`).join('')}
      </div>
      ${entries.map((entry) => `
        <div class="quote-term-block">
          <strong>${escapeHtml(entry.label)}</strong>
          <p>${escapeHtml(entry.value).replace(/\n/g, '<br>')}</p>
        </div>
      `).join('')}
      ${quote.specialTerms ? `
        <div class="quote-term-block important">
          <strong>個別特記事項</strong>
          <p>${escapeHtml(quote.specialTerms).replace(/\n/g, '<br>')}</p>
        </div>
      ` : ''}
      <div class="quote-acceptance-box">
        <p>上記内容および添付約款を確認し、合意します。</p>
        <div><span>発行元担当者</span><span>${escapeHtml(quote.issuerSnapshot?.contactPerson || '-')}</span></div>
        <div><span>顧客担当者</span><span>${escapeHtml(quote.acceptedByCustomerName || '-')}</span></div>
        <div><span>確認日</span><span>${escapeHtml(quote.acceptedAt ? String(quote.acceptedAt).slice(0, 10) : '-')}</span></div>
        <div><span>確認方法</span><span>${escapeHtml(quote.acceptanceMethod || '-')}</span></div>
      </div>
    </section>
  `;
}

export function renderQuotePreviewHtml(context) {
  const { quote, customer, contacts, products, supplier, issuer, financials, generatedAt } = context;
  const contactNames = contacts.map((contact) => contact.name).filter(Boolean).join(', ') || '-';
  const lines = calculateQuoteTotals(quote).lines;
  const pages = chunkLines(lines);
  const issueDate = quote.issueDate || quote.submittedDate || generatedAt.slice(0, 10);
  const finalPageIndex = pages.length - 1;
  const issuerName = issuer?.legalName || issuer?.name || '営業手帳';
  const issuerAddress = issuer?.address || '食品営業CRM';
  const issuerContact = [issuer?.phone, issuer?.email].filter(Boolean).join(' / ') || 'sample@example.com';

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
      ${pages.map((pageLines, pageIndex) => `
        <section class="quote-page">
          <div class="quote-header">
            <div>
              ${issuer?.logoUrl ? `<img class="quote-logo" src="${escapeHtml(issuer.logoUrl)}" alt="">` : `<div class="quote-logo">${escapeHtml(issuerName.slice(0, 1))}</div>`}
              <p><strong>${escapeHtml(issuerName)}</strong><br>${escapeHtml(issuerAddress)}<br>${escapeHtml(issuerContact)}</p>
              ${issuer?.registrationNumber ? `<p>登録番号: ${escapeHtml(issuer.registrationNumber)}</p>` : ''}
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
              <div><strong>発行元担当:</strong> ${escapeHtml(issuer?.contactPerson || '-')}</div>
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
                ${issuer?.bankAccount ? `<div><strong>振込先:</strong> ${escapeHtml(issuer.bankAccount)}</div>` : ''}
                <div><strong>重要条件:</strong><br>${escapeHtml(quoteTermsSummaryText(quote, issuer)).replace(/\n/g, '<br>')}</div>
              </div>
              <div class="quote-total">
                <div><span>小計</span><span>${escapeHtml(money(financials.subtotal, quote.currency))}</span></div>
                <div><span>値引</span><span>${escapeHtml(money(quote.discount || 0, quote.currency))}</span></div>
                <div><span>運賃</span><span>${escapeHtml(money(quote.freight || 0, quote.currency))}</span></div>
                <div><span>消費税 ${escapeHtml(taxRateLabel(financials.taxBreakdown, quote.defaultTaxRate))}</span><span>${escapeHtml(money(financials.taxAmount, quote.currency))}</span></div>
                <div><strong>合計</strong><strong>${escapeHtml(money(financials.grandTotal, quote.currency))}</strong></div>
              </div>
            </div>
            <p class="quote-terms-summary">${escapeHtml(quoteTermsSummaryText(quote, issuer)).replace(/\n/g, '<br>')}</p>
          ` : ''}
          <div class="quote-footer">明細ヘッダーは各ページ再表示 / 顧客向けPDFには社内原価・利益を表示しません</div>
        </section>
      `).join('')}
    </article>
  `;
}

export function renderConfirmationPreviewHtml(context) {
  const html = renderQuotePreviewHtml(context)
    .replace('quote-preview-document quote-a4-preview', 'quote-preview-document quote-a4-preview confirmation-preview-document');
  return html.replace('</article>', `${renderTermsHtml(context.quote)}</article>`);
}

export function createQuotePdfFile(context, documentType = 'quote') {
  const { quote, customer, contacts, products, supplier, issuer, financials, generatedAt } = context;
  const isConfirmation = documentType === 'confirmation';
  const rows = calculateQuoteTotals(quote).lines;
  const pages = chunkLines(rows);
  const issueDate = quote.issueDate || quote.submittedDate || generatedAt.slice(0, 10);
  const contactNames = contacts.map((contact) => contact.name).filter(Boolean).join(', ') || '-';
  const issuerName = issuer?.legalName || issuer?.name || '営業手帳';
  const issuerAddress = issuer?.address || '食品営業CRM';
  const issuerContact = [issuer?.phone, issuer?.email].filter(Boolean).join(' / ');
  const documentTitle = isConfirmation ? '成約確認書' : '御見積書';
  const termsEntries = visibleTermsEntries(quote);
  const termsPdfLines = [
    `約款バージョン: ${quote.termsVersion || '-'} / 適用開始日: ${quote.termsEffectiveDate || '-'}`,
    ...termsSummary(quote.termsSnapshot).flatMap((item) => splitText(`重要条件: ${item}`, 58)),
    ...termsEntries.flatMap((entry) => [
      `【${entry.label}】`,
      ...splitText(entry.value, 58),
    ]),
    ...(quote.specialTerms ? ['【個別特記事項】', ...splitText(quote.specialTerms, 58)] : []),
    '【確認欄】上記内容および添付約款を確認し、合意します。',
    `発行元担当者: ${issuer?.contactPerson || '-'} / 顧客担当者: ${quote.acceptedByCustomerName || '-'}`,
    `確認日: ${quote.acceptedAt ? String(quote.acceptedAt).slice(0, 10) : '-'} / 確認方法: ${quote.acceptanceMethod || '-'}`,
  ].filter((line) => line !== undefined && line !== null);
  const termsPages = isConfirmation && termsPdfLines.length > 1 ? chunkLines(termsPdfLines, 34) : [];
  const totalPdfPages = pages.length + termsPages.length;
  const pdfPages = pages.map((pageRows, pageIndex) => {
    const isLast = pageIndex === pages.length - 1;
    const lines = [
      { text: documentTitle, x: 260, y: 800, size: 16 },
      { text: issuerName, x: 40, y: 805, size: 9 },
      { text: issuerAddress, x: 40, y: 790, size: 8 },
      { text: issuerContact, x: 40, y: 777, size: 8 },
      { text: `見積番号: ${quote.quoteNumber || '-'}`, x: 400, y: 805, size: 9 },
      { text: `作成日: ${issueDate}`, x: 400, y: 790, size: 9 },
      { text: `有効期限: ${quote.validUntil || '-'}`, x: 400, y: 775, size: 9 },
      { text: `Page ${pageIndex + 1} / ${totalPdfPages}`, x: 400, y: 760, size: 9 },
    ];

    if (pageIndex === 0) {
      lines.push(
        { text: `御宛先: ${customer?.companyName || '-'}`, x: 40, y: 760, size: 10 },
        { text: `御担当者: ${contactNames}`, x: 40, y: 745, size: 9 },
        { text: `件名: ${quote.projectName || '-'}`, x: 40, y: 730, size: 9 },
        { text: `仕入先: ${supplier?.name || supplier?.companyName || '-'}`, x: 40, y: 715, size: 9 },
        { text: `発行元担当: ${issuer?.contactPerson || '-'}`, x: 360, y: 715, size: 9 },
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
        { text: `消費税 ${taxRateLabel(financials.taxBreakdown, quote.defaultTaxRate)}: ${money(financials.taxAmount, quote.currency)}`, x: 390, y: totalY - 48, size: 9 },
        { text: `合計: ${money(financials.grandTotal, quote.currency)}`, x: 390, y: totalY - 66, size: 11 },
        { text: `支払条件: ${quote.paymentTerms || '-'}`, x: 40, y: totalY, size: 9 },
        { text: `配送条件: ${quote.deliveryTerms || '-'}`, x: 40, y: totalY - 16, size: 9 },
        { text: `納期: ${quote.deliveryDate || '-'}`, x: 40, y: totalY - 32, size: 9 },
        { text: `備考: ${truncate(quote.remarks || quote.memo || '-', 46)}`, x: 40, y: totalY - 48, size: 9 },
        { text: `振込先: ${truncate(issuer?.bankAccount || '-', 46)}`, x: 40, y: totalY - 64, size: 9 },
        { text: `重要条件: ${truncate(quoteTermsSummaryText(quote, issuer), 46) || '-'}`, x: 40, y: totalY - 80, size: 9 },
      );
    }

    return lines;
  });
  termsPages.forEach((termsPage, termsPageIndex) => {
    const pageNumber = pages.length + termsPageIndex + 1;
    pdfPages.push([
      { text: '取引条件・約款', x: 40, y: 805, size: 14 },
      { text: `見積番号: ${quote.quoteNumber || '-'} / Page ${pageNumber} / ${totalPdfPages}`, x: 360, y: 805, size: 9 },
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
  const prefix = isConfirmation ? 'confirmation' : 'quote';
  const fileName = `${quote.quoteNumber || prefix}-${prefix}-${Date.now()}.pdf`.replace(/[\\/:*?"<>|]/g, '-');
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
