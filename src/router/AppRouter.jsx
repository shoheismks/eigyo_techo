import { Suspense, lazy } from 'react';
import { useAppData } from '../context/AppDataContext.jsx';

const AnalyticsPage = lazy(() => import('../modules/dashboard/pages/AnalyticsPage.jsx'));
const BusinessCards = lazy(() => import('../modules/businessCards/pages/BusinessCards.jsx'));
const CalendarPage = lazy(() => import('../modules/calendar/pages/CalendarPage.jsx'));
const CompanyEnrich = lazy(() => import('../modules/customers/pages/CompanyEnrich.jsx'));
const Complaints = lazy(() => import('../modules/claims/pages/Complaints.jsx'));
const Contacts = lazy(() => import('../modules/contacts/pages/Contacts.jsx'));
const CustomerDetail = lazy(() => import('../modules/customers/pages/CustomerDetail.jsx'));
const CustomerKarte = lazy(() => import('../modules/customers/pages/CustomerKarte.jsx'));
const Customers = lazy(() => import('../modules/customers/pages/Customers.jsx'));
const Home = lazy(() => import('../pages/Home.jsx'));
const HelpPage = lazy(() => import('../modules/settings/pages/HelpPage.jsx'));
const ImportPage = lazy(() => import('../modules/customers/pages/ImportPage.jsx'));
const Invoices = lazy(() => import('../modules/invoices/pages/Invoices.jsx'));
const InventoryPage = lazy(() => import('../modules/inventory/pages/InventoryPage.jsx'));
const DeliveryNotes = lazy(() => import('../modules/deliveryNotes/pages/DeliveryNotes.jsx'));
const LeadSearch = lazy(() => import('../modules/customers/pages/LeadSearch.jsx'));
const MailAI = lazy(() => import('../pages/MailAI.jsx'));
const Pipeline = lazy(() => import('../pages/Pipeline.jsx'));
const Quotes = lazy(() => import('../modules/quotes/pages/Quotes.jsx'));
const ProductDetail = lazy(() => import('../modules/products/pages/ProductDetail.jsx'));
const Products = lazy(() => import('../modules/products/pages/Products.jsx'));
const CustomerProductPrices = lazy(() => import('../modules/prices/pages/CustomerProductPrices.jsx'));
const SalesOrders = lazy(() => import('../modules/salesOrders/pages/SalesOrders.jsx'));
const SettingsPage = lazy(() => import('../modules/settings/pages/SettingsPage.jsx'));
const Shipments = lazy(() => import('../modules/shipments/pages/Shipments.jsx'));
const Suppliers = lazy(() => import('../modules/suppliers/pages/Suppliers.jsx'));


