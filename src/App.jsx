import { useEffect, useMemo, useState } from 'react';
import AppLayout from './layouts/AppLayout.jsx';
import { useAuth } from './context/AuthContext.jsx';
import { useAdoptions } from './hooks/useAdoptions.js';
import { useAttachments } from './shared/hooks/useAttachments.js';
import { useBusinessCards } from './hooks/useBusinessCards.js';
import { useComplaints } from './hooks/useComplaints.js';
import { useContacts } from './modules/contacts/hooks/useContacts.js';
import { useCustomers } from './hooks/useCustomers.js';
import { useProducts } from './hooks/useProducts.js';
import { useQuotes } from './hooks/useQuotes.js';
import { useSamples } from './hooks/useSamples.js';
import { useSuppliers } from './hooks/useSuppliers.js';
import BusinessCards from './pages/BusinessCards.jsx';
import CompanyEnrich from './pages/CompanyEnrich.jsx';
import Complaints from './pages/Complaints.jsx';
import Contacts from './modules/contacts/pages/Contacts.jsx';
import CustomerDetail from './pages/CustomerDetail.jsx';
import CustomerKarte from './pages/CustomerKarte.jsx';
import Customers from './pages/Customers.jsx';
import Home from './pages/Home.jsx';
import LeadSearch from './pages/LeadSearch.jsx';
import Login from './pages/Login.jsx';
import MailAI from './pages/MailAI.jsx';
import Pipeline from './pages/Pipeline.jsx';
import ProductDetail from './pages/ProductDetail.jsx';
import Products from './pages/Products.jsx';
import Suppliers from './pages/Suppliers.jsx';
import { PIPELINE_STATUSES } from './modules/deals/constants.js';

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

function ImportPage({ error, onGoCustomers }) {
  return (
    <section className="page">
      <div className="page-header">
        <p className="eyebrow">Import</p>
        <h1>会社名を追加</h1>
        <p>Chrome拡張から受け取った会社名を営業手帳へ追加します。</p>
      </div>

      {error ? (
        <div className="empty-state">
          <h3>追加できませんでした</h3>
          <p>{error}</p>
          <button type="button" className="primary-button" onClick={onGoCustomers}>
            取引先一覧へ
          </button>
        </div>
      ) : (
        <div className="empty-state">
          <h3>取り込み中...</h3>
          <p>会社名を確認しています。</p>
        </div>
      )}
    </section>
  );
}

function CalendarPage({ customers, samples = [], quotes = [], complaints = [], onOpenKarte }) {
  const [viewMode, setViewMode] = useState('month');
  const today = toDateKey(new Date());
  const events = useMemo(
    () => buildCalendarEvents({ customers, samples, quotes, complaints }),
    [complaints, customers, quotes, samples],
  );
  const monthDays = useMemo(() => buildMonthDays(today), [today]);
  const weekDays = useMemo(() => buildWeekDays(today), [today]);
  const visibleDays = viewMode === 'week' ? weekDays : monthDays;
  const visibleEvents = useMemo(() => {
    if (viewMode === 'list') return events;
    const daySet = new Set(visibleDays.map((day) => day.dateKey));
    return events.filter((event) => daySet.has(event.date));
  }, [events, viewMode, visibleDays]);

  function eventsForDay(dateKey) {
    return visibleEvents.filter((event) => event.date === dateKey);
  }

  function openEvent(event) {
    if (event.customerId) {
      onOpenKarte(event.customerId);
    }
  }

  return (
    <section className="page">
      <div className="page-header calendar-page-header">
        <div>
          <p className="eyebrow">Calendar</p>
          <h1>営業カレンダー</h1>
          <p>フォロー、商談、サンプル、見積、クレーム対応をまとめて確認できます。</p>
        </div>
        <div className="segmented-control calendar-view-switch" aria-label="カレンダー表示切替">
          <button type="button" className={viewMode === 'month' ? 'selected' : ''} onClick={() => setViewMode('month')}>月</button>
          <button type="button" className={viewMode === 'week' ? 'selected' : ''} onClick={() => setViewMode('week')}>週</button>
          <button type="button" className={viewMode === 'list' ? 'selected' : ''} onClick={() => setViewMode('list')}>リスト</button>
        </div>
      </div>

      {viewMode === 'list' ? (
        <section className="desktop-panel">
          <div className="section-heading">
            <h2>予定一覧</h2>
            <span className="info-badge">{events.length}件</span>
          </div>
          <div className="calendar-list">
            {events.map((event) => (
              <CalendarEventButton event={event} key={event.id} onClick={() => openEvent(event)} />
            ))}
          </div>
          {events.length === 0 && <CalendarEmpty />}
        </section>
      ) : (
        <section className="calendar-grid-panel">
          <div className="calendar-week-labels">
            {['日', '月', '火', '水', '木', '金', '土'].map((label) => <span key={label}>{label}</span>)}
          </div>
          <div className={`calendar-grid ${viewMode === 'week' ? 'week-view' : ''}`}>
            {visibleDays.map((day) => {
              const dayEvents = eventsForDay(day.dateKey);
              const limit = viewMode === 'week' ? 8 : 4;
              return (
                <article className={`calendar-day ${day.dateKey === today ? 'today' : ''} ${!day.inCurrentMonth ? 'muted' : ''}`} key={day.dateKey}>
                  <div className="calendar-day-head">
                    <strong>{day.label}</strong>
                    {dayEvents.length > 0 && <span>{dayEvents.length}</span>}
                  </div>
                  <div className="calendar-day-events">
                    {dayEvents.slice(0, limit).map((event) => (
                      <CalendarEventButton compact event={event} key={event.id} onClick={() => openEvent(event)} />
                    ))}
                    {dayEvents.length > limit && <small className="calendar-more">+{dayEvents.length - limit}件</small>}
                  </div>
                </article>
              );
            })}
          </div>
          {visibleEvents.length === 0 && <CalendarEmpty />}
        </section>
      )}
    </section>
  );
}

