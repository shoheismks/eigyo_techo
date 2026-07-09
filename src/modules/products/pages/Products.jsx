import { useMemo, useState } from 'react';
import {
  PRODUCT_CATEGORIES,
  TEMPERATURE_ZONES,
  formatPrice,
} from '../hooks/useProducts.js';

const ALL = 'すべて';
const PAGE_SIZE = 40;

function includesText(value, keyword) {
  return String(value ?? '').toLowerCase().includes(keyword);
}

function uniqueValues(products, field) {
  return [...new Set(products.map((product) => product[field]).filter(Boolean))].sort();
}

export default function Products({ products, removeProduct, onOpenProductDetail }) {
  const [keyword, setKeyword] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(ALL);
  const [temperatureFilter, setTemperatureFilter] = useState(ALL);
  const [manufacturerFilter, setManufacturerFilter] = useState(ALL);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selectedPreviewId, setSelectedPreviewId] = useState('');

  const manufacturers = useMemo(
    () => uniqueValues(products, 'manufacturerName'),
    [products],
  );

  const filteredProducts = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return products.filter((product) => {
      const matchesKeyword =
        !normalizedKeyword ||
        [
          product.name,
          product.category,
          product.manufacturerName,
          product.origin,
          product.temperatureZone,
          product.packageStyle,
          product.memo,
          ...(product.tags ?? []),
        ].some((value) => includesText(value, normalizedKeyword));

      const matchesCategory =
        categoryFilter === ALL || product.category === categoryFilter;
      const matchesTemperature =
        temperatureFilter === ALL || product.temperatureZone === temperatureFilter;
      const matchesManufacturer =
        manufacturerFilter === ALL || product.manufacturerName === manufacturerFilter;

      return matchesKeyword && matchesCategory && matchesTemperature && matchesManufacturer;
    });
  }, [categoryFilter, keyword, manufacturerFilter, products, temperatureFilter]);

  const visibleProducts = filteredProducts.slice(0, visibleCount);
  const selectedPreviewProduct =
    visibleProducts.find((product) => product.id === selectedPreviewId) ||
    visibleProducts[0];

  function resetPaging(handler) {
    return (event) => {
      handler(event);
      setVisibleCount(PAGE_SIZE);
    };
  }

  return (
    <main className="page products-page">
      <section className="page-header">
        <div>
          <p className="eyebrow">Products</p>
          <h1>商品マスター</h1>
          <p>PCでは価格・粗利・資料有無を比較しやすいテーブルで表示します。</p>
        </div>
      </section>

      <section className="search-panel desktop-filter-panel">
        <div className="section-heading">
          <h2>商品検索</h2>
          <button
            type="button"
            className="primary-button compact-button"
            onClick={() => onOpenProductDetail('new')}
          >
            商品追加
          </button>
        </div>

        <label className="field-label filter-search">
          キーワード
          <input
            value={keyword}
            placeholder="商品名、メーカー、産地、タグ、メモで検索"
            onChange={resetPaging((event) => setKeyword(event.target.value))}
          />
        </label>

        <label className="field-label">
          カテゴリー
          <select value={categoryFilter} onChange={resetPaging((event) => setCategoryFilter(event.target.value))}>
            <option>{ALL}</option>
            {PRODUCT_CATEGORIES.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
        </label>

        <label className="field-label">
          温度帯
          <select value={temperatureFilter} onChange={resetPaging((event) => setTemperatureFilter(event.target.value))}>
            <option>{ALL}</option>
            {TEMPERATURE_ZONES.map((zone) => (
              <option key={zone}>{zone}</option>
            ))}
          </select>
        </label>

        <label className="field-label">
          メーカー名
          <select value={manufacturerFilter} onChange={resetPaging((event) => setManufacturerFilter(event.target.value))}>
            <option>{ALL}</option>
            {manufacturers.map((manufacturer) => (
              <option key={manufacturer}>{manufacturer}</option>
            ))}
          </select>
        </label>
      </section>

      <section className="result-stack">
        <div className="section-heading">
          <h2>商品一覧</h2>
          <span>{filteredProducts.length}件</span>
        </div>

        {visibleProducts.length > 0 ? (
          <>
            <div className="desktop-workbench products-workbench">
              <div className="desktop-table-pane">
                <div className="desktop-table products-table">
              <div className="desktop-table-head">
                <span>商品名</span>
                <span>カテゴリー</span>
                <span>メーカー</span>
                <span>産地</span>
                <span>温度帯</span>
                <span>荷姿</span>
                <span>原価</span>
                <span>希望販売価格</span>
                <span>粗利率</span>
                <span>資料</span>
                <span>操作</span>
              </div>
              {visibleProducts.map((product) => (
                <div
                  className={`desktop-table-row ${selectedPreviewProduct?.id === product.id ? 'selected' : ''}`}
                  key={product.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedPreviewId(product.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') setSelectedPreviewId(product.id);
                  }}
                >
                  <strong>{product.name}</strong>
                  <span>{product.category || '-'}</span>
                  <span>{product.manufacturerName || '-'}</span>
                  <span>{product.origin || '-'}</span>
                  <span>{product.temperatureZone || '-'}</span>
                  <span>{product.packageStyle || '-'}</span>
                  <span>{formatPrice(product.costPrice) || '-'}{product.costPrice !== '' ? `円/${product.costUnit}` : ''}</span>
                  <span>{formatPrice(product.desiredSellingPrice) || '-'}{product.desiredSellingPrice !== '' ? `円/${product.sellingPriceUnit}` : ''}</span>
                  <span>{product.grossMarginRate || '-'}</span>
                  <span>
                    {[
                      product.imageFile && '画像',
                      product.productMaterialFile && '資料',
                      product.specSheetFile && 'スペック',
                    ].filter(Boolean).join(', ') || 'なし'}
                  </span>
                  <span className="table-actions" onClick={(event) => event.stopPropagation()}>
                    <button className="ghost-button" onClick={() => onOpenProductDetail(product.id)}>編集</button>
                    <button className="ghost-button danger" onClick={() => removeProduct(product.id)}>削除</button>
                  </span>
                </div>
              ))}
                </div>
              </div>

              {selectedPreviewProduct && (
                <aside className="desktop-detail-preview">
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">Preview</p>
                      <h2>{selectedPreviewProduct.name}</h2>
                    </div>
                    <span className="status-pill active">{selectedPreviewProduct.temperatureZone || '-'}</span>
                  </div>
                  {selectedPreviewProduct.imageFile?.url ? (
                    <img
                      className="product-preview-image"
                      loading="lazy"
                      src={selectedPreviewProduct.imageFile.url}
                      alt={`${selectedPreviewProduct.name}の商品画像`}
                    />
                  ) : (
                    <div className="product-thumb placeholder desktop-preview-thumb">No Image</div>
                  )}
                  <dl className="company-details">
                    <div><dt>カテゴリー</dt><dd>{selectedPreviewProduct.category || '-'}</dd></div>
                    <div><dt>メーカー</dt><dd>{selectedPreviewProduct.manufacturerName || '-'}</dd></div>
                    <div><dt>産地</dt><dd>{selectedPreviewProduct.origin || '-'}</dd></div>
                    <div><dt>荷姿</dt><dd>{selectedPreviewProduct.packageStyle || '-'}</dd></div>
                    <div><dt>原価</dt><dd>{formatPrice(selectedPreviewProduct.costPrice) || '-'}</dd></div>
                    <div><dt>希望価格</dt><dd>{formatPrice(selectedPreviewProduct.desiredSellingPrice) || '-'}</dd></div>
                    <div><dt>粗利率</dt><dd>{selectedPreviewProduct.grossMarginRate || '-'}</dd></div>
                  </dl>
                  <p className="inline-helper">{selectedPreviewProduct.memo || selectedPreviewProduct.description || 'メモは未登録です。'}</p>
                  <div className="card-actions">
                    <button className="primary-button" onClick={() => onOpenProductDetail(selectedPreviewProduct.id)}>詳細編集</button>
                    <button className="ghost-button danger" onClick={() => removeProduct(selectedPreviewProduct.id)}>削除</button>
                  </div>
                </aside>
              )}
            </div>

            <div className="card-list-mobile">
              {visibleProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  removeProduct={removeProduct}
                  onOpenProductDetail={onOpenProductDetail}
                />
              ))}
            </div>

            {visibleCount < filteredProducts.length && (
              <button
                className="ghost-button"
                onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
              >
                さらに表示
              </button>
            )}
          </>
        ) : (
          <div className="empty-state">
            <h3>商品が見つかりません</h3>
            <p>検索条件を変えるか、商品マスターに新しい商品を追加してください。</p>
          </div>
        )}
      </section>
    </main>
  );
}

