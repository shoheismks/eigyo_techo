import { useEffect, useMemo, useState } from 'react';
import CompanyCard from '../../../shared/components/CompanyCard.jsx';
import { getFallbackAreas, searchPlaces } from '../services/placesService.js';
import { calculateCompanyScore } from '../services/scoringService.js';

export default function LeadSearch({ addCustomer, isSaved }) {
  const [query, setQuery] = useState('');
  const [area, setArea] = useState('すべて');
  const [leads, setLeads] = useState([]);
  const [sortMode, setSortMode] = useState('default');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [usingFallback, setUsingFallback] = useState(false);

  const areas = getFallbackAreas();

  const scoredLeads = useMemo(() => {
    const nextLeads = leads.map((lead) => ({
      ...lead,
      ...calculateCompanyScore(lead),
    }));

    if (sortMode === 'score') {
      return [...nextLeads].sort((a, b) => b.score - a.score);
    }

    return nextLeads;
  }, [leads, sortMode]);

  useEffect(() => {
    let ignore = false;

    async function runSearch() {
      setIsLoading(true);
      setError('');

      const response = await searchPlaces({ query, area });

      if (ignore) {
        return;
      }

      setLeads(response.results);
      setUsingFallback(response.usingFallback);
      setError(response.error ? '検索に失敗しました' : '');
      setIsLoading(false);
    }

    runSearch();

    return () => {
      ignore = true;
    };
  }, [area, query]);

  return (
    <main className="page">
      <section className="page-header">
        <p className="eyebrow">Lead search</p>
        <h1>営業先検索</h1>
        <p>Google Places API連携を見据えた検索画面です。APIキー未設定時は仮データで検索します。</p>
      </section>

      <section className="search-panel">
        <label className="field-label">
          キーワード
          <input
            value={query}
            placeholder="会社名・業種・住所で検索"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label className="field-label">
          エリア
          <select value={area} onChange={(event) => setArea(event.target.value)}>
            {areas.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="field-label">
          並び替え
          <select value={sortMode} onChange={(event) => setSortMode(event.target.value)}>
            <option value="default">標準</option>
            <option value="score">高スコア順</option>
          </select>
        </label>
      </section>

      <section className="result-stack">
        <div className="section-heading">
          <h2>検索結果</h2>
          <span>{isLoading ? '検索中...' : `${scoredLeads.length}件`}</span>
        </div>

        {usingFallback && (
          <p className="notice-text">APIキー未設定またはAPI取得失敗のため、仮データを表示しています。</p>
        )}

        {error && <p className="error-text">検索に失敗しました</p>}

        {isLoading ? (
          <div className="empty-state">
            <h3>検索中...</h3>
            <p>営業先候補を取得しています。</p>
          </div>
        ) : (
          scoredLeads.map((lead) => (
            <CompanyCard
              key={lead.placeId || `${lead.companyName}-${lead.address}`}
              company={lead}
              actionLabel="営業手帳に追加"
              actionDisabled={isSaved(lead.companyName, lead.address, lead.placeId)}
              onAction={() => addCustomer(lead)}
              showLeadBadges
            />
          ))
        )}
      </section>
    </main>
  );
}