function CalendarEventButton({ event, compact = false, onClick }) {
  return (
    <button type="button" className={`calendar-event ${event.tone} ${compact ? 'compact' : ''}`} onClick={onClick}>
      {!compact && <span>{event.date}</span>}
      <strong>{event.type}</strong>
      <small>{event.customerName}</small>
      <em>{event.title}</em>
    </button>
  );
}

function CalendarEmpty() {
  return (
    <div className="empty-state compact-empty">
      <h3>予定はまだありません</h3>
      <p>顧客カルテ、案件、サンプル、見積、クレームに日付を登録すると表示されます。</p>
    </div>
  );
}

function buildCalendarEvents({ customers, samples, quotes, complaints }) {
  const events = [];
  const customersById = new Map(customers.map((customer) => [customer.id, customer]));

  customers.forEach((customer) => {
    const followDate = customer.nextFollowUpDate || customer.nextFollowDate;
    if (followDate) {
      events.push(calendarEvent({
        id: `follow-${customer.id}-${followDate}`,
        date: followDate,
        type: '次回フォロー',
        title: customer.pipelineMemo || customer.memo || 'フォロー予定',
        customer,
        tone: 'follow',
      }));
    }

    (customer.dealHistories ?? []).forEach((deal) => {
      if (!deal.date) return;
      events.push(calendarEvent({
        id: `deal-${customer.id}-${deal.id}`,
        date: deal.date,
        type: '商談予定',
        title: deal.summary || deal.type || '商談',
        customer,
        tone: 'deal',
      }));
    });
  });

  samples.forEach((sample) => {
    const customer = customersById.get(sample.customerId);
    if (!customer) return;
    if (sample.arrivalDate) {
      events.push(calendarEvent({
        id: `sample-arrival-${sample.id}`,
        date: sample.arrivalDate,
        type: 'サンプル到着',
        title: sample.sampleName || 'サンプル到着予定',
        customer,
        tone: 'sample',
      }));
    }
    if (sample.followUpDate) {
      events.push(calendarEvent({
        id: `sample-follow-${sample.id}`,
        date: sample.followUpDate,
        type: 'サンプルフォロー',
        title: sample.nextAction || sample.sampleName || 'サンプル反応確認',
        customer,
        tone: 'sample',
      }));
    }
  });

  quotes.forEach((quote) => {
    const customer = customersById.get(quote.customerId);
    if (!customer || !quote.validUntil) return;
    events.push(calendarEvent({
      id: `quote-${quote.id}`,
      date: quote.validUntil,
      type: '見積期限',
      title: quote.quoteNumber || quote.memo || '見積有効期限',
      customer,
      tone: 'quote',
    }));
  });

  complaints.forEach((complaint) => {
    const customer = customersById.get(complaint.customerId);
    const dueDate = complaint.responseDueDate || complaint.dueDate || complaint.deadline || complaint.handlingDueDate;
    if (!customer || !dueDate) return;
    events.push(calendarEvent({
      id: `complaint-${complaint.id}`,
      date: dueDate,
      type: 'クレーム対応',
      title: complaint.title || complaint.memo || '対応期限',
      customer,
      tone: 'complaint',
    }));
  });

  return events
    .filter((event) => event.date)
    .sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type));
}

function calendarEvent({ id, date, type, title, customer, tone }) {
  return {
    id,
    date: String(date).slice(0, 10),
    type,
    title,
    customerId: customer.id,
    customerName: customer.companyName || '取引先未設定',
    tone,
  };
}

function toDateKey(value) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildMonthDays(baseDateKey) {
  const base = new Date(`${baseDateKey}T00:00:00`);
  const first = new Date(base.getFullYear(), base.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      dateKey: toDateKey(date),
      label: String(date.getDate()),
      inCurrentMonth: date.getMonth() === base.getMonth(),
    };
  });
}

function buildWeekDays(baseDateKey) {
  const base = new Date(`${baseDateKey}T00:00:00`);
  const start = new Date(base);
  start.setDate(base.getDate() - base.getDay());
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      dateKey: toDateKey(date),
      label: `${date.getMonth() + 1}/${date.getDate()}`,
      inCurrentMonth: true,
    };
  });
}

