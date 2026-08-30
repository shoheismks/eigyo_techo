import { useMemo, useState } from 'react';

const REVIEW_STATUSES = new Set(['candidate', 'unmatched', 'review', 'ambiguous']);
const CONFIRMED_STATUSES = new Set(['matched', 'manual']);
const EXCLUDED_STATUSES = new Set(['excluded', 'skipped']);

function matchStatus(line) {
  return line.productMatchStatus || line.matchStatus || 'unmatched';
}

export function inboundProductReviewGroup(line) {
  if (EXCLUDED_STATUSES.has(line.status)) return 'excluded';
  if (line.requiresReview || line.requires_review) return 'review';
  const status = matchStatus(line);
  if (CONFIRMED_STATUSES.has(status) && line.matchedProductId) return 'confirmed';
  if (REVIEW_STATUSES.has(status)) return 'review';
  return 'review';
}

export function inboundProductReviewCounts(lines = []) {
  return lines.reduce((counts, line) => {
    const group = inboundProductReviewGroup(line);
    counts[group] += 1;
    counts.total += 1;
    return counts;
  }, { review: 0, confirmed: 0, excluded: 0, total: 0 });
}

function sourceLabel(line) {
  if (matchStatus(line) === 'manual') return '確認済み（手動）';
  if (line.productMatchSource === 'product_code') return '商品コードで確認';
  if (['supplier_code_alias', 'name_alias'].includes(line.productMatchSource)) return '登録済みの表記で確認';
  return '確認済み';
}

function reviewMessage(line) {
  if (line.requiresReview || line.requires_review) return '帳票の読み取り内容を確認してください';
  if (matchStatus(line) === 'candidate') return '候補の商品があります';
  if (['review', 'ambiguous'].includes(matchStatus(line))) return '複数の商品候補があります';
  return '商品マスタとの対応を確認してください';
}

function formatNumber(value) {
  if (value === '' || value === null || value === undefined) return '-';
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString('ja-JP') : String(value);
}

function CandidateList({ line, onLinkAlias }) {
  const candidates = line.candidates || line.productMatchCandidates || [];
  if (!candidates.length) return null;
  return (
    <div className="inbound-review-candidates">
      {candidates.slice(0, 3).map((entry) => {
        const product = entry.product || entry;
        const differences = entry.differences || [];
        return (
          <article className="inbound-review-candidate" key={product.id}>
            <div><strong>{product.name || '商品名未設定'}</strong><span>{product.productCode || 'コードなし'}{product.brandName ? ` / ${product.brandName}` : ''}</span></div>
            {differences.length > 0 && <p>{differences.map((difference) => difference.label).join('・')}に差異があります</p>}
            <button type="button" className="secondary-button" onClick={() => onLinkAlias?.(line, product)}>この商品と同じ表記として登録</button>
          </article>
        );
      })}
    </div>
  );
}

function ReviewCard({ line, onAddProduct, onLinkAlias }) {
  const canResolveProduct = !(line.requiresReview || line.requires_review);
  return (
    <article className="inbound-review-card needs-review">
      <header>
        <div><span className="inbound-review-mark" aria-hidden="true">!</span><div><h4>{line.productName || line.productNameRaw || '商品名未取得'}</h4><p>帳票コード: {line.productCode || '未取得'}{line.brand ? ` / ${line.brand}` : ''}</p></div></div>
        <span className="info-badge warning">要確認</span>
      </header>
      <dl className="inbound-review-facts">
        <div><dt>個数</dt><dd>{formatNumber(line.pieceCount ?? line.quantityPieces)}</dd></div>
        <div><dt>重量</dt><dd>{formatNumber(line.weight)}{line.weight !== '' && line.weight !== null && line.weight !== undefined ? ` ${line.unit || 'KG'}` : ''}</dd></div>
      </dl>
      <p className="inbound-review-message">{reviewMessage(line)}</p>
      {line.productMatchMessage && <p className="inline-helper">{line.productMatchMessage}</p>}
      {canResolveProduct && <CandidateList line={line} onLinkAlias={onLinkAlias} />}
      {line.productMatchDifferences?.length > 0 && (
        <div className="inbound-review-differences">
          {line.productMatchDifferences.map((difference) => <p key={difference.label}>{difference.label}: 帳票「{difference.imported}」 / マスタ「{difference.registered}」</p>)}
        </div>
      )}
      {canResolveProduct && (
        <div className="inbound-review-actions">
          <button type="button" className="ghost-button" onClick={() => onLinkAlias?.(line)}>別の商品を検索</button>
          <button type="button" className="ghost-button" onClick={() => onAddProduct?.(line)}>新商品として登録</button>
        </div>
      )}
      {!canResolveProduct && <p className="notice-text">この確認事項を解除する操作はありません。帳票内容を確認したうえで既存の保存条件に従って進めてください。</p>}
    </article>
  );
}

