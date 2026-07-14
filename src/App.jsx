import { Component, Suspense, lazy, useEffect, useState } from 'react';
import AppLayout from './layouts/AppLayout.jsx';
import { useAuth } from './context/AuthContext.jsx';
import { useAdoptions } from './modules/products/hooks/useAdoptions.js';
import { useAttachments } from './shared/hooks/useAttachments.js';
import { useBusinessCards } from './modules/businessCards/hooks/useBusinessCards.js';
import { useComplaints } from './modules/claims/hooks/useComplaints.js';
import { useContacts } from './modules/contacts/hooks/useContacts.js';
import { useCustomers } from './modules/customers/hooks/useCustomers.js';
import { useProjects } from './modules/deals/hooks/useProjects.js';
import { useEvents } from './modules/calendar/hooks/useEvents.js';
import { useInventory } from './modules/inventory/hooks/useInventory.js';
import { useProducts } from './modules/products/hooks/useProducts.js';
import { useQuotes } from './modules/quotes/hooks/useQuotes.js';
import { useSamples } from './modules/samples/hooks/useSamples.js';
import { useSuppliers } from './modules/suppliers/hooks/useSuppliers.js';
import OnboardingTutorial from './shared/components/OnboardingTutorial.jsx';
import Login from './pages/Login.jsx';

const AnalyticsPage = lazy(() => import('./modules/dashboard/pages/AnalyticsPage.jsx'));
const BusinessCards = lazy(() => import('./modules/businessCards/pages/BusinessCards.jsx'));
const CalendarPage = lazy(() => import('./modules/calendar/pages/CalendarPage.jsx'));
const CompanyEnrich = lazy(() => import('./modules/customers/pages/CompanyEnrich.jsx'));
const Complaints = lazy(() => import('./modules/claims/pages/Complaints.jsx'));
const Contacts = lazy(() => import('./modules/contacts/pages/Contacts.jsx'));
const CustomerDetail = lazy(() => import('./modules/customers/pages/CustomerDetail.jsx'));
const CustomerKarte = lazy(() => import('./modules/customers/pages/CustomerKarte.jsx'));
const Customers = lazy(() => import('./modules/customers/pages/Customers.jsx'));
const Home = lazy(() => import('./pages/Home.jsx'));
const HelpPage = lazy(() => import('./modules/settings/pages/HelpPage.jsx'));
const ImportPage = lazy(() => import('./modules/customers/pages/ImportPage.jsx'));
const LeadSearch = lazy(() => import('./modules/customers/pages/LeadSearch.jsx'));
const MailAI = lazy(() => import('./pages/MailAI.jsx'));
const Pipeline = lazy(() => import('./pages/Pipeline.jsx'));
const ProductDetail = lazy(() => import('./modules/products/pages/ProductDetail.jsx'));
const Products = lazy(() => import('./modules/products/pages/Products.jsx'));
const SettingsPage = lazy(() => import('./modules/settings/pages/SettingsPage.jsx'));
const Suppliers = lazy(() => import('./modules/suppliers/pages/Suppliers.jsx'));

function isImportPath() {
  return window.location.pathname === '/import';
}

function getImportCompanyName() {
  const params = new URLSearchParams(window.location.search);
  return (params.get('companyName') || params.get('importCompany') || '').trim();
}

class PageErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <main className="page">
          <section className="empty-state">
            <h3>画面の表示に失敗しました</h3>
            <p>{this.state.error.message || '予期しないエラーが発生しました。'}</p>
            <button type="button" className="primary-button" onClick={this.props.onReset}>
              ホームへ戻る
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

