import { useEffect, useState } from 'react';
import AppLayout from './layouts/AppLayout.jsx';
import { useAuth } from './context/AuthContext.jsx';
import { useAdoptions } from './modules/products/hooks/useAdoptions.js';
import { useAttachments } from './shared/hooks/useAttachments.js';
import { useBusinessCards } from './modules/businessCards/hooks/useBusinessCards.js';
import { useComplaints } from './modules/claims/hooks/useComplaints.js';
import { useContacts } from './modules/contacts/hooks/useContacts.js';
import { useCustomers } from './modules/customers/hooks/useCustomers.js';
import { useProducts } from './modules/products/hooks/useProducts.js';
import { useQuotes } from './modules/quotes/hooks/useQuotes.js';
import { useSamples } from './modules/samples/hooks/useSamples.js';
import { useSuppliers } from './modules/suppliers/hooks/useSuppliers.js';
import AnalyticsPage from './modules/dashboard/pages/AnalyticsPage.jsx';
import BusinessCards from './modules/businessCards/pages/BusinessCards.jsx';
import CalendarPage from './modules/calendar/pages/CalendarPage.jsx';
import CompanyEnrich from './modules/customers/pages/CompanyEnrich.jsx';
import Complaints from './modules/claims/pages/Complaints.jsx';
import Contacts from './modules/contacts/pages/Contacts.jsx';
import CustomerDetail from './modules/customers/pages/CustomerDetail.jsx';
import CustomerKarte from './modules/customers/pages/CustomerKarte.jsx';
import Customers from './modules/customers/pages/Customers.jsx';
import Home from './pages/Home.jsx';
import ImportPage from './modules/customers/pages/ImportPage.jsx';
import LeadSearch from './modules/customers/pages/LeadSearch.jsx';
import Login from './pages/Login.jsx';
import MailAI from './pages/MailAI.jsx';
import Pipeline from './pages/Pipeline.jsx';
import ProductDetail from './modules/products/pages/ProductDetail.jsx';
import Products from './modules/products/pages/Products.jsx';
import SettingsPage from './modules/settings/pages/SettingsPage.jsx';
import Suppliers from './modules/suppliers/pages/Suppliers.jsx';

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
  const [addMenuOpen, setAddMenuOpen] = useState(false);

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
    records: adoptions,
    addRecord: addAdoption,
    updateRecord: updateAdoption,
    removeRecord: removeAdoption,
  } = useAdoptions(userId);
  const {
    records: samples,
    addRecord: addSample,
    updateRecord: updateSample,
    removeRecord: removeSample,
  } = useSamples(userId);
  const {
    records: quotes,
    addRecord: addQuote,
    updateRecord: updateQuote,
    removeRecord: removeQuote,
  } = useQuotes(userId);
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

  function navigate(page) {
    setActivePage(page);
  }

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

  function handleAddAction(actionKey) {
    const nextPageByAction = {
      company: 'LeadSearch',
      'business-card': 'BusinessCards',
      deal: 'Pipeline',
      complaint: 'Complaints',
      supplier: 'Suppliers',
    };

    if (actionKey === 'product') {
      openProductDetail('new');
      return;
    }

    setActivePage(nextPageByAction[actionKey] || 'Home');
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
    <AppLayout
      activePage={activePage}
      user={user}
      onNavigate={navigate}
      onAddAction={handleAddAction}
      onSignOut={signOut}
      addMenuOpen={addMenuOpen}
      setAddMenuOpen={setAddMenuOpen}
      notice={extensionNotice}
    >
      <ActivePage
        activePage={activePage}
        importError={importError}
        setActivePage={setActivePage}
        addCustomer={addCustomer}
        isSaved={isSaved}
        customers={customers}
        updateCustomer={updateCustomer}
        removeCustomer={removeCustomer}
        openCustomerDetail={openCustomerDetail}
        openCustomerKarte={openCustomerKarte}
        selectedCustomer={selectedCustomer}
        selectedCustomerId={selectedCustomerId}
        products={products}
        addProduct={addProduct}
        updateProduct={updateProduct}
        removeProduct={removeProduct}
        adoptions={adoptions}
        addAdoption={addAdoption}
        updateAdoption={updateAdoption}
        removeAdoption={removeAdoption}
        samples={samples}
        addSample={addSample}
        updateSample={updateSample}
        removeSample={removeSample}
        quotes={quotes}
        addQuote={addQuote}
        updateQuote={updateQuote}
        removeQuote={removeQuote}
        openProductDetail={openProductDetail}
        selectedProduct={selectedProduct}
        contacts={contacts}
        addContact={addContact}
        updateContact={updateContact}
        removeContact={removeContact}
        suppliers={suppliers}
        addSupplier={addSupplier}
        updateSupplier={updateSupplier}
        removeSupplier={removeSupplier}
        businessCards={businessCards}
        addBusinessCard={addBusinessCard}
        complaints={complaints}
        addComplaint={addComplaint}
        updateComplaint={updateComplaint}
        removeComplaint={removeComplaint}
        attachments={attachments}
        addAttachment={addAttachment}
        syncState={syncState}
        syncError={syncError}
        reloadFromCloud={reloadFromCloud}
        user={user}
        userId={userId}
        signOut={signOut}
      />
    </AppLayout>
  );
}

