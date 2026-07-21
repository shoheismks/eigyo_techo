import { useMemo, useState } from 'react';
import DesktopTable from '../../../shared/components/DesktopTable.jsx';
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

function productInventorySummary(product, inventories) {
  const productInventories = inventories.filter((inventory) => inventory.productId === product.id);
  const total = productInventories.reduce((sum, inventory) => sum + Number(inventory.quantity || 0), 0);
  const unit = productInventories[0]?.unit || product.costUnit || product.sellingPriceUnit || '';
  return {
    count: productInventories.length,
    total,
    unit,
  };
}

export default function Products({
  products,
  inventories = [],
  removeProduct,
  onOpenProductDetail,
  onOpenInventory,
}) {
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
          product.productCode,
          product.category,
          product.manufacturerName,
          product.origin,
          product.temperatureZone,
          product.packageStyle,
          product.memo,
          ...(product.tags ?? []),
        ].some((value) => includesText(value, normalizedKeyword));

      const matchesCategory = categoryFilter === ALL || product.category === categoryFilter;
      const matchesTemperature = temperatureFilter === ALL || product.temperatureZone === temperatureFilter;
      const matchesManufacturer = manufacturerFilter === ALL || product.manufacturerName === manufacturerFilter;

      return matchesKeyword && matchesCategory && matchesTemperature && matchesManufacturer;
    });
  }, [categoryFilter, keyword, manufacturerFilter, products, temperatureFilter]);

  const visibleProducts = filteredProducts.slice(0, visibleCount);
  const selectedPreviewProduct =
    visibleProducts.find((product) => product.id === selectedPreviewId) ||
    visibleProducts[0];

  const desktopColumns = useMemo(
    () => [
      {
        key: 'name',
        label: '商品名',
        width: '22%',
        minWidth: '260px',
        render: (product) => <strong>{product.name}</strong>,
      },
      { key: 'productCode', label: '商品コード', minWidth: '130px', render: (product) => product.productCode || '-' },
      { key: 'category', label: 'カテゴリー', minWidth: '100px', render: (product) => product.category || '-' },
      { key: 'manufacturerName', label: 'メーカー', width: '16%', minWidth: '180px', render: (product) => product.manufacturerName || '-' },
      { key: 'origin', label: '産地', minWidth: '90px', render: (product) => product.origin || '-' },
      { key: 'temperatureZone', label: '温度帯', width: '90px', minWidth: '90px', render: (product) => product.temperatureZone || '-' },
      { key: 'packageStyle', label: '荷姿', minWidth: '90px', render: (product) => product.packageStyle || '-' },
      {
        key: 'stock',
        label: '現在庫',
        minWidth: '120px',
        render: (product) => {
          const stock = productInventorySummary(product, inventories);
          return `${stock.total.toLocaleString('ja-JP')} ${stock.unit}`;
        },
      },
      {
        key: 'desiredSellingPrice',
        label: '希望販売価格',
        width: '130px',
        minWidth: '130px',
        render: (product) =>
          `${formatPrice(product.desiredSellingPrice) || '-'}${product.desiredSellingPrice !== '' ? `/${product.sellingPriceUnit}` : ''}`,
      },
      { key: 'grossMarginRate', label: '粗利率', width: '90px', minWidth: '90px', render: (product) => product.grossMarginRate || '-' },
      {
        key: 'files',
        label: '資料',
        minWidth: '130px',
        render: (product) =>
          [
            product.imageFile && '画像',
            product.productMaterialFile && '資料',
            product.specSheetFile && 'スペック',
          ].filter(Boolean).join(', ') || 'なし',
      },
    ],
    [inventories],
  );

  function resetPaging(handler) {
    return (event) => {
      handler(event);
      setVisibleCount(PAGE_SIZE);
    };
  }

  function openInbound(productId) {
    onOpenInventory?.({ tab: 'inbound', productId });
  }

  function openOutbound(productId) {
    const inventory = inventories.find((item) => item.productId === productId);
    onOpenInventory?.({ tab: 'outbound', productId, inventoryId: inventory?.id || '' });
  }

  return (
    <main className="page products-page">
      <section className="page-header">
        <div>
          <p className="eyebrow">Products</p>
          <h1>商品マスター</h1>
          <p>商品情報と在庫導線をまとめて確認できます。在庫登録は各商品行の「＋入庫」から直接開始できます。</p>
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
            placeholder="商品名、商品コード、メーカー、産地、タグ、メモで検索"
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
            <DesktopTable
              actionWidth="260px"
              actions={(product) => (
                <>
                  <button className="ghost-button" onClick={() => onOpenProductDetail(product.id)}>編集</button>
                  <button className="ghost-button" onClick={() => openInbound(product.id)}>＋入庫</button>
                  <button className="ghost-button" onClick={() => openOutbound(product.id)}>－出庫</button>
                  <button className="ghost-button danger" onClick={() => removeProduct(product.id)}>削除</button>
                </>
              )}
              className="products-common-table"
              columns={desktopColumns}
              minWidth={1450}
              onRowClick={(product) => setSelectedPreviewId(product.id)}
              rows={visibleProducts}
              selectedRowId={selectedPreviewProduct?.id}
            />

            <div className="card-list-mobile">
              {visibleProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  inventories={inventories}
                  removeProduct={removeProduct}
                  onOpenProductDetail={onOpenProductDetail}
                  onOpenInventory={onOpenInventory}
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

function ProductCard({ product, inventories, removeProduct, onOpenProductDetail, onOpenInventory }) {
  const stock = productInventorySummary(product, inventories);
  const inventory = inventories.find((item) => item.productId === product.id);

  return (
    <article className="product-card">
      <div className="product-card-main">
        {product.imageFile?.url ? (
          <img
            className="product-thumb"
            src={product.imageFile.url}
            alt={`${product.name}の商品画像`}
            loading="lazy"
          />
        ) : (
          <div className="product-thumb placeholder">No Image</div>
        )}

        <div className="company-heading">
          <h3>{product.name}</h3>
          {product.productCode && <p>商品コード: {product.productCode}</p>}
          <p>{product.category || 'カテゴリー未設定'} / {product.temperatureZone || '温度帯未設定'}</p>
        </div>
      </div>

      <dl className="company-details">
        <div><dt>商品コード</dt><dd>{product.productCode || '未入力'}</dd></div>
        <div><dt>メーカー</dt><dd>{product.manufacturerName || '未入力'}</dd></div>
        <div><dt>産地</dt><dd>{product.origin || '未入力'}</dd></div>
        <div><dt>荷姿</dt><dd>{product.packageStyle || '未入力'}</dd></div>
        <div><dt>現在庫</dt><dd>{stock.total.toLocaleString('ja-JP')} {stock.unit}</dd></div>
        <div><dt>希望販売価格</dt><dd>{formatPrice(product.desiredSellingPrice) || '未入力'}{product.desiredSellingPrice !== '' ? `/${product.sellingPriceUnit}` : ''}</dd></div>
        <div><dt>粗利率</dt><dd>{product.grossMarginRate || '未入力'}</dd></div>
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
        <button className="ghost-button" onClick={() => onOpenInventory?.({ tab: 'inbound', productId: product.id })}>
          ＋入庫
        </button>
        <button className="ghost-button" onClick={() => onOpenInventory?.({ tab: 'outbound', productId: product.id, inventoryId: inventory?.id || '' })}>
          －出庫
        </button>
        <button className="ghost-button danger" onClick={() => removeProduct(product.id)}>
          削除
        </button>
      </div>
    </article>
  );
}
