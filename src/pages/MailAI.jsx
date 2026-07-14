import { useEffect, useMemo, useState } from 'react';
import { SALES_PURPOSES, createMailDrafts } from '../services/mailDraftService.js';
import { createGmailDraft } from '../services/gmailService.js';
import { createOutlookDraft } from '../services/outlookService.js';
import { generateMailSupportNote } from '../services/aiService.js';
import { productDisplayName } from '../modules/products/hooks/useProducts.js';
import {
  fetchMailDrafts,
  normalizeGeneratedDrafts,
  readLocalMailDrafts,
  upsertMailDrafts,
} from '../services/mailDraftSyncService.js';

export default function MailAI({ customers, products = [], userId = '' }) {
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? '');
  const [productId, setProductId] = useState('');
  const [productName, setProductName] = useState('');
  const [purpose, setPurpose] = useState('新規営業');
  const [senderName, setSenderName] = useState('');
  const [drafts, setDrafts] = useState([]);
  const [generationSource, setGenerationSource] = useState('');
  const [fallbackReason, setFallbackReason] = useState('');
  const [aiMailNote, setAiMailNote] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingMailNote, setIsGeneratingMailNote] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [draftSyncNotice, setDraftSyncNotice] = useState('');
  const [copiedDraftId, setCopiedDraftId] = useState('');
  const [gmailLoadingDraftId, setGmailLoadingDraftId] = useState('');
  const [outlookLoadingDraftId, setOutlookLoadingDraftId] = useState('');

  useEffect(() => {
    if (!customerId && customers[0]?.id) {
      setCustomerId(customers[0].id);
    }
  }, [customerId, customers]);

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === customerId) ?? customers[0],
    [customerId, customers],
  );
  const selectedProduct = useMemo(
    () => products.find((product) => product.id === productId),
    [products, productId],
  );

  useEffect(() => {
    if (selectedProduct) {
      setProductName(selectedProduct.name);
    }
  }, [selectedProduct]);

  useEffect(() => {
    let ignore = false;

    async function loadDrafts() {
      if (!selectedCustomer?.id) {
        setDrafts([]);
        return;
      }

      try {
        const savedDrafts = await fetchMailDrafts(selectedCustomer.id, userId);
        if (!ignore) {
          setDrafts(savedDrafts);
          setDraftSyncNotice(savedDrafts.length > 0 ? '保存済みメール案を読み込みました' : '');
        }
      } catch {
        if (!ignore) {
          const localDrafts = readLocalMailDrafts(selectedCustomer.id, userId);
          setDrafts(localDrafts);
          setDraftSyncNotice('メール案はLocalStorageから読み込みます');
        }
      }
    }

    loadDrafts();

    return () => {
      ignore = true;
    };
  }, [selectedCustomer?.id, userId]);

  async function handleCreateDrafts() {
    setIsGenerating(true);
    setError('');
    setNotice('');
    setCopiedDraftId('');
    setFallbackReason('');

    try {
      const result = await createMailDrafts({
        customer: selectedCustomer,
        productName,
        purpose,
        senderName,
        products,
      });
      const generatedDrafts = normalizeGeneratedDrafts({
        customer: selectedCustomer,
        drafts: result.drafts,
        productName,
        purpose,
        source: result.source,
        userId,
      });
      setDrafts(generatedDrafts);
      setGenerationSource(result.source);
      setFallbackReason(result.fallbackReason);
      setDraftSyncNotice('');

      try {
        const savedDrafts = await upsertMailDrafts(generatedDrafts, userId);
        setDrafts(savedDrafts);
        setDraftSyncNotice('メール案を保存しました');
      } catch {
        setDraftSyncNotice('メール案はLocalStorageに保存しました');
      }
    } catch {
      setError('メール案の作成に失敗しました');
      setDrafts([]);
      setGenerationSource('');
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleCreateMailNote() {
    setIsGeneratingMailNote(true);
    setError('');

    try {
      setAiMailNote(await generateMailSupportNote({
        customer: selectedCustomer,
        productName,
        purpose,
      }));
    } finally {
      setIsGeneratingMailNote(false);
    }
  }

  function updateDraft(draftId, field, value) {
    setDrafts((currentDrafts) =>
      currentDrafts.map((draft) =>
        draft.id === draftId ? { ...draft, [field]: value } : draft,
      ),
    );
  }

  async function handleCopy(draft) {
    try {
      await navigator.clipboard.writeText(draft.body);
      setCopiedDraftId(draft.id);
      setNotice('');
    } catch {
      setError('コピーに失敗しました');
    }
  }

  async function handleCreateGmailDraft(draft) {
    await createProviderDraft({
      draft,
      provider: 'Gmail',
      setLoadingDraftId: setGmailLoadingDraftId,
      createDraft: createGmailDraft,
      successMessage: 'Gmail下書きを作成しました',
      errorMessage: 'Gmail下書き作成に失敗しました',
    });
  }

  async function handleCreateOutlookDraft(draft) {
    await createProviderDraft({
      draft,
      provider: 'Outlook',
      setLoadingDraftId: setOutlookLoadingDraftId,
      createDraft: createOutlookDraft,
      successMessage: 'Outlook下書きを作成しました',
      errorMessage: 'Outlook下書き作成に失敗しました',
    });
  }

  async function createProviderDraft({
    draft,
    setLoadingDraftId,
    createDraft,
    successMessage,
    errorMessage,
  }) {
    if (!selectedCustomer?.email) {
      setError('メールアドレスが未登録です');
      setNotice('');
      return;
    }

    setLoadingDraftId(draft.id);
    setError('');
    setNotice('');

    try {
      await createDraft({
        to: selectedCustomer.email,
        subject: draft.subject,
        body: draft.body,
      });
      setNotice(successMessage);
    } catch {
      setError(errorMessage);
    } finally {
      setLoadingDraftId('');
    }
  }

  return (
    <main className="page">
      <section className="page-header">
        <p className="eyebrow">Mail AI</p>
        <h1>AIメール作成</h1>
        <p>得意先情報、商材、営業目的から営業メール案を生成し、GmailやOutlookの下書き作成の準備まで行えます。</p>
      </section>

      <section className="mail-builder">
        <label className="field-label">
          得意先
          <select
            value={selectedCustomer?.id ?? ''}
            onChange={(event) => setCustomerId(event.target.value)}
            disabled={customers.length === 0}
          >
            {customers.length === 0 ? (
              <option>得意先を追加してください</option>
            ) : (
              customers.map((customer) => (
                <option value={customer.id} key={customer.id}>
                  {customer.companyName}
                </option>
              ))
            )}
          </select>
        </label>

        <label className="field-label">
          商品マスター
          <select value={productId} onChange={(event) => setProductId(event.target.value)}>
            <option value="">手入力</option>
            {products.map((product) => (
              <option value={product.id} key={product.id}>
                {productDisplayName(product)}
              </option>
            ))}
          </select>
        </label>

        <label className="field-label">
          商材名
          <input
            value={productName}
            placeholder="例: 問い合わせ対応自動化ツール"
            onChange={(event) => setProductName(event.target.value)}
          />
        </label>

        <label className="field-label">
          営業目的
          <select value={purpose} onChange={(event) => setPurpose(event.target.value)}>
            {SALES_PURPOSES.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>

        <label className="field-label">
          署名名
          <input
            value={senderName}
            placeholder="例: 山田 太郎"
            onChange={(event) => setSenderName(event.target.value)}
          />
        </label>

        {!selectedCustomer?.isDoNotContact && (
          <div className="mail-action-row">
          <button
            className="primary-button"
            disabled={!selectedCustomer || isGenerating}
            onClick={handleCreateDrafts}
          >
            {isGenerating ? 'AI生成中...' : 'メール案を作成'}
          </button>
          <button
            className="ghost-button"
            disabled={!selectedCustomer || isGeneratingMailNote}
            onClick={handleCreateMailNote}
          >
            {isGeneratingMailNote ? 'AI方針生成中...' : 'AIメール方針'}
          </button>
          </div>
        )}
      </section>

      {aiMailNote && (
        <section className="mail-context">
          <label className="field-label">
            AIメール方針メモ
            <textarea value={aiMailNote} onChange={(event) => setAiMailNote(event.target.value)} />
          </label>
        </section>
      )}

      {selectedCustomer && (
        <section className="mail-context">
          <div>
            <span>宛先候補</span>
            <strong>{selectedCustomer.companyName}</strong>
          </div>
          <div>
            <span>送信先メール</span>
            <strong>{selectedCustomer.email || 'メールアドレスが未登録です'}</strong>
          </div>
          <div>
            <span>タグ</span>
            <strong>{(selectedCustomer.tags ?? []).join(', ') || '未設定'}</strong>
          </div>
        </section>
      )}

      {selectedCustomer?.isDoNotContact && (
        <p className="error-text">この顧客は配信停止・NGのため、メール作成ボタンを表示しません。</p>
      )}

      {generationSource && (
        <p className={fallbackReason ? 'error-text' : 'notice-text'}>
          生成方式: {generationSource}
          {fallbackReason ? ` / ${fallbackReason}` : ''}
        </p>
      )}

      {notice && <p className="notice-text">{notice}</p>}
      {draftSyncNotice && <p className="notice-text">{draftSyncNotice}</p>}
      {error && <p className="error-text">{error}</p>}

      <section className="mail-drafts">
        <div className="section-heading">
          <h2>メール案3パターン</h2>
          <span>{drafts.length}件</span>
        </div>

        {drafts.length > 0 ? (
          drafts.map((draft) => (
            <article className="mail-draft-card" key={draft.id}>
              <div className="section-heading">
                <h3>{draft.title}</h3>
                <div className="mail-action-row">
                  <button className="ghost-button" onClick={() => handleCopy(draft)}>
                    {copiedDraftId === draft.id ? 'コピー済み' : 'コピー'}
                  </button>
                  <button
                    className="ghost-button"
                    disabled={selectedCustomer?.isDoNotContact || !selectedCustomer?.email || gmailLoadingDraftId === draft.id}
                    onClick={() => handleCreateGmailDraft(draft)}
                  >
                    {gmailLoadingDraftId === draft.id ? '作成中...' : 'Gmail下書き作成'}
                  </button>
                  <button
                    className="ghost-button"
                    disabled={selectedCustomer?.isDoNotContact || !selectedCustomer?.email || outlookLoadingDraftId === draft.id}
                    onClick={() => handleCreateOutlookDraft(draft)}
                  >
                    {outlookLoadingDraftId === draft.id ? '作成中...' : 'Outlook下書き作成'}
                  </button>
                </div>
              </div>
              {!selectedCustomer?.email && (
                <p className="inline-helper">メールアドレスが未登録です</p>
              )}
              <div className="mail-subject">
                <span>件名</span>
                <input
                  value={draft.subject}
                  onChange={(event) => updateDraft(draft.id, 'subject', event.target.value)}
                />
              </div>
              <textarea value={draft.body} onChange={(event) => updateDraft(draft.id, 'body', event.target.value)} />
            </article>
          ))
        ) : (
          <div className="empty-state">
            <h3>メール案はまだありません</h3>
            <p>得意先、商材名、営業目的を確認して「メール案を作成」を押してください。</p>
          </div>
        )}
      </section>
    </main>
  );
}
