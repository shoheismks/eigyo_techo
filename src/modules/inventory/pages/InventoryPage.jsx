import { useEffect, useMemo, useState } from 'react';
import DesktopTable from '../../../shared/components/DesktopTable.jsx';
import { formatPrice, productDisplayName } from '../../products/hooks/useProducts.js';
import {
  INVENTORY_INBOUND_REASONS,
  INVENTORY_OUTBOUND_REASONS,
  INVENTORY_STATUSES,
  INVENTORY_TYPES,
  INVENTORY_UNITS,
  appendInventoryMovement,
  emptyInventory,
  inventoryAvailableQuantity,
  isValidInventoryCode,
  normalizeInventory,
  normalizeInventoryCode,
} from '../hooks/useInventory.js';

const TABS = [
  { key: 'list', label: '在庫一覧' },
  { key: 'inbound', label: '入庫' },
  { key: 'outbound', label: '出庫' },
  { key: 'stocktake', label: '棚卸' },
  { key: 'history', label: '入出庫履歴' },
];

const ALL = 'all';

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysString(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function parseNumber(value) {
  if (value === '' || value === null || value === undefined) return 0;
  const parsed = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function textIncludes(value, keyword) {
  return String(value ?? '').toLowerCase().includes(keyword);
}

function expiryState(inventory) {
  if (!inventory.expiryDate) return '';
  const today = todayString();
  const soon = addDaysString(30);
  if (inventory.expiryDate < today) return 'expired';
  if (inventory.expiryDate <= soon) return 'expiring';
  return '';
}

function inventoryAlertClass(inventory) {
  const quantity = parseNumber(inventory.quantity);
  const safetyStock = parseNumber(inventory.safetyStock);
  const expiry = expiryState(inventory);
  if (quantity <= 0 || expiry === 'expired') return 'inventory-danger';
  if (safetyStock > 0 && quantity <= safetyStock) return 'inventory-warning';
  if (expiry === 'expiring') return 'inventory-expiring';
  return '';
}

function buildHistory(inventories, products, suppliers) {
  return inventories
    .flatMap((inventory) => {
      const product = products.find((item) => item.id === inventory.productId);
      const supplier = suppliers.find((item) => item.id === inventory.supplierId);
      const history = Array.isArray(inventory.movementHistory) ? inventory.movementHistory : [];

      if (history.length === 0) {
        return [{
          id: `created-${inventory.id}`,
          date: inventory.receivedDate || inventory.createdAt || inventory.updatedAt,
          type: '登録',
          quantity: inventory.quantity,
          unit: inventory.unit,
          reason: inventory.inventoryStatus,
          handlerName: inventory.handlerName || inventory.createdByName,
          memo: inventory.memo,
          productName: productDisplayName(product, '商品未設定'),
          supplierName: supplier?.name || supplier?.companyName || '',
          lot: inventory.lot,
          inventoryCode: inventory.inventoryCode,
          projectId: '',
          quoteId: '',
          invoiceId: '',
        }];
      }

      return history.map((movement) => ({
        ...movement,
        id: movement.id || `${inventory.id}-${movement.createdAt}`,
        productName: productDisplayName(product, '商品未設定'),
        supplierName: supplier?.name || supplier?.companyName || '',
        lot: inventory.lot,
        inventoryCode: inventory.inventoryCode,
      }));
    })
    .sort((a, b) => String(b.date || b.createdAt || '').localeCompare(String(a.date || a.createdAt || '')));
}

function emptyMovementForm(initial = {}, user = null) {
  return {
    productId: initial.productId || '',
    inventoryId: initial.inventoryId || '',
    inventoryCode: '',
    supplierId: '',
    quantity: '',
    unit: 'kg',
    lot: '',
    expiryDate: '',
    manufactureDate: '',
    receivedDate: todayString(),
    location: '',
    cost: '',
    stockType: '現物',
    inventoryStatus: 'フリー',
    voucherNumber: '',
    handlerName: user?.email || '',
    reason: initial.reason || '仕入',
    memo: '',
  };
}

export default function InventoryPage({
  inventories = [],
  products = [],
  suppliers = [],
  projects = [],
  quotes = [],
  invoices = [],
  addInventory,
  updateInventory,
  removeInventory,
  initialAction = null,
  onInitialHandled,
  onOpenProductDetail,
  onCreateQuote,
  user = null,
  userId = '',
}) {
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('eigyo-techo-inventory-tab') || 'list');
  const [keyword, setKeyword] = useState(() => localStorage.getItem('eigyo-techo-inventory-keyword') || '');
  const [filter, setFilter] = useState(() => localStorage.getItem('eigyo-techo-inventory-filter') || ALL);
  const [form, setForm] = useState(() => emptyMovementForm(initialAction || {}, user));
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    localStorage.setItem('eigyo-techo-inventory-tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem('eigyo-techo-inventory-keyword', keyword);
  }, [keyword]);

  useEffect(() => {
    localStorage.setItem('eigyo-techo-inventory-filter', filter);
  }, [filter]);

  useEffect(() => {
    if (!initialAction) return;
    setActiveTab(initialAction.tab || 'inbound');
    setForm(emptyMovementForm(initialAction, user));
    onInitialHandled?.();
  }, [initialAction, onInitialHandled, user]);

  const selectedProduct = products.find((product) => product.id === form.productId);
  const selectedInventory = inventories.find((inventory) => inventory.id === form.inventoryId);
  const historyRows = useMemo(
    () => buildHistory(inventories, products, suppliers),
    [inventories, products, suppliers],
  );

  const summary = useMemo(() => {
    const today = todayString();
    const soon = addDaysString(30);
    return {
      outOfStock: inventories.filter((item) => parseNumber(item.quantity) <= 0).length,
      belowSafety: inventories.filter((item) => parseNumber(item.safetyStock) > 0 && parseNumber(item.quantity) <= parseNumber(item.safetyStock)).length,
      expiringSoon: inventories.filter((item) => item.expiryDate && item.expiryDate >= today && item.expiryDate <= soon).length,
      expired: inventories.filter((item) => item.expiryDate && item.expiryDate < today).length,
      inboundToday: historyRows.filter((item) => item.type === '入庫' && String(item.date).slice(0, 10) === today).length,
      outboundToday: historyRows.filter((item) => item.type === '出庫' && String(item.date).slice(0, 10) === today).length,
    };
  }, [historyRows, inventories]);

  const filteredInventories = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    const today = todayString();
    const soon = addDaysString(30);

    return inventories.filter((inventory) => {
      const product = products.find((item) => item.id === inventory.productId);
      const supplier = suppliers.find((item) => item.id === inventory.supplierId);
      const matchesKeyword =
        !normalizedKeyword ||
        [
          product?.name,
          product?.productCode,
          product?.category,
          inventory.inventoryCode,
          inventory.lot,
          inventory.location,
          inventory.owner,
          inventory.memo,
          supplier?.name,
          supplier?.companyName,
        ].some((value) => textIncludes(value, normalizedKeyword));
      const quantity = parseNumber(inventory.quantity);
      const matchesFilter =
        filter === ALL ||
        (filter === 'in-stock' && quantity > 0) ||
        (filter === 'out-of-stock' && quantity <= 0) ||
        (filter === 'expiring' && inventory.expiryDate && inventory.expiryDate >= today && inventory.expiryDate <= soon) ||
        (filter === 'expired' && inventory.expiryDate && inventory.expiryDate < today) ||
        (filter === 'has-lot' && Boolean(inventory.lot));

      return matchesKeyword && matchesFilter;
    });
  }, [filter, inventories, keyword, products, suppliers]);

  const filteredHistory = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return historyRows.filter((row) =>
      !normalizedKeyword ||
      [row.productName, row.inventoryCode, row.lot, row.type, row.reason, row.handlerName, row.memo]
        .some((value) => textIncludes(value, normalizedKeyword)),
    );
  }, [historyRows, keyword]);

  function setField(field, value) {
    setError('');
    setToast('');
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === 'productId') {
        const product = products.find((item) => item.id === value);
        next.unit = product?.costUnit || product?.sellingPriceUnit || current.unit || 'kg';
        next.cost = product?.costPrice || current.cost || '';
      }
      if (field === 'inventoryId') {
        const inventory = inventories.find((item) => item.id === value);
        if (inventory) {
          next.productId = inventory.productId;
          next.unit = inventory.unit || 'kg';
          next.lot = inventory.lot || '';
          next.expiryDate = inventory.expiryDate || '';
          next.location = inventory.location || '';
        }
      }
      return next;
    });
  }

  function validateCommon() {
    if (!form.productId) {
      setError('商品を選択してください。');
      return false;
    }
    if (parseNumber(form.quantity) <= 0 && activeTab !== 'stocktake') {
      setError('数量を入力してください。');
      return false;
    }
    const inventoryCode = normalizeInventoryCode(form.inventoryCode);
    if (!isValidInventoryCode(inventoryCode)) {
      setError('在庫コードは半角英数字と記号のみ使用できます。空欄も可能です。');
      return false;
    }
    if (
      inventoryCode &&
      inventories.some((inventory) =>
        inventory.id !== form.inventoryId &&
        normalizeInventoryCode(inventory.inventoryCode).toLowerCase() === inventoryCode.toLowerCase())
    ) {
      setError('同じ在庫コードが既に登録されています。');
      return false;
    }
    return true;
  }

  function handleInbound(event) {
    event.preventDefault();
    if (!validateCommon()) return;

    const inventoryId = addInventory?.(normalizeInventory({
      ...emptyInventory,
      ...form,
      inventoryCode: normalizeInventoryCode(form.inventoryCode),
      userId,
      createdBy: userId,
      createdByName: user?.email || '',
      movementHistory: appendInventoryMovement({}, {
        type: '入庫',
        quantity: form.quantity,
        unit: form.unit,
        reason: form.reason,
        date: form.receivedDate || todayString(),
        handlerName: form.handlerName,
        memo: form.memo,
      }),
    }, userId));

    setToast('在庫を登録しました。');
    setActiveTab('list');
    setForm(emptyMovementForm({ inventoryId }, user));
  }

  function handleOutbound(event) {
    event.preventDefault();
    if (!form.inventoryId) {
      setError('出庫するロットを選択してください。');
      return;
    }
    if (parseNumber(form.quantity) <= 0) {
      setError('出庫数量を入力してください。');
      return;
    }
    const inventory = selectedInventory;
    const nextQuantity = parseNumber(inventory.quantity) - parseNumber(form.quantity);
    if (nextQuantity < 0) {
      setError('現在庫を超えて出庫できません。');
      return;
    }

    updateInventory?.(inventory.id, {
      quantity: nextQuantity,
      inventoryStatus: nextQuantity <= 0 ? '欠品' : inventory.inventoryStatus,
      movementHistory: appendInventoryMovement(inventory, {
        type: '出庫',
        quantity: form.quantity,
        unit: form.unit,
        reason: form.reason,
        date: form.receivedDate || todayString(),
        handlerName: form.handlerName,
        memo: form.memo,
      }),
    });
    setToast('出庫を記録しました。');
    setActiveTab('list');
    setForm(emptyMovementForm({}, user));
  }

  function handleStocktake(event) {
    event.preventDefault();
    if (!form.inventoryId) {
      setError('棚卸する在庫を選択してください。');
      return;
    }
    const inventory = selectedInventory;
    const theoretical = parseNumber(inventory.quantity);
    const actual = parseNumber(form.quantity);
    const difference = actual - theoretical;
    updateInventory?.(inventory.id, {
      quantity: actual,
      movementHistory: appendInventoryMovement(inventory, {
        type: '棚卸',
        quantity: difference,
        unit: form.unit,
        reason: form.reason || '棚卸差異',
        date: form.receivedDate || todayString(),
        handlerName: form.handlerName,
        memo: form.memo,
      }),
    });
    setToast('棚卸結果を保存しました。');
    setActiveTab('list');
    setForm(emptyMovementForm({}, user));
  }

  const listColumns = [
    {
      key: 'image',
      label: '画像',
      width: '72px',
      render: (inventory) => {
        const product = products.find((item) => item.id === inventory.productId);
        return product?.imageFile?.url
          ? <img className="inventory-thumb" src={product.imageFile.url} alt={product.name} loading="lazy" />
          : <span className="inventory-thumb placeholder">No</span>;
      },
    },
    { key: 'productName', label: '商品名', minWidth: '220px', render: (inventory) => productDisplayName(products.find((item) => item.id === inventory.productId), '商品未設定') },
    { key: 'sku', label: 'SKU', minWidth: '120px', render: (inventory) => inventory.inventoryCode || products.find((item) => item.id === inventory.productId)?.productCode || '-' },
    { key: 'category', label: 'カテゴリ', minWidth: '110px', render: (inventory) => products.find((item) => item.id === inventory.productId)?.category || '-' },
    { key: 'quantity', label: '現在庫', width: '90px', render: (inventory) => `${formatPrice(inventory.quantity) || 0}` },
    { key: 'reserved', label: '引当', width: '90px', render: (inventory) => formatPrice(inventory.reservedQuantity) || 0 },
    { key: 'available', label: '使用可能', width: '100px', render: (inventory) => inventoryAvailableQuantity(inventory).toLocaleString('ja-JP') },
    { key: 'unit', label: '単位', width: '80px', render: (inventory) => inventory.unit || '-' },
    { key: 'location', label: '保管場所', minWidth: '140px', render: (inventory) => inventory.location || '-' },
    { key: 'lot', label: 'LOT', minWidth: '130px', render: (inventory) => inventory.lot || '-' },
    { key: 'expiry', label: '最短賞味期限', minWidth: '130px', render: (inventory) => inventory.expiryDate || '-' },
    { key: 'supplier', label: '仕入先', minWidth: '160px', render: (inventory) => suppliers.find((item) => item.id === inventory.supplierId)?.name || suppliers.find((item) => item.id === inventory.supplierId)?.companyName || '-' },
    { key: 'updated', label: '最終更新', minWidth: '120px', render: (inventory) => String(inventory.updatedAt || '').slice(0, 10) || '-' },
  ];

  const historyColumns = [
    { key: 'date', label: '日時', minWidth: '120px', render: (row) => String(row.date || row.createdAt || '').slice(0, 10) || '-' },
    { key: 'product', label: '商品', minWidth: '220px', render: (row) => row.productName },
    { key: 'lot', label: 'LOT', minWidth: '120px', render: (row) => row.lot || '-' },
    { key: 'type', label: '区分', minWidth: '90px', render: (row) => row.type },
    { key: 'quantity', label: '数量', minWidth: '90px', render: (row) => `${row.quantity || 0} ${row.unit || ''}` },
    { key: 'handler', label: '担当者', minWidth: '140px', render: (row) => row.handlerName || '-' },
    { key: 'reason', label: '理由', minWidth: '140px', render: (row) => row.reason || '-' },
    { key: 'project', label: '関連案件', minWidth: '140px', render: (row) => projects.find((item) => item.id === row.projectId)?.title || '-' },
    { key: 'quote', label: '関連見積', minWidth: '140px', render: (row) => quotes.find((item) => item.id === row.quoteId)?.quoteNumber || '-' },
    { key: 'invoice', label: '関連請求', minWidth: '140px', render: (row) => invoices.find((item) => item.id === row.invoiceId)?.invoiceNumber || '-' },
  ];

  return (
    <main className="page inventory-page">
      <section className="page-header inventory-hero">
        <div>
          <p className="eyebrow">Inventory</p>
          <h1>在庫管理</h1>
          <p>在庫登録、入庫、出庫、棚卸、入出庫履歴をここから操作できます。</p>
        </div>
        <button
          type="button"
          className="primary-button"
          onClick={() => {
            setActiveTab('inbound');
            setForm(emptyMovementForm({}, user));
          }}
        >
          ＋ 在庫登録
        </button>
      </section>

      {(toast || error) && (
        <section className="detail-section compact-feedback">
          {toast && <p className="notice-text">{toast}</p>}
          {error && <p className="error-text">{error}</p>}
        </section>
      )}

      <section className="dashboard-metrics inventory-metrics">
        <button type="button" className="metric-card red" onClick={() => setFilter('out-of-stock')}>
          <span>在庫切れ</span><strong>{summary.outOfStock}</strong>
        </button>
        <button type="button" className="metric-card orange" onClick={() => setFilter('in-stock')}>
          <span>安全在庫以下</span><strong>{summary.belowSafety}</strong>
        </button>
        <button type="button" className="metric-card gold" onClick={() => setFilter('expiring')}>
          <span>賞味期限30日以内</span><strong>{summary.expiringSoon}</strong>
        </button>
        <button type="button" className="metric-card red" onClick={() => setFilter('expired')}>
          <span>賞味期限切れ</span><strong>{summary.expired}</strong>
        </button>
        <button type="button" className="metric-card blue" onClick={() => setActiveTab('history')}>
          <span>本日入庫</span><strong>{summary.inboundToday}</strong>
        </button>
        <button type="button" className="metric-card blue" onClick={() => setActiveTab('history')}>
          <span>本日出庫</span><strong>{summary.outboundToday}</strong>
        </button>
      </section>

      <section className="inventory-tabs" aria-label="在庫管理タブ">
        {TABS.map((tab) => (
          <button
            type="button"
            className={activeTab === tab.key ? 'active' : ''}
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key);
              setError('');
              setToast('');
            }}
          >
            {tab.label}
          </button>
        ))}
      </section>

      {(activeTab === 'list' || activeTab === 'history') && (
        <section className="search-panel desktop-filter-panel inventory-filter-panel">
          <label className="field-label filter-search">
            検索
            <input
              value={keyword}
              placeholder="商品名、SKU、カテゴリ、仕入先、保管場所、LOTで検索"
              onChange={(event) => setKeyword(event.target.value)}
            />
          </label>
          {activeTab === 'list' && (
            <label className="field-label">
              フィルタ
              <select value={filter} onChange={(event) => setFilter(event.target.value)}>
                <option value={ALL}>すべて</option>
                <option value="in-stock">在庫あり</option>
                <option value="out-of-stock">在庫なし</option>
                <option value="expiring">賞味期限30日以内</option>
                <option value="expired">賞味期限切れ</option>
                <option value="has-lot">ロットあり</option>
              </select>
            </label>
          )}
        </section>
      )}

      {activeTab === 'list' && (
        <section className="result-stack inventory-list-section">
          <div className="section-heading">
            <h2>在庫一覧</h2>
            <span>{filteredInventories.length}件</span>
          </div>
          <DesktopTable
            actionWidth="220px"
            actions={(inventory) => (
              <>
                <button type="button" className="ghost-button" onClick={() => { setActiveTab('inbound'); setForm(emptyMovementForm({ productId: inventory.productId }, user)); }}>入庫</button>
                <button type="button" className="ghost-button" onClick={() => { setActiveTab('outbound'); setForm(emptyMovementForm({ inventoryId: inventory.id, productId: inventory.productId, reason: '販売' }, user)); }}>出庫</button>
                <button type="button" className="ghost-button" onClick={() => { setActiveTab('stocktake'); setForm(emptyMovementForm({ inventoryId: inventory.id, productId: inventory.productId, reason: '棚卸差異' }, user)); }}>棚卸</button>
              </>
            )}
            className="inventory-common-table"
            columns={listColumns}
            minWidth={1600}
            rowClassName={inventoryAlertClass}
            rows={filteredInventories}
          />
          <div className="card-list-mobile inventory-card-list">
            {filteredInventories.map((inventory) => {
              const product = products.find((item) => item.id === inventory.productId);
              const supplier = suppliers.find((item) => item.id === inventory.supplierId);
              return (
                <article className={`product-card inventory-card ${inventoryAlertClass(inventory)}`} key={inventory.id}>
                  <div className="product-card-main">
                    {product?.imageFile?.url ? <img className="product-thumb" src={product.imageFile.url} alt={product.name} loading="lazy" /> : <div className="product-thumb placeholder">No Image</div>}
                    <div className="company-heading">
                      <h3>{productDisplayName(product, '商品未設定')}</h3>
                      <p>{inventory.inventoryCode || product?.productCode || 'SKU未設定'} / LOT {inventory.lot || '-'}</p>
                    </div>
                  </div>
                  <dl className="company-details">
                    <div><dt>現在庫</dt><dd>{formatPrice(inventory.quantity) || 0} {inventory.unit}</dd></div>
                    <div><dt>使用可能</dt><dd>{inventoryAvailableQuantity(inventory).toLocaleString('ja-JP')} {inventory.unit}</dd></div>
                    <div><dt>保管場所</dt><dd>{inventory.location || '-'}</dd></div>
                    <div><dt>賞味期限</dt><dd>{inventory.expiryDate || '-'}</dd></div>
                    <div><dt>仕入先</dt><dd>{supplier?.name || supplier?.companyName || '-'}</dd></div>
                  </dl>
                  <div className="card-actions">
                    <button type="button" className="ghost-button" onClick={() => { setActiveTab('inbound'); setForm(emptyMovementForm({ productId: inventory.productId }, user)); }}>入庫</button>
                    <button type="button" className="ghost-button" onClick={() => { setActiveTab('outbound'); setForm(emptyMovementForm({ inventoryId: inventory.id, productId: inventory.productId, reason: '販売' }, user)); }}>出庫</button>
                    <button type="button" className="ghost-button" onClick={() => { setActiveTab('stocktake'); setForm(emptyMovementForm({ inventoryId: inventory.id, productId: inventory.productId, reason: '棚卸差異' }, user)); }}>棚卸</button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {activeTab === 'inbound' && (
        <InventoryInboundForm
          form={form}
          products={products}
          suppliers={suppliers}
          setField={setField}
          onSubmit={handleInbound}
        />
      )}

      {activeTab === 'outbound' && (
        <InventoryOutboundForm
          form={form}
          inventories={inventories}
          products={products}
          selectedInventory={selectedInventory}
          setField={setField}
          onSubmit={handleOutbound}
        />
      )}

      {activeTab === 'stocktake' && (
        <InventoryStocktakeForm
          form={form}
          inventories={inventories}
          products={products}
          selectedInventory={selectedInventory}
          setField={setField}
          onSubmit={handleStocktake}
        />
      )}

      {activeTab === 'history' && (
        <section className="result-stack inventory-list-section">
          <div className="section-heading">
            <h2>入出庫履歴</h2>
            <span>{filteredHistory.length}件</span>
          </div>
          <DesktopTable columns={historyColumns} rows={filteredHistory} getRowKey={(row) => row.id} minWidth={1300} />
          <div className="card-list-mobile inventory-card-list">
            {filteredHistory.map((row) => (
              <article className="product-card inventory-card" key={row.id}>
                <div className="history-meta">
                  <span>{row.type}</span>
                  <small>{String(row.date || '').slice(0, 10)}</small>
                </div>
                <h3>{row.productName}</h3>
                <dl className="company-details">
                  <div><dt>LOT</dt><dd>{row.lot || '-'}</dd></div>
                  <div><dt>数量</dt><dd>{row.quantity || 0} {row.unit}</dd></div>
                  <div><dt>担当者</dt><dd>{row.handlerName || '-'}</dd></div>
                  <div><dt>理由</dt><dd>{row.reason || '-'}</dd></div>
                </dl>
                {row.memo && <p className="inline-helper">{row.memo}</p>}
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function InventoryProductSelect({ value, products, onChange }) {
  return (
    <label className="field-label">
      商品
      <select value={value} onChange={(event) => onChange(event.target.value)} required>
        <option value="">商品を選択</option>
        {products.map((product) => (
          <option value={product.id} key={product.id}>
            {product.productCode ? `${product.productCode} / ` : ''}{productDisplayName(product, '商品名未設定')}
          </option>
        ))}
      </select>
    </label>
  );
}

function InventoryInboundForm({ form, products, suppliers, setField, onSubmit }) {
  return (
    <section className="detail-section inventory-form-section">
      <div className="section-heading">
        <h2>＋ 在庫登録・入庫</h2>
        <span className="info-badge ready">保存後は在庫一覧へ戻ります</span>
      </div>
      <form className="inventory-form-grid" onSubmit={onSubmit}>
        <InventoryProductSelect value={form.productId} products={products} onChange={(value) => setField('productId', value)} />
        <label className="field-label">数量<input inputMode="decimal" value={form.quantity} onChange={(event) => setField('quantity', event.target.value)} required /></label>
        <label className="field-label">単位<select value={form.unit} onChange={(event) => setField('unit', event.target.value)}>{INVENTORY_UNITS.map((unit) => <option key={unit}>{unit}</option>)}</select></label>
        <label className="field-label">ロット番号<input value={form.lot} onChange={(event) => setField('lot', event.target.value)} /></label>
        <label className="field-label">賞味期限<input type="date" value={form.expiryDate} onChange={(event) => setField('expiryDate', event.target.value)} /></label>
        <label className="field-label">製造日<input type="date" value={form.manufactureDate} onChange={(event) => setField('manufactureDate', event.target.value)} /></label>
        <label className="field-label">保管場所<input value={form.location} onChange={(event) => setField('location', event.target.value)} /></label>
        <label className="field-label">仕入先<select value={form.supplierId} onChange={(event) => setField('supplierId', event.target.value)}><option value="">未選択</option>{suppliers.map((supplier) => <option value={supplier.id} key={supplier.id}>{supplier.name || supplier.companyName || '仕入先名未設定'}</option>)}</select></label>
        <label className="field-label">仕入単価<input inputMode="decimal" value={form.cost} onChange={(event) => setField('cost', event.target.value)} /></label>
        <label className="field-label">入庫日<input type="date" value={form.receivedDate} onChange={(event) => setField('receivedDate', event.target.value)} /></label>
        <label className="field-label">伝票番号<input value={form.voucherNumber} onChange={(event) => setField('voucherNumber', event.target.value)} /></label>
        <label className="field-label">担当者<input value={form.handlerName} onChange={(event) => setField('handlerName', event.target.value)} /></label>
        <label className="field-label">入庫理由<select value={form.reason} onChange={(event) => setField('reason', event.target.value)}>{INVENTORY_INBOUND_REASONS.map((reason) => <option key={reason}>{reason}</option>)}</select></label>
        <label className="field-label">現物/先物<select value={form.stockType} onChange={(event) => setField('stockType', event.target.value)}>{INVENTORY_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
        <label className="field-label">在庫ステータス<select value={form.inventoryStatus} onChange={(event) => setField('inventoryStatus', event.target.value)}>{INVENTORY_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
        <label className="field-label">在庫コード<input value={form.inventoryCode} placeholder="LOT-2026-001" onChange={(event) => setField('inventoryCode', event.target.value)} onBlur={(event) => setField('inventoryCode', normalizeInventoryCode(event.target.value))} /></label>
        <label className="field-label full-width">メモ<textarea value={form.memo} onChange={(event) => setField('memo', event.target.value)} /></label>
        <button className="primary-button full-width" type="submit">＋ 在庫登録</button>
      </form>
    </section>
  );
}

function InventoryOutboundForm({ form, inventories, products, selectedInventory, setField, onSubmit }) {
  return (
    <section className="detail-section inventory-form-section">
      <div className="section-heading">
        <h2>－ 出庫</h2>
        {selectedInventory?.expiryDate && <span className="info-badge muted">賞味期限 {selectedInventory.expiryDate}</span>}
      </div>
      <form className="inventory-form-grid" onSubmit={onSubmit}>
        <label className="field-label full-width">
          商品・ロット
          <select value={form.inventoryId} onChange={(event) => setField('inventoryId', event.target.value)} required>
            <option value="">出庫する在庫を選択</option>
            {inventories.map((inventory) => {
              const product = products.find((item) => item.id === inventory.productId);
              return <option value={inventory.id} key={inventory.id}>{productDisplayName(product, '商品未設定')} / LOT {inventory.lot || '-'} / {inventory.quantity || 0}{inventory.unit}</option>;
            })}
          </select>
        </label>
        <label className="field-label">数量<input inputMode="decimal" value={form.quantity} onChange={(event) => setField('quantity', event.target.value)} required /></label>
        <label className="field-label">出庫日<input type="date" value={form.receivedDate} onChange={(event) => setField('receivedDate', event.target.value)} /></label>
        <label className="field-label">担当者<input value={form.handlerName} onChange={(event) => setField('handlerName', event.target.value)} /></label>
        <label className="field-label">出庫理由<select value={form.reason} onChange={(event) => setField('reason', event.target.value)}>{INVENTORY_OUTBOUND_REASONS.map((reason) => <option key={reason}>{reason}</option>)}</select></label>
        <label className="field-label full-width">メモ<textarea value={form.memo} onChange={(event) => setField('memo', event.target.value)} /></label>
        <button className="primary-button full-width" type="submit">出庫を記録</button>
      </form>
    </section>
  );
}

function InventoryStocktakeForm({ form, inventories, products, selectedInventory, setField, onSubmit }) {
  const theoretical = parseNumber(selectedInventory?.quantity);
  const actual = parseNumber(form.quantity);
  const difference = form.quantity === '' ? 0 : actual - theoretical;

  return (
    <section className="detail-section inventory-form-section">
      <div className="section-heading">
        <h2>棚卸</h2>
        <span className={`info-badge ${difference === 0 ? 'ready' : 'muted'}`}>差異 {difference.toLocaleString('ja-JP')}</span>
      </div>
      <form className="inventory-form-grid" onSubmit={onSubmit}>
        <label className="field-label full-width">
          対象在庫
          <select value={form.inventoryId} onChange={(event) => setField('inventoryId', event.target.value)} required>
            <option value="">棚卸する在庫を選択</option>
            {inventories.map((inventory) => {
              const product = products.find((item) => item.id === inventory.productId);
              return <option value={inventory.id} key={inventory.id}>{productDisplayName(product, '商品未設定')} / LOT {inventory.lot || '-'} / 理論 {inventory.quantity || 0}{inventory.unit}</option>;
            })}
          </select>
        </label>
        <div className="summary-card"><span>理論在庫</span><strong>{theoretical.toLocaleString('ja-JP')} {selectedInventory?.unit || ''}</strong></div>
        <label className="field-label">実在庫<input inputMode="decimal" value={form.quantity} onChange={(event) => setField('quantity', event.target.value)} required /></label>
        <label className="field-label">差異理由<select value={form.reason} onChange={(event) => setField('reason', event.target.value)}>{INVENTORY_INBOUND_REASONS.map((reason) => <option key={reason}>{reason}</option>)}</select></label>
        <label className="field-label">更新者<input value={form.handlerName} onChange={(event) => setField('handlerName', event.target.value)} /></label>
        <label className="field-label full-width">メモ<textarea value={form.memo} onChange={(event) => setField('memo', event.target.value)} /></label>
        <button className="primary-button full-width" type="submit">棚卸結果を保存</button>
      </form>
    </section>
  );
}
