import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  normalizeProductAliasText,
  normalizeSupplierProductCode,
} from '../../products/services/productAliasNormalization.js';
import { resolveInboundSupplierContext } from '../services/inboundProductMatcher.js';
import './inbound-product-alias.css';

const value = (input) => String(input ?? '').trim();
const productCode = (product) => value(product?.productCode ?? product?.product_code);
const productName = (product) => value(product?.name) || '商品名未設定';

function selectedProductDifferences(line, product) {
  if (!product) return [];
  return [
    ['商品名', line.productName ?? line.productNameRaw, product.name],
    ['ブランド', line.brand ?? line.brandNameRaw, product.brandName ?? product.brand_name],
    ['原産国', line.originCountry ?? line.origin_country, product.origin],
    ['カテゴリ', line.productType ?? line.category, product.category],
  ].filter(([, imported, registered]) => value(imported) && value(registered)
    && normalizeProductAliasText(imported) !== normalizeProductAliasText(registered));
}

function aliasMatchesScope(alias, scope, supplierContext) {
  const aliasSupplierId = value(alias.supplierId ?? alias.supplier_id);
  const aliasSupplierName = normalizeProductAliasText(alias.supplierNameSnapshot ?? alias.supplier_name_snapshot);
  if (scope === 'global') return !aliasSupplierId && !aliasSupplierName;
  return aliasSupplierId === supplierContext.supplierId
    || (!aliasSupplierId && aliasSupplierName === normalizeProductAliasText(supplierContext.supplierName));
}

function active(alias) {
  return alias?.isActive ?? alias?.is_active ?? true;
}

