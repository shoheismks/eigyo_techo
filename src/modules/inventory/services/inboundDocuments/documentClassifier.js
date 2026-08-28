import { parseDeliveryNoticeLayout } from '../deliveryNoticeLayoutParser.js';

const PRICE_LIST_TERMS = [
  { pattern: /\bcode\b/i, score: 16, reason: 'Codeヘッダー' },
  { pattern: /\bitem\b/i, score: 14, reason: 'Itemヘッダー' },
  { pattern: /(?:単価|unit\s*price)/i, score: 14, reason: '単価ヘッダー' },
  { pattern: /(?:係数|coefficient|factor)/i, score: 12, reason: '係数ヘッダー' },
  { pattern: /(?:諸費用|additional\s*cost|charges?)/i, score: 12, reason: '諸費用ヘッダー' },
  { pattern: /(?:請求単価|billed\s*price|invoice\s*price)/i, score: 18, reason: '請求単価ヘッダー' },
];

const DELIVERY_NOTICE_TERMS = [
  { pattern: /(?:デリバリー予定案内|delivery\s*notice)/i, score: 45, reason: '書類タイトル' },
  { pattern: /(?:契約\s*no|contract\s*no)/i, score: 10, reason: '契約Noヘッダー' },
  { pattern: /(?:通関予定|customs\s*(?:clearance)?)/i, score: 12, reason: '通関予定ヘッダー' },
  { pattern: /(?:packing|パッキング)/i, score: 8, reason: 'Packingヘッダー' },
  { pattern: /\bJPY\s*\/\s*KG\b/i, score: 8, reason: 'JPY/KG単価' },
];

export function classifyInboundDocument(extraction = {}) {
  const pages = extraction.pages || [];
  const text = String(extraction.text || pages.map((page) => page.text || '').join('\n'));
  const textItemCount = pages.reduce((sum, page) => sum + (page.items?.length || 0), 0);

  if (textItemCount < 4 || text.replace(/\s/g, '').length < 12) {
    return classification('warehouse_receipt_candidate', 'low', 35, [
      'PDFテキスト層がない、または極端に少ない',
      'OCR前のため入庫報告書とは確定していない',
    ], { textItemCount, textLength: text.length });
  }

  const price = scoreTerms(text, PRICE_LIST_TERMS);
  const delivery = scoreTerms(text, DELIVERY_NOTICE_TERMS);
  const layout = parseDeliveryNoticeLayout(pages);
  const recognizedDeliveryFields = new Set(
    (layout.layout || []).flatMap((page) => page.recognizedFields || []),
  );
  if (recognizedDeliveryFields.size >= 6) {
    delivery.score += 38;
    delivery.reasons.push(`Delivery Notice列を${recognizedDeliveryFields.size}項目認識`);
  } else if (recognizedDeliveryFields.size >= 4) {
    delivery.score += 22;
    delivery.reasons.push(`Delivery Notice列を${recognizedDeliveryFields.size}項目認識`);
  }

  const productCodes = text.match(/\b\d{6}\b/g) || [];
  const priceRows = text.match(/\b\d{6}\b[^\n]*(?:¥|\d)[^\n]*(?:1\.\d{3})/g) || [];
  if (productCodes.length >= 3) {
    price.score += 16;
    price.reasons.push(`6桁商品コードを${productCodes.length}件検出`);
  }
  if (priceRows.length >= 3) {
    price.score += 12;
    price.reasons.push('商品コード・係数を持つ価格行を検出');
  }

  const ranked = [
    { type: 'delivery_notice', ...delivery },
    { type: 'product_price_list', ...price },
  ].sort((left, right) => right.score - left.score);
  const best = ranked[0];
  const margin = best.score - ranked[1].score;

  if (best.score < 40 || margin < 12) {
    return classification('unknown', best.score >= 30 ? 'medium' : 'low', best.score, [
      ...best.reasons,
      margin < 12 ? '複数書類種別の判定スコアが近い' : '確定に必要な特徴が不足',
    ], { textItemCount, scores: scoreMap(ranked) });
  }

  const confidence = best.score >= 70 && margin >= 20 ? 'high' : 'medium';
  return classification(best.type, confidence, Math.min(best.score, 100), best.reasons, {
    textItemCount,
    scores: scoreMap(ranked),
  });
}

function scoreTerms(text, definitions) {
  return definitions.reduce((result, definition) => {
    if (definition.pattern.test(text)) {
      result.score += definition.score;
      result.reasons.push(definition.reason);
    }
    return result;
  }, { score: 0, reasons: [] });
}

function classification(documentType, confidence, score, reasons, diagnostics) {
  return { documentType, confidence, score, reasons, diagnostics };
}
function scoreMap(ranked) {
  return Object.fromEntries(ranked.map((entry) => [entry.type, entry.score]));
}
