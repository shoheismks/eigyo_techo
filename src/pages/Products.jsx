import { useMemo, useState } from 'react';
import {
  PRODUCT_CATEGORIES,
  TEMPERATURE_ZONES,
  formatPrice,
} from '../hooks/useProducts.js';

const ALL = 'すべて';

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
        ].some((value) => includesText(value, normalizedKeyword));

      const matchesCategory =
        categoryFilter === ALL || product.category === categoryFilter;
      const matchesTemperature =
        temperatureFilter === ALL || product.temperatureZone === temperatureFilter;
      const matchesManufacturer =
        manufacturerFilter === ALL || product.manufacturerName === manufacturerFilter;

      return (
        matchesKeyword &&
        matchesCategory &&
        matchesTemperature &&
        matchesManufacturer
      );
    });
  }, [categoryFilter, keyword, manufacturerFilter, products, temperatureFilter]);

  return (
    <main className="page">
      <section className="page-header">
        <p className="eyebrow">Products</p>
        <h1>商品マスター</h1>
        <p>営業メールや商談で使う商品情報、価格、資料、スペックをまとめて管理します。</p>
      </section>

      <section className="search-panel">
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

        <label className="field-label">
          キーワード
          <input
            value={keyword}
            placeholder="商品名、メーカー、産地、荷姿、メモで検索"
            onChange={(event) => setKeyword(event.target.value)}
          />
        </label>

        <div className="date-grid">
          <label className="field-label">
            カテゴリー
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
            >
              <option>{ALL}</option>
              {PRODUCT_CATEGORIES.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </label>

          <label className="field-label">
            温度帯
            <select
              value={temperatureFilter}
              onChange={(event) => setTemperatureFilter(event.target.value)}
            >
              <option>{ALL}</option>
              {TEMPERATURE_ZONES.map((zone) => (
                <option key={zone}>{zone}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="field-label">
          メーカー名
          <select
            value={manufacturerFilter}
            onChange={(event) => setManufacturerFilter(event.target.value)}
          >
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

        {filteredProducts.length > 0 ? (
          filteredProducts.map((product) => (
            <article className="product-card" key={product.id}>
              <div className="product-card-main">
                {product.imageFile?.dataUrl ? (
                  <img
                    className="product-thumb"
                    src={product.imageFile.dataUrl}
                    alt={`${product.name}の商品画像`}
                  />
                ) : (
                  <div className="product-thumb placeholder">No Image</div>
                )}

                <div className="company-heading">
                  <h3>{product.name}</h3>
                  <p>
                    {product.category || 'カテゴリー未設定'} / {product.temperatureZone || '温度帯未設定'}
                  </p>
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
                  <dd>
                    {formatPrice(product.costPrice) || '未入力'}
                    {product.costPrice !== '' ? `円/${product.costUnit}` : ''}
                  </dd>
                </div>
                <div>
                  <dt>希望価格</dt>
                  <dd>
                    {formatPrice(product.desiredSellingPrice) || '未入力'}
                    {product.desiredSellingPrice !== '' ? `円/${product.sellingPriceUnit}` : ''}
                  </dd>
                </div>
                <div>
                  <dt>粗利率</dt>
                  <dd>{product.grossMarginRate || '未入力'}</dd>
                </div>
              </dl>

              <div className="lead-badges">
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
          ))
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
