import { useState } from 'react';
import Home from './pages/Home.jsx';
import LeadSearch from './pages/LeadSearch.jsx';
import Customers from './pages/Customers.jsx';
import Pipeline from './pages/Pipeline.jsx';
import MailAI from './pages/MailAI.jsx';
import CompanyEnrich from './pages/CompanyEnrich.jsx';
import { useCustomers } from './hooks/useCustomers.js';

const pages = {
  Home: { label: 'ホーム', icon: '⌂' },
  LeadSearch: { label: '検索', icon: '⌕' },
  CompanyEnrich: { label: '補完', icon: '＋' },
  Customers: { label: '得意先', icon: '□' },
  Pipeline: { label: '案件', icon: '▤' },
  MailAI: { label: 'メール', icon: '✉' },
};

export default function App() {
  const [activePage, setActivePage] = useState('Home');
  const {
    customers,
    addCustomer,
    updateCustomer,
    removeCustomer,
    isSaved,
    reloadFromCloud,
    syncError,
    syncState,
  } = useCustomers();

  return (
    <div className="app-shell">
      <div className="app-frame">
        {activePage === 'Home' && (
          <Home
            customers={customers}
            setActivePage={setActivePage}
            syncState={syncState}
            syncError={syncError}
            reloadFromCloud={reloadFromCloud}
          />
        )}
        {activePage === 'LeadSearch' && (
          <LeadSearch addCustomer={addCustomer} isSaved={isSaved} />
        )}
        {activePage === 'CompanyEnrich' && (
          <CompanyEnrich addCustomer={addCustomer} isSaved={isSaved} />
        )}
        {activePage === 'Customers' && (
          <Customers
            customers={customers}
            updateCustomer={updateCustomer}
            removeCustomer={removeCustomer}
          />
        )}
        {activePage === 'Pipeline' && (
          <Pipeline customers={customers} updateCustomer={updateCustomer} />
        )}
        {activePage === 'MailAI' && <MailAI customers={customers} />}

        <nav className="bottom-nav" aria-label="メインナビゲーション">
          {Object.entries(pages).map(([key, page]) => (
            <button
              key={key}
              className={activePage === key ? 'active' : ''}
              onClick={() => setActivePage(key)}
            >
              <span aria-hidden="true">{page.icon}</span>
              {page.label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
