import { useEffect, useMemo, useState } from 'react';
import {
  PRODUCT_CATEGORIES,
  PRODUCT_UNITS,
  TEMPERATURE_ZONES,
  calculateGrossMarginRate,
  emptyProduct,
  formatPrice,
  normalizeProduct,
  parsePrice,
} from '../hooks/useProducts.js';
import { uploadAttachment } from '../services/storageService.js';

function fileLabel(file) {
  return file?.name ? `${file.name} (${Math.ceil((file.size ?? 0) / 1024)}KB)` : '未添付';
}

export default function ProductDetail({
  product,
  addProduct,
  updateProduct,
  setActivePage,
  userId = '',
}) {
  const [form, setForm] = useState(() =>
    normalizeProduct(product ?? { ...emptyProduct, id: crypto.randomUUID(), userId }, userId),
  );
  const [uploadingField, setUploadingField] = useState('');
  const [uploadError, setUploadError] = useState('');
  const isNew = !product;

  useEffect(() => {
    setForm(normalizeProduct(product ?? { ...emptyProduct, id: crypto.randomUUID(), userId }, userId));
  }, [product, userId]);

  const grossMarginRate = useMemo(
    () => calculateGrossMarginRate(form.costPrice, form.desiredSellingPrice),
    [form.costPrice, form.desiredSellingPrice],
  );

  function updateField(field, value) {
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

  async function handleFile(field, file) {
    if (!file) {
      return;
    }

    setUploadingField(field);
    setUploadError('');

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
      setUploadError(error.message || '添付ファイルのアップロードに失敗しました。');
    } finally {
      setUploadingField('');
    }
  }

  function removeFile(field) {
    setForm((current) => ({
      ...current,
      [field]: null,
      attachments: (current.attachments ?? []).filter((item) => item.field !== field),
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (!form.name.trim()) {
      return;
    }

    const payload = normalizeProduct({
      ...form,
      userId,
      costPrice: parsePrice(form.costPrice),
      desiredSellingPrice: parsePrice(form.desiredSellingPrice),
      grossMarginRate,
    }, userId);

    if (isNew) {
      addProduct(payload);
    } else {
      updateProduct(product.id, payload);
    }

    setActivePage('Products');
  }

  return (
    <main className="page">
      <section className="page-header">
        <p className="eyebrow">Product detail</p>
        <h1>{isNew ? '商品追加' : '商品詳細'}</h1>
        <p>商品情報、価格、添付ファイルをSupabaseに同期して管理します。</p>
      </section>

      <form onSubmit={handleSubmit}>
        <section className="detail-section">
          <div className="section-heading">
            <h2>基本情報</h2>
            <button type="button" className="text-button" onClick={() => setActivePage('Products')}>
              一覧へ
            </button>
          </div>

          <label className="field-label">
            商品名
            <input
              value={form.name}
              placeholder="例: 和牛ベーコン"
              onChange={(event) => updateField('name', event.target.value)}
            />
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

        <button className="primary-button sticky-submit" type="submit">
          {isNew ? '商品を追加' : '商品を保存'}
        </button>
      </form>
    </main>
  );
}