function ProductCard({ product, removeProduct, onOpenProductDetail }) {
  return (
    <article className="product-card">
      <div className="product-card-main">
        {product.imageFile?.url ? (
          <img
            className="product-thumb"
            src={product.imageFile.url}
            alt={`${product.name}の商品画像`}
          />
        ) : (
          <div className="product-thumb placeholder">No Image</div>
        )}

        <div className="company-heading">
          <h3>{product.name}</h3>
          <p>{product.category || 'カテゴリー未設定'} / {product.temperatureZone || '温度帯未設定'}</p>
        </div>
      </div>

      <dl className="company-details">
        <div>
          <dt>メーカー</dt>
          <dd>{product.manufacturerName || '未入力'}</dd>
        </div>
        <div>
          <dt>産地</dt>
          <dd>{product.origin || '未入力'}</dd>
        </div>
        <div>
          <dt>荷姿</dt>
          <dd>{product.packageStyle || '未入力'}</dd>
        </div>
        <div>
          <dt>原価</dt>
          <dd>{formatPrice(product.costPrice) || '未入力'}{product.costPrice !== '' ? `円/${product.costUnit}` : ''}</dd>
        </div>
        <div>
          <dt>希望価格</dt>
          <dd>{formatPrice(product.desiredSellingPrice) || '未入力'}{product.desiredSellingPrice !== '' ? `円/${product.sellingPriceUnit}` : ''}</dd>
        </div>
        <div>
          <dt>粗利率</dt>
          <dd>{product.grossMarginRate || '未入力'}</dd>
        </div>
      </dl>

      <div className="lead-badges">
        {(product.tags ?? []).map((tag) => (
          <span className="info-badge ready" key={tag}>{tag}</span>
        ))}
        <span className={`info-badge ${product.productMaterialFile ? 'ready' : 'muted'}`}>
          商品資料 {product.productMaterialFile ? 'あり' : 'なし'}
        </span>
        <span className={`info-badge ${product.specSheetFile ? 'ready' : 'muted'}`}>
          スペック {product.specSheetFile ? 'あり' : 'なし'}
        </span>
      </div>

      {product.memo && <p className="inline-helper">{product.memo}</p>}

      <div className="card-actions">
        <button className="ghost-button" onClick={() => onOpenProductDetail(product.id)}>
          詳細・編集
        </button>
        <button className="ghost-button danger" onClick={() => removeProduct(product.id)}>
          削除
        </button>
      </div>
    </article>
  );
}