function tutorialStorageKey(userId = '') {
  return `eigyo-techo-tutorial-seen:${userId || 'local'}`;
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
  const [globalCustomerSearch, setGlobalCustomerSearch] = useState('');
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tutorialStepIndex, setTutorialStepIndex] = useState(0);

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
    records: inventories,
    addRecord: addInventory,
    updateRecord: updateInventory,
    removeRecord: removeInventory,
  } = useInventory(userId);
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
    records: projects,
    addRecord: addProject,
    updateRecord: updateProject,
    removeRecord: removeProject,
  } = useProjects(userId);
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
    updateRecord: updateBusinessCard,
  } = useBusinessCards(userId);
  const {
    records: complaints,
    addRecord: addComplaint,
    updateRecord: updateComplaint,
    removeRecord: removeComplaint,
  } = useComplaints(userId);
  const {
    records: events,
    addRecord: addEvent,
    updateRecord: updateEvent,
    removeRecord: removeEvent,
  } = useEvents(userId);
  const {
    records: attachments,
    addRecord: addAttachment,
    updateRecord: updateAttachment,
  } = useAttachments(userId);

  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId);
  const selectedProduct = products.find((product) => product.id === selectedProductId);

  useEffect(() => {
    if (!userId) return;
    const hasSeenTutorial = localStorage.getItem(tutorialStorageKey(userId)) === 'true';
    setTutorialOpen(!hasSeenTutorial && !isImportPath());
    setTutorialStepIndex(0);
  }, [userId]);

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

  function handleGlobalSearch(query) {
    setGlobalCustomerSearch(query);
    setActivePage('Customers');
  }

  function closeTutorial() {
    localStorage.setItem(tutorialStorageKey(userId), 'true');
    setTutorialOpen(false);
  }

  function resetTutorial() {
    localStorage.removeItem(tutorialStorageKey(userId));
    setTutorialStepIndex(0);
    setTutorialOpen(true);
  }

  function navigateTutorialStep(page) {
    setActivePage(page);
    closeTutorial();
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
    <>
      <AppLayout
        activePage={activePage}
        user={user}
        onNavigate={navigate}
        onAddAction={handleAddAction}
        onGlobalSearch={handleGlobalSearch}
        onHelp={() => setActivePage('Help')}
        onSignOut={signOut}
        addMenuOpen={addMenuOpen}
        setAddMenuOpen={setAddMenuOpen}
        notice={extensionNotice}
      >
        <PageErrorBoundary resetKey={activePage} onReset={() => setActivePage('Home')}>
          <Suspense fallback={<PageLoading />}>
            <ActivePage
            activePage={activePage}
            importError={importError}
            setActivePage={setActivePage}
            addCustomer={addCustomer}
            isSaved={isSaved}
            customers={customers}
            initialSearchQuery={globalCustomerSearch}
            updateCustomer={updateCustomer}
            removeCustomer={removeCustomer}
            openCustomerDetail={openCustomerDetail}
            openCustomerKarte={openCustomerKarte}
            selectedCustomer={selectedCustomer}
            selectedCustomerId={selectedCustomerId}
            products={products}
            inventories={inventories}
            addInventory={addInventory}
            updateInventory={updateInventory}
            removeInventory={removeInventory}
            addProduct={addProduct}
            updateProduct={updateProduct}
            removeProduct={removeProduct}
            adoptions={adoptions}
            addAdoption={addAdoption}
            updateAdoption={updateAdoption}
            removeAdoption={removeAdoption}
            projects={projects}
            addProject={addProject}
            updateProject={updateProject}
            removeProject={removeProject}
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
            updateBusinessCard={updateBusinessCard}
            complaints={complaints}
            addComplaint={addComplaint}
            updateComplaint={updateComplaint}
            removeComplaint={removeComplaint}
            events={events}
            addEvent={addEvent}
            updateEvent={updateEvent}
            removeEvent={removeEvent}
            attachments={attachments}
            addAttachment={addAttachment}
            updateAttachment={updateAttachment}
            syncState={syncState}
            syncError={syncError}
            reloadFromCloud={reloadFromCloud}
            user={user}
            userId={userId}
            signOut={signOut}
            onResetTutorial={resetTutorial}
            />
          </Suspense>
        </PageErrorBoundary>
      </AppLayout>
      <OnboardingTutorial
        open={tutorialOpen}
        stepIndex={tutorialStepIndex}
        onNext={() => setTutorialStepIndex((index) => Math.min(index + 1, 5))}
        onBack={() => setTutorialStepIndex((index) => Math.max(index - 1, 0))}
        onSkip={closeTutorial}
        onClose={closeTutorial}
        onNavigateStep={navigateTutorialStep}
      />
    </>
  );
}

