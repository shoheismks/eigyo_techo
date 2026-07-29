import { Component, Suspense, useEffect, useMemo, useState } from 'react';
import AppLayout from './layouts/AppLayout.jsx';
import AppRouter from './router/AppRouter.jsx';
import { AppDataProvider, useAppData } from './context/AppDataContext.jsx';
import { useAuth } from './context/AuthContext.jsx';
import { applyResolvedPriceToLine, resolveCustomerProductPrice } from './modules/prices/services/customerProductPriceService.js';
import { DEFAULT_QUOTE_TAX_RATE } from './modules/quotes/hooks/useQuotes.js';
import { buildSalesOrderDraft } from './modules/salesOrders/hooks/useSalesOrders.js';
import QuoteFormModal from './modules/quotes/components/QuoteFormModal.jsx';
import { buildInvoiceDraftFromQuote } from './modules/invoices/services/invoicePdfService.js';
import OnboardingTutorial from './shared/components/OnboardingTutorial.jsx';
import { createThemeStyle, DEFAULT_THEME_COLOR } from './shared/utils/themeColor.js';
import Login from './pages/Login.jsx';

const ISSUER_THEME_STORAGE_KEY = 'eigyo-techo-selected-issuer-id';

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
  const { userId } = useAuth();

  return (
    <AppDataProvider userId={userId}>
      <AuthenticatedShell />
    </AppDataProvider>
  );
}

