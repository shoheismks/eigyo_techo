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
import { useInvoices } from './modules/invoices/hooks/useInvoices.js';
import { useProducts } from './modules/products/hooks/useProducts.js';
import { DEFAULT_QUOTE_TAX_RATE, useQuotes } from './modules/quotes/hooks/useQuotes.js';
import { useSamples } from './modules/samples/hooks/useSamples.js';
import { useIssuers } from './modules/settings/hooks/useIssuers.js';
import { useSuppliers } from './modules/suppliers/hooks/useSuppliers.js';
import QuoteFormModal from './modules/quotes/components/QuoteFormModal.jsx';
import { buildInvoiceDraftFromQuote } from './modules/invoices/services/invoicePdfService.js';
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
const Invoices = lazy(() => import('./modules/invoices/pages/Invoices.jsx'));
const InventoryPage = lazy(() => import('./modules/inventory/pages/InventoryPage.jsx'));
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
  const [quoteDraft, setQuoteDraft] = useState(null);
  const [invoiceDraft, setInvoiceDraft] = useState(null);
  const [inventoryAction, setInventoryAction] = useState(null);

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
    records: invoices,
    addRecord: addInvoice,
    updateRecord: updateInvoice,
    removeRecord: removeInvoice,
  } = useInvoices(userId);
  const {
    records: issuers,
    addRecord: addIssuer,
    updateRecord: updateIssuer,
    removeRecord: removeIssuer,
  } = useIssuers(userId);
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

  function openInventoryPage(initial = {}) {
    setInventoryAction(initial || null);
    setActivePage('Inventory');
  }

  function buildProductQuoteLine(productId, inventoryId = '', proposal = {}) {
    const product = products.find((item) => item.id === productId);
    const inventory = inventories.find((item) => item.id === inventoryId);
    if (!product) return null;
    return {
      id: crypto.randomUUID(),
      productId: product.id,
      inventoryId: inventory?.id || '',
      productCode: product.productCode || '',
      productName: [product.productCode, product.name].filter(Boolean).join(' / ') || product.name || '',
      description: [product.productCode, product.name].filter(Boolean).join(' / ') || product.name || '',
      category: product.category || '',
      manufacturerName: product.manufacturerName || '',
      origin: product.origin || '',
      packageStyle: product.packageStyle || '',
      temperatureZone: product.temperatureZone || '',
      expirationText: inventory?.expiryDate || product.shelfLife || '',
      inventoryCode: inventory?.inventoryCode || inventory?.inventory_code || '',
      inventoryOwner: inventory?.owner || '',
      inventoryStockType: inventory?.stockType || '',
      inventoryLot: inventory?.lot || '',
      inventoryExpiryDate: inventory?.expiryDate || '',
      quantity: proposal.monthlyExpectedQuantity || proposal.quantity || '',
      unit: proposal.unit || product.sellingPriceUnit || product.costUnit || inventory?.unit || 'kg',
      unitPrice: proposal.expectedSellingPrice || product.desiredSellingPrice || '',
      costPrice: inventory?.cost || inventory?.costPrice || proposal.expectedCost || product.costPrice || '',
      taxRate: DEFAULT_QUOTE_TAX_RATE,
      snapshotCreatedAt: new Date().toISOString(),
      sourceProductUpdatedAt: product.updatedAt || '',
      sourceInventoryUpdatedAt: inventory?.updatedAt || '',
    };
  }

  function openQuoteForm(initial = {}) {
    const initialCustomer = customers.find((customer) => customer.id === initial.customerId);
    const initialProject = projects.find((project) => project.id === initial.projectId);
    const defaultIssuer =
      issuers.find((issuer) => issuer.id === initial.issuerId) ||
      issuers.find((issuer) => issuer.id === initialProject?.defaultIssuerId) ||
      issuers.find((issuer) => issuer.id === initialCustomer?.defaultIssuerId) ||
      issuers.find((issuer) => issuer.isDefault && issuer.isActive !== false) ||
      issuers.find((issuer) => issuer.isActive !== false);
    const proposalLines = (initial.productProposals ?? [])
      .map((proposal) => buildProductQuoteLine(proposal.productId, proposal.inventoryId, proposal))
      .filter(Boolean);
    const inventoryLines = (initial.inventoryIds ?? [])
      .map((inventoryId) => {
        const inventory = inventories.find((item) => item.id === inventoryId);
        return inventory ? buildProductQuoteLine(inventory.productId, inventory.id) : null;
      })
      .filter(Boolean);
    const productLines = (initial.productIds ?? [])
      .map((productId) => buildProductQuoteLine(productId))
      .filter(Boolean);
    const quoteLines = initial.quoteLines?.length
      ? initial.quoteLines
      : initial.inventoryId
        ? [buildProductQuoteLine(initial.productId, initial.inventoryId)].filter(Boolean)
        : initial.productId
          ? [buildProductQuoteLine(initial.productId)].filter(Boolean)
          : [...proposalLines, ...inventoryLines, ...productLines];
    const uniqueQuoteLines = quoteLines.filter((line, index, lines) => {
      const key = `${line.productId || ''}:${line.inventoryId || ''}`;
      return lines.findIndex((item) => `${item.productId || ''}:${item.inventoryId || ''}` === key) === index;
    });
    setQuoteDraft({
      id: crypto.randomUUID(),
      ...initial,
      issuerId: initial.issuerId || defaultIssuer?.id || '',
      pdfTemplate: initial.pdfTemplate || defaultIssuer?.defaultPdfTemplate || 'standard',
      defaultTaxRate: initial.defaultTaxRate || defaultIssuer?.defaultTaxRate || DEFAULT_QUOTE_TAX_RATE,
      taxRate: initial.taxRate || defaultIssuer?.defaultTaxRate || DEFAULT_QUOTE_TAX_RATE,
      paymentTerms: initial.paymentTerms || defaultIssuer?.defaultPaymentTerms || '',
      deliveryTerms: initial.deliveryTerms || defaultIssuer?.defaultDeliveryTerms || '',
      remarks: initial.remarks || defaultIssuer?.defaultRemarks || '',
      quoteLines: uniqueQuoteLines,
      productIds: [...new Set([
        ...(initial.productId ? [initial.productId] : []),
        ...(initial.productIds ?? []),
        ...uniqueQuoteLines.map((line) => line.productId).filter(Boolean),
      ])],
      inventoryIds: [...new Set([
        ...(initial.inventoryId ? [initial.inventoryId] : []),
        ...(initial.inventoryIds ?? []),
        ...uniqueQuoteLines.map((line) => line.inventoryId).filter(Boolean),
      ])],
      contactIds: initial.contactIds ?? [],
    });
  }

  function handleQuoteSaved(quote) {
    if (quote.customerId) {
      setSelectedCustomerId(quote.customerId);
      setActivePage('CustomerKarte');
    }
  }

  function openInvoiceForm(initial = {}) {
    const safeInitial = initial || {};
    const sourceQuote = safeInitial.quoteId
      ? quotes.find((quote) => quote.id === safeInitial.quoteId)
      : null;

    if (sourceQuote) {
      const customer = customers.find((item) => item.id === sourceQuote.customerId);
      const contact = contacts.find((item) => item.id === sourceQuote.contactIds?.[0] || item.id === safeInitial.contactId);
      const project = projects.find((item) => item.id === sourceQuote.projectId || item.id === safeInitial.projectId);
      const issuer = issuers.find((item) => item.id === sourceQuote.issuerId);
      setInvoiceDraft(buildInvoiceDraftFromQuote({
        quote: sourceQuote,
        customer,
        contact,
        project,
        issuer,
        invoices,
        user,
      }));
      setActivePage('Invoices');
      return;
    }

    setInvoiceDraft(safeInitial);
    setActivePage('Invoices');
  }

  function handleAddAction(actionKey) {
    const nextPageByAction = {
      company: 'LeadSearch',
      'business-card': 'BusinessCards',
      deal: 'Pipeline',
      complaint: 'Complaints',
      supplier: 'Suppliers',
      quote: null,
      invoice: null,
      inventory: null,
    };

    if (actionKey === 'quote') {
      openQuoteForm({});
      return;
    }

    if (actionKey === 'invoice') {
      openInvoiceForm({});
      return;
    }

    if (actionKey === 'inventory') {
      openInventoryPage({ tab: 'inbound' });
      return;
    }

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
            onCreateQuote={openQuoteForm}
            onCreateInvoice={openInvoiceForm}
            inventoryAction={inventoryAction}
            setInventoryAction={setInventoryAction}
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
            invoices={invoices}
            issuers={issuers}
            addIssuer={addIssuer}
            updateIssuer={updateIssuer}
            removeIssuer={removeIssuer}
            addQuote={addQuote}
            updateQuote={updateQuote}
            removeQuote={removeQuote}
            addInvoice={addInvoice}
            updateInvoice={updateInvoice}
            removeInvoice={removeInvoice}
            openProductDetail={openProductDetail}
            openInventoryPage={openInventoryPage}
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
      <QuoteFormModal
        open={Boolean(quoteDraft)}
        draft={quoteDraft}
        customers={customers}
        contacts={contacts}
        products={products}
        inventories={inventories}
        suppliers={suppliers}
        issuers={issuers}
        quotes={quotes}
        addQuote={addQuote}
        updateQuote={updateQuote}
        user={user}
        onClose={() => setQuoteDraft(null)}
        onSaved={handleQuoteSaved}
      />
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
  onCreateQuote,
  onCreateInvoice,
  inventoryAction,
  setInventoryAction,
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
  invoices,
  issuers,
  addIssuer,
  updateIssuer,
  removeIssuer,
  addQuote,
  updateQuote,
  removeQuote,
  addInvoice,
  updateInvoice,
  removeInvoice,
  openProductDetail,
  openInventoryPage,
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
        invoices={invoices}
        inventories={inventories}
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
          invoices={invoices}
          suppliers={suppliers}
          issuers={issuers}
          projects={projects}
          complaints={complaints}
          events={events}
          attachments={attachments}
          updateCustomer={updateCustomer}
          addProject={addProject}
          updateProject={updateProject}
          removeProject={removeProject}
          addContact={addContact}
          updateContact={updateContact}
          addBusinessCard={addBusinessCard}
          updateBusinessCard={updateBusinessCard}
          addComplaint={addComplaint}
          updateComplaint={updateComplaint}
          addAttachment={addAttachment}
          addSample={addSample}
          updateSample={updateSample}
          addQuote={addQuote}
          updateQuote={updateQuote}
          onCreateInvoice={onCreateInvoice}
          addInventory={addInventory}
          updateInventory={updateInventory}
          removeInventory={removeInventory}
          addAdoption={addAdoption}
          updateAdoption={updateAdoption}
          setActivePage={setActivePage}
          onCreateQuote={onCreateQuote}
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
        issuers={issuers}
        inventories={inventories}
        quotes={quotes}
        invoices={invoices}
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
        onCreateQuote={onCreateQuote}
        onCreateInvoice={onCreateInvoice}
        user={user}
      />
    );
  }

  if (activePage === 'Pipeline') {
    return (
      <Pipeline
        customers={customers}
        suppliers={suppliers}
        issuers={issuers}
        contacts={contacts}
        products={products}
        inventories={inventories}
        quotes={quotes}
        invoices={invoices}
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
        onCreateQuote={onCreateQuote}
        onCreateInvoice={onCreateInvoice}
      />
    );
  }

  if (activePage === 'Invoices') {
    return (
      <Invoices
        invoices={invoices}
        addInvoice={addInvoice}
        updateInvoice={updateInvoice}
        removeInvoice={removeInvoice}
        customers={customers}
        contacts={contacts}
        projects={projects}
        quotes={quotes}
        issuers={issuers}
        initialDraft={invoiceDraft}
        onDraftHandled={() => setInvoiceDraft(null)}
        user={user}
      />
    );
  }

  if (activePage === 'Products') {
    return (
      <Products
        products={products}
        inventories={inventories}
        removeProduct={removeProduct}
        onOpenProductDetail={openProductDetail}
        onOpenInventory={openInventoryPage}
      />
    );
  }

  if (activePage === 'Inventory') {
    return (
      <InventoryPage
        inventories={inventories}
        products={products}
        suppliers={suppliers}
        projects={projects}
        quotes={quotes}
        invoices={invoices}
        addInventory={addInventory}
        updateInventory={updateInventory}
        removeInventory={removeInventory}
        initialAction={inventoryAction}
        onInitialHandled={() => setInventoryAction(null)}
        onOpenProductDetail={openProductDetail}
        onCreateQuote={onCreateQuote}
        user={user}
        userId={userId}
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
        invoices={invoices}
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
        onCreateQuote={onCreateQuote}
        onOpenInventory={openInventoryPage}
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
        issuers={issuers}
        addSupplier={addSupplier}
        updateSupplier={updateSupplier}
        removeSupplier={removeSupplier}
        contacts={contacts}
        products={products}
        inventories={inventories}
        quotes={quotes}
        invoices={invoices}
        samples={samples}
        complaints={complaints}
        events={events}
        attachments={attachments}
        addProject={addProject}
        updateProject={updateProject}
        removeProject={removeProject}
        setActivePage={setActivePage}
        onOpenKarte={openCustomerKarte}
        onCreateQuote={onCreateQuote}
        onCreateInvoice={onCreateInvoice}
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
        issuers={issuers}
        addIssuer={addIssuer}
        updateIssuer={updateIssuer}
        removeIssuer={removeIssuer}
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
          invoices,
          issuers,
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
          invoices: { records: invoices, add: addInvoice, update: updateInvoice },
          issuers: { records: issuers, add: addIssuer, update: updateIssuer },
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