function ActivePage({
  activePage,
  importError,
  setActivePage,
  addCustomer,
  isSaved,
  customers,
  initialSearchQuery,
  updateCustomer,
  removeCustomer,
  openCustomerDetail,
  openCustomerKarte,
  selectedCustomer,
  selectedCustomerId,
  products,
  inventories,
  addInventory,
  updateInventory,
  removeInventory,
  addProduct,
  updateProduct,
  removeProduct,
  adoptions,
  addAdoption,
  updateAdoption,
  removeAdoption,
  projects = [],
  addProject,
  updateProject,
  removeProject,
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
  updateBusinessCard,
  complaints,
  addComplaint,
  updateComplaint,
  removeComplaint,
  events,
  addEvent,
  updateEvent,
  removeEvent,
  attachments,
  addAttachment,
  updateAttachment,
  syncState,
  syncError,
  reloadFromCloud,
  user,
  userId,
  signOut,
  onResetTutorial,
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
        events={events}
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
        addCustomer={addCustomer}
        customers={customers}
        initialSearchQuery={initialSearchQuery}
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
      <Suspense fallback={<KarteLoading />}>
        <CustomerKarte
          customerId={selectedCustomerId}
          customers={customers}
          contacts={contacts}
          businessCards={businessCards}
          products={products}
          inventories={inventories}
          adoptions={adoptions}
          samples={samples}
          quotes={quotes}
          suppliers={suppliers}
          projects={projects}
          complaints={complaints}
          events={events}
          attachments={attachments}
          updateCustomer={updateCustomer}
          addProject={addProject}
          updateProject={updateProject}
          removeProject={removeProject}
          addContact={addContact}
          addBusinessCard={addBusinessCard}
          addComplaint={addComplaint}
          addAttachment={addAttachment}
          addSample={addSample}
          updateSample={updateSample}
          addQuote={addQuote}
          updateQuote={updateQuote}
          addInventory={addInventory}
          updateInventory={updateInventory}
          removeInventory={removeInventory}
          addAdoption={addAdoption}
          updateAdoption={updateAdoption}
          setActivePage={setActivePage}
          user={user}
        />
      </Suspense>
    );
  }

  if (activePage === 'CustomerDetail') {
    return (
      <CustomerDetail
        customer={selectedCustomer}
        products={products}
        contacts={contacts}
        projects={projects}
        suppliers={suppliers}
        inventories={inventories}
        quotes={quotes}
        samples={samples}
        complaints={complaints}
        events={events}
        attachments={attachments}
        addProject={addProject}
        updateProject={updateProject}
        removeProject={removeProject}
        onOpenKarte={openCustomerKarte}
        updateCustomer={updateCustomer}
        setActivePage={setActivePage}
        user={user}
      />
    );
  }

  if (activePage === 'Pipeline') {
    return (
      <Pipeline
        customers={customers}
        suppliers={suppliers}
        contacts={contacts}
        products={products}
        inventories={inventories}
        quotes={quotes}
        samples={samples}
        complaints={complaints}
        events={events}
        attachments={attachments}
        projects={projects}
        addProject={addProject}
        updateProject={updateProject}
        removeProject={removeProject}
        updateCustomer={updateCustomer}
        setActivePage={setActivePage}
        onOpenKarte={openCustomerKarte}
      />
    );
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
        products={products}
        inventories={inventories}
        adoptions={adoptions}
        samples={samples}
        quotes={quotes}
        projects={projects}
        customers={customers}
        suppliers={suppliers}
        addProduct={addProduct}
        updateProduct={updateProduct}
        updateAdoption={updateAdoption}
        updateSample={updateSample}
        updateQuote={updateQuote}
        addInventory={addInventory}
        updateInventory={updateInventory}
        removeInventory={removeInventory}
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
        projects={projects}
        customers={customers}
        addSupplier={addSupplier}
        updateSupplier={updateSupplier}
        removeSupplier={removeSupplier}
        contacts={contacts}
        products={products}
        inventories={inventories}
        quotes={quotes}
        samples={samples}
        complaints={complaints}
        events={events}
        attachments={attachments}
        addProject={addProject}
        updateProject={updateProject}
        removeProject={removeProject}
        setActivePage={setActivePage}
        onOpenKarte={openCustomerKarte}
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
        events={events}
        quotes={quotes}
        samples={samples}
        inventories={inventories}
        setActivePage={setActivePage}
      />
    );
  }

  if (activePage === 'Calendar') {
    return (
      <CalendarPage
        customers={customers}
        contacts={contacts}
        events={events}
        samples={samples}
        projects={projects}
        quotes={quotes}
        complaints={complaints}
        addEvent={addEvent}
        updateEvent={updateEvent}
        removeEvent={removeEvent}
        updateCustomer={updateCustomer}
        user={user}
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
        userId={userId}
        backupDatasets={{
          customers,
          products,
          inventories,
          contacts,
          businessCards,
          suppliers,
          projects,
          complaints,
          samples,
          quotes,
          adoptions,
          attachments,
          events,
        }}
        restoreHandlers={{
          customers: { records: customers, add: addCustomer, update: updateCustomer },
          products: { records: products, add: addProduct, update: updateProduct },
          inventories: { records: inventories, add: addInventory, update: updateInventory },
          contacts: { records: contacts, add: addContact, update: updateContact },
          businessCards: { records: businessCards, add: addBusinessCard, update: updateBusinessCard },
          suppliers: { records: suppliers, add: addSupplier, update: updateSupplier },
          projects: { records: projects, add: addProject, update: updateProject },
          complaints: { records: complaints, add: addComplaint, update: updateComplaint },
          samples: { records: samples, add: addSample, update: updateSample },
          quotes: { records: quotes, add: addQuote, update: updateQuote },
          adoptions: { records: adoptions, add: addAdoption, update: updateAdoption },
          attachments: { records: attachments, add: addAttachment, update: updateAttachment },
          events: { records: events, add: addEvent, update: updateEvent },
        }}
        onResetTutorial={onResetTutorial}
      />
    );
  }

  if (activePage === 'Help') {
    return <HelpPage setActivePage={setActivePage} />;
  }

  return (
    <Home
      customers={customers}
      samples={samples}
      quotes={quotes}
      complaints={complaints}
      events={events}
      setActivePage={setActivePage}
      syncState={syncState}
      syncError={syncError}
      reloadFromCloud={reloadFromCloud}
      onOpenKarte={openCustomerKarte}
    />
  );
}

function KarteLoading() {
  return (
    <main className="page karte-page">
      <section className="empty-state">
        <h3>顧客カルテを読み込み中...</h3>
      </section>
    </main>
  );
}

function PageLoading() {
  return (
    <main className="page">
      <section className="empty-state">
        <h3>読み込み中...</h3>
      </section>
    </main>
  );
}