function AuthenticatedShell() {
  const { signOut, user, userId } = useAuth();
  const appData = useAppData();
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
  const [salesOrderDraft, setSalesOrderDraft] = useState(null);
  const [inventoryAction, setInventoryAction] = useState(null);
  const [selectedIssuerId, setSelectedIssuerId] = useState(() => {
    if (typeof window === 'undefined') return '';
    return window.localStorage.getItem(ISSUER_THEME_STORAGE_KEY) || '';
  });

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
    products,
    addProduct,
    updateProduct,
    removeProduct,
    productAssets,
    addProductAsset,
    updateProductAsset,
    removeProductAsset,
    brands,
    addBrand,
    updateBrand,
    removeBrand,
    customerProductPrices,
    customerProductPriceHistory,
    addCustomerProductPrice,
    updateCustomerProductPrice,
    removeCustomerProductPrice,
    deactivateCustomerProductPrice,
    addCustomerProductPriceHistory,
    inventories,
    addInventory,
    updateInventory,
    removeInventory,
    reloadInventory,
    inventoryLots,
    inventoryMovements,
    inventoryReservations,
    stocktakes,
    stocktakeLines,
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
    invoices,
    addInvoice,
    updateInvoice,
    removeInvoice,
    salesOrders,
    addSalesOrder,
    updateSalesOrder,
    removeSalesOrder,
    reserveLineFefo,
    reserveLineLot,
    releaseLineReservations,
    reallocateLineFefo,
    shipments,
    createShipmentFromOrder,
    updateShipmentStatus,
    shipShipment,
    cancelShipment,
    reloadShipments,
    deliveryNotes,
    addDeliveryNote,
    updateDeliveryNote,
    removeDeliveryNote,
    reloadDeliveryNotes,
    issuers,
    addIssuer,
    updateIssuer,
    removeIssuer,
    projects,
    addProject,
    updateProject,
    removeProject,
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
  } = appData;

  const activeIssuers = useMemo(
    () => issuers.filter((issuer) => issuer.isActive !== false),
    [issuers],
  );
  const currentThemeIssuer = useMemo(() => {
    if (activeIssuers.length === 0) return null;
    return (
      activeIssuers.find((issuer) => issuer.id === selectedIssuerId) ||
      activeIssuers.find((issuer) => issuer.isDefault) ||
      activeIssuers[0]
    );
  }, [activeIssuers, selectedIssuerId]);
  const themeStyle = useMemo(
    () => createThemeStyle(currentThemeIssuer?.themeColor || DEFAULT_THEME_COLOR),
    [currentThemeIssuer?.themeColor],
  );

  useEffect(() => {
    if (activeIssuers.length === 0) {
      if (selectedIssuerId) {
        setSelectedIssuerId('');
      }
      return;
    }

    if (activeIssuers.some((issuer) => issuer.id === selectedIssuerId)) {
      return;
    }

    const fallbackIssuer = activeIssuers.find((issuer) => issuer.isDefault) || activeIssuers[0];
    setSelectedIssuerId(fallbackIssuer.id);
  }, [activeIssuers, selectedIssuerId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (selectedIssuerId) {
      window.localStorage.setItem(ISSUER_THEME_STORAGE_KEY, selectedIssuerId);
    } else {
      window.localStorage.removeItem(ISSUER_THEME_STORAGE_KEY);
    }
  }, [selectedIssuerId]);

  function handleIssuerThemeChange(issuerId) {
    setSelectedIssuerId(issuerId);
  }

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
    const baseLine = {
      id: crypto.randomUUID(),
      productId: product.id,
      inventoryId: inventory?.id || '',
      productCode: product.productCode || '',
      productName: [product.productCode, product.name].filter(Boolean).join(' / ') || product.name || '',
      description: [product.productCode, product.name].filter(Boolean).join(' / ') || product.name || '',
      brandId: product.brandId || '',
      brandName: product.brandName || '',
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
    const resolved = resolveCustomerProductPrice({
      customerId: proposal.customerId || quoteDraft?.customerId || '',
      productId: product.id,
      quantity: baseLine.quantity,
      priceUnit: baseLine.unit,
      customers,
      products,
      prices: customerProductPrices,
    });
    return applyResolvedPriceToLine(baseLine, resolved);
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
      .map((proposal) => buildProductQuoteLine(proposal.productId, proposal.inventoryId, { ...proposal, customerId: initial.customerId }))
      .filter(Boolean);
    const inventoryLines = (initial.inventoryIds ?? [])
      .map((inventoryId) => {
        const inventory = inventories.find((item) => item.id === inventoryId);
        return inventory ? buildProductQuoteLine(inventory.productId, inventory.id, { customerId: initial.customerId }) : null;
      })
      .filter(Boolean);
    const productLines = (initial.productIds ?? [])
      .map((productId) => buildProductQuoteLine(productId, '', { customerId: initial.customerId }))
      .filter(Boolean);
    const quoteLines = initial.quoteLines?.length
      ? initial.quoteLines
      : initial.inventoryId
        ? [buildProductQuoteLine(initial.productId, initial.inventoryId, { customerId: initial.customerId })].filter(Boolean)
        : initial.productId
          ? [buildProductQuoteLine(initial.productId, '', { customerId: initial.customerId })].filter(Boolean)
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

  function openSalesOrderForm(initial = {}) {
    const safeInitial = initial || {};
    const sourceQuote = safeInitial.quoteId || safeInitial.confirmationQuoteId
      ? quotes.find((quote) => quote.id === (safeInitial.confirmationQuoteId || safeInitial.quoteId))
      : null;

    if (sourceQuote) {
      const customer = customers.find((item) => item.id === sourceQuote.customerId || item.id === safeInitial.customerId);
      const contact = contacts.find((item) => item.id === sourceQuote.contactIds?.[0] || item.id === safeInitial.contactId);
      const project = projects.find((item) => item.id === sourceQuote.projectId || item.id === safeInitial.projectId);
      const issuer = issuers.find((item) => item.id === sourceQuote.issuerId || item.id === safeInitial.issuerId);
      setSalesOrderDraft(buildSalesOrderDraft({
        sourceType: safeInitial.sourceType || (safeInitial.confirmationQuoteId ? 'confirmation' : 'quote'),
        quote: sourceQuote,
        customer,
        contact,
        project,
        issuer,
        orders: salesOrders,
        user,
      }));
      setActivePage('SalesOrders');
      return;
    }

    setSalesOrderDraft(safeInitial);
    setActivePage('SalesOrders');
  }

  async function handleCreateDeliveryNoteFromShipment(input) {
    const shipmentId = typeof input === 'string' ? input : input?.shipmentId;
    const priceVisible = typeof input === 'object' ? Boolean(input?.priceVisible) : false;
    const issueDate = typeof input === 'object' ? input?.issueDate || '' : '';
    if (!shipmentId) {
      setActivePage('DeliveryNotes');
      return null;
    }
    const result = await createDeliveryNoteFromShipment({ shipmentId, priceVisible, issueDate });
    await reloadDeliveryNotes();
    setActivePage('DeliveryNotes');
    return result;
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
      salesOrder: null,
      deliveryNote: 'DeliveryNotes',
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

    if (actionKey === 'salesOrder') {
      openSalesOrderForm({});
      return;
    }

    if (actionKey === 'deliveryNote') {
      setActivePage('DeliveryNotes');
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
        issuers={activeIssuers}
        selectedIssuerId={currentThemeIssuer?.id || ''}
        currentIssuer={currentThemeIssuer}
        onIssuerChange={handleIssuerThemeChange}
        themeStyle={themeStyle}
      >
        <PageErrorBoundary resetKey={activePage} onReset={() => setActivePage('Home')}>
          <Suspense fallback={<PageLoading />}>
            <AppRouter
              activePage={activePage}
              importError={importError}
              initialSearchQuery={globalCustomerSearch}
              inventoryAction={inventoryAction}
              onCreateDeliveryNoteFromShipment={handleCreateDeliveryNoteFromShipment}
              onCreateInvoice={openInvoiceForm}
              onCreateQuote={openQuoteForm}
              onCreateSalesOrder={openSalesOrderForm}
              onOpenCustomerDetail={openCustomerDetail}
              onOpenCustomerKarte={openCustomerKarte}
              onOpenInventoryPage={openInventoryPage}
              onOpenProductDetail={openProductDetail}
              onResetTutorial={resetTutorial}
              salesOrderDraft={salesOrderDraft}
              selectedCustomerId={selectedCustomerId}
              selectedProductId={selectedProductId}
              setActivePage={setActivePage}
              setInventoryAction={setInventoryAction}
              setSalesOrderDraft={setSalesOrderDraft}
              signOut={signOut}
              user={user}
              userId={userId}
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
        customerProductPrices={customerProductPrices}
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
function PageLoading() {
  return (
    <main className="page">
      <section className="empty-state">
        <h3>読み込み中...</h3>
      </section>
    </main>
  );
}
