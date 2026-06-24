import { useMemo, useState } from 'react';
import {
  enrichCompaniesByName,
  parseCompanyNames,
  toCustomerFromEnrichedCompany,
} from '../services/companyEnrichmentService.js';
import {
  discoverPublicContactsFromWebsite,
  normalizeWebsiteUrl,
} from '../services/websiteContactService.js';
import { calculateCompanyScore } from '../services/scoringService.js';

export default function CompanyEnrich({ addCustomer, isSaved }) {
  const [bulkText, setBulkText] = useState('');
  const [companies, setCompanies] = useState([]);
  const [isEnriching, setIsEnriching] = useState(false);
  const [contactLoadingId, setContactLoadingId] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const parsedNames = useMemo(() => parseCompanyNames(bulkText), [bulkText]);

  async function handleEnrich() {
    if (parsedNames.length === 0) {
      setError('会社名を1行ずつ貼り付けてください');
      return;
    }

    setIsEnriching(true);
    setError('');
    setNotice('連続アクセスを避けながら補完しています');

    try {
      const results = await enrichCompaniesByName(parsedNames);
      setCompanies(results);
      setNotice('補完候補を作成しました。公式サイトは人間が確認して入力してください。');
    } catch {
      setError('企業情報の補完に失敗しました');
    } finally {
      setIsEnriching(false);
    }
  }

  function updateCompany(id, updates) {
    setCompanies((current) =>
      current.map((company) => (company.id === id ? { ...company, ...updates } : company)),
    );
  }

  async function handleDiscoverContact(company) {
    const website = normalizeWebsiteUrl(company.website);
    if (!website) {
      updateCompany(company.id, {
        contactStatus: '取得失敗',
        contactMessage: '公式サイトURLを入力してください',
      });
      return;
    }

    setContactLoadingId(company.id);
    updateCompany(company.id, { website, contactStatus: '検索中', contactMessage: '' });

    const result = await discoverPublicContactsFromWebsite(website);
    updateCompany(company.id, {
      email: result.email || company.email,
      inquiryUrl: result.inquiryUrl || company.inquiryUrl,
      contactStatus: result.status === 'matched' ? '取得済' : '取得失敗',
      contactMessage: result.message,
    });
    setContactLoadingId('');
  }

  function handleSave(company) {
    addCustomer(toCustomerFromEnrichedCompany(company));
    setNotice(`${company.companyName} を営業手帳に保存しました`);
  }

  return (
    <main className="page">
      <section className="page-header">
        <p className="eyebrow">Free enrichment</p>
        <h1>企業情報補完</h1>
        <p>無料APIと人間確認を優先して、正式社名、所在地、法人番号、公式サイト、公開連絡先を補完します。</p>
      </section>

      <section className="search-panel">
        <label className="field-label">
          会社名一括貼り付け
          <textarea
            value={bulkText}
            placeholder={'例:\n株式会社サンプル食品\n東京テスト商事'}
            onChange={(event) => setBulkText(event.target.value)}
          />
        </label>
        <div className="enrich-action-row">
          <button className="primary-button" disabled={isEnriching} onClick={handleEnrich}>
            {isEnriching ? '補完中...' : '無料情報で補完'}
          </button>
          <span>{parsedNames.length}社</span>
        </div>
        <p className="inline-helper">
          Google検索API、Google Mapsスクレイピング、Baseconnect自動巡回は使いません。
        </p>
      </section>

      {notice && <p className="notice-text">{notice}</p>}
      {error && <p className="error-text">{error}</p>}

      <section className="result-stack">
        <div className="section-heading">
          <h2>補完候補</h2>
          <span>{companies.length}件</span>
        </div>

        {companies.length === 0 ? (
          <div className="empty-state">
            <h3>補完候補はまだありません</h3>
            <p>会社名を貼り付けて「無料情報で補完」を押してください。</p>
          </div>
        ) : (
          companies.map((company) => {
            const scoredCompany = {
              ...company,
              ...calculateCompanyScore(company),
            };
            const saved = isSaved(company.companyName, company.address);

            return (
              <article className="company-card enrich-card" key={company.id}>
                <div className="card-topline">
                  <span className="status-pill neutral">{company.enrichmentStatus}</span>
                  <span className="area-chip">{company.source}</span>
                </div>

                <div className="company-heading">
                  <h3>{company.companyName}</h3>
                  <p>{company.address || '所在地未取得'}</p>
                </div>

                <dl className="company-details">
                  <div>
                    <dt>法人番号</dt>
                    <dd>{company.corporateNumber || '未取得'}</dd>
                  </div>
                  <div>
                    <dt>所在地</dt>
                    <dd>{company.address || '未取得'}</dd>
                  </div>
                  <div>
                    <dt>Email</dt>
                    <dd>{company.email || 'メール未取得'}</dd>
                  </div>
                  <div>
                    <dt>問合せ</dt>
                    <dd>{company.inquiryUrl || '問い合わせ未取得'}</dd>
                  </div>
                </dl>

                <div className="lead-badges">
                  <span className="info-badge">{company.enrichmentMessage}</span>
                  {company.contactMessage && (
                    <span className={company.contactStatus === '取得済' ? 'info-badge ready' : 'info-badge failed'}>
                      {company.contactMessage}
                    </span>
                  )}
                </div>

                <div className="score-panel">
                  <div>
                    <span>Score</span>
                    <strong>{scoredCompany.score}</strong>
                  </div>
                  <div>
                    <span>Rank</span>
                    <strong>{scoredCompany.rank}</strong>
                  </div>
                </div>

                <div className="enrich-links">
                  <a href={company.googleSearchUrl} target="_blank" rel="noreferrer">
                    Googleで公式サイト確認
                  </a>
                  <a href={company.gbizInfoUrl} target="_blank" rel="noreferrer">
                    gBizINFOで確認
                  </a>
                </div>

                <label className="field-label">
                  公式サイトURL
                  <input
                    value={company.website}
                    placeholder="https://example.co.jp"
                    onChange={(event) => updateCompany(company.id, { website: event.target.value })}
                  />
                </label>

                <div className="card-actions">
                  <button
                    className="ghost-button"
                    disabled={contactLoadingId === company.id || !company.website}
                    onClick={() => handleDiscoverContact(company)}
                  >
                    {contactLoadingId === company.id ? '連絡先抽出中...' : '公開連絡先を抽出'}
                  </button>
                  <button
                    className="primary-button"
                    disabled={saved}
                    onClick={() => handleSave(company)}
                  >
                    {saved ? '追加済み' : '営業手帳に保存'}
                  </button>
                </div>
              </article>
            );
          })
        )}
      </section>
    </main>
  );
}
