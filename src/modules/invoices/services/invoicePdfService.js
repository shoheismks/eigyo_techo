import { calculateInvoiceTotals, DEFAULT_INVOICE_TAX_RATE, emptyInvoice, normalizeInvoice } from '../hooks/useInvoices.js';
import { calculateQuoteTotals } from '../../quotes/hooks/useQuotes.js';

const A4_WIDTH = 595;
const A4_HEIGHT = 842;
const ROWS_PER_PAGE = 20;

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysString(value, days) {
  const date = new Date(`${value || todayString()}T00:00:00`);
  date.setDate(date.getDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
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

export function invoiceMoney(value, currency = 'JPY') {
  if (value === '' || value === null || value === undefined) return '-';
  const text = numberValue(value).toLocaleString('ja-JP');
  return currency === 'JPY' ? `${text}円` : `${text} ${currency}`;
}

function truncate(value = '', length = 34) {
  const text = String(value || '');
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

function sanitizeFilePart(value = '') {
  return String(value || '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '_')
    .slice(0, 80);
}

export function generateInvoiceNumber(invoices = [], issuerId = '') {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const sameIssuer = invoices.filter((invoice) => !issuerId || invoice.issuerId === issuerId);
  const max = sameIssuer.reduce((currentMax, invoice) => {
    const number = invoice.invoiceNumber || '';
    if (!number.startsWith(prefix)) return currentMax;
    const parsed = Number(number.replace(prefix, ''));
    return Number.isFinite(parsed) ? Math.max(currentMax, parsed) : currentMax;
  }, 0);
  return `${prefix}${String(max + 1).padStart(6, '0')}`;
}

function issuerPaymentSnapshot(issuer = {}) {
  return {
    bankAccount: issuer.bankAccount || '',
    bankName: issuer.defaultBankName || '',
    branchName: issuer.defaultBankBranch || '',
    accountType: issuer.defaultBankAccountType || '',
    accountNumber: issuer.defaultBankAccountNumber || '',
    accountHolder: issuer.defaultBankAccountHolder || '',
  };
}

function createCustomerSnapshot(customer = {}) {
  return {
    id: customer.id || '',
    companyName: customer.companyName || '',
    address: customer.address || '',
    email: customer.email || '',
    phone: customer.phone || '',
    customerCode: customer.customerCode || '',
  };
}

function createIssuerSnapshot(issuer = {}) {
  return {
    id: issuer.id || '',
    name: issuer.name || issuer.legalName || '',
    legalName: issuer.legalName || issuer.name || '',
    logoUrl: issuer.logoUrl || '',
    sealUrl: issuer.sealUrl || '',
    address: issuer.address || '',
    phone: issuer.phone || '',
    email: issuer.email || '',
    registrationNumber: issuer.registrationNumber || issuer.invoiceRegistrationNumber || '',
    contactPerson: issuer.contactPerson || '',
    bankAccount: issuer.bankAccount || '',
    defaultTaxRate: issuer.defaultTaxRate || DEFAULT_INVOICE_TAX_RATE,
    invoiceRoundingMode: issuer.invoiceRoundingMode || 'round',
    defaultInvoiceRemarks: issuer.defaultInvoiceRemarks || issuer.defaultRemarks || '',
    defaultTransferFeeText: issuer.defaultTransferFeeText || '振込手数料は貴社にてご負担ください。',
    snapshotCreatedAt: new Date().toISOString(),
  };
}

function quoteLineToInvoiceLine(line = {}, defaultTaxRate = DEFAULT_INVOICE_TAX_RATE) {
  const quoteLine = calculateQuoteTotals({ quoteLines: [line], defaultTaxRate }).lines?.[0] || line;
  return {
    id: crypto.randomUUID(),
    productId: line.productId || '',
    inventoryId: line.inventoryId || '',
    productCode: line.productCode || '',
    productName: line.productName || line.description || '',
    brandId: line.brandId || '',
    brandName: line.brandName || '',
    specification: line.packageStyle || line.specification || line.category || '',
    quantity: line.quantity || '',
    unit: line.unit || 'kg',
    unitPrice: line.unitPrice || '',
    taxRate: line.taxRate || defaultTaxRate,
    taxExcludedAmount: quoteLine.amount || '',
    taxAmount: quoteLine.taxAmount || '',
    taxIncludedAmount: quoteLine.amount !== '' ? (Number(quoteLine.amount || 0) + Number(quoteLine.taxAmount || 0)) : '',
    reducedTax: String(line.taxRate || defaultTaxRate) === '8',
    memo: line.memo || line.expirationText || '',
  };
}

export function buildInvoiceDraftFromQuote({
  quote,
  customer,
  contact,
  project,
  issuer,
  invoices = [],
  user,
}) {
  const selectedIssuer = quote?.issuerSnapshot || issuer || {};
  const issuerSnapshot = createIssuerSnapshot(selectedIssuer);
  const defaultTaxRate = issuerSnapshot.defaultTaxRate || quote?.defaultTaxRate || DEFAULT_INVOICE_TAX_RATE;
  const sourceLines = quote?.quoteLines?.length ? quote.quoteLines : [];
  const issueDate = todayString();
  const dueDays = Number(selectedIssuer.defaultInvoiceDueDays || 30);
  const invoiceLines = sourceLines.map((line) => quoteLineToInvoiceLine(line, defaultTaxRate));

  return normalizeInvoice({
    ...emptyInvoice,
    id: crypto.randomUUID(),
    userId: user?.id || quote?.userId || '',
    invoiceNumber: generateInvoiceNumber(invoices, quote?.issuerId || selectedIssuer.id || ''),
    issueDate,
    invoiceDate: issueDate,
    dueDate: addDaysString(issueDate, dueDays),
    transactionDate: quote?.submittedDate || quote?.issueDate || issueDate,
    customerId: quote?.customerId || customer?.id || '',
    contactId: quote?.contactIds?.[0] || contact?.id || '',
    projectId: quote?.projectId || project?.id || '',
    quoteId: quote?.id || '',
    confirmationQuoteId: quote?.confirmationPdfUrl ? quote.id : '',
    issuerId: quote?.issuerId || selectedIssuer.id || '',
    subject: quote?.projectName || project?.title || quote?.remarks || '請求書',
    billingName: customer?.companyName || quote?.customerSnapshot?.companyName || '',
    billingAddress: customer?.address || '',
    billingContactName: contact?.name || '',
    issuerSnapshot,
    customerSnapshot: createCustomerSnapshot(customer),
    sourceQuoteSnapshot: quote ? { ...quote } : null,
    sourceConfirmationSnapshot: quote?.confirmationPdfUrl ? {
      quoteId: quote.id,
      quoteNumber: quote.quoteNumber,
      confirmationPdfUrl: quote.confirmationPdfUrl,
      confirmationPdfGeneratedAt: quote.confirmationPdfGeneratedAt,
      termsVersion: quote.termsVersion,
      termsEffectiveDate: quote.termsEffectiveDate,
    } : null,
    bankSnapshot: issuerPaymentSnapshot(selectedIssuer),
    paymentTerms: selectedIssuer.defaultPaymentTerms || quote?.paymentTerms || '',
    transferFeeText: selectedIssuer.defaultTransferFeeText || '振込手数料は貴社にてご負担ください。',
    remarks: selectedIssuer.defaultInvoiceRemarks || '',
    status: '下書き',
    invoiceLines,
    createdBy: user?.id || '',
    createdByName: user?.email || '',
  }, user?.id || quote?.userId || '');
}

function chunkLines(lines, size = ROWS_PER_PAGE) {
  const chunks = [];
  for (let index = 0; index < lines.length; index += size) {
    chunks.push(lines.slice(index, index + size));
  }
  return chunks.length > 0 ? chunks : [[]];
}

function bankText(invoice = {}, issuer = {}) {
  const bank = invoice.bankSnapshot || {};
  return [
    bank.bankName && `銀行: ${bank.bankName}`,
    bank.branchName && `支店: ${bank.branchName}`,
    bank.accountType && `種別: ${bank.accountType}`,
    bank.accountNumber && `口座番号: ${bank.accountNumber}`,
    bank.accountHolder && `名義: ${bank.accountHolder}`,
    bank.bankAccount || issuer.bankAccount,
  ].filter(Boolean).join(' / ');
}

export function renderInvoicePreviewHtml(context) {
  const { invoice, customer, issuer } = context;
  const totals = calculateInvoiceTotals(invoice);
  const pages = chunkLines(totals.invoiceLines);
  const issuerSnapshot = invoice.issuerSnapshot || issuer || {};
  const customerName = invoice.billingName || customer?.companyName || invoice.customerSnapshot?.companyName || '-';

  return `
    <article class="quote-preview-document quote-a4-preview invoice-preview-document">
      <style>
        .invoice-preview-document { width: min(100%, 794px); background: #f3f4f6; color: #111827; border: 1px solid #dbe3ef; border-radius: 8px; padding: 16px; font-family: "Yu Gothic", "Meiryo", system-ui, sans-serif; box-sizing: border-box; }
        .invoice-page { min-height: 1123px; background: #fff; padding: 34px; box-sizing: border-box; page-break-after: always; }
        .invoice-page:last-child { page-break-after: auto; }
        .invoice-header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #111827; padding-bottom: 14px; margin-bottom: 18px; }
        .invoice-title { text-align: center; font-size: 25px; letter-spacing: .18em; margin: 10px 0 18px; }
        .invoice-total-box { border: 2px solid #111827; padding: 12px 16px; margin: 14px 0; display: flex; justify-content: space-between; align-items: center; font-size: 15px; }
        .invoice-total-box strong { font-size: 22px; }
        .invoice-meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 18px; font-size: 12px; margin: 12px 0; }
        .invoice-table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 8.5pt; }
        .invoice-table th, .invoice-table td { border-bottom: 1px solid #d1d5db; padding: 5px 4px; text-align: left; vertical-align: top; }
        .invoice-table th { background: #f3f4f6; color: #111827; font-weight: 700; }
        .invoice-table .num, .invoice-table .money { text-align: right; }
        .invoice-summary { display: grid; grid-template-columns: 1fr 260px; gap: 24px; margin-top: 18px; }
        .invoice-total div { display: flex; justify-content: space-between; border-bottom: 1px solid #e5e7eb; padding: 5px 0; }
        .invoice-bank { font-size: 10pt; line-height: 1.7; }
        .invoice-footer { margin-top: 10px; text-align: right; font-size: 9pt; color: #6b7280; }
        @media (max-width: 767px) { .invoice-preview-document { padding: 8px; } .invoice-page { padding: 14px; min-height: auto; overflow-x: auto; } .invoice-summary { grid-template-columns: 1fr; } }
      </style>
      ${pages.map((pageLines, pageIndex) => `
        <section class="invoice-page">
          <div class="invoice-header">
            <div>
              <strong>${escapeHtml(issuerSnapshot.legalName || issuerSnapshot.name || '営業手帳')}</strong><br>
              ${escapeHtml(issuerSnapshot.address || '')}<br>
              ${escapeHtml([issuerSnapshot.phone, issuerSnapshot.email].filter(Boolean).join(' / '))}
              ${issuerSnapshot.registrationNumber ? `<br>登録番号: ${escapeHtml(issuerSnapshot.registrationNumber)}` : ''}
            </div>
            <div>
              <div>請求書番号: ${escapeHtml(invoice.invoiceNumber || '-')}</div>
              <div>発行日: ${escapeHtml(invoice.issueDate || '-')}</div>
              <div>支払期限: ${escapeHtml(invoice.dueDate || '-')}</div>
              <div>Page ${pageIndex + 1} / ${pages.length}</div>
            </div>
          </div>
          ${pageIndex === 0 ? `
            <h2 class="invoice-title">請求書</h2>
            <div class="invoice-meta">
              <div><strong>御請求先:</strong> ${escapeHtml(customerName)}</div>
              <div><strong>御担当者:</strong> ${escapeHtml(invoice.billingContactName || '-')}</div>
              <div><strong>件名:</strong> ${escapeHtml(invoice.subject || '-')}</div>
              <div><strong>取引日:</strong> ${escapeHtml(invoice.transactionDate || '-')}</div>
              <div><strong>元見積番号:</strong> ${escapeHtml(invoice.sourceQuoteSnapshot?.quoteNumber || '-')}</div>
              <div><strong>支払条件:</strong> ${escapeHtml(invoice.paymentTerms || '-')}</div>
            </div>
            <div class="invoice-total-box"><span>御請求金額</span><strong>${escapeHtml(invoiceMoney(totals.grandTotal))}</strong></div>
          ` : `<h2 class="invoice-title">請求書 続き</h2>`}
          <table class="invoice-table">
            <thead>
              <tr>
                <th style="width: 5%;">No.</th>
                <th style="width: 14%;">商品コード</th>
                <th style="width: 25%;">商品名</th>
                <th style="width: 15%;">規格</th>
                <th style="width: 8%;">数量</th>
                <th style="width: 7%;">単位</th>
                <th style="width: 11%;">単価</th>
                <th style="width: 11%;">税抜金額</th>
                <th style="width: 8%;">税率</th>
                <th style="width: 12%;">備考</th>
              </tr>
            </thead>
            <tbody>
              ${pageLines.map((line, lineIndex) => `
                <tr>
                  <td class="num">${pageIndex * ROWS_PER_PAGE + lineIndex + 1}</td>
                  <td>${escapeHtml(line.productCode || '-')}</td>
                  <td>${escapeHtml(truncate(line.productName || '-', 34))}</td>
                  <td>${escapeHtml(truncate(line.specification || '-', 18))}</td>
                  <td class="num">${escapeHtml(line.quantity || '-')}</td>
                  <td>${escapeHtml(line.unit || '-')}</td>
                  <td class="money">${escapeHtml(invoiceMoney(line.unitPrice))}</td>
                  <td class="money">${escapeHtml(invoiceMoney(line.taxExcludedAmount))}</td>
                  <td>${escapeHtml(line.taxRate || '0')}%</td>
                  <td>${escapeHtml(truncate(line.memo || '', 18))}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          ${pageIndex === pages.length - 1 ? `
            <div class="invoice-summary">
              <div class="invoice-bank">
                <div><strong>振込先</strong> ${escapeHtml(bankText(invoice, issuerSnapshot) || '-')}</div>
                <div><strong>振込手数料</strong> ${escapeHtml(invoice.transferFeeText || '-')}</div>
                <div><strong>備考</strong><br>${escapeHtml(invoice.remarks || '-').replace(/\n/g, '<br>')}</div>
              </div>
              <div class="invoice-total">
                <div><span>税抜合計</span><span>${escapeHtml(invoiceMoney(totals.subtotal))}</span></div>
                ${totals.taxBreakdown.map((item) => `<div><span>${escapeHtml(item.rate)}% 対象 ${escapeHtml(invoiceMoney(item.taxableAmount))}</span><span>${escapeHtml(invoiceMoney(item.tax))}</span></div>`).join('')}
                <div><strong>税込合計</strong><strong>${escapeHtml(invoiceMoney(totals.grandTotal))}</strong></div>
                <div><span>入金済</span><span>${escapeHtml(invoiceMoney(totals.paidAmount))}</span></div>
                <div><span>未入金</span><span>${escapeHtml(invoiceMoney(totals.unpaidAmount))}</span></div>
              </div>
            </div>
          ` : ''}
          <div class="invoice-footer">本書は顧客向け請求書です。社内原価・粗利・利益情報は表示していません。</div>
        </section>
      `).join('')}
    </article>
  `;
}

export function buildInvoicePdfContext({ invoice, customer, issuer }) {
  return {
    invoice: normalizeInvoice(invoice, invoice.userId),
    customer,
    issuer: invoice.issuerSnapshot || issuer || null,
    generatedAt: new Date().toISOString(),
  };
}

export function createInvoicePdfFile(context) {
  const invoice = normalizeInvoice(context.invoice, context.invoice.userId);
  const totals = calculateInvoiceTotals(invoice);
  const pages = chunkLines(totals.invoiceLines);
  const issuer = invoice.issuerSnapshot || context.issuer || {};
  const customerName = invoice.billingName || context.customer?.companyName || invoice.customerSnapshot?.companyName || '-';
  const totalPdfPages = pages.length;
  const pdfPages = pages.map((pageLines, pageIndex) => {
    const headerY = pageIndex === 0 ? 655 : 710;
    const lines = [
      { text: '請求書', x: 270, y: 805, size: 16 },
      { text: issuer.legalName || issuer.name || '営業手帳', x: 40, y: 805, size: 10 },
      { text: issuer.address || '', x: 40, y: 790, size: 8 },
      { text: [issuer.phone, issuer.email].filter(Boolean).join(' / '), x: 40, y: 777, size: 8 },
      { text: issuer.registrationNumber ? `登録番号: ${issuer.registrationNumber}` : '', x: 40, y: 764, size: 8 },
      { text: `請求書番号: ${invoice.invoiceNumber || '-'}`, x: 390, y: 805, size: 9 },
      { text: `発行日: ${invoice.issueDate || '-'}`, x: 390, y: 790, size: 9 },
      { text: `支払期限: ${invoice.dueDate || '-'}`, x: 390, y: 775, size: 9 },
      { text: `Page ${pageIndex + 1} / ${totalPdfPages}`, x: 390, y: 760, size: 9 },
    ];

    if (pageIndex === 0) {
      lines.push(
        { text: `御請求先: ${customerName}`, x: 40, y: 735, size: 10 },
        { text: `御担当者: ${invoice.billingContactName || '-'}`, x: 40, y: 720, size: 9 },
        { text: `件名: ${invoice.subject || '-'}`, x: 40, y: 705, size: 9 },
        { text: `取引日: ${invoice.transactionDate || '-'}`, x: 40, y: 690, size: 9 },
        { text: `御請求金額: ${invoiceMoney(totals.grandTotal)}`, x: 360, y: 710, size: 13 },
      );
    } else {
      lines.push({ text: '請求書 続き', x: 40, y: 735, size: 10 });
    }

    lines.push(
      { text: 'No', x: 40, y: headerY, size: 8 },
      { text: '商品コード', x: 64, y: headerY, size: 8 },
      { text: '商品名', x: 130, y: headerY, size: 8 },
      { text: '規格', x: 255, y: headerY, size: 8 },
      { text: '数量', x: 325, y: headerY, size: 8 },
      { text: '単位', x: 360, y: headerY, size: 8 },
      { text: '単価', x: 390, y: headerY, size: 8 },
      { text: '税抜金額', x: 445, y: headerY, size: 8 },
      { text: '税率', x: 515, y: headerY, size: 8 },
    );

    pageLines.forEach((line, lineIndex) => {
      const y = headerY - 18 - lineIndex * 18;
      lines.push(
        { text: String(pageIndex * ROWS_PER_PAGE + lineIndex + 1), x: 40, y, size: 8 },
        { text: truncate(line.productCode || '-', 13), x: 64, y, size: 8 },
        { text: truncate(line.productName || '-', 22), x: 130, y, size: 8 },
        { text: truncate(line.specification || '-', 12), x: 255, y, size: 8 },
        { text: String(line.quantity || '-'), x: 325, y, size: 8 },
        { text: line.unit || '-', x: 360, y, size: 8 },
        { text: invoiceMoney(line.unitPrice), x: 390, y, size: 8 },
        { text: invoiceMoney(line.taxExcludedAmount), x: 445, y, size: 8 },
        { text: `${line.taxRate || 0}%`, x: 515, y, size: 8 },
      );
    });

    if (pageIndex === pages.length - 1) {
      const totalY = Math.max(100, headerY - 36 - pageLines.length * 18);
      lines.push(
        { text: `税抜合計 ${invoiceMoney(totals.subtotal)}`, x: 380, y: totalY, size: 9 },
        ...totals.taxBreakdown.flatMap((item, index) => [
          { text: `${item.rate}%対象 ${invoiceMoney(item.taxableAmount)}`, x: 380, y: totalY - 16 * (index + 1), size: 8 },
          { text: `消費税 ${invoiceMoney(item.tax)}`, x: 480, y: totalY - 16 * (index + 1), size: 8 },
        ]),
        { text: `税込合計 ${invoiceMoney(totals.grandTotal)}`, x: 380, y: totalY - 16 * (totals.taxBreakdown.length + 1), size: 11 },
        { text: `振込先 ${truncate(bankText(invoice, issuer) || '-', 44)}`, x: 40, y: totalY, size: 9 },
        { text: `支払条件: ${truncate(invoice.paymentTerms || '-', 44)}`, x: 40, y: totalY - 16, size: 9 },
        { text: `備考: ${truncate(invoice.remarks || '-', 44)}`, x: 40, y: totalY - 32, size: 9 },
      );
    }

    return lines;
  });
  const pdf = buildUnicodePdf(pdfPages);
  const blob = new Blob([pdf], { type: 'application/pdf' });
  const fileName = `invoice_${sanitizeFilePart(invoice.invoiceNumber || 'draft')}_${sanitizeFilePart(customerName)}_${invoice.issueDate || todayString()}.pdf`;
  return new File([blob], fileName, { type: 'application/pdf' });
}

export function downloadInvoicePdf(context) {
  const file = createInvoicePdfFile(context);
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
