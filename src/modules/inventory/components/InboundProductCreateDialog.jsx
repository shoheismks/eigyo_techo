import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  PRODUCT_CATEGORIES, PRODUCT_UNITS, TEMPERATURE_ZONES, isValidProductCode,
  normalizeProduct, normalizeProductCode, parsePrice,
} from '../../products/hooks/useProducts.js';

function initialForm(line) {
  return {
    productCode: String(line?.productCode ?? '').trim(),
    name: String(line?.productName ?? '').trim(),
    brandName: String(line?.brand ?? '').trim(),
    category: String(line?.productType ?? line?.category ?? '').trim(),
    origin: String(line?.originCountry ?? '').trim(),
    costPrice: line?.unitPrice === '' || line?.unitPrice === null || line?.unitPrice === undefined ? '' : String(line.unitPrice),
    costUnit: String(line?.priceUnit ?? '').trim().toLowerCase(),
    manufacturerName: '', temperatureZone: '', packageStyle: '', memo: '',
  };
}

export default function InboundProductCreateDialog({ line, products = [], addProduct, userId = '', onClose, onCreated }) {
  const [form, setForm] = useState(() => initialForm(line));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setForm(initialForm(line)); setError(''); }, [line]);
  if (!line || typeof document === 'undefined') return null;

  function setField(key, value) { setForm((current) => ({ ...current, [key]: value })); }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    const code = normalizeProductCode(form.productCode);
    if (!code) return setError('商品コードを入力してください。');
    if (!isValidProductCode(code)) return setError('商品コードは半角英数字と記号で入力してください。');
    if (!form.name.trim()) return setError('商品名を入力してください。');
    if (!form.temperatureZone) return setError('温度帯を確認して選択してください。');
    if (products.some((product) => normalizeProductCode(product.productCode) === code)) {
      return setError('同じ商品コードが既に登録されています。画面を閉じて再照合してください。');
    }
    const payload = normalizeProduct({ ...form, userId, productCode: code, costPrice: parsePrice(form.costPrice) }, userId);
    setSaving(true);
    try {
      const productId = await addProduct?.(payload);
      if (!productId) throw new Error('商品マスタへの登録に失敗しました。');
      await onCreated?.({ ...payload, id: productId });
    } catch (saveError) {
      setError(saveError.message || '商品マスタへの登録に失敗しました。');
    } finally { setSaving(false); }
  }

  return createPortal(
    <div className="modal-backdrop inbound-product-create-backdrop" role="presentation" onMouseDown={onClose}>
      <form className="modal-panel inbound-product-create-modal" role="dialog" aria-modal="true" aria-labelledby="inbound-product-create-title" onMouseDown={(event) => event.stopPropagation()} onSubmit={handleSubmit}>
        <div className="customer-editor-header"><div><p className="eyebrow">商品マスタ</p><h2 id="inbound-product-create-title">新商品として登録</h2></div><button type="button" className="ghost-button" onClick={onClose}>閉じる</button></div>
        <p className="inline-helper">帳票から取得できた値だけを初期入力しています。登録前に内容を確認してください。</p>
        <div className="inbound-product-create-grid">
          <label>商品コード<input value={form.productCode} onChange={(event) => setField('productCode', event.target.value)} required /></label>
          <label>商品名<input value={form.name} onChange={(event) => setField('name', event.target.value)} required /></label>
          <label>ブランド<input value={form.brandName} onChange={(event) => setField('brandName', event.target.value)} /></label>
          <label>原産国<input value={form.origin} onChange={(event) => setField('origin', event.target.value)} /></label>
          <label>カテゴリ<input list="inbound-product-categories" value={form.category} onChange={(event) => setField('category', event.target.value)} /></label>
          <label>原価<input inputMode="decimal" value={form.costPrice} onChange={(event) => setField('costPrice', event.target.value)} placeholder="未取得" /></label>
          <label>原価単位<input list="inbound-product-units" value={form.costUnit} onChange={(event) => setField('costUnit', event.target.value)} placeholder="未取得" /></label>
          <label>メーカー<input value={form.manufacturerName} onChange={(event) => setField('manufacturerName', event.target.value)} /></label>
          <label>温度帯<select value={form.temperatureZone} onChange={(event) => setField('temperatureZone', event.target.value)} required><option value="">選択してください</option>{TEMPERATURE_ZONES.map((value) => <option value={value} key={value}>{value}</option>)}</select></label>
          <label>荷姿<input value={form.packageStyle} onChange={(event) => setField('packageStyle', event.target.value)} /></label>
          <label className="inbound-product-create-wide">メモ<textarea rows="3" value={form.memo} onChange={(event) => setField('memo', event.target.value)} /></label>
        </div>
        <datalist id="inbound-product-categories">{PRODUCT_CATEGORIES.map((value) => <option value={value} key={value} />)}</datalist>
        <datalist id="inbound-product-units">{PRODUCT_UNITS.map((value) => <option value={value} key={value} />)}</datalist>
        {error && <p className="form-error-message">{error}</p>}
        <div className="customer-editor-actions inbound-product-create-actions"><button type="button" className="ghost-button" onClick={onClose}>キャンセル</button><button type="submit" className="primary-button" disabled={saving}>{saving ? '登録中...' : '内容を確認して登録'}</button></div>
      </form>
    </div>, document.body,
  );
}
