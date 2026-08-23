import { useMemo } from 'react';
import BusinessAlerts from './home/BusinessAlerts.jsx';
import HomeKpiStrip from './home/HomeKpiStrip.jsx';
import NextActionList from './home/NextActionList.jsx';
import QuickActionPanel from './home/QuickActionPanel.jsx';
import TodaySummary from './home/TodaySummary.jsx';
import { buildHomeDashboard } from './home/homeDashboardService.js';

export default function Home({
  customers = [],
  tasks = [],
  events = [],
  projects = [],
  samples = [],
  quotes = [],
  salesOrders = [],
  shipments = [],
  inventories = [],
  complaints = [],
  inboundShipments = [],
  inboundShipmentLines = [],
  inventoryLots = [],
  setActivePage,
  onOpenKarte,
  onOpenInventoryPage,
  onCreateCalendarItem,
}) {
  const dashboard = useMemo(
    () =>
      buildHomeDashboard({
        customers,
        tasks,
        events,
        projects,
        samples,
        quotes,
        salesOrders,
        shipments,
        inventories,
        complaints,
        inboundShipments,
        inboundShipmentLines,
        inventoryLots,
      }),
    [
      customers,
      tasks,
      events,
      projects,
      samples,
      quotes,
      salesOrders,
      shipments,
      inventories,
      complaints,
      inboundShipments,
      inboundShipmentLines,
      inventoryLots,
    ],
  );

  const handleAction = (action = {}) => {
    if (action.type === 'karte' && action.customerId) {
      onOpenKarte?.(action.customerId);
      return;
    }
    if (action.type === 'customer') {
      setActivePage?.('Customers');
      return;
    }
    if (action.type === 'record' || action.type === 'pipeline') {
      setActivePage?.('Pipeline');
      return;
    }
    if (action.type === 'schedule' || action.type === 'task') {
      if (typeof onCreateCalendarItem === 'function') {
        onCreateCalendarItem(action.type);
        return;
      }
      setActivePage?.('Calendar');
      return;
    }
    if (action.type === 'calendar') {
      setActivePage?.('Calendar');
      return;
    }
    if (action.type === 'quote') {
      setActivePage?.('Quotes');
      return;
    }
    if (action.type === 'salesOrders') {
      setActivePage?.('SalesOrders');
      return;
    }
    if (action.type === 'inventory') {
      setActivePage?.('Inventory');
      return;
    }
    if (action.type === 'inbound') {
      if (typeof onOpenInventoryPage === 'function') {
        onOpenInventoryPage({ tab: 'inbound' });
      } else {
        setActivePage?.('Inventory');
      }
    }
  };

  return (
    <main className="page home-page">
      <section className="home-hero-panel">
        <div>
          <p className="eyebrow">Today dashboard</p>
          <h1>今日の業務</h1>
          <p className="home-date-label">{dashboard.dateLabel}</p>
          <p className="hero-copy">
            予定、タスク、フォロー、入荷予定をまとめて確認し、次に動く順番を判断できます。
          </p>
        </div>
        <button className="hero-action" type="button" onClick={() => setActivePage?.('Calendar')}>
          カレンダーへ
        </button>
      </section>

      <div className="home-desktop-layout">
        <TodaySummary cards={dashboard.summaryCards} onAction={handleAction} />
        <NextActionList actions={dashboard.nextActions} onAction={handleAction} />
        <div className="home-two-column">
          <BusinessAlerts alerts={dashboard.businessAlerts} onAction={handleAction} />
          <HomeKpiStrip kpis={dashboard.kpis} onAction={handleAction} />
        </div>
      </div>

      <div className="home-mobile-layout">
        <TodaySummary cards={dashboard.summaryCards.slice(0, 4)} onAction={handleAction} />
        <NextActionList actions={dashboard.nextActions.slice(0, 6)} compact onAction={handleAction} />
        <QuickActionPanel onAction={handleAction} />
        <BusinessAlerts alerts={dashboard.businessAlerts} onAction={handleAction} />
      </div>
    </main>
  );
}