function ConfirmedCard({ line }) {
  return (
    <article className="inbound-review-card confirmed">
      <header>
        <div><span className="inbound-review-mark" aria-hidden="true">✓</span><div><h4>{line.productName || line.productNameRaw || '商品名未取得'}</h4><p>{line.productCode || 'コードなし'} → {line.matchedProduct?.name || '商品名未設定'}</p></div></div>
        <span className="info-badge ready">確認済み</span>
      </header>
      <p className="inbound-review-source">{sourceLabel(line)}</p>
      <details><summary>詳細</summary><dl className="inbound-review-facts"><div><dt>正式商品コード</dt><dd>{line.matchedProduct?.productCode || '-'}</dd></div><div><dt>ブランド</dt><dd>{line.matchedProduct?.brandName || line.brand || '-'}</dd></div></dl></details>
    </article>
  );
}

function ExcludedCard({ line }) {
  return <article className="inbound-review-card excluded"><header><div><span className="inbound-review-mark" aria-hidden="true">−</span><div><h4>{line.productName || line.productNameRaw || '商品名未取得'}</h4><p>{line.productCode || 'コードなし'}</p></div></div><span className="info-badge muted">除外</span></header></article>;
}

export default function InboundProductReview({ lines = [], onAddProduct, onLinkAlias }) {
  const [filter, setFilter] = useState('review');
  const counts = useMemo(() => inboundProductReviewCounts(lines), [lines]);
  const visible = lines.filter((line) => inboundProductReviewGroup(line) === filter);
  const tabs = [
    ['review', '要確認', counts.review],
    ['confirmed', '確認済み', counts.confirmed],
    ['excluded', '除外', counts.excluded],
  ];

  return (
    <div className="inbound-product-review">
      <div className="inbound-review-tabs" role="tablist" aria-label="商品確認の表示切替">
        {tabs.map(([key, label, count]) => <button type="button" role="tab" aria-selected={filter === key} className={filter === key ? 'active' : ''} key={key} onClick={() => setFilter(key)}>{label} <span>{count}</span></button>)}
      </div>
      {counts.review === 0 && <div className="inbound-review-complete"><strong>✓ 商品確認が完了しました</strong><span>{counts.confirmed} / {counts.total}</span></div>}
      <div className="inbound-review-list" role="tabpanel">
        {visible.map((line) => filter === 'confirmed'
          ? <ConfirmedCard line={line} key={line.id} />
          : filter === 'excluded'
            ? <ExcludedCard line={line} key={line.id} />
            : <ReviewCard line={line} onAddProduct={onAddProduct} onLinkAlias={onLinkAlias} key={line.id} />)}
        {visible.length === 0 && <div className="empty-state"><h3>{filter === 'review' ? '確認が必要な商品はありません' : `${tabs.find(([key]) => key === filter)?.[1]}の商品はありません`}</h3></div>}
      </div>
    </div>
  );
}