function LegacyCalendarPage({ customers, setActivePage }) {
  const followItems = useMemo(
    () =>
      customers
        .filter((customer) => customer.nextFollowUpDate || customer.nextFollowDate)
        .sort((a, b) =>
          (a.nextFollowUpDate || a.nextFollowDate).localeCompare(
            b.nextFollowUpDate || b.nextFollowDate,
          ),
        )
        .slice(0, 60),
    [customers],
  );

  return (
    <section className="page">
      <div className="page-header">
        <p className="eyebrow">Calendar</p>
        <h1>フォロー予定</h1>
        <p>次回フォロー日が入っている取引先を日付順に確認できます。</p>
      </div>

      <section className="desktop-panel">
        <div className="section-heading">
          <h2>予定一覧</h2>
          <button type="button" className="text-button" onClick={() => setActivePage('Pipeline')}>
            案件へ
          </button>
        </div>

        <div className="desktop-table calendar-table">
          <div className="desktop-table-head">
            <span>日付</span>
            <span>会社名</span>
            <span>ステータス</span>
            <span>メモ</span>
            <span>操作</span>
          </div>
          {followItems.map((customer) => (
            <div className="desktop-table-row" key={customer.id}>
              <span>{customer.nextFollowUpDate || customer.nextFollowDate}</span>
              <strong>{customer.companyName}</strong>
              <span>{customer.status || '-'}</span>
              <span>{customer.pipelineMemo || customer.memo || '-'}</span>
              <span className="table-actions">
                <button type="button" className="ghost-button" onClick={() => setActivePage('Pipeline')}>
                  案件
                </button>
              </span>
            </div>
          ))}
        </div>

        {followItems.length === 0 && (
          <div className="empty-state">
            <h3>フォロー予定はありません</h3>
            <p>取引先または案件画面で次回フォロー日を登録してください。</p>
          </div>
        )}
      </section>
    </section>
  );
}

function AnalyticsPage({ customers, products, contacts, suppliers, complaints, setActivePage }) {
  const summary = useMemo(() => {
    const statusCounts = PIPELINE_STATUSES.map((status) => ({
      status,
      count: customers.filter((customer) => customer.status === status).length,
    }));
    const highRankCount = customers.filter((customer) => ['S', 'A'].includes(customer.customerRank)).length;
    const complaintOpenCount = complaints.filter((complaint) => complaint.status !== '解決').length;

    return {
      statusCounts,
      highRankCount,
      complaintOpenCount,
    };
  }, [complaints, customers]);

  return (
    <section className="page">
      <div className="page-header">
        <p className="eyebrow">Analytics</p>
        <h1>営業分析</h1>
        <p>PCサイドバーから確認する、営業状況の集約ビューです。</p>
      </div>

      <div className="dashboard-metrics">
        <DashboardMetric label="取引先" value={customers.length} tone="blue" />
        <DashboardMetric label="重要顧客" value={summary.highRankCount} tone="gold" />
        <DashboardMetric label="商品" value={products.length} tone="purple" />
        <DashboardMetric label="担当者" value={contacts.length} tone="blue" />
        <DashboardMetric label="仕入先" value={suppliers.length} tone="orange" />
        <DashboardMetric label="未解決クレーム" value={summary.complaintOpenCount} tone="red" />
      </div>

      <section className="section-block">
        <div className="section-heading">
          <h2>ステータス別件数</h2>
          <button type="button" className="text-button" onClick={() => setActivePage('Pipeline')}>
            案件へ
          </button>
        </div>
        <div className="status-count-grid">
          {summary.statusCounts.map((item) => (
            <div className="status-count-card" key={item.status}>
              <span>{item.count}</span>
              <p>{item.status}</p>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}

function SettingsPage({ user, syncState, syncError, reloadFromCloud, signOut }) {
  return (
    <section className="page">
      <div className="page-header">
        <p className="eyebrow">Settings</p>
        <h1>設定</h1>
        <p>ログイン情報と保存先の状態を確認できます。</p>
      </div>

      <section className={`sync-status-card ${syncState === 'supabase' ? 'cloud' : 'local'}`}>
        <div>
          <span>ログイン中</span>
          <strong>{user?.email}</strong>
        </div>
        <div>
          <span>保存先</span>
          <strong>{syncState === 'supabase' ? 'Supabase' : syncState === 'syncing' ? '同期中...' : 'LocalStorage'}</strong>
        </div>
        <button type="button" className="ghost-button" onClick={reloadFromCloud} disabled={syncState === 'syncing'}>
          クラウドから再読み込み
        </button>
        {syncError && <p>{syncError}</p>}
        <button type="button" className="text-button danger" onClick={signOut}>
          ログアウト
        </button>
      </section>
    </section>
  );
}

function DashboardMetric({ label, value, tone }) {
  return (
    <div className={`dashboard-metric ${tone}`}>
      <span>{value}</span>
      <p>{label}</p>
    </div>
  );
}
