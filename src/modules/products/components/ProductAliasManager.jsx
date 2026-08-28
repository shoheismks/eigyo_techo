import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  normalizeProductAliasText,
  normalizeSupplierProductCode,
} from '../services/productAliasNormalization.js';
import { replaceProductAlias } from '../services/productAliasChangeService.js';
import './product-alias-manager.css';

const text = (value) => String(value ?? '').trim();
const aliasProductId = (alias) => alias.productId ?? alias.product_id ?? '';
const aliasSupplierId = (alias) => alias.supplierId ?? alias.supplier_id ?? '';
const aliasSupplierName = (alias) => alias.supplierNameSnapshot ?? alias.supplier_name_snapshot ?? '';
const aliasName = (alias) => alias.aliasName ?? alias.alias_name ?? '';
const aliasSupplierCode = (alias) => alias.supplierProductCode ?? alias.supplier_product_code ?? '';
const aliasActive = (alias) => alias.isActive ?? alias.is_active ?? true;

function sourceLabel(alias) {
  const source = alias.sourceType ?? alias.source_type ?? '';
  const documentType = alias.sourceDocumentType ?? alias.source_document_type ?? '';
  if (source === 'product_detail') return '商品詳細';
  if (source === 'inbound_preview') {
    if (documentType === 'delivery_notice') return '入荷PDF';
    if (documentType === 'standard_excel_import' || documentType === 'excel_import') return 'Excel取込';
    return '入荷取込';
  }
  if (source === 'excel_import') return 'Excel取込';
  if (source === 'delivery_notice') return '入荷PDF';
  return 'その他';
}

function emptyDraft(productId) {
  return { productId, name: '', scope: 'supplier', supplierId: '', supplierCode: '', globalConfirmed: false };
}

function draftFromAlias(alias) {
  const supplierId = aliasSupplierId(alias);
  return {
    productId: aliasProductId(alias),
    name: aliasName(alias),
    scope: supplierId || aliasSupplierName(alias) ? 'supplier' : 'global',
    supplierId,
    supplierCode: aliasSupplierCode(alias),
    globalConfirmed: false,
  };
}

function sameScope(alias, draft, suppliers) {
  const existingId = text(aliasSupplierId(alias));
  const existingName = normalizeProductAliasText(aliasSupplierName(alias));
  if (draft.scope === 'global') return !existingId && !existingName;
  const supplier = suppliers.find((item) => item.id === draft.supplierId);
  return existingId === draft.supplierId
    || (!existingId && existingName === normalizeProductAliasText(supplier?.name));
}

function findConflict(aliases, draft, suppliers, ignoredAliasId = '') {
  const normalizedName = normalizeProductAliasText(draft.name);
  const normalizedCode = normalizeSupplierProductCode(draft.supplierCode);
  return aliases.find((alias) => {
    if (!aliasActive(alias) || alias.id === ignoredAliasId || !sameScope(alias, draft, suppliers)) return false;
    const existingName = alias.normalizedAlias ?? alias.normalized_alias ?? normalizeProductAliasText(aliasName(alias));
    const existingCode = alias.normalizedSupplierProductCode ?? alias.normalized_supplier_product_code
      ?? normalizeSupplierProductCode(aliasSupplierCode(alias));
    return existingName === normalizedName || (normalizedCode && existingCode === normalizedCode);
  });
}

