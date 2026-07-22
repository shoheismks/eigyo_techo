import { useMemo, useState } from 'react';
import DesktopTable from '../../../shared/components/DesktopTable.jsx';
import { formatPrice, productDisplayName } from '../../products/hooks/useProducts.js';
import {
  PRICE_TYPES,
  PRICE_UNITS,
  isActivePrice,
} from '../services/customerProductPriceService.js';
import {
  emptyCustomerProductPrice,
  normalizeCustomerProductPrice,
} from '../hooks/useCustomerProductPrices.js';

const ALL = 'all';

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function displayCustomer(customer) {
  if (!customer) return '-';
  return [customer.companyName, customer.branchName].filter(Boolean).join(' ');
}

function displayPeriod(price) {
  if (!price.validFrom && !price.validTo) return '無期限';
  return `${price.validFrom || '開始未設定'} - ${price.validTo || '終了未設定'}`;
}

function displayQuantity(price) {
  if (!price.minimumQuantity && !price.maximumQuantity) return '条件なし';
  return `${price.minimumQuantity || '0'} - ${price.maximumQuantity || '上限なし'} ${price.priceUnit}`;
}

function duplicateWarning(prices, form) {
  return prices.some((price) =>
    price.id !== form.id &&
    !price.deletedAt &&
    price.customerId === form.customerId &&
    price.productId === form.productId &&
    price.priceUnit === form.priceUnit &&
    String(price.minimumQuantity || '') === String(form.minimumQuantity || '') &&
    String(price.maximumQuantity || '') === String(form.maximumQuantity || '') &&
    String(price.validFrom || '') === String(form.validFrom || '') &&
    String(price.validTo || '') === String(form.validTo || '') &&
    Number(price.priority || 0) === Number(form.priority || 0)
  );
}

