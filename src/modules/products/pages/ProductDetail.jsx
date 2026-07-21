import { useEffect, useMemo, useState } from 'react';
import {
  PRODUCT_CATEGORIES,
  PRODUCT_UNITS,
  TEMPERATURE_ZONES,
  calculateGrossMarginRate,
  emptyProduct,
  formatPrice,
  isValidProductCode,
  normalizeProductCode,
  normalizeProduct,
  parsePrice,
} from '../hooks/useProducts.js';
import {
  findDuplicateBrand,
  normalizeBrand,
  normalizeBrandName,
} from '../hooks/useBrands.js';
import { uploadAttachment } from '../../../shared/services/storageService.js';
import {
  INVENTORY_STATUSES,
  INVENTORY_TYPES,
  INVENTORY_UNITS,
  emptyInventory,
  inventoryAvailableQuantity,
  inventoryLabel,
  isValidInventoryCode,
  normalizeInventoryCode,
  normalizeInventory,
} from '../../inventory/hooks/useInventory.js';
import { calculateProjectProductProposal } from '../../deals/services/projectProductProposalService.js';

function fileLabel(file) {
  return file?.name ? `${file.name} (${Math.ceil((file.size ?? 0) / 1024)}KB)` : '未添付';
}

function daysUntil(value) {
  if (!value) return null;
  const target = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

function inventoryAlerts(inventory) {
  const alerts = [];
  const firmDays = daysUntil(inventory.firmDeadline);
  const etaDays = daysUntil(inventory.eta);
  const expiryDays = daysUntil(inventory.expiryDate);

  if (firmDays !== null && firmDays < 0) {
    alerts.push({ label: 'ファーム期限切れ', className: 'failed' });
  } else if (firmDays !== null && firmDays <= 7) {
    alerts.push({ label: `ファーム期限 ${firmDays === 0 ? '今日' : `${firmDays}日以内`}`, className: 'muted' });
  }

  if (etaDays !== null && etaDays < 0 && inventory.inventoryStatus === '入港待ち') {
    alerts.push({ label: 'ETA超過', className: 'failed' });
  } else if (etaDays !== null && etaDays <= 7 && etaDays >= 0) {
    alerts.push({ label: `ETA ${etaDays === 0 ? '今日' : `${etaDays}日以内`}`, className: 'ready' });
  }

  if (expiryDays !== null && expiryDays < 0) {
    alerts.push({ label: '賞味期限切れ', className: 'failed' });
  } else if (expiryDays !== null && expiryDays <= 30) {
    alerts.push({ label: `賞味期限 ${expiryDays === 0 ? '今日' : `${expiryDays}日以内`}`, className: 'muted' });
  }

  return alerts;
}

function searchText(values) {
  return values.filter(Boolean).join(' ').toLowerCase();
}

function productSnapshot(product) {
  if (!product) return '';
  const {
    updatedAt: _updatedAt,
    createdAt: _createdAt,
    ...rest
  } = normalizeProduct(product);
  return JSON.stringify(rest);
}

export default function ProductDetail({
  product,
  products = [],
  brands = [],
  inventories = [],
  adoptions = [],
  samples = [],
  quotes = [],
  projects = [],
  customers = [],
  suppliers = [],
  addProduct,
  updateProduct,
  addBrand,
  updateAdoption,
  updateSample,
  updateQuote,
  addInventory,
  updateInventory,
  removeInventory,
  setActivePage,
  onCreateQuote,
  onOpenInventory,
  userId = '',
}) {
  const [form, setForm] = useState(() =>
    normalizeProduct(product ?? { ...emptyProduct, id: crypto.randomUUID(), userId }, userId),
  );
  const [inventoryForm, setInventoryForm] = useState(() =>
    normalizeInventory({ ...emptyInventory, productId: product?.id ?? '', userId }, userId),
  );
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryStatusFilter, setInventoryStatusFilter] = useState('all');
  const [inventoryTypeFilter, setInventoryTypeFilter] = useState('all');
  const [uploadingField, setUploadingField] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState('');
  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    productSnapshot(normalizeProduct(product ?? { ...emptyProduct, id: crypto.randomUUID(), userId }, userId)),
  );
  const isNew = !product;

  useEffect(() => {
    const nextForm = normalizeProduct(product ?? { ...emptyProduct, id: crypto.randomUUID(), userId }, userId);
    setForm(nextForm);
    setSavedSnapshot(productSnapshot(nextForm));
    setSaveMessage('');
    setSaveError('');
  }, [product, userId]);

  useEffect(() => {
    setInventoryForm(normalizeInventory({
      ...emptyInventory,
      productId: product?.id ?? '',
      userId,
    }, userId));
  }, [product?.id, userId]);

  const grossMarginRate = useMemo(
    () => calculateGrossMarginRate(form.costPrice, form.desiredSellingPrice),
    [form.costPrice, form.desiredSellingPrice],
  );
  const isDirty = useMemo(() => {
    if (isNew) return true;
    return productSnapshot(form) !== savedSnapshot;
  }, [form, isNew, savedSnapshot]);
  const relatedInventories = useMemo(
    () =>
      inventories
        .filter((inventory) => inventory.productId === form.id)
        .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))),
    [form.id, inventories],
  );
  const activeBrands = useMemo(
    () =>
      brands
        .filter((brand) => brand.isActive !== false && !brand.deletedAt)
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ja')),
    [brands],
  );
  const relatedBrand = useMemo(
    () =>
      activeBrands.find((brand) => brand.id === form.brandId) ||
      activeBrands.find((brand) => brand.name === form.brandName) ||
      null,
    [activeBrands, form.brandId, form.brandName],
  );
  const relatedBrandProducts = useMemo(
    () =>
      form.brandName
        ? products
            .filter((item) => item.id !== form.id && item.brandName === form.brandName)
            .slice(0, 6)
        : [],
    [form.brandName, form.id, products],
  );
  const brandCandidates = useMemo(() => {
    const manufacturer = String(form.manufacturerName || '').trim();
    const supplierIds = new Set(relatedInventories.map((inventory) => inventory.supplierId).filter(Boolean));
    const related = activeBrands.filter((brand) => (
      !manufacturer ||
      !brand.manufacturerId ||
      brand.manufacturerId === manufacturer ||
      supplierIds.has(brand.supplierId)
    ));
    return related.length ? related : activeBrands;
  }, [activeBrands, form.manufacturerName, relatedInventories]);
  const inventorySummary = useMemo(() => {
    const total = relatedInventories.reduce((sum, inventory) => sum + Number(inventory.quantity || 0), 0);
    const reserved = relatedInventories.reduce((sum, inventory) => sum + Number(inventory.reservedQuantity || 0), 0);
    const available = relatedInventories.reduce((sum, inventory) => sum + inventoryAvailableQuantity(inventory), 0);
    const unit = relatedInventories[0]?.unit || form.costUnit || form.sellingPriceUnit || '';
    return { total, reserved, available, unit };
  }, [form.costUnit, form.sellingPriceUnit, relatedInventories]);
  const filteredInventories = useMemo(() => {
    const query = inventorySearch.trim().toLowerCase();

    return relatedInventories.filter((inventory) => {
      const supplier = suppliers.find((item) => item.id === inventory.supplierId);
      const matchesStatus =
        inventoryStatusFilter === 'all' || inventory.inventoryStatus === inventoryStatusFilter;
      const matchesType = inventoryTypeFilter === 'all' || inventory.stockType === inventoryTypeFilter;
      const matchesQuery =
        !query ||
        searchText([
          inventory.inventoryStatus,
          inventory.stockType,
          inventory.inventoryCode,
          form.name,
          form.productCode,
          inventory.owner,
          inventory.lot,
          inventory.memo,
          inventory.cost,
          inventory.currency,
          inventory.quantity,
          inventory.unit,
          inventory.firmDeadline,
          inventory.eta,
          inventory.expiryDate,
          supplier?.name,
          supplier?.companyName,
        ]).includes(query);

      return matchesStatus && matchesType && matchesQuery;
    });
  }, [form.name, form.productCode, inventorySearch, inventoryStatusFilter, inventoryTypeFilter, relatedInventories, suppliers]);
  const relatedInventoryIds = useMemo(
    () => new Set(relatedInventories.map((inventory) => inventory.id)),
    [relatedInventories],
  );
  const relatedSamples = useMemo(
    () =>
      samples
        .filter((sample) => (sample.productIds ?? []).includes(form.id))
        .sort((a, b) =>
          String(b.followUpDate || b.shippedDate || b.createdAt || '').localeCompare(
            String(a.followUpDate || a.shippedDate || a.createdAt || ''),
          ),
        ),
    [form.id, samples],
  );
  const relatedQuotes = useMemo(
    () =>
      quotes
        .filter(
          (quote) =>
            (quote.productIds ?? []).includes(form.id) ||
            (quote.inventoryIds ?? []).some((id) => relatedInventoryIds.has(id)),
        )
        .sort((a, b) =>
          String(b.submittedDate || b.createdAt || '').localeCompare(
            String(a.submittedDate || a.createdAt || ''),
          ),
        ),
    [form.id, quotes, relatedInventoryIds],
  );
  const relatedAdoptions = useMemo(
    () =>
      adoptions
        .filter((adoption) => adoption.productId === form.id)
        .sort((a, b) =>
          String(b.adoptedDate || b.createdAt || '').localeCompare(
            String(a.adoptedDate || a.createdAt || ''),
          ),
        ),
    [adoptions, form.id],
  );
  const relatedProjectProposals = useMemo(
    () =>
      projects
        .flatMap((project) =>
          (project.productProposals ?? [])
            .filter((proposal) => proposal.productId === form.id)
            .map((proposal) => ({ project, proposal })),
        )
        .sort((a, b) =>
          String(b.proposal.updatedAt || b.project.updatedAt || '').localeCompare(
            String(a.proposal.updatedAt || a.project.updatedAt || ''),
          ),
        ),
    [form.id, projects],
  );

  function updateField(field, value) {
    setSaveMessage('');
    setSaveError('');
    setForm((current) => {
      const nextForm = { ...current, [field]: value };
      if (field === 'costPrice' || field === 'desiredSellingPrice') {
        nextForm.grossMarginRate = calculateGrossMarginRate(
          field === 'costPrice' ? value : nextForm.costPrice,
          field === 'desiredSellingPrice' ? value : nextForm.desiredSellingPrice,
        );
      }
      return nextForm;
    });
  }

  function updateTags(value) {
    updateField(
      'tags',
      value
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    );
  }

  function updateBrandName(value) {
    const name = normalizeBrandName(value);
    const matchedBrand = activeBrands.find((brand) => brand.name === name);
    setSaveMessage('');
    setSaveError('');
    setForm((current) => ({
      ...current,
      brandId: matchedBrand?.id || '',
      brandName: name,
    }));
  }

  function clearBrand() {
    setSaveMessage('');
    setSaveError('');
    setForm((current) => ({ ...current, brandId: '', brandName: '' }));
  }

  function createBrandFromInput() {
    const name = normalizeBrandName(form.brandName);
    if (!name || !addBrand) return;
    const duplicate = findDuplicateBrand(activeBrands, name);
    if (duplicate) {
      setForm((current) => ({ ...current, brandId: duplicate.id, brandName: duplicate.name }));
      setSaveMessage('既存ブランドを選択しました。');
      return;
    }

    const brandId = addBrand(normalizeBrand({
      name,
      manufacturerId: form.manufacturerName || '',
      country: form.origin || '',
      userId,
    }, userId));
    setForm((current) => ({ ...current, brandId, brandName: name }));
    setSaveMessage('ブランドを追加しました。');
  }

  function updateInventoryField(field, value) {
    setInventoryForm((current) => ({ ...current, [field]: value }));
  }

  function validateInventoryCode(value, currentId = '') {
    const inventoryCode = normalizeInventoryCode(value);
    if (!isValidInventoryCode(inventoryCode)) {
      setSaveError('在庫コードは半角英数字と記号のみ使用できます。空白、日本語、全角文字は使えません。');
      return null;
    }

    if (
      inventoryCode &&
      inventories.some((inventory) =>
        inventory.id !== currentId &&
        normalizeInventoryCode(inventory.inventoryCode).toLowerCase() === inventoryCode.toLowerCase())
    ) {
      setSaveError('同じ在庫コードが既に登録されています。別の在庫コードを入力してください。');
      return null;
    }

    return inventoryCode;
  }

  function updateInventoryRecord(inventory, updates) {
    setSaveMessage('');
    setSaveError('');

    if (Object.hasOwn(updates, 'inventoryCode')) {
      const inventoryCode = validateInventoryCode(updates.inventoryCode, inventory.id);
      if (inventoryCode === null) {
        return;
      }
      updateInventory?.(inventory.id, { ...updates, inventoryCode });
      return;
    }

    updateInventory?.(inventory.id, updates);
  }

  function handleAddInventory(event) {
    event.preventDefault();
    if (!addInventory || isNew) {
      return;
    }

    const inventoryCode = validateInventoryCode(inventoryForm.inventoryCode);
    if (inventoryCode === null) {
      return;
    }

    addInventory(normalizeInventory({
      ...inventoryForm,
      inventoryCode,
      productId: form.id,
      userId,
    }, userId));
    setInventoryForm(normalizeInventory({ ...emptyInventory, productId: form.id, userId }, userId));
  }

  async function handleFile(field, file) {
    if (!file) {
      return;
    }

    setUploadingField(field);
    setUploadError('');
    setSaveMessage('');
    setSaveError('');

    try {
      const ownerId = form.id || crypto.randomUUID();
      const fileRecord = await uploadAttachment({
        file,
        userId,
        ownerType: 'product',
        ownerId,
        field,
      });
      setForm((current) => ({
        ...current,
        id: ownerId,
        [field]: fileRecord,
        attachments: [
          ...(current.attachments ?? []).filter((item) => item.field !== field),
          fileRecord,
        ],
      }));
    } catch (error) {
      if (error.code === '23505' || String(error.message || '').includes('products_user_product_code_unique_idx')) {
        setSaveError('同じ商品コードが既に登録されています。別の商品コードを入力してください。');
        return;
      }
      if (error.code === '23514' || String(error.message || '').includes('products_product_code_ascii_check')) {
        setSaveError('商品コードは半角英数字と記号のみ使用できます。空白、日本語、全角文字は使えません。');
        return;
      }
      setUploadError(error.message || '添付ファイルのアップロードに失敗しました。');
    } finally {
      setUploadingField('');
    }
  }

  function removeFile(field) {
    setSaveMessage('');
    setSaveError('');
    setForm((current) => ({
      ...current,
      [field]: null,
      attachments: (current.attachments ?? []).filter((item) => item.field !== field),
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaveMessage('');
    setSaveError('');

    if (!form.name.trim()) {
      setSaveError('商品名は必須です。');
      return;
    }

    const productCode = normalizeProductCode(form.productCode);
    if (!isValidProductCode(productCode)) {
      setSaveError('商品コードは半角英数字と記号のみ使用できます。空白、日本語、全角文字は使えません。');
      return;
    }

    if (
      productCode &&
      products.some((item) =>
        item.id !== form.id &&
        normalizeProductCode(item.productCode).toLowerCase() === productCode.toLowerCase())
    ) {
      setSaveError('同じ商品コードが既に登録されています。別の商品コードを入力してください。');
      return;
    }

    if (!isNew && !isDirty) {
      setSaveMessage('変更なし');
      return;
    }

    const payload = normalizeProduct({
      ...form,
      userId,
      productCode,
      costPrice: parsePrice(form.costPrice),
      desiredSellingPrice: parsePrice(form.desiredSellingPrice),
      grossMarginRate,
    }, userId);

    setSaving(true);
    try {
      if (isNew) {
        addProduct(payload);
        setActivePage('Products');
      } else {
        await updateProduct(product.id, payload);
        setForm(payload);
        setSavedSnapshot(productSnapshot(payload));
        setSaveMessage('商品情報を更新しました。');
      }
    } catch (error) {
      setSaveError(error.message || '商品情報の更新に失敗しました。');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page">
      <section className="page-header">
        <p className="eyebrow">Product detail</p>
        <h1>{isNew ? '商品追加' : '商品詳細'}</h1>
        <p>商品情報、価格、添付ファイルをSupabaseに同期して管理します。</p>
      </section>

      {!isNew && (
        <section className="detail-section inventory-product-summary">
          <div className="section-heading">
            <h2>在庫サマリー</h2>
            <div className="mail-action-row">
              <button type="button" className="primary-button compact-button" onClick={() => onOpenInventory?.({ tab: 'inbound', productId: form.id })}>
                ＋在庫登録
              </button>
              <button type="button" className="ghost-button compact-button" onClick={() => onOpenInventory?.({ tab: 'outbound', productId: form.id, inventoryId: relatedInventories[0]?.id || '' })}>
                －出庫
              </button>
              <button type="button" className="ghost-button compact-button" onClick={() => onOpenInventory?.({ tab: 'stocktake', productId: form.id, inventoryId: relatedInventories[0]?.id || '' })}>
                棚卸
              </button>
            </div>
          </div>
          <div className="dashboard-metrics inventory-summary-cards">
            <div className="metric-card blue"><span>現在庫</span><strong>{inventorySummary.total.toLocaleString('ja-JP')} {inventorySummary.unit}</strong></div>
            <div className="metric-card orange"><span>引当在庫</span><strong>{inventorySummary.reserved.toLocaleString('ja-JP')} {inventorySummary.unit}</strong></div>
            <div className="metric-card gold"><span>使用可能在庫</span><strong>{inventorySummary.available.toLocaleString('ja-JP')} {inventorySummary.unit}</strong></div>
          </div>
        </section>
      )}

      <form onSubmit={handleSubmit}>
        {(saveMessage || saveError) && (
          <section className="detail-section save-status-section">
            {saveMessage && <p className="notice-text">{saveMessage}</p>}
            {saveError && <p className="error-text">{saveError}</p>}
          </section>
        )}

        <section className="detail-section">
          <div className="section-heading">
            <h2>基本情報</h2>
            <div className="mail-action-row">
              {!isNew && (
                <button type="button" className="ghost-button" onClick={() => onCreateQuote?.({ productId: form.id })}>
                  この商品で見積作成
                </button>
              )}
              <button type="button" className="text-button" onClick={() => setActivePage('Products')}>
                一覧へ
              </button>
            </div>
          </div>

          <label className="field-label">
            商品名
            <input
              value={form.name}
              placeholder="例: 和牛ベーコン"
              onChange={(event) => updateField('name', event.target.value)}
            />
          </label>

          <label className="field-label">
            商品コード
            <input
              value={form.productCode}
              placeholder="例: ABC-001"
              onChange={(event) => updateField('productCode', event.target.value)}
              onBlur={() => updateField('productCode', normalizeProductCode(form.productCode))}
            />
            <span className="inline-helper">任意入力。半角英数字と記号のみ、空白・日本語・全角文字は使用不可。</span>
          </label>

          <div className="date-grid">
            <label className="field-label">
              カテゴリー
              <select
                value={form.category}
                onChange={(event) => updateField('category', event.target.value)}
              >
                <option value="">選択してください</option>
                {PRODUCT_CATEGORIES.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </label>

            <label className="field-label">
              温度帯
              <select
                value={form.temperatureZone}
                onChange={(event) => updateField('temperatureZone', event.target.value)}
              >
                {TEMPERATURE_ZONES.map((zone) => (
                  <option key={zone}>{zone}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="field-label">
            タグ
            <input
              value={(form.tags ?? []).join(', ')}
              placeholder="例: 高級, 冷凍, 差別化"
              onChange={(event) => updateTags(event.target.value)}
            />
          </label>

          <label className="field-label">
            メーカー名
            <input
              value={form.manufacturerName}
              placeholder="例: サンプルフーズ"
              onChange={(event) => updateField('manufacturerName', event.target.value)}
            />
          </label>

          <label className="field-label">
            ブランド
            <input
              value={form.brandName}
              list="product-brand-options"
              placeholder="未設定可。入力して既存選択または新規追加"
              onChange={(event) => updateBrandName(event.target.value)}
            />
            <datalist id="product-brand-options">
              {brandCandidates.map((brand) => (
                <option value={brand.name} key={brand.id} />
              ))}
            </datalist>
            <span className="inline-helper">
              ブランドはメーカー／仕入先とは別管理です。未登録ブランドはこの場で追加できます。
            </span>
          </label>

          <div className="card-actions">
            <button
              type="button"
              className="ghost-button"
              onClick={createBrandFromInput}
              disabled={!form.brandName || Boolean(relatedBrand)}
            >
              ブランド新規登録
            </button>
            <button type="button" className="ghost-button" onClick={clearBrand}>
              ブランド未設定
            </button>
          </div>

          {relatedBrand && (
            <div className="karte-mini-card">
              <div className="section-heading">
                <h3>{relatedBrand.name}</h3>
                <span className="info-badge ready">Brand</span>
              </div>
              {relatedBrand.logoUrl && (
                <img className="product-thumb" src={relatedBrand.logoUrl} alt={`${relatedBrand.name} logo`} loading="lazy" />
              )}
              <dl className="company-details">
                <div><dt>メーカー</dt><dd>{relatedBrand.manufacturerId || form.manufacturerName || '-'}</dd></div>
                <div><dt>仕入先</dt><dd>{suppliers.find((supplier) => supplier.id === relatedBrand.supplierId)?.name || '-'}</dd></div>
                <div><dt>国</dt><dd>{relatedBrand.country || '-'}</dd></div>
              </dl>
              {relatedBrand.description && <p className="inline-helper">{relatedBrand.description}</p>}
              {relatedBrandProducts.length > 0 && (
                <p className="inline-helper">
                  同一ブランドの商品: {relatedBrandProducts.map((item) => item.name).join('、')}
                </p>
              )}
            </div>
          )}

          <div className="date-grid">
            <label className="field-label">
              産地
              <input
                value={form.origin}
                placeholder="例: 北海道"
                onChange={(event) => updateField('origin', event.target.value)}
              />
            </label>

            <label className="field-label">
              荷姿
              <input
                value={form.packageStyle}
                placeholder="例: 1kg x 10袋"
                onChange={(event) => updateField('packageStyle', event.target.value)}
              />
            </label>
          </div>

          <label className="field-label">
            説明
            <textarea
              value={form.description}
              placeholder="商品の特徴、用途、提案先など"
              onChange={(event) => updateField('description', event.target.value)}
            />
          </label>
        </section>

        <section className="detail-section">
          <h2>価格</h2>
          <div className="date-grid">
            <label className="field-label">
              原価
              <input
                value={form.costPrice}
                inputMode="decimal"
                placeholder="例: 800"
                onChange={(event) => updateField('costPrice', event.target.value)}
                onBlur={() => updateField('costPrice', parsePrice(form.costPrice))}
              />
            </label>

            <label className="field-label">
              原価単位
              <select
                value={form.costUnit}
                onChange={(event) => updateField('costUnit', event.target.value)}
              >
                {PRODUCT_UNITS.map((unit) => (
                  <option key={unit}>{unit}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="date-grid">
            <label className="field-label">
              希望販売価格
              <input
                value={form.desiredSellingPrice}
                inputMode="decimal"
                placeholder="例: 1000"
                onChange={(event) => updateField('desiredSellingPrice', event.target.value)}
                onBlur={() => updateField('desiredSellingPrice', parsePrice(form.desiredSellingPrice))}
              />
            </label>

            <label className="field-label">
              希望販売価格単位
              <select
                value={form.sellingPriceUnit}
                onChange={(event) => updateField('sellingPriceUnit', event.target.value)}
              >
                {PRODUCT_UNITS.map((unit) => (
                  <option key={unit}>{unit}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="price-preview">
            <div>
              <span>原価</span>
              <strong>{formatPrice(form.costPrice) || '-'}円/{form.costUnit}</strong>
            </div>
            <div>
              <span>希望販売価格</span>
              <strong>
                {formatPrice(form.desiredSellingPrice) || '-'}円/{form.sellingPriceUnit}
              </strong>
            </div>
            <div>
              <span>粗利率</span>
              <strong>{grossMarginRate || '-'}</strong>
            </div>
          </div>
        </section>

        <section className="detail-section">
          <div className="section-heading">
            <h2>在庫・仕入</h2>
            <span className="info-badge">{relatedInventories.length}件</span>
          </div>

          {isNew ? (
            <p className="inline-helper">商品を保存すると、この商品に複数の在庫を登録できます。</p>
          ) : (
            <form className="sample-form" onSubmit={handleAddInventory}>
              <label className="field-label">
                在庫コード
                <input
                  value={inventoryForm.inventoryCode}
                  placeholder="例: LOT-2026-001"
                  onChange={(event) => updateInventoryField('inventoryCode', event.target.value)}
                  onBlur={() => updateInventoryField('inventoryCode', normalizeInventoryCode(inventoryForm.inventoryCode))}
                />
                <span className="inline-helper">任意入力。半角英数字と記号のみ、空白・日本語・全角文字は使用不可。</span>
              </label>
              <div className="date-grid">
                <label className="field-label">
                  コスト
                  <input inputMode="decimal" value={inventoryForm.cost} placeholder="例: 800" onChange={(event) => updateInventoryField('cost', event.target.value)} />
                </label>
                <label className="field-label">
                  通貨
                  <input value={inventoryForm.currency} placeholder="JPY" onChange={(event) => updateInventoryField('currency', event.target.value)} />
                </label>
                <label className="field-label">
                  数量
                  <input inputMode="decimal" value={inventoryForm.quantity} placeholder="例: 100" onChange={(event) => updateInventoryField('quantity', event.target.value)} />
                </label>
                <label className="field-label">
                  単位
                  <select value={inventoryForm.unit} onChange={(event) => updateInventoryField('unit', event.target.value)}>
                    {INVENTORY_UNITS.map((unit) => <option key={unit}>{unit}</option>)}
                  </select>
                </label>
              </div>

              <div className="date-grid">
                <label className="field-label">
                  現物/先物
                  <select value={inventoryForm.stockType} onChange={(event) => updateInventoryField('stockType', event.target.value)}>
                    {INVENTORY_TYPES.map((type) => <option key={type}>{type}</option>)}
                  </select>
                </label>
                <label className="field-label">
                  所有者
                  <input value={inventoryForm.owner} placeholder="例: 自社 / 仕入先 / 顧客予約" onChange={(event) => updateInventoryField('owner', event.target.value)} />
                </label>
                <label className="field-label">
                  在庫ステータス
                  <select value={inventoryForm.inventoryStatus} onChange={(event) => updateInventoryField('inventoryStatus', event.target.value)}>
                    {INVENTORY_STATUSES.map((status) => <option key={status}>{status}</option>)}
                  </select>
                </label>
                <label className="field-label">
                  仕入先
                  <select value={inventoryForm.supplierId} onChange={(event) => updateInventoryField('supplierId', event.target.value)}>
                    <option value="">未選択</option>
                    {suppliers.map((supplier) => (
                      <option value={supplier.id} key={supplier.id}>
                        {supplier.name || supplier.companyName || '仕入先名未設定'}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="date-grid">
                <label className="field-label">
                  ファーム期限
                  <input type="date" value={inventoryForm.firmDeadline} onChange={(event) => updateInventoryField('firmDeadline', event.target.value)} />
                </label>
                <label className="field-label">
                  ETA
                  <input type="date" value={inventoryForm.eta} onChange={(event) => updateInventoryField('eta', event.target.value)} />
                </label>
                <label className="field-label">
                  LOT
                  <input value={inventoryForm.lot} onChange={(event) => updateInventoryField('lot', event.target.value)} />
                </label>
                <label className="field-label">
                  賞味期限
                  <input type="date" value={inventoryForm.expiryDate} onChange={(event) => updateInventoryField('expiryDate', event.target.value)} />
                </label>
              </div>

              <label className="field-label">
                メモ
                <textarea value={inventoryForm.memo} onChange={(event) => updateInventoryField('memo', event.target.value)} />
              </label>

              <button className="primary-button" type="submit">在庫を追加</button>
            </form>
          )}

          {relatedInventories.length > 0 && (
            <div className="sample-form">
              <div className="date-grid">
                <label className="field-label">
                  在庫検索
                  <input
                    value={inventorySearch}
                    placeholder="LOT・所有者・仕入先・メモで検索"
                    onChange={(event) => setInventorySearch(event.target.value)}
                  />
                </label>
                <label className="field-label">
                  在庫ステータス
                  <select value={inventoryStatusFilter} onChange={(event) => setInventoryStatusFilter(event.target.value)}>
                    <option value="all">すべて</option>
                    {INVENTORY_STATUSES.map((status) => <option key={status}>{status}</option>)}
                  </select>
                </label>
                <label className="field-label">
                  現物/先物
                  <select value={inventoryTypeFilter} onChange={(event) => setInventoryTypeFilter(event.target.value)}>
                    <option value="all">すべて</option>
                    {INVENTORY_TYPES.map((type) => <option key={type}>{type}</option>)}
                  </select>
                </label>
              </div>
              <p className="inline-helper">
                表示 {filteredInventories.length}件 / 全{relatedInventories.length}件。期限が近い在庫はバッジで警告します。
              </p>
            </div>
          )}

          {filteredInventories.length > 0 ? (
            <div className="karte-card-list sample-card-list">
              {filteredInventories.map((inventory) => {
                const supplier = suppliers.find((item) => item.id === inventory.supplierId);
                const alerts = inventoryAlerts(inventory);
                return (
                  <article className="karte-mini-card" key={inventory.id}>
                    <div className="history-meta">
                      <span>{inventoryLabel(inventory, form, supplier)}</span>
                      <small>{inventory.stockType}</small>
                    </div>
                    <div className="lead-badges">
                      <span className="info-badge ready">{inventory.inventoryStatus}</span>
                      {inventory.firmDeadline && <span className="info-badge">ファーム {inventory.firmDeadline}</span>}
                      {inventory.eta && <span className="info-badge">ETA {inventory.eta}</span>}
                      {inventory.expiryDate && <span className="info-badge">賞味 {inventory.expiryDate}</span>}
                      {alerts.map((alert) => (
                        <span className={`info-badge ${alert.className}`} key={alert.label}>{alert.label}</span>
                      ))}
                    </div>
                    <dl className="company-details">
                      <div><dt>在庫コード</dt><dd>{inventory.inventoryCode || '-'}</dd></div>
                      <div><dt>コスト</dt><dd>{formatPrice(inventory.cost) || '-'} {inventory.currency}/{inventory.unit}</dd></div>
                      <div><dt>数量</dt><dd>{inventory.quantity || '-'} {inventory.unit}</dd></div>
                      <div><dt>所有者</dt><dd>{inventory.owner || '-'}</dd></div>
                      <div><dt>LOT</dt><dd>{inventory.lot || '-'}</dd></div>
                    </dl>
                    <label className="field-label">
                      在庫コード
                      <input
                        value={inventory.inventoryCode || ''}
                        placeholder="例: LOT-2026-001"
                        onChange={(event) => updateInventoryRecord(inventory, { inventoryCode: event.target.value })}
                        onBlur={(event) => updateInventoryRecord(inventory, { inventoryCode: normalizeInventoryCode(event.target.value) })}
                      />
                    </label>
                    <label className="field-label">
                      在庫ステータス
                      <select value={inventory.inventoryStatus} onChange={(event) => updateInventoryRecord(inventory, { inventoryStatus: event.target.value })}>
                        {INVENTORY_STATUSES.map((status) => <option key={status}>{status}</option>)}
                      </select>
                    </label>
                    <div className="date-grid">
                      <label className="field-label">
                        コスト
                        <input inputMode="decimal" value={inventory.cost} onChange={(event) => updateInventory?.(inventory.id, { cost: event.target.value })} />
                      </label>
                      <label className="field-label">
                        通貨
                        <input value={inventory.currency || 'JPY'} onChange={(event) => updateInventory?.(inventory.id, { currency: event.target.value })} />
                      </label>
                      <label className="field-label">
                        数量
                        <input inputMode="decimal" value={inventory.quantity} onChange={(event) => updateInventory?.(inventory.id, { quantity: event.target.value })} />
                      </label>
                      <label className="field-label">
                        単位
                        <select value={inventory.unit || 'kg'} onChange={(event) => updateInventory?.(inventory.id, { unit: event.target.value })}>
                          {INVENTORY_UNITS.map((unit) => <option key={unit}>{unit}</option>)}
                        </select>
                      </label>
                    </div>
                    <div className="date-grid">
                      <label className="field-label">
                        所有者
                        <input value={inventory.owner || ''} onChange={(event) => updateInventory?.(inventory.id, { owner: event.target.value })} />
                      </label>
                      <label className="field-label">
                        仕入先
                        <select value={inventory.supplierId || ''} onChange={(event) => updateInventory?.(inventory.id, { supplierId: event.target.value })}>
                          <option value="">未選択</option>
                          {suppliers.map((supplierItem) => (
                            <option value={supplierItem.id} key={supplierItem.id}>
                              {supplierItem.name || supplierItem.companyName || '仕入先名未設定'}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field-label">
                        LOT
                        <input value={inventory.lot || ''} onChange={(event) => updateInventory?.(inventory.id, { lot: event.target.value })} />
                      </label>
                    </div>
                    <div className="date-grid">
                      <label className="field-label">
                        ファーム期限
                        <input type="date" value={inventory.firmDeadline || ''} onChange={(event) => updateInventory?.(inventory.id, { firmDeadline: event.target.value })} />
                      </label>
                      <label className="field-label">
                        ETA
                        <input type="date" value={inventory.eta || ''} onChange={(event) => updateInventory?.(inventory.id, { eta: event.target.value })} />
                      </label>
                      <label className="field-label">
                        賞味期限
                        <input type="date" value={inventory.expiryDate || ''} onChange={(event) => updateInventory?.(inventory.id, { expiryDate: event.target.value })} />
                      </label>
                      <label className="field-label">
                        現物/先物
                        <select value={inventory.stockType || '現物'} onChange={(event) => updateInventory?.(inventory.id, { stockType: event.target.value })}>
                          {INVENTORY_TYPES.map((type) => <option key={type}>{type}</option>)}
                        </select>
                      </label>
                    </div>
                    <label className="field-label">
                      メモ
                      <textarea value={inventory.memo || ''} onChange={(event) => updateInventory?.(inventory.id, { memo: event.target.value })} />
                    </label>
                    <button
                      className="primary-button"
                      type="button"
                      onClick={() => onCreateQuote?.({ productId: form.id, inventoryId: inventory.id })}
                    >
                      この在庫で見積作成
                    </button>
                    <button className="ghost-button danger" type="button" onClick={() => removeInventory?.(inventory.id)}>
                      在庫を削除
                    </button>
                  </article>
                );
              })}
            </div>
          ) : (
            !isNew && (
              <p className="inline-helper">
                {relatedInventories.length > 0 ? '条件に合う在庫がありません。' : 'この商品の在庫はまだ登録されていません。'}
              </p>
            )
          )}
        </section>

        <section className="detail-section">
          <h2>添付</h2>
          <div className="attachment-grid">
            <label className="field-label file-field">
              商品画像
              <input
                type="file"
                accept="image/*"
                onChange={(event) => handleFile('imageFile', event.target.files?.[0])}
              />
              <span>{fileLabel(form.imageFile)}</span>
              {form.imageFile && (
                <button type="button" className="text-button" onClick={() => removeFile('imageFile')}>
                  添付を外す
                </button>
              )}
            </label>

            <label className="field-label file-field">
              商品資料
              <input
                type="file"
                onChange={(event) => handleFile('productMaterialFile', event.target.files?.[0])}
              />
              <span>{fileLabel(form.productMaterialFile)}</span>
              {form.productMaterialFile && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => removeFile('productMaterialFile')}
                >
                  添付を外す
                </button>
              )}
            </label>

            <label className="field-label file-field">
              スペックシート
              <input
                type="file"
                onChange={(event) => handleFile('specSheetFile', event.target.files?.[0])}
              />
              <span>{fileLabel(form.specSheetFile)}</span>
              {form.specSheetFile && (
                <button type="button" className="text-button" onClick={() => removeFile('specSheetFile')}>
                  添付を外す
                </button>
              )}
            </label>
          </div>

          {uploadingField && <p className="notice-text">アップロード中...</p>}
          {uploadError && <p className="error-text">{uploadError}</p>}

          {form.imageFile?.url && (
            <img className="product-preview-image" src={form.imageFile.url} alt="商品画像プレビュー" />
          )}
        </section>

        <section className="detail-section">
          <h2>メモ</h2>
          <label className="field-label">
            社内メモ
            <textarea
              value={form.memo}
              placeholder="サンプル可否、ロット、注意点、提案トークなど"
              onChange={(event) => updateField('memo', event.target.value)}
            />
          </label>
        </section>

        <section className="detail-section">
          <div className="section-heading">
            <h2>案件別商品提案</h2>
            <span className="info-badge">{relatedProjectProposals.length}件</span>
          </div>
          {relatedProjectProposals.length > 0 ? (
            <div className="karte-card-list sample-card-list">
              {relatedProjectProposals.map(({ project, proposal }) => {
                const customer = customers.find((item) => item.id === project.customerId);
                const supplier = suppliers.find((item) => item.id === project.supplierId);
                const totals = calculateProjectProductProposal(proposal);
                return (
                  <article className="karte-mini-card adoption-card" key={`${project.id}-${proposal.id}`}>
                    <div className="history-meta">
                      <span>{project.title || '案件'}</span>
                      <small>{proposal.status || '-'}</small>
                    </div>
                    <dl className="company-details">
                      <div><dt>会社</dt><dd>{customer?.companyName || supplier?.name || '-'}</dd></div>
                      <div><dt>月間見込</dt><dd>{proposal.monthlyExpectedQuantity || '-'} {proposal.unit || ''}</dd></div>
                      <div><dt>年間見込</dt><dd>{proposal.annualExpectedQuantity || totals.annualQuantity || '-'} {proposal.unit || ''}</dd></div>
                      <div><dt>想定売価</dt><dd>{proposal.expectedSellingPrice || '-'}</dd></div>
                      <div><dt>想定原価</dt><dd>{proposal.expectedCost || '-'}</dd></div>
                      <div><dt>想定粗利</dt><dd>{totals.grossProfit.toLocaleString('ja-JP')}</dd></div>
                    </dl>
                    {(proposal.reasonCategory || proposal.adoptionReason || proposal.rejectionReason) && (
                      <p className="inline-helper">
                        {proposal.reasonCategory || ''} {proposal.adoptionReason || proposal.rejectionReason || ''}
                      </p>
                    )}
                    {proposal.competitorProduct && <p className="inline-helper">競合: {proposal.competitorProduct}</p>}
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="inline-helper">この商品に紐づく案件別の商品提案はまだありません。</p>
          )}
        </section>

        <section className="detail-section">
          <div className="section-heading">
            <h2>採用顧客</h2>
            <span className="info-badge">{relatedAdoptions.length}件</span>
          </div>
          {relatedAdoptions.length > 0 ? (
            <div className="karte-card-list sample-card-list">
              {relatedAdoptions.map((adoption) => {
                const customer = customers.find((item) => item.id === adoption.customerId);
                return (
                  <article className="karte-mini-card adoption-card" key={adoption.id}>
                    <div className="history-meta">
                      <span>{customer?.companyName || '-'}</span>
                      <small>{adoption.status || '-'}</small>
                    </div>
                    <label className="field-label">
                      ステータス
                      <select
                        value={adoption.status || '採用中'}
                        onChange={(event) => updateAdoption?.(adoption.id, { status: event.target.value })}
                      >
                        {['採用中', '休止中', '終了'].map((status) => <option key={status}>{status}</option>)}
                      </select>
                    </label>
                    <dl className="company-details">
                      <div><dt>採用日</dt><dd>{adoption.adoptedDate || '-'}</dd></div>
                      <div><dt>月間数量</dt><dd>{adoption.monthlyVolume || '-'}</dd></div>
                      <div><dt>販売価格</dt><dd>{adoption.sellingPrice || '-'}</dd></div>
                      <div><dt>単位</dt><dd>{adoption.unit || '-'}</dd></div>
                      <div><dt>粗利率</dt><dd>{adoption.grossMarginRate || '-'}</dd></div>
                    </dl>
                    {adoption.memo && <p className="inline-helper">{adoption.memo}</p>}
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="inline-helper">この商品を採用中の顧客はまだ登録されていません。</p>
          )}
        </section>

        <section className="detail-section">
          <div className="section-heading">
            <h2>見積履歴</h2>
            <span className="info-badge">{relatedQuotes.length}件</span>
          </div>
          {relatedQuotes.length > 0 ? (
            <div className="karte-card-list sample-card-list">
              {relatedQuotes.map((quote) => {
                const customer = customers.find((item) => item.id === quote.customerId);
                const supplier = suppliers.find((item) => item.id === quote.supplierId);
                return (
                  <article className="karte-mini-card quote-card" key={quote.id}>
                    <div className="history-meta">
                      <span>{quote.quoteNumber || '見積'}</span>
                      <small>{customer?.companyName || '-'}</small>
                    </div>
                    <label className="field-label">
                      ステータス
                      <select
                        value={quote.status || '提出済'}
                        onChange={(event) => updateQuote?.(quote.id, { status: event.target.value })}
                      >
                        {['作成中', '提出済', '再見積', '採用', '失注', '期限切れ'].map((status) => <option key={status}>{status}</option>)}
                      </select>
                    </label>
                    <dl className="company-details">
                      <div><dt>仕入先</dt><dd>{supplier?.name || supplier?.companyName || '-'}</dd></div>
                      <div><dt>提出日</dt><dd>{quote.submittedDate || '-'}</dd></div>
                      <div><dt>有効期限</dt><dd>{quote.validUntil || '-'}</dd></div>
                      <div><dt>金額</dt><dd>{quote.totalAmount || '-'}</dd></div>
                      <div><dt>粗利率</dt><dd>{quote.grossMarginRate || '-'}</dd></div>
                    </dl>
                    {quote.fileUrl && (
                      <a className="ghost-button external-button" href={quote.fileUrl} target="_blank" rel="noreferrer">
                        {quote.fileName || '見積ファイルを開く'}
                      </a>
                    )}
                    {quote.memo && <p className="inline-helper">{quote.memo}</p>}
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="inline-helper">この商品に紐づく見積履歴はまだありません。</p>
          )}
        </section>

        <section className="detail-section">
          <div className="section-heading">
            <h2>サンプル履歴</h2>
            <span className="info-badge">{relatedSamples.length}件</span>
          </div>
          {relatedSamples.length > 0 ? (
            <div className="karte-card-list sample-card-list">
              {relatedSamples.map((sample) => {
                const customer = customers.find((item) => item.id === sample.customerId);
                return (
                  <article className="karte-mini-card sample-card" key={sample.id}>
                    <div className="history-meta">
                      <span>{sample.sampleName || 'サンプル'}</span>
                      <small>{customer?.companyName || '-'}</small>
                    </div>
                    <label className="field-label">
                      ステータス
                      <select
                        value={sample.status || '発送前'}
                        onChange={(event) => updateSample?.(sample.id, { status: event.target.value })}
                      >
                        {['発送前', '発送済', '到着済', '評価待ち', '採用', '不採用', '保留'].map((status) => <option key={status}>{status}</option>)}
                      </select>
                    </label>
                    <dl className="company-details">
                      <div><dt>発送日</dt><dd>{sample.shippedDate || '-'}</dd></div>
                      <div><dt>到着日</dt><dd>{sample.arrivalDate || '-'}</dd></div>
                      <div><dt>フォロー日</dt><dd>{sample.followUpDate || '-'}</dd></div>
                      <div><dt>次アクション</dt><dd>{sample.nextAction || '-'}</dd></div>
                    </dl>
                    {sample.feedback && <p className="inline-helper">{sample.feedback}</p>}
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="inline-helper">この商品に紐づくサンプル履歴はまだありません。</p>
          )}
        </section>

        <button className="primary-button sticky-submit" type="submit" disabled={saving || Boolean(uploadingField) || (!isNew && !isDirty)}>
          {saving ? '保存中...' : isNew ? '登録' : isDirty ? '更新' : '変更なし'}
        </button>
      </form>
    </main>
  );
}
