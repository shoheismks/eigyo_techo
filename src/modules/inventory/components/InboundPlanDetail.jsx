import { useEffect, useMemo, useState } from 'react';

const SECTIONS = [
  ['overview', '概要'],
  ['products', '商品確認'],
  ['inventory', '入荷・在庫'],
  ['history', '変更履歴'],
];
const SECTION_KEYS = new Set(SECTIONS.map(([key]) => key));

function sectionFromUrl() {
  if (typeof window === 'undefined') return 'overview';
  const section = new URLSearchParams(window.location.search).get('section');
  return SECTION_KEYS.has(section) ? section : 'overview';
}

function writeSectionUrl(section, replace = false) {
  const url = new URL(window.location.href);
  url.searchParams.set('section', SECTION_KEYS.has(section) ? section : 'overview');
  window.history[replace ? 'replaceState' : 'pushState']({}, '', `${url.pathname}${url.search}${url.hash}`);
}

function savedProductGroup(line) {
  if (['excluded', 'skipped'].includes(line.status)) return 'excluded';
  return line.matchedProductId && ['matched', 'manual'].includes(line.matchStatus) ? 'confirmed' : 'review';
}

function matchLabel(status) {
  return {
    matched: '商品コード・登録済み表記で確認',
    manual: '確認済み（手動）',
    ambiguous: '複数候補を確認',
    unmatched: '商品確認が必要',
  }[status] || '商品確認が必要';
}

export function InboundSavedProductReview({ lines = [], products = [], onLineChange, onSaveAlias }) {
  const [filter, setFilter] = useState('review');
  const counts = useMemo(() => lines.reduce((result, line) => {
    result[savedProductGroup(line)] += 1;
    return result;
  }, { review: 0, confirmed: 0, excluded: 0 }), [lines]);
  const visible = lines.filter((line) => savedProductGroup(line) === filter);
  const tabs = [['review', '要確認'], ['confirmed', '確認済み'], ['excluded', '除外']];

  return (
    <div className="inbound-saved-product-review">
      <div className="inbound-review-tabs" role="tablist" aria-label="保存済み商品の表示切替">
        {tabs.map(([key, label]) => <button type="button" role="tab" aria-selected={filter === key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key)} key={key}>{label} <span>{counts[key]}</span></button>)}
      </div>
      <div className="inbound-saved-product-list" role="tabpanel">
        {visible.map((line) => (
          <article className={`inbound-saved-product-card ${filter}`} key={line.id}>
            <header><div><h4>{line.productNameRaw || '商品名未取得'}</h4><p>{line.contractNo || '契約No未取得'} / {line.brandNameRaw || 'ブランド未取得'}</p></div><span className={`info-badge ${filter === 'confirmed' ? 'ready' : filter === 'review' ? 'warning' : 'muted'}`}>{filter === 'confirmed' ? '確認済み' : filter === 'review' ? '要確認' : '除外'}</span></header>
            <label className="field-label">正式商品
              <select value={line.matchedProductId || ''} onChange={(event) => onLineChange?.(line, { matchedProductId: event.target.value })}>
                <option value="">未照合</option>
                {products.map((product) => <option value={product.id} key={product.id}>{product.productCode ? `${product.productCode} / ` : ''}{product.name || '商品名未設定'}</option>)}
              </select>
            </label>
            <p className="inbound-review-source">{matchLabel(line.matchStatus)}</p>
            <div className="inbound-review-actions">
              <button type="button" className="ghost-button" onClick={() => onLineChange?.(line, { status: line.status === 'excluded' ? 'draft' : 'excluded' })}>{line.status === 'excluded' ? '除外を戻す' : '明細除外'}</button>
              <button type="button" className="ghost-button" disabled={!line.matchedProductId} onClick={() => onSaveAlias?.(line)}>この表記を保存</button>
            </div>
            {line.warnings?.length > 0 && <div className="delivery-notice-line-warnings">{line.warnings.map((warning) => <span className="info-badge muted" key={warning}>{warning}</span>)}</div>}
          </article>
        ))}
        {visible.length === 0 && <div className="empty-state"><h3>{filter === 'review' ? '確認が必要な商品はありません' : `${tabs.find(([key]) => key === filter)?.[1]}の商品はありません`}</h3></div>}
      </div>
    </div>
  );
}

export default function InboundPlanDetail({ shipment, contracts, statusLabel, statusClass, currentCustomsDate, onBack, sections }) {
  const [section, setSection] = useState(sectionFromUrl);

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('section');
    if (!SECTION_KEYS.has(raw)) writeSectionUrl('overview', true);
    setSection(sectionFromUrl());
  }, [shipment.id]);

  useEffect(() => {
    const handlePopState = () => {
      const raw = new URLSearchParams(window.location.search).get('section');
      if (!SECTION_KEYS.has(raw)) writeSectionUrl('overview', true);
      setSection(sectionFromUrl());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  function selectSection(next) {
    setSection(next);
    writeSectionUrl(next);
  }

  return (
    <div className="delivery-notice-detail-editor inbound-plan-detail">
      <button type="button" className="ghost-button inbound-view-back" onClick={onBack}>← 入荷予定一覧</button>
      <header className="inbound-plan-detail-header">
        <div><p className="eyebrow">Saved inbound plan</p><h2>入荷予定詳細</h2><p>{contracts || '契約No未取得'} / {shipment.supplierName || '仕入先未取得'} / {shipment.documentNumber || '帳票番号未取得'}</p></div>
        <dl><div><dt>状態</dt><dd><span className={`info-badge ${statusClass}`}>{statusLabel}</span></dd></div><div><dt>明細数</dt><dd>{shipment.lines?.length || 0}件</dd></div><div><dt>現在通関予定</dt><dd>{currentCustomsDate || '-'}</dd></div></dl>
      </header>
      <nav className="inbound-detail-tabs" aria-label="入荷予定詳細">
        {SECTIONS.map(([key, label]) => <button type="button" aria-current={section === key ? 'page' : undefined} className={section === key ? 'active' : ''} onClick={() => selectSection(key)} key={key}>{label}</button>)}
      </nav>
      <section className="inbound-detail-section" data-inbound-section={section}>{sections[section]}</section>
    </div>
  );
}