export default function CustomerProductPrices({
  prices = [],
  priceHistory = [],
  customers = [],
  products = [],
  brands = [],
  addPrice,
  updatePrice,
  removePrice,
  deactivatePrice,
  userId = '',
}) {
  const [keyword, setKeyword] = useState('');
  const [customerFilter, setCustomerFilter] = useState(ALL);
  const [productFilter, setProductFilter] = useState(ALL);
  const [typeFilter, setTypeFilter] = useState(ALL);
  const [activeFilter, setActiveFilter] = useState('active');
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState(() => normalizeCustomerProductPrice({ ...emptyCustomerProductPrice, userId }, userId));
  const [message, setMessage] = useState('');

  const customerMap = useMemo(() => new Map(customers.map((customer) => [customer.id, customer])), [customers]);
  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const brandMap = useMemo(() => new Map(brands.map((brand) => [brand.id, brand])), [brands]);

  const visiblePrices = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return prices
      .filter((price) => !price.deletedAt)
      .filter((price) => customerFilter === ALL || price.customerId === customerFilter)
      .filter((price) => productFilter === ALL || price.productId === productFilter)
      .filter((price) => typeFilter === ALL || price.priceType === typeFilter)
      .filter((price) => {
        if (activeFilter === 'active') return isActivePrice(price);
        if (activeFilter === 'inactive') return price.isActive === false || !isActivePrice(price);
        return true;
      })
      .filter((price) => {
        if (!normalizedKeyword) return true;
        const customer = customerMap.get(price.customerId);
        const product = productMap.get(price.productId);
        const brand = brandMap.get(price.brandId);
        return [
          displayCustomer(customer),
          product?.name,
          product?.productCode,
          product?.manufacturerName,
          product?.category,
          brand?.name,
          price.priceType,
          price.notes,
        ].some((value) => String(value || '').toLowerCase().includes(normalizedKeyword));
      })
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  }, [activeFilter, brandMap, customerFilter, customerMap, keyword, priceHistory, prices, productFilter, productMap, typeFilter]);

  const selectedHistory = priceHistory
    .filter((entry) => entry.customerProductPriceId === editingId)
    .slice(0, 8);

  function resetForm() {
    setEditingId('');
    setForm(normalizeCustomerProductPrice({ ...emptyCustomerProductPrice, userId }, userId));
    setMessage('');
  }

  function editPrice(price) {
    setEditingId(price.id);
    setForm(normalizeCustomerProductPrice(price, userId));
    setMessage('');
  }

  function duplicatePrice(price) {
    setEditingId('');
    setForm(normalizeCustomerProductPrice({
      ...price,
      id: crypto.randomUUID(),
      validFrom: todayString(),
      validTo: '',
      notes: `${price.notes || ''} copy`.trim(),
      userId,
    }, userId));
    setMessage('');
  }

  function updateField(field, value) {
    setMessage('');
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === 'customerId') {
        const customer = customerMap.get(value);
        next.parentCustomerId = customer?.parentCustomerId || (customer?.isHeadOffice ? customer.id : '');
      }
      if (field === 'productId') {
        const product = productMap.get(value);
        next.brandId = product?.brandId || '';
        next.priceUnit = product?.sellingPriceUnit || product?.costUnit || next.priceUnit;
        next.unitPrice = next.unitPrice || product?.desiredSellingPrice || '';
      }
      return next;
    });
  }

  function submit(event) {
    event.preventDefault();
    const payload = normalizeCustomerProductPrice(form, userId);
    if (!payload.customerId) {
      setMessage('顧客を選択してください。');
      return;
    }
    if (!payload.productId) {
      setMessage('商品を選択してください。');
      return;
    }
    if (payload.unitPrice === '') {
      setMessage('単価（税抜）を入力してください。');
      return;
    }
    if (payload.validFrom && payload.validTo && payload.validFrom > payload.validTo) {
      setMessage('適用開始日は終了日以前にしてください。');
      return;
    }
    if (duplicateWarning(prices, payload)) {
      setMessage('同じ顧客・商品・単位・数量条件・期間・優先度の価格が既にあります。');
      return;
    }

    if (editingId) {
      updatePrice?.(editingId, payload, 'price master updated');
      setMessage('価格を更新しました。');
    } else {
      addPrice?.(payload, 'price master created');
      setMessage('価格を登録しました。');
      resetForm();
    }
  }

  const columns = [
    { key: 'customer', label: '顧客', minWidth: '220px', render: (price) => displayCustomer(customerMap.get(price.customerId)) },
    { key: 'product', label: '商品', minWidth: '260px', render: (price) => productDisplayName(productMap.get(price.productId), price.productId) },
    { key: 'brand', label: 'ブランド', minWidth: '140px', render: (price) => brandMap.get(price.brandId)?.name || productMap.get(price.productId)?.brandName || '-' },
    { key: 'priceType', label: '価格種別', minWidth: '120px', render: (price) => PRICE_TYPES.find((item) => item.value === price.priceType)?.label || price.priceType },
    { key: 'unitPrice', label: '単価（税抜）', minWidth: '130px', render: (price) => `${formatPrice(price.unitPrice) || '-'} / ${price.priceUnit}` },
    { key: 'quantity', label: '数量条件', minWidth: '150px', render: displayQuantity },
    { key: 'period', label: '適用期間', minWidth: '180px', render: displayPeriod },
    { key: 'scope', label: '適用範囲', minWidth: '150px', render: (price) => price.applyToChildCustomers ? '本社配下を含む' : 'この拠点のみ' },
    { key: 'status', label: '状態', minWidth: '100px', render: (price) => isActivePrice(price) ? '有効' : '無効' },
    { key: 'updatedAt', label: '更新日', minWidth: '120px', render: (price) => String(price.updatedAt || '').slice(0, 10) || '-' },
  ];

  return (
    <main className="page price-master-page">
      <section className="page-header">
        <p className="eyebrow">Price Master</p>
        <h1>顧客別価格マスター</h1>
        <p>商品ごと・顧客ごとの販売価格を管理し、見積と受注へ税抜単価を自動反映します。</p>
      </section>

      <section className="search-panel desktop-filter-panel">
        <label className="field-label filter-search">検索<input value={keyword} placeholder="顧客・商品・商品コード・ブランドで検索" onChange={(event) => setKeyword(event.target.value)} /></label>
        <label className="field-label">顧客<select value={customerFilter} onChange={(event) => setCustomerFilter(event.target.value)}><option value={ALL}>すべて</option>{customers.map((customer) => <option value={customer.id} key={customer.id}>{displayCustomer(customer)}</option>)}</select></label>
        <label className="field-label">商品<select value={productFilter} onChange={(event) => setProductFilter(event.target.value)}><option value={ALL}>すべて</option>{products.map((product) => <option value={product.id} key={product.id}>{productDisplayName(product, '商品未設定')}</option>)}</select></label>
        <label className="field-label">価格種別<select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value={ALL}>すべて</option>{PRICE_TYPES.map((type) => <option value={type.value} key={type.value}>{type.label}</option>)}</select></label>
        <label className="field-label">状態<select value={activeFilter} onChange={(event) => setActiveFilter(event.target.value)}><option value="active">有効</option><option value="inactive">無効/期限外</option><option value={ALL}>すべて</option></select></label>
      </section>

      <section className="detail-section">
        <div className="section-heading">
          <div>
            <h2>{editingId ? '価格編集' : '価格登録'}</h2>
            <span>同条件の重複は保存前に警告します。</span>
          </div>
          <button type="button" className="ghost-button" onClick={resetForm}>新規入力</button>
        </div>
        <form className="sample-form" onSubmit={submit}>
          <div className="date-grid">
            <label className="field-label">顧客<select value={form.customerId} onChange={(event) => updateField('customerId', event.target.value)}><option value="">未選択</option>{customers.map((customer) => <option value={customer.id} key={customer.id}>{displayCustomer(customer)}</option>)}</select></label>
            <label className="field-label">商品<select value={form.productId} onChange={(event) => updateField('productId', event.target.value)}><option value="">未選択</option>{products.map((product) => <option value={product.id} key={product.id}>{productDisplayName(product, '商品未設定')}</option>)}</select></label>
            <label className="field-label">価格種別<select value={form.priceType} onChange={(event) => updateField('priceType', event.target.value)}>{PRICE_TYPES.map((type) => <option value={type.value} key={type.value}>{type.label}</option>)}</select></label>
            <label className="field-label">単価（税抜）<input inputMode="decimal" value={form.unitPrice} onChange={(event) => updateField('unitPrice', event.target.value)} /></label>
            <label className="field-label">単位<select value={form.priceUnit} onChange={(event) => updateField('priceUnit', event.target.value)}>{PRICE_UNITS.map((unit) => <option key={unit}>{unit}</option>)}</select></label>
            <label className="field-label">税率(%)<input inputMode="decimal" value={form.taxRate} onChange={(event) => updateField('taxRate', event.target.value)} /></label>
            <label className="field-label">最小数量<input inputMode="decimal" value={form.minimumQuantity} onChange={(event) => updateField('minimumQuantity', event.target.value)} /></label>
            <label className="field-label">最大数量<input inputMode="decimal" value={form.maximumQuantity} onChange={(event) => updateField('maximumQuantity', event.target.value)} /></label>
            <label className="field-label">開始日<input type="date" value={form.validFrom} onChange={(event) => updateField('validFrom', event.target.value)} /></label>
            <label className="field-label">終了日<input type="date" value={form.validTo} onChange={(event) => updateField('validTo', event.target.value)} /></label>
            <label className="field-label">優先度<input inputMode="numeric" value={form.priority} onChange={(event) => updateField('priority', event.target.value)} /></label>
            <label className="field-label">状態<select value={form.isActive ? 'active' : 'inactive'} onChange={(event) => updateField('isActive', event.target.value === 'active')}><option value="active">有効</option><option value="inactive">無効</option></select></label>
          </div>
          <label className="field-label checkbox-line"><input type="checkbox" checked={form.applyToChildCustomers} onChange={(event) => updateField('applyToChildCustomers', event.target.checked)} />本社配下の支社・支店にも適用</label>
          <label className="field-label">メモ<textarea value={form.notes} onChange={(event) => updateField('notes', event.target.value)} /></label>
          <div className="mail-action-row">
            <button type="submit" className="primary-button">{editingId ? '更新' : '登録'}</button>
            {editingId && <button type="button" className="ghost-button" onClick={() => duplicatePrice(form)}>複製</button>}
            {editingId && <button type="button" className="ghost-button" onClick={() => deactivatePrice?.(editingId, 'deactivated from price master')}>無効化</button>}
            {editingId && <button type="button" className="ghost-button danger" onClick={() => removePrice?.(editingId, 'deleted from price master')}>削除</button>}
          </div>
          {message && <p className={message.includes('警告') || message.includes('選択') || message.includes('入力') || message.includes('既に') ? 'form-error-message' : 'notice-text'}>{message}</p>}
        </form>
        {editingId && (
          <div className="timeline-list">
            <h3>変更履歴</h3>
            {selectedHistory.length ? selectedHistory.map((entry) => (
              <div className="timeline-item" key={entry.id}>
                <strong>{entry.action}</strong>
                <span>{entry.reason || '-'} / {String(entry.createdAt || '').slice(0, 16).replace('T', ' ')}</span>
              </div>
            )) : <p className="notice-text">履歴はまだありません。</p>}
          </div>
        )}
      </section>

      <section className="result-stack">
        <div className="section-heading">
          <h2>価格一覧</h2>
          <span>{visiblePrices.length}件</span>
        </div>
        <DesktopTable
          columns={columns}
          rows={visiblePrices}
          actionWidth="220px"
          actions={(price) => (
            <>
              <button type="button" className="ghost-button" onClick={() => editPrice(price)}>編集</button>
              <button type="button" className="ghost-button" onClick={() => duplicatePrice(price)}>複製</button>
            </>
          )}
        />
        <div className="mobile-card-list">
          {visiblePrices.map((price) => (
            <article className="data-card" key={price.id} onClick={() => editPrice(price)}>
              <div className="card-main">
                <strong>{displayCustomer(customerMap.get(price.customerId))}</strong>
                <span>{productDisplayName(productMap.get(price.productId), '-')}</span>
              </div>
              <div className="card-meta">
                <span>{formatPrice(price.unitPrice)} / {price.priceUnit}</span>
                <span>{displayPeriod(price)}</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
