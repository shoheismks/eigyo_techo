import { useState } from 'react';
import { APP_VERSION_LABEL } from '../shared/constants/appMeta.js';
import AddActionMenu from './AddActionMenu.jsx';
import BottomNavigation from './BottomNavigation.jsx';
import SidebarNavigation from './SidebarNavigation.jsx';

const pageTitles = {
  Home: 'ホーム',
  Customers: '顧客',
  CustomerKarte: '顧客カルテ',
  CustomerDetail: '顧客編集',
  Pipeline: '営業',
  SalesOrders: '受注',
  Shipments: '出荷',
  DeliveryNotes: '納品書',
  Invoices: '請求書',
  Products: '商品',
  ProductDetail: '商品編集',
  CustomerProductPrices: '顧客別価格',
  Inventory: '在庫・物流',
  Suppliers: '仕入',
  Calendar: 'スケジュール',
  Analytics: '分析',
  Settings: '設定',
  Help: 'ヘルプ',
  LeadSearch: '営業先検索',
  CompanyEnrich: '企業情報補完',
  BusinessCards: '名刺',
  Contacts: '担当者',
  Complaints: 'クレーム',
  MailAI: 'AIメール',
  Import: '取り込み',
};

function pageTitleFor(activePage) {
  return pageTitles[activePage] || '営業手帳';
}

export default function AppLayout({
  activePage,
  user,
  onNavigate,
  onAddAction,
  onGlobalSearch,
  onHelp,
  onSignOut,
  addMenuOpen,
  setAddMenuOpen,
  notice,
  themeStyle,
  children,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function handleAction(actionKey) {
    onAddAction?.(actionKey);
    setAddMenuOpen(false);
  }

  function handleSearchSubmit(event) {
    event.preventDefault();
    const normalizedQuery = searchQuery.trim();
    if (normalizedQuery) {
      onGlobalSearch?.(normalizedQuery);
    }
  }

  function handleNavigate(pageKey) {
    onNavigate(pageKey);
    setSidebarOpen(false);
  }

  return (
    <div className="app-shell desktop-layout mobile-layout" style={themeStyle}>
      <div className="app-frame app-layout">
        <SidebarNavigation
          activePage={activePage}
          onNavigate={handleNavigate}
          user={user}
          onSignOut={onSignOut}
          mobileOpen={sidebarOpen}
          onMobileClose={() => setSidebarOpen(false)}
        />

        <main className="app-main">
          <header className="app-topbar">
            <button
              type="button"
              className="mobile-menu-button"
              aria-label="メニューを開く"
              onClick={() => setSidebarOpen(true)}
            >
              <span aria-hidden="true">☰</span>
            </button>

            <div className="app-topbar-title">
              <strong>{pageTitleFor(activePage)}</strong>
              <span>営業手帳 / {APP_VERSION_LABEL}</span>
            </div>

            <form className="desktop-global-search" aria-label="全体検索" onSubmit={handleSearchSubmit}>
              <span>検索</span>
              <input
                type="search"
                value={searchQuery}
                placeholder="会社名・商品・担当者を検索"
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </form>

            <div className="desktop-quick-actions">
              <button type="button" className="ghost-button compact-button help-button" aria-label="ヘルプ" onClick={onHelp}>
                ?
              </button>
              <button type="button" className="primary-button compact-button" onClick={() => handleAction('company')}>
                追加
              </button>
              <button type="button" className="ghost-button compact-button" onClick={() => handleAction('inventory')}>
                在庫
              </button>
              <button type="button" className="ghost-button compact-button" onClick={() => handleAction('business-card')}>
                名刺
              </button>
              <button type="button" className="ghost-button compact-button" onClick={() => handleAction('product')}>
                商品
              </button>
            </div>

            <div className="app-user-block">
              <span>{user?.email}</span>
              <button type="button" className="text-button compact-button logout-button" onClick={onSignOut}>
                ログアウト
              </button>
            </div>
          </header>

          {notice && <div className="extension-toast">{notice}</div>}

          <div className="main-content">{children}</div>
          {activePage !== 'Help' && (
            <button type="button" className="floating-help-button" aria-label="ヘルプ" onClick={onHelp}>
              ?
            </button>
          )}
        </main>

        <BottomNavigation
          activePage={activePage}
          onNavigate={handleNavigate}
          onAdd={() => setAddMenuOpen(true)}
        />
        <AddActionMenu
          open={addMenuOpen}
          onClose={() => setAddMenuOpen(false)}
          onAction={handleAction}
        />
      </div>
    </div>
  );
}