export default function ProductAliasManager({
  product,
  products = [],
  suppliers = [],
  productAliases = [],
  addProductAlias,
  deactivateProductAlias,
  userId = '',
}) {
  const [showInactive, setShowInactive] = useState(false);
  const [editor, setEditor] = useState(null);
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const aliases = useMemo(
    () => productAliases.filter((alias) => aliasProductId(alias) === product?.id),
    [product?.id, productAliases],
  );
  const activeAliases = aliases.filter(aliasActive);
  const inactiveAliases = aliases.filter((alias) => !aliasActive(alias));

  if (!product) return null;

  function openAdd() {
    setError('');
    setMessage('');
    setEditor({ mode: 'add', original: null, draft: emptyDraft(product.id) });
  }

  function openEdit(alias) {
    setError('');
    setMessage('');
    setEditor({ mode: 'edit', original: alias, draft: draftFromAlias(alias) });
  }

  function updateDraft(field, value) {
    setEditor((current) => ({ ...current, draft: { ...current.draft, [field]: value } }));
  }

  function buildInput(draft, overrides = {}) {
    const supplier = draft.scope === 'supplier' ? suppliers.find((item) => item.id === draft.supplierId) : null;
    return {
      userId,
      productId: draft.productId,
      aliasName: text(draft.name),
      supplierId: supplier?.id || '',
      supplierNameSnapshot: supplier?.name || '',
      supplierProductCode: text(draft.supplierCode),
      sourceType: 'product_detail',
      sourceDocumentType: '',
      sourceNote: editor?.mode === 'edit' ? `修正元: ${editor.original.id}` : '',
      confirmedBy: userId,
      confirmedAt: new Date().toISOString(),
      ...overrides,
    };
  }

  async function saveEditor(event) {
    event.preventDefault();
    const { draft, original, mode } = editor;
    setError('');
    if (!normalizeProductAliasText(draft.name)) return setError('商品表記を入力してください。');
    if (draft.scope === 'supplier' && !draft.supplierId) return setError('仕入先を選択してください。');
    if (draft.scope === 'global' && !draft.globalConfirmed) return setError('すべての仕入先へ適用することを確認してください。');
    const conflict = findConflict(productAliases, draft, suppliers, original?.id || '');
    if (conflict) {
      const owner = products.find((item) => item.id === aliasProductId(conflict));
      return setError(`この商品表記または仕入先商品コードは、すでに「${owner?.name || '別の商品'}」に登録されています。`);
    }

    setSaving(true);
    try {
      if (mode === 'add') {
        await addProductAlias(buildInput(draft));
      } else {
        await replaceProductAlias({
          originalAlias: original,
          nextAlias: buildInput(draft),
          addProductAlias,
          deactivateProductAlias,
        });
      }
      setEditor(null);
      setMessage(mode === 'add' ? '商品表記を追加しました。' : '商品表記を修正しました。');
    } catch (saveError) {
      setError(saveError.message || '商品表記を保存できませんでした。');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeactivate() {
    setSaving(true);
    setError('');
    try {
      await deactivateProductAlias(deactivateTarget.id);
      setDeactivateTarget(null);
      setMessage('商品表記の紐付けを解除しました。');
    } catch (deactivateError) {
      setError(deactivateError.message || '商品表記を解除できませんでした。');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="detail-section product-alias-section">
      <div className="section-heading">
        <div><h2>商品名・仕入先表記</h2><p className="inline-helper">仕入先や帳票ごとに異なる商品名を、この商品として認識するための設定です。</p></div>
        <button type="button" className="primary-button" onClick={openAdd}>商品表記を追加</button>
      </div>
      {message && <p className="notice-text">{message}</p>}
      {error && !editor && <p className="error-text">{error}</p>}
      <AliasList aliases={activeAliases} products={products} suppliers={suppliers} onEdit={openEdit} onDeactivate={setDeactivateTarget} />
      {activeAliases.length === 0 && <p className="empty-state">登録済みの商品表記はありません。</p>}
      {inactiveAliases.length > 0 && <button type="button" className="text-button" onClick={() => setShowInactive((current) => !current)}>{showInactive ? '解除済みを閉じる' : `解除済みを表示 (${inactiveAliases.length})`}</button>}
      {showInactive && <AliasList aliases={inactiveAliases} products={products} suppliers={suppliers} inactive />}
      {editor && <AliasEditor editor={editor} product={product} products={products} suppliers={suppliers} saving={saving} error={error} onChange={updateDraft} onClose={() => setEditor(null)} onSubmit={saveEditor} />}
      {deactivateTarget && <DeactivateDialog alias={deactivateTarget} product={product} suppliers={suppliers} saving={saving} onClose={() => setDeactivateTarget(null)} onConfirm={confirmDeactivate} />}
    </section>
  );
}

function AliasList({ aliases, suppliers, onEdit, onDeactivate, inactive = false }) {
  const cards = aliases.map((alias) => {
    const supplier = suppliers.find((item) => item.id === aliasSupplierId(alias));
    return { alias, supplierName: supplier?.name || aliasSupplierName(alias) || '-' };
  });
  return <div className={`product-alias-list ${inactive ? 'inactive' : ''}`}>{cards.map(({ alias, supplierName }) => <article className="product-alias-card" key={alias.id}><div className="product-alias-card-heading"><strong>{aliasName(alias)}</strong><span className={`info-badge ${inactive ? 'muted' : 'ready'}`}>{inactive ? '解除済み' : '有効'}</span></div><dl className="company-details"><div><dt>仕入先</dt><dd>{supplierName}</dd></div><div><dt>仕入先商品コード</dt><dd>{aliasSupplierCode(alias) || '-'}</dd></div><div><dt>適用範囲</dt><dd>{aliasSupplierId(alias) || aliasSupplierName(alias) ? 'この仕入先のみ' : 'すべての仕入先'}</dd></div><div><dt>登録元</dt><dd>{sourceLabel(alias)}</dd></div><div><dt>登録日時</dt><dd>{String(alias.createdAt ?? alias.created_at ?? '').slice(0, 10) || '-'}</dd></div></dl>{!inactive && <div className="card-actions"><button type="button" className="ghost-button" onClick={() => onEdit(alias)}>修正・別商品へ変更</button><button type="button" className="danger-button" onClick={() => onDeactivate(alias)}>解除</button></div>}</article>)}</div>;
}

function AliasEditor({ editor, product, products, suppliers, saving, error, onChange, onClose, onSubmit }) {
  if (typeof document === 'undefined') return null;
  const draft = editor.draft;
  const target = products.find((item) => item.id === draft.productId) || product;
  return createPortal(<div className="modal-backdrop" role="presentation" onMouseDown={onClose}><form className="modal-panel product-alias-modal" role="dialog" aria-modal="true" aria-labelledby="product-alias-editor-title" onMouseDown={(event) => event.stopPropagation()} onSubmit={onSubmit}><div className="customer-editor-header"><div><p className="eyebrow">Product naming</p><h2 id="product-alias-editor-title">{editor.mode === 'add' ? '商品表記を追加' : '商品表記を修正'}</h2></div><button type="button" className="ghost-button" onClick={onClose}>閉じる</button></div><label>商品表記<input aria-label="商品表記" value={draft.name} onChange={(event) => onChange('name', event.target.value)} /></label><label>紐付け先商品<select aria-label="紐付け先商品" value={draft.productId} onChange={(event) => onChange('productId', event.target.value)}>{products.map((item) => <option value={item.id} key={item.id}>{item.productCode ? `${item.productCode} / ` : ''}{item.name || '商品名未設定'}</option>)}</select></label>{draft.productId !== product.id && <div className="product-alias-move-compare"><span>現在: {product.name}</span><span>変更先: {target?.name || '-'}</span></div>}<fieldset className="inbound-alias-scope"><legend>適用範囲</legend><label><input type="radio" name="product-alias-scope" checked={draft.scope === 'supplier'} onChange={() => onChange('scope', 'supplier')} />この仕入先のみ</label><label><input type="radio" name="product-alias-scope" checked={draft.scope === 'global'} onChange={() => onChange('scope', 'global')} />すべての仕入先</label></fieldset>{draft.scope === 'supplier' ? <label>仕入先<select aria-label="仕入先" value={draft.supplierId} onChange={(event) => onChange('supplierId', event.target.value)}><option value="">選択してください</option>{suppliers.map((supplier) => <option value={supplier.id} key={supplier.id}>{supplier.name}</option>)}</select></label> : <><p className="notice-text">この表記は仕入先に関係なく、この商品として認識されます。</p><label className="inline-check"><input type="checkbox" checked={draft.globalConfirmed} onChange={(event) => onChange('globalConfirmed', event.target.checked)} />影響範囲を確認しました</label></>}<label>仕入先商品コード<input aria-label="仕入先商品コード" value={draft.supplierCode} onChange={(event) => onChange('supplierCode', event.target.value)} /></label>{error && <p className="form-error-message">{error}</p>}<div className="customer-editor-actions"><button type="button" className="ghost-button" onClick={onClose}>キャンセル</button><button type="submit" className="primary-button" disabled={saving}>{saving ? '保存中...' : '保存'}</button></div></form></div>, document.body);
}

function DeactivateDialog({ alias, product, suppliers, saving, onClose, onConfirm }) {
  if (typeof document === 'undefined') return null;
  const supplier = suppliers.find((item) => item.id === aliasSupplierId(alias));
  return createPortal(<div className="modal-backdrop" role="presentation" onMouseDown={onClose}><div className="modal-panel product-alias-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="product-alias-deactivate-title" onMouseDown={(event) => event.stopPropagation()}><div className="customer-editor-header"><h2 id="product-alias-deactivate-title">この商品表記の紐付けを解除しますか？</h2></div><dl className="company-details"><div><dt>商品表記</dt><dd>{aliasName(alias)}</dd></div><div><dt>仕入先</dt><dd>{supplier?.name || aliasSupplierName(alias) || 'すべての仕入先'}</dd></div><div><dt>正式商品</dt><dd>{product.name}</dd></div></dl><div className="customer-editor-actions"><button type="button" className="ghost-button" onClick={onClose}>キャンセル</button><button type="button" className="danger-button" disabled={saving} onClick={onConfirm}>{saving ? '解除中...' : '解除する'}</button></div></div></div>, document.body);
}
