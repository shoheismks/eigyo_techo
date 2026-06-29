import { useEffect, useState } from 'react';
import { useAuth } from './context/AuthContext.jsx';
import Home from './pages/Home.jsx';
import LeadSearch from './pages/LeadSearch.jsx';
import Customers from './pages/Customers.jsx';
import Pipeline from './pages/Pipeline.jsx';
import MailAI from './pages/MailAI.jsx';
import CompanyEnrich from './pages/CompanyEnrich.jsx';
import CustomerDetail from './pages/CustomerDetail.jsx';
import CustomerKarte from './pages/CustomerKarte.jsx';
import Products from './pages/Products.jsx';
import ProductDetail from './pages/ProductDetail.jsx';
import Contacts from './pages/Contacts.jsx';
import Suppliers from './pages/Suppliers.jsx';
import BusinessCards from './pages/BusinessCards.jsx';
import Complaints from './pages/Complaints.jsx';
import Login from './pages/Login.jsx';
import { useCustomers } from './hooks/useCustomers.js';
import { useProducts } from './hooks/useProducts.js';
import { useContacts } from './hooks/useContacts.js';
import { useSuppliers } from './hooks/useSuppliers.js';
import { useBusinessCards } from './hooks/useBusinessCards.js';
import { useComplaints } from './hooks/useComplaints.js';
import { useAttachments } from './hooks/useAttachments.js';

const pages = {
  Home: { label: 'ホーム', icon: 'H' },
  LeadSearch: { label: '検索', icon: 'S' },
  CompanyEnrich: { label: '補完', icon: 'E' },
  Customers: { label: '取引先', icon: 'C' },
  Pipeline: { label: '案件', icon: 'P' },
  Products: { label: '商品', icon: 'B' },
  Contacts: { label: '担当者', icon: 'N' },
  Suppliers: { label: '仕入', icon: 'V' },
  BusinessCards: { label: '名刺', icon: 'O' },
  Complaints: { label: '苦情', icon: '!' },
  MailAI: { label: 'メール', icon: 'M' },
};

function isImportPath() {
  return window.location.pathname === '/import';
}

function getImportCompanyName() {
  const params = new URLSearchParams(window.location.search);
  return (params.get('companyName') || params.get('importCompany') || '').trim();
}

export default function App() {
  const { loading, user } = useAuth();

  if (loading) {
    return (
      <main className="login-page">
        <section className="login-card">
          <h1>営業手帳</h1>
          <p className="hero-copy">ログイン状態を確認しています。</p>
        </section>
      </main>
    );
  }

  if (!user) {
    return <Login />;
  }

  return <AuthenticatedApp />;
}

