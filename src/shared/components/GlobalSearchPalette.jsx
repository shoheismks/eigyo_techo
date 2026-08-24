import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  GLOBAL_SEARCH_LABELS,
  groupSearchResults,
  searchGlobalIndex,
} from '../search/globalSearchService.js';

function flattenGroups(groups) {
  return groups.flatMap((group) => group.results);
}

export default function GlobalSearchPalette({
  open,
  query,
  index = [],
  onQueryChange,
  onClose,
  onSelect,
}) {
  const inputRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const results = useMemo(() => searchGlobalIndex(index, query), [index, query]);
  const groups = useMemo(() => groupSearchResults(results), [results]);
  const flatResults = useMemo(() => flattenGroups(groups), [groups]);
  const trimmedQuery = String(query || '').trim();

  useEffect(() => {
    if (!open) return undefined;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return undefined;

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose?.();
        return;
      }

      if (!flatResults.length) return;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((current) => Math.min(current + 1, flatResults.length - 1));
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((current) => Math.max(current - 1, 0));
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        onSelect?.(flatResults[activeIndex]);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeIndex, flatResults, onClose, onSelect, open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="global-search-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="global-search-palette"
        role="dialog"
        aria-modal="true"
        aria-label="グローバル検索"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="global-search-header">
          <div>
            <p className="eyebrow">Search</p>
            <h2>グローバル検索</h2>
          </div>
          <button type="button" className="text-button compact-button" onClick={onClose}>
            閉じる
          </button>
        </div>

        <div className="global-search-input-wrap">
          <span aria-hidden="true">⌕</span>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => onQueryChange?.(event.target.value)}
            placeholder="顧客・担当者・商品・案件・見積などを検索"
            aria-label="検索キーワード"
          />
          {query && (
            <button type="button" className="global-search-clear" onClick={() => onQueryChange?.('')}>
              クリア
            </button>
          )}
        </div>

        <div className="global-search-meta">
          <span>{trimmedQuery ? `${results.length}件ヒット` : 'キーワードを入力してください'}</span>
          <span className="desktop-only-hint">Ctrl / Cmd + K で開く</span>
        </div>

        <div className="global-search-results">
          {!trimmedQuery && (
            <div className="global-search-empty">
              <strong>横断検索</strong>
              <p>顧客名、商品コード、見積番号、契約Noなどで検索できます。</p>
            </div>
          )}

          {trimmedQuery && results.length === 0 && (
            <div className="global-search-empty">
              <strong>該当する結果がありません</strong>
              <p>表記ゆれや番号の一部で再検索してください。</p>
            </div>
          )}

          {groups.map((group) => (
            <section className="global-search-group" key={group.type}>
              <div className="global-search-group-heading">
                <h3>{group.label}</h3>
                <span>{group.total}件</span>
              </div>
              <div className="global-search-group-list">
                {group.results.map((result) => {
                  const selected = flatResults[activeIndex]?.key === result.key;
                  return (
                    <button
                      type="button"
                      className={selected ? 'global-search-result active' : 'global-search-result'}
                      key={result.key}
                      onMouseEnter={() => setActiveIndex(flatResults.findIndex((item) => item.key === result.key))}
                      onClick={() => onSelect?.(result)}
                    >
                      <span className="global-search-type">{GLOBAL_SEARCH_LABELS[result.type] || result.type}</span>
                      <span className="global-search-result-main">
                        <strong>{result.title}</strong>
                        <small>{result.subtitle || result.matchedValue || '-'}</small>
                      </span>
                      {result.badge && <span className="info-badge muted">{result.badge}</span>}
                      {result.matchedField && (
                        <span className="global-search-match">
                          {result.matchedField}: {result.matchedValue}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {group.total > group.results.length && (
                <p className="global-search-more">さらに {group.total - group.results.length} 件あります。キーワードを絞り込んでください。</p>
              )}
            </section>
          ))}
        </div>
      </section>
    </div>,
    document.body,
  );
}