export default function AppRouter({
  activePage,
  importError,
  initialSearchQuery,
  inventoryAction,
  onCreateDeliveryNoteFromShipment,
  onCreateInvoice,
  onCreateQuote,
  onCreateSalesOrder,
  onOpenCustomerDetail,
  onOpenCustomerKarte,
  onOpenInventoryPage,
  onOpenProductDetail,
  onResetTutorial,
  salesOrderDraft,
  selectedCustomerId,
  selectedProductId,
  setActivePage,
  setInventoryAction,
  setSalesOrderDraft,
  signOut,
  user,
  userId,
}) {
  const appData = useAppData();
  const {
  addCustomer,
  isSaved,
  customers,
  updateCustomer,
  removeCustomer,
  products,
  productSyncState,
  productSyncError,
  productLegacyLocalDataWarning,
  brands,
  brandSyncError,
  brandLegacyLocalDataWarning,
  productAssets,
  productAssetSyncError,
  productAssetLegacyLocalDataWarning,
  customerProductPrices,
  customerProductPriceHistory,
  inventories,
  inventoryLots,
  inventoryMovements,
  inventoryReservations,
  stocktakes,
  stocktakeLines,
  addInventory,
  updateInventory,
  removeInventory,
  addProduct,
  updateProduct,
  removeProduct,
  addProductAsset,
  updateProductAsset,
  removeProductAsset,
  addBrand,
  updateBrand,
  removeBrand,
  addCustomerProductPrice,
  updateCustomerProductPrice,
  removeCustomerProductPrice,
  deactivateCustomerProductPrice,
  addCustomerProductPriceHistory,
  customerProductPriceSyncState,
  customerProductPriceSyncError,
  customerProductPriceLegacyLocalDataWarning,
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
  quoteSyncState,
  quoteSyncError,
  quoteLegacyLocalDataWarning,
  invoices,
  salesOrders,
  salesOrderSyncState,
  salesOrderSyncError,
  salesOrderLegacyLocalDataWarning,
  shipments,
  shipmentSyncState,
  shipmentSyncError,
  shipmentLegacyLocalDataWarning,
  deliveryNotes,
  deliveryNoteSyncState,
  deliveryNoteSyncError,
  deliveryNoteLegacyLocalDataWarning,
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
  addSalesOrder,
  updateSalesOrder,
  removeSalesOrder,
  reserveLineFefo,
  reserveLineLot,
  releaseLineReservations,
  reallocateLineFefo,
  createShipmentFromOrder,
  updateShipmentStatus,
  shipShipment,
  cancelShipment,
  reloadShipments,
  reloadDeliveryNotes,
  addDeliveryNote,
  updateDeliveryNote,
  removeDeliveryNote,
  reloadInventory,
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
  eventSyncState,
  eventSyncError,
  eventLegacyLocalDataWarning,
  tasks,
  addTask,
  updateTask,
  removeTask,
  taskSyncState,
  taskSyncError,
  taskLegacyLocalDataWarning,
  attachments,
  addAttachment,
  updateAttachment,
  syncState,
  syncError,
  legacyLocalDataWarning,
  reloadFromCloud,
  } = appData;

  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId);
  const selectedProduct = products.find((product) => product.id === selectedProductId);
  const openCustomerDetail = onOpenCustomerDetail;
  const openCustomerKarte = onOpenCustomerKarte;
  const openInventoryPage = onOpenInventoryPage;
  const openProductDetail = onOpenProductDetail;
  const createDeliveryNoteFromShipment = onCreateDeliveryNoteFromShipment;

  if (activePage === 'Import') {
    return <ImportPage error={importError} onGoCustomers={() => setActivePage('Customers')} />;
  }

  if (activePage === 'Home') {
    return (
      <Home
        customers={customers}
        samples={samples}
        quotes={quotes}
        salesOrders={salesOrders}
        shipments={shipments}
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
        syncState={syncState}
        syncError={syncError}
        legacyLocalDataWarning={legacyLocalDataWarning}
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
          customerProductPrices={customerProductPrices}
          inventories={inventories}
          adoptions={adoptions}
          samples={samples}
          quotes={quotes}
          invoices={invoices}
          deliveryNotes={deliveryNotes}
          salesOrders={salesOrders}
          suppliers={suppliers}
          issuers={issuers}
          projects={projects}
          complaints={complaints}
          events={events}
          tasks={tasks}
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
          addTask={addTask}
          updateTask={updateTask}
          removeTask={removeTask}
          addAttachment={addAttachment}
          addSample={addSample}
          updateSample={updateSample}
          addQuote={addQuote}
          updateQuote={updateQuote}
          onCreateInvoice={onCreateInvoice}
          onCreateSalesOrder={onCreateSalesOrder}
          addInventory={addInventory}
          updateInventory={updateInventory}
          removeInventory={removeInventory}
          addAdoption={addAdoption}
          updateAdoption={updateAdoption}
          setActivePage={setActivePage}
          onOpenKarte={openCustomerKarte}
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
        customers={customers}
        products={products}
        contacts={contacts}
        projects={projects}
        suppliers={suppliers}
        issuers={issuers}
        inventories={inventories}
        quotes={quotes}
        invoices={invoices}
        salesOrders={salesOrders}
        shipments={shipments}
        samples={samples}
        complaints={complaints}
        events={events}
        tasks={tasks}
        attachments={attachments}
        addProject={addProject}
        updateProject={updateProject}
        removeProject={removeProject}
        onOpenKarte={openCustomerKarte}
        updateCustomer={updateCustomer}
        setActivePage={setActivePage}
        onCreateQuote={onCreateQuote}
        onCreateInvoice={onCreateInvoice}
          onCreateSalesOrder={onCreateSalesOrder}
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
        salesOrders={salesOrders}
        samples={samples}
        complaints={complaints}
        events={events}
        tasks={tasks}
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
        onCreateSalesOrder={onCreateSalesOrder}
      />
    );
  }

  if (activePage === 'SalesOrders') {
    return (
      <SalesOrders
        salesOrders={salesOrders}
        shipments={shipments}
        addSalesOrder={addSalesOrder}
        updateSalesOrder={updateSalesOrder}
        removeSalesOrder={removeSalesOrder}
        syncState={salesOrderSyncState}
        syncError={salesOrderSyncError}
        legacyLocalDataWarning={salesOrderLegacyLocalDataWarning}
        customers={customers}
        contacts={contacts}
        projects={projects}
        quotes={quotes}
        issuers={issuers}
        products={products}
        customerProductPrices={customerProductPrices}
        inventoryLots={inventoryLots}
        inventoryReservations={inventoryReservations}
        reserveLineFefo={reserveLineFefo}
        reserveLineLot={reserveLineLot}
        releaseLineReservations={releaseLineReservations}
        reallocateLineFefo={reallocateLineFefo}
        createShipmentFromOrder={createShipmentFromOrder}
        updateShipmentStatus={updateShipmentStatus}
        shipShipment={shipShipment}
        cancelShipment={cancelShipment}
        reloadShipments={reloadShipments}
        reloadInventory={reloadInventory}
        initialDraft={salesOrderDraft}
        onDraftHandled={() => setSalesOrderDraft(null)}
        onOpenKarte={openCustomerKarte}
        onOpenProject={() => setActivePage('Pipeline')}
        user={user}
      />
    );
  }

  if (activePage === 'Shipments') {
    return (
      <Shipments
        shipments={shipments}
        salesOrders={salesOrders}
        customers={customers}
        products={products}
        inventoryLots={inventoryLots}
        deliveryNotes={deliveryNotes}
        updateShipmentStatus={updateShipmentStatus}
        syncState={shipmentSyncState}
        syncError={shipmentSyncError}
        legacyLocalDataWarning={shipmentLegacyLocalDataWarning}
        onOpenSalesOrder={() => setActivePage('SalesOrders')}
        onOpenDeliveryNotes={() => setActivePage('DeliveryNotes')}
        onCreateDeliveryNote={createDeliveryNoteFromShipment}
      />
    );
  }

  if (activePage === 'DeliveryNotes') {
    return (
      <DeliveryNotes
        deliveryNotes={deliveryNotes}
        shipments={shipments}
        salesOrders={salesOrders}
        customers={customers}
        products={products}
        issuers={issuers}
        createDeliveryNoteFromShipment={createDeliveryNoteFromShipment}
        updateDeliveryNote={updateDeliveryNote}
        removeDeliveryNote={removeDeliveryNote}
        syncState={deliveryNoteSyncState}
        syncError={deliveryNoteSyncError}
        legacyLocalDataWarning={deliveryNoteLegacyLocalDataWarning}
        user={user}
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
        brands={brands}
        customerProductPrices={customerProductPrices}
        inventories={inventories}
        productAssets={productAssets}
        removeProduct={removeProduct}
        onOpenProductDetail={openProductDetail}
        onOpenInventory={openInventoryPage}
        syncState={productSyncState}
        syncError={productSyncError || brandSyncError || productAssetSyncError}
        legacyLocalDataWarning={[
          productLegacyLocalDataWarning,
          brandLegacyLocalDataWarning,
          productAssetLegacyLocalDataWarning,
        ].filter(Boolean).join(' / ')}
      />
    );
  }

  if (activePage === 'Quotes') {
    return (
      <Quotes
        quotes={quotes}
        customers={customers}
        contacts={contacts}
        projects={projects}
        syncState={quoteSyncState}
        syncError={quoteSyncError}
        legacyLocalDataWarning={quoteLegacyLocalDataWarning}
        onCreateQuote={onCreateQuote}
      />
    );
  }

  if (activePage === 'CustomerProductPrices') {
    return (
      <CustomerProductPrices
        prices={customerProductPrices}
        priceHistory={customerProductPriceHistory}
        customers={customers}
        products={products}
        brands={brands}
        addPrice={addCustomerProductPrice}
        updatePrice={updateCustomerProductPrice}
        removePrice={removeCustomerProductPrice}
        deactivatePrice={deactivateCustomerProductPrice}
        syncState={customerProductPriceSyncState}
        syncError={customerProductPriceSyncError}
        legacyLocalDataWarning={customerProductPriceLegacyLocalDataWarning}
        userId={userId}
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
        brands={brands}
        inventories={inventories}
        adoptions={adoptions}
        samples={samples}
        quotes={quotes}
        invoices={invoices}
        projects={projects}
        productAssets={productAssets}
        customers={customers}
        suppliers={suppliers}
        addProduct={addProduct}
        updateProduct={updateProduct}
        addBrand={addBrand}
        updateAdoption={updateAdoption}
        updateSample={updateSample}
        updateQuote={updateQuote}
        addProductAsset={addProductAsset}
        updateProductAsset={updateProductAsset}
        removeProductAsset={removeProductAsset}
        syncError={productSyncError || brandSyncError || productAssetSyncError}
        legacyLocalDataWarning={[
          productLegacyLocalDataWarning,
          brandLegacyLocalDataWarning,
          productAssetLegacyLocalDataWarning,
        ].filter(Boolean).join(' / ')}
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
        tasks={tasks}
        attachments={attachments}
        addProject={addProject}
        updateProject={updateProject}
        removeProject={removeProject}
        setActivePage={setActivePage}
        onOpenKarte={openCustomerKarte}
        onCreateQuote={onCreateQuote}
        onCreateInvoice={onCreateInvoice}
        onCreateSalesOrder={onCreateSalesOrder}
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
        salesOrders={salesOrders}
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
        tasks={tasks}
        samples={samples}
        projects={projects}
        quotes={quotes}
        complaints={complaints}
        addEvent={addEvent}
        updateEvent={updateEvent}
        removeEvent={removeEvent}
        addTask={addTask}
        updateTask={updateTask}
        removeTask={removeTask}
        syncState={eventSyncState === 'error' || taskSyncState === 'error' ? 'error' : eventSyncState}
        syncError={[eventSyncError, taskSyncError].filter(Boolean).join(' / ')}
        legacyLocalDataWarning={[
          eventLegacyLocalDataWarning,
          taskLegacyLocalDataWarning,
        ].filter(Boolean).join(' / ')}
        updateCustomer={updateCustomer}
        user={user}
        onOpenKarte={openCustomerKarte}
        onOpenProject={() => setActivePage('Pipeline')}
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
          productAssets,
          brands,
          customerProductPrices,
          customerProductPriceHistory,
          inventories,
          inventoryLots,
          inventoryMovements,
          inventoryReservations,
          stocktakes,
          stocktakeLines,
          contacts,
          businessCards,
          suppliers,
          projects,
          complaints,
          samples,
          quotes,
          salesOrders,
          shipments,
          deliveryNotes,
          invoices,
          issuers,
          adoptions,
          attachments,
          events,
          tasks,
        }}
        restoreHandlers={{
          customers: { records: customers, add: addCustomer, update: updateCustomer },
          products: { records: products, add: addProduct, update: updateProduct },
          productAssets: { records: productAssets, add: addProductAsset, update: updateProductAsset },
          brands: { records: brands, add: addBrand, update: updateBrand },
          customerProductPrices: { records: customerProductPrices, add: addCustomerProductPrice, update: updateCustomerProductPrice },
          customerProductPriceHistory: { records: customerProductPriceHistory, add: addCustomerProductPriceHistory, update: () => {} },
          inventories: { records: inventories, add: addInventory, update: updateInventory },
          contacts: { records: contacts, add: addContact, update: updateContact },
          businessCards: { records: businessCards, add: addBusinessCard, update: updateBusinessCard },
          suppliers: { records: suppliers, add: addSupplier, update: updateSupplier },
          projects: { records: projects, add: addProject, update: updateProject },
          complaints: { records: complaints, add: addComplaint, update: updateComplaint },
          samples: { records: samples, add: addSample, update: updateSample },
          quotes: { records: quotes, add: addQuote, update: updateQuote },
          salesOrders: { records: salesOrders, add: addSalesOrder, update: updateSalesOrder },
          deliveryNotes: { records: deliveryNotes, add: addDeliveryNote, update: updateDeliveryNote },
          invoices: { records: invoices, add: addInvoice, update: updateInvoice },
          issuers: { records: issuers, add: addIssuer, update: updateIssuer },
          adoptions: { records: adoptions, add: addAdoption, update: updateAdoption },
          attachments: { records: attachments, add: addAttachment, update: updateAttachment },
          events: { records: events, add: addEvent, update: updateEvent },
          tasks: { records: tasks, add: addTask, update: updateTask },
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
      salesOrders={salesOrders}
      shipments={shipments}
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