function ActivePage({
  activePage,
  importError,
  setActivePage,
  addCustomer,
  isSaved,
  customers,
  updateCustomer,
  removeCustomer,
  openCustomerDetail,
  openCustomerKarte,
  selectedCustomer,
  selectedCustomerId,
  products,
  addProduct,
  updateProduct,
  removeProduct,
  adoptions,
  addAdoption,
  updateAdoption,
  removeAdoption,
  samples,
  addSample,
  updateSample,
  removeSample,
  quotes,
  addQuote,
  updateQuote,
  removeQuote,
  openProductDetail,
  selectedProduct,
  contacts,
  addContact,
  updateContact,
  removeContact,
  suppliers,
  addSupplier,
  updateSupplier,
  removeSupplier,
  businessCards,
  addBusinessCard,
  complaints,
  addComplaint,
  updateComplaint,
  removeComplaint,
  attachments,
  addAttachment,
  syncState,
  syncError,
  reloadFromCloud,
  user,
  userId,
  signOut,
}) {
  if (activePage === 'Import') {
    return <ImportPage error={importError} onGoCustomers={() => setActivePage('Customers')} />;
  }

  if (activePage === 'Home') {
    return (
      <Home
        customers={customers}
        samples={samples}
        quotes={quotes}
        complaints={complaints}
        setActivePage={setActivePage}
        syncState={syncState}
        syncError={syncError}
        reloadFromCloud={reloadFromCloud}
        onOpenKarte={openCustomerKarte}
      />
    );
  }

  if (activePage === 'LeadSearch') {
    return <LeadSearch addCustomer={addCustomer} isSaved={isSaved} />;
  }

  if (activePage === 'CompanyEnrich') {
    return <CompanyEnrich addCustomer={addCustomer} isSaved={isSaved} />;
  }

  if (activePage === 'Customers') {
    return (
      <Customers
        customers={customers}
        updateCustomer={updateCustomer}
        removeCustomer={removeCustomer}
        onOpenDetail={openCustomerDetail}
        onOpenKarte={openCustomerKarte}
        onOpenPipeline={() => setActivePage('Pipeline')}
        onCreateMail={() => setActivePage('MailAI')}
      />
    );
  }

  if (activePage === 'CustomerKarte') {
    return (
      <CustomerKarte
        customerId={selectedCustomerId}
        customers={customers}
        contacts={contacts}
        businessCards={businessCards}
        products={products}
        adoptions={adoptions}
        samples={samples}
        quotes={quotes}
        suppliers={suppliers}
        complaints={complaints}
        attachments={attachments}
        updateCustomer={updateCustomer}
        addContact={addContact}
        addBusinessCard={addBusinessCard}
        addComplaint={addComplaint}
        addAttachment={addAttachment}
        addSample={addSample}
        updateSample={updateSample}
        addQuote={addQuote}
        updateQuote={updateQuote}
        addAdoption={addAdoption}
        updateAdoption={updateAdoption}
        setActivePage={setActivePage}
        user={user}
      />
    );
  }

  if (activePage === 'CustomerDetail') {
    return (
      <CustomerDetail
        customer={selectedCustomer}
        products={products}
        contacts={contacts}
        updateCustomer={updateCustomer}
        setActivePage={setActivePage}
        user={user}
      />
    );
  }

  if (activePage === 'Pipeline') {
    return <Pipeline customers={customers} updateCustomer={updateCustomer} />;
  }

  if (activePage === 'Products') {
    return (
      <Products
        products={products}
        removeProduct={removeProduct}
        onOpenProductDetail={openProductDetail}
      />
    );
  }

  if (activePage === 'ProductDetail') {
    return (
      <ProductDetail
        product={selectedProduct}
        adoptions={adoptions}
        samples={samples}
        quotes={quotes}
        customers={customers}
        suppliers={suppliers}
        addProduct={addProduct}
        updateProduct={updateProduct}
        updateAdoption={updateAdoption}
        updateSample={updateSample}
        updateQuote={updateQuote}
        setActivePage={setActivePage}
        userId={userId}
      />
    );
  }

  if (activePage === 'Contacts') {
    return (
      <Contacts
        contacts={contacts}
        customers={customers}
        addContact={addContact}
        updateContact={updateContact}
        removeContact={removeContact}
      />
    );
  }

  if (activePage === 'Suppliers') {
    return (
      <Suppliers
        suppliers={suppliers}
        addSupplier={addSupplier}
        updateSupplier={updateSupplier}
        removeSupplier={removeSupplier}
        userId={userId}
      />
    );
  }

  if (activePage === 'BusinessCards') {
    return (
      <BusinessCards
        businessCards={businessCards}
        addBusinessCard={addBusinessCard}
        contacts={contacts}
        addContact={addContact}
        userId={userId}
      />
    );
  }

  if (activePage === 'Complaints') {
    return (
      <Complaints
        complaints={complaints}
        customers={customers}
        addComplaint={addComplaint}
        updateComplaint={updateComplaint}
        removeComplaint={removeComplaint}
        userId={userId}
      />
    );
  }

  if (activePage === 'MailAI') {
    return <MailAI customers={customers} products={products} userId={userId} />;
  }

  if (activePage === 'Analytics') {
    return (
      <AnalyticsPage
        customers={customers}
        products={products}
        contacts={contacts}
        suppliers={suppliers}
        complaints={complaints}
        setActivePage={setActivePage}
      />
    );
  }

  if (activePage === 'Calendar') {
    return (
      <CalendarPage
        customers={customers}
        samples={samples}
        quotes={quotes}
        complaints={complaints}
        onOpenKarte={openCustomerKarte}
      />
    );
  }

  if (activePage === 'Settings') {
    return (
      <SettingsPage
        user={user}
        syncState={syncState}
        syncError={syncError}
        reloadFromCloud={reloadFromCloud}
        signOut={signOut}
      />
    );
  }

  return (
    <Home
      customers={customers}
      samples={samples}
      quotes={quotes}
      complaints={complaints}
      setActivePage={setActivePage}
      syncState={syncState}
      syncError={syncError}
      reloadFromCloud={reloadFromCloud}
      onOpenKarte={openCustomerKarte}
    />
  );
}