export default function InboundProductAliasDialog({
  line,
  initialProduct = null,
  products = [],
  productAliases = [],
  suppliers = [],
  preview = null,
  userId = '',
  onClose,
  onConfirm,
}) {
  const supplierContext = useMemo(() => resolveInboundSupplierContext(
    line || {},
    suppliers,
    { supplierName: preview?.supplier ?? preview?.supplierName ?? '' },
  ), [line, preview, suppliers]);
  const [selectedProductId, setSelectedProductId] = useState(initialProduct?.id || '');
  const [aliasName, setAliasName] = useState(value(line?.productName ?? line?.productNameRaw));
  const [scope, setScope] = useState(supplierContext.status === 'resolved' ? 'supplier' : '');
  const [saveSupplierCode, setSaveSupplierCode] = useState(false);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setSelectedProductId(initialProduct?.id || '');
    setAliasName(value(line?.productName ?? line?.productNameRaw));
    setScope(supplierContext.status === 'resolved' ? 'supplier' : '');
    setSaveSupplierCode(false);
    setQuery('');
    setError('');
  }, [initialProduct, line, supplierContext.status]);

  const selectedProduct = products.find((product) => product.id === selectedProductId) || initialProduct;
  const differences = selectedProductDifferences(line || {}, selectedProduct);
  const searchResults = useMemo(() => {
    const normalized = normalizeProductAliasText(query);
    if (!normalized) return products.slice(0, 8);
    return products.filter((product) => normalizeProductAliasText([
      productCode(product), productName(product), product.brandName ?? product.brand_name,
    ].filter(Boolean).join(' ')).includes(normalized)).slice(0, 8);
  }, [products, query]);

  if (!line || typeof document === 'undefined') return null;

  function findConflict() {
    const normalizedAlias = normalizeProductAliasText(aliasName);
    const supplierCode = saveSupplierCode
      ? normalizeSupplierProductCode(line.productCode ?? line.product_code)
      : '';
    return productAliases.find((alias) => {
      if (!active(alias) || !aliasMatchesScope(alias, scope, supplierContext)) return false;
      const aliasProductId = alias.productId ?? alias.product_id;
      if (aliasProductId === selectedProductId) return false;
      const existingName = alias.normalizedAlias ?? alias.normalized_alias;
      const existingCode = alias.normalizedSupplierProductCode ?? alias.normalized_supplier_product_code;
      return existingName === normalizedAlias || (supplierCode && existingCode === supplierCode);
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    if (!selectedProductId) return setError('正式商品を選択してください。');
    if (!normalizeProductAliasText(aliasName)) return setError('Aliasとして登録する商品名を入力してください。');
    if (!scope) return setError('適用範囲を選択してください。');
    if (scope === 'supplier' && supplierContext.status !== 'resolved') {
      return setError('仕入先を一意に特定できません。');
    }
    if (findConflict()) {
      return setError('同じAliasまたは仕入先商品コードが別の商品に登録済みです。既存Aliasは変更していません。');
    }

    setSaving(true);
    try {
      await onConfirm?.({
        userId,
        productId: selectedProductId,
        aliasName: value(aliasName),
        supplierId: scope === 'supplier' ? supplierContext.supplierId : '',
        supplierNameSnapshot: scope === 'supplier'
          ? value(supplierContext.supplierName || preview?.supplier || preview?.supplierName)
          : '',
        supplierProductCode: saveSupplierCode ? value(line.productCode ?? line.product_code) : '',
        sourceType: 'inbound_preview',
        sourceDocumentType: value(preview?.documentType),
        sourceNote: [preview?.documentNumber, preview?.fileName].filter(Boolean).join(' / '),
        confirmedBy: userId,
        confirmedAt: new Date().toISOString(),
      });
    } catch (saveError) {
      setError(saveError.message || 'Aliasの登録に失敗しました。');
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="modal-backdrop inbound-alias-backdrop" role="presentation" onMouseDown={onClose}>
      <form className="modal-panel inbound-alias-modal" role="dialog" aria-modal="true" aria-labelledby="inbound-alias-title" onMouseDown={(event) => event.stopPropagation()} onSubmit={handleSubmit}>
        <div className="customer-editor-header">
          <div><p className="eyebrow">Product alias</p><h2 id="inbound-alias-title">同じ商品として登録</h2></div>
          <button type="button" className="ghost-button" onClick={onClose}>閉じる</button>
        </div>

        <div className="inbound-alias-compare">
          <section><h3>帳票の商品</h3><p><strong>{line.productName || '-'}</strong></p><p>{line.productCode || '商品コードなし'}</p><p>{line.brand || '-'} / {line.originCountry || '-'} / {line.productType || line.category || '-'}</p></section>
          <section><h3>正式商品</h3><p><strong>{selectedProduct ? productName(selectedProduct) : '未選択'}</strong></p><p>{selectedProduct ? productCode(selectedProduct) || '商品コードなし' : '-'}</p><p>{selectedProduct?.brandName || '-'} / {selectedProduct?.origin || '-'} / {selectedProduct?.category || '-'}</p></section>
        </div>

        <label className="inbound-alias-search">既存商品を検索<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="商品コード、商品名、ブランド" /></label>
        <div className="inbound-alias-results" role="listbox" aria-label="正式商品候補">
          {searchResults.map((product) => (
            <button type="button" className={product.id === selectedProductId ? 'selected' : ''} key={product.id} onClick={() => setSelectedProductId(product.id)}>
              <strong>{productName(product)}</strong><span>{productCode(product) || 'コードなし'} / {product.brandName || '-'}</span>
            </button>
          ))}
        </div>

        <label>Aliasとして登録する名前<input value={aliasName} onChange={(event) => setAliasName(event.target.value)} /></label>
        <fieldset className="inbound-alias-scope"><legend>適用範囲</legend>
          <label><input type="radio" name="alias-scope" value="supplier" checked={scope === 'supplier'} disabled={supplierContext.status !== 'resolved'} onChange={() => setScope('supplier')} />この仕入先のみ{supplierContext.status === 'resolved' ? ` (${supplierContext.supplierName})` : ' (仕入先を特定できません)'}</label>
          <label><input type="radio" name="alias-scope" value="global" checked={scope === 'global'} onChange={() => setScope('global')} />すべての仕入先で使用</label>
        </fieldset>
        {scope === 'global' && <p className="notice-text">この表記は仕入先に関係なく同じ商品として扱われます。</p>}

        <label className="inline-check"><input type="checkbox" checked={saveSupplierCode} disabled={!line.productCode} onChange={(event) => setSaveSupplierCode(event.target.checked)} />このコードを仕入先商品コードとして登録{line.productCode ? ` (${line.productCode})` : ''}</label>
        <dl className="company-details inbound-alias-meta"><div><dt>仕入先</dt><dd>{preview?.supplier || '-'}</dd></div><div><dt>登録元書類</dt><dd>{preview?.documentNumber || preview?.fileName || '-'}</dd></div></dl>
        {differences.length > 0 && <div className="inbound-alias-differences"><h3>差異</h3>{differences.map(([label, imported, registered]) => <p key={label}>{label}: 帳票「{value(imported)}」 / マスタ「{value(registered)}」</p>)}</div>}
        {error && <p className="form-error-message">{error}</p>}
        <div className="customer-editor-actions inbound-alias-actions"><button type="button" className="ghost-button" onClick={onClose}>キャンセル</button><button type="submit" className="primary-button" disabled={saving}>{saving ? '登録中...' : 'Aliasを登録'}</button></div>
      </form>
    </div>,
    document.body,
  );
}
