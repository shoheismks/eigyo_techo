import { useEffect, useState } from 'react';
import Home from './pages/Home.jsx';
import LeadSearch from './pages/LeadSearch.jsx';
import Customers from './pages/Customers.jsx';
import Pipeline from './pages/Pipeline.jsx';
import MailAI from './pages/MailAI.jsx';
import CompanyEnrich from './pages/CompanyEnrich.jsx';
import CustomerDetail from './pages/CustomerDetail.jsx';
import Products from './pages/Products.jsx';
import { useCustomers } from './hooks/useCustomers.js';
import { useProducts } from './hooks/useProducts.js';

const pages = {
  Home: { label: 'ホーム', icon: '⌂' },
  LeadSearch: { label: '検索', icon: '⌕' },
  CompanyEnrich: { label: '補完', icon: '＋' },
  Customers: { label: '得意先', icon: '□' },
  Pipeline: { label: '案件', icon: '▤' },
  Products: { label: '商品', icon: '◇' },
  MailAI: { label: 'メール', icon: '✉' },
};

export default function App() {
  const [activePage, setActivePage] = useState('Home');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [extensionNotice, setExtensionNotice] = useState('');
  const {
    customers,
    addCustomer,
    importCompanyName,
    updateCustomer,
    removeCustomer,
    isSaved,
    reloadFromCloud,
    syncError,
    syncState,
  } = useCustomers();
  const { products, addProduct, updateProduct, removeProduct } = useProducts();

  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId);

  function openCustomerDetail(customerId) {
    setSelectedCustomerId(customerId);
    setActivePage('CustomerDetail');
  }

  function handleExtensionImport(companyName) {
    const result = importCompanyName(companyName);
    setExtensionNotice(result.reason);

    if (result.ok) {
      setActivePage('Customers');
    }

    window.setTimeout(() => setExtensionNotice(''), 3500);
    return result;
  }

  useEffect(() => {
    window.eigyoTechoImportCompanyName = handleExtensionImport;

    function handleMessage(event) {
      if (event.origin !== window.location.origin) {
        return;
      }

      if (event.data?.type !== 'EIGYO_TECHO_IMPORT_COMPANY') {
        return;
      }

      const result = handleExtensionImport(event.data.companyName || '');
      window.postMessage(
        {
          type: 'EIGYO_TECHO_IMPORT_RESULT',
          requestId: event.data.requestId,
          ok: result.ok,
          message: result.reason,
        },
        window.location.origin,
      );
    }

    function handleUrlImport() {
      const params = new URLSearchParams(window.location.search);
      const companyName = params.get('importCompany');
      if (!companyName) {
        return;
      }

      const result = handleExtensionImport(companyName);
      window.postMessage(
        {
          type: 'EIGYO_TECHO_IMPORT_RESULT',
          requestId: 'url-import',
          ok: result.ok,
          message: result.reason,
        },
        window.location.origin,
      );
      params.delete('importCompany');
      const nextSearch = params.toString();
      const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`;
      window.history.replaceState({}, '', nextUrl);
    }

    window.addEventListener('message', handleMessage);
    window.setTimeout(handleUrlImport, 0);

    return () => {
      window.removeEventListener('message', handleMessage);
      delete window.eigyoTechoImportCompanyName;
    };
  });

  return (
    <div className="app-shell">
      <div className="app-frame">
        {extensionNotice && <div className="extension-toast">{extensionNotice}</div>}
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
            onOpenDetail={openCustomerDetail}
          />
        )}
        {activePage === 'CustomerDetail' && (
          <CustomerDetail
            customer={selectedCustomer}
            products={products}
            updateCustomer={updateCustomer}
            setActivePage={setActivePage}
          />
        )}
        {activePage === 'Pipeline' && (
          <Pipeline customers={customers} updateCustomer={updateCustomer} />
        )}
        {activePage === 'Products' && (
          <Products
            products={products}
            addProduct={addProduct}
            updateProduct={updateProduct}
            removeProduct={removeProduct}
          />
        )}
        {activePage === 'MailAI' && <MailAI customers={customers} products={products} />}

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