function AuthenticatedApp() {
  const { signOut, user, userId } = useAuth();
  const [activePage, setActivePage] = useState(() => (isImportPath() ? 'Import' : 'Home'));
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [extensionNotice, setExtensionNotice] = useState('');
  const [importError, setImportError] = useState('');
  const [importHandled, setImportHandled] = useState(false);

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
  } = useCustomers(userId);
  const { products, addProduct, updateProduct, removeProduct } = useProducts(userId);
  const {
    records: contacts,
    addRecord: addContact,
    updateRecord: updateContact,
    removeRecord: removeContact,
  } = useContacts(userId);
  const {
    records: suppliers,
    addRecord: addSupplier,
    updateRecord: updateSupplier,
    removeRecord: removeSupplier,
  } = useSuppliers(userId);
  const {
    records: businessCards,
    addRecord: addBusinessCard,
  } = useBusinessCards(userId);
  const {
    records: complaints,
    addRecord: addComplaint,
    updateRecord: updateComplaint,
    removeRecord: removeComplaint,
  } = useComplaints(userId);
  const {
    records: attachments,
    addRecord: addAttachment,
  } = useAttachments(userId);

  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId);
  const selectedProduct = products.find((product) => product.id === selectedProductId);

  function openCustomerDetail(customerId) {
    setSelectedCustomerId(customerId);
    setActivePage('CustomerDetail');
  }

  function openCustomerKarte(customerId) {
    setSelectedCustomerId(customerId);
    setActivePage('CustomerKarte');
  }

  function openProductDetail(productId) {
    setSelectedProductId(productId === 'new' ? '' : productId);
    setActivePage('ProductDetail');
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

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
      delete window.eigyoTechoImportCompanyName;
    };
  });

  useEffect(() => {
    if (!isImportPath() || importHandled) {
      return;
    }

    setImportHandled(true);
    const companyName = getImportCompanyName();

    if (!companyName) {
      setImportError('会社名が指定されていません。');
      setActivePage('Import');
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

    setActivePage('Customers');
    window.history.replaceState({}, '', '/');
  }, [importHandled]);

  return (
    <div className="app-shell">
      <div className="app-frame">
        <header className="auth-bar">
          <span>{user.email}</span>
          <button className="text-button" onClick={signOut}>ログアウト</button>
        </header>

        {extensionNotice && <div className="extension-toast">{extensionNotice}</div>}

        {activePage === 'Import' && (
          <ImportPage error={importError} onGoCustomers={() => setActivePage('Customers')} />
        )}
        {activePage === 'Home' && (
          <Home
            customers={customers}
            setActivePage={setActivePage}
            syncState={syncState}
            syncError={syncError}
            reloadFromCloud={reloadFromCloud}
          />
        )}
        {activePage === 'LeadSearch' && <LeadSearch addCustomer={addCustomer} isSaved={isSaved} />}
        {activePage === 'CompanyEnrich' && <CompanyEnrich addCustomer={addCustomer} isSaved={isSaved} />}
        {activePage === 'Customers' && (
          <Customers
            customers={customers}
            updateCustomer={updateCustomer}
            removeCustomer={removeCustomer}
            onOpenDetail={openCustomerDetail}
            onOpenKarte={openCustomerKarte}
          />
        )}
        {activePage === 'CustomerKarte' && (
          <CustomerKarte
            customerId={selectedCustomerId}
            customers={customers}
            contacts={contacts}
            businessCards={businessCards}
            products={products}
            complaints={complaints}
            attachments={attachments}
            updateCustomer={updateCustomer}
            addContact={addContact}
            addBusinessCard={addBusinessCard}
            addComplaint={addComplaint}
            addAttachment={addAttachment}
            setActivePage={setActivePage}
            user={user}
          />
        )}
        {activePage === 'CustomerDetail' && (
          <CustomerDetail
            customer={selectedCustomer}
            products={products}
            contacts={contacts}
            updateCustomer={updateCustomer}
            setActivePage={setActivePage}
            user={user}
          />
        )}
        {activePage === 'Pipeline' && <Pipeline customers={customers} updateCustomer={updateCustomer} />}
        {activePage === 'Products' && (
          <Products products={products} removeProduct={removeProduct} onOpenProductDetail={openProductDetail} />
        )}
        {activePage === 'ProductDetail' && (
          <ProductDetail
            product={selectedProduct}
            addProduct={addProduct}
            updateProduct={updateProduct}
            setActivePage={setActivePage}
            userId={userId}
          />
        )}
        {activePage === 'Contacts' && (
          <Contacts
            contacts={contacts}
            customers={customers}
            addContact={addContact}
            updateContact={updateContact}
            removeContact={removeContact}
          />
        )}
        {activePage === 'Suppliers' && (
          <Suppliers
            suppliers={suppliers}
            addSupplier={addSupplier}
            updateSupplier={updateSupplier}
            removeSupplier={removeSupplier}
            userId={userId}
          />
        )}
        {activePage === 'BusinessCards' && (
          <BusinessCards
            businessCards={businessCards}
            addBusinessCard={addBusinessCard}
            contacts={contacts}
            addContact={addContact}
            userId={userId}
          />
        )}
        {activePage === 'Complaints' && (
          <Complaints
            complaints={complaints}
            customers={customers}
            addComplaint={addComplaint}
            updateComplaint={updateComplaint}
            removeComplaint={removeComplaint}
            userId={userId}
          />
        )}
        {activePage === 'MailAI' && <MailAI customers={customers} products={products} userId={userId} />}

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

function ImportPage({ error, onGoCustomers }) {
  return (
    <main className="page">
      <section className="page-header">
        <p className="eyebrow">Import</p>
        <h1>会社名を追加</h1>
        <p>Chrome拡張から受け取った会社名を営業手帳へ追加します。</p>
      </section>

      {error ? (
        <section className="empty-state">
          <h3>追加できませんでした</h3>
          <p>{error}</p>
          <button className="primary-button" onClick={onGoCustomers}>
            取引先一覧へ
          </button>
        </section>
      ) : (
        <section className="empty-state">
          <h3>取り込み中...</h3>
          <p>会社名を確認しています。</p>
        </section>
      )}
    </main>
  );
}
