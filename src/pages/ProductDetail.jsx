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
  adoptions = [],
  samples = [],
  quotes = [],
  customers = [],
  suppliers = [],
  addProduct,
  updateProduct,
  updateAdoption,
  updateSample,
  updateQuote,
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
        .filter((quote) => (quote.productIds ?? []).includes(form.id))
        .sort((a, b) =>
          String(b.submittedDate || b.createdAt || '').localeCompare(
            String(a.submittedDate || a.createdAt || ''),
          ),
        ),
    [form.id, quotes],
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

        <button className="primary-button sticky-submit" type="submit">
          {isNew ? '商品を追加' : '商品を保存'}
        </button>
      </form>
    </main>
  );
}
