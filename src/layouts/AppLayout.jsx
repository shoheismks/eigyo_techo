import { useEffect, useState } from 'react';
import { APP_VERSION_LABEL } from '../shared/constants/appMeta.js';
import AddActionMenu from './AddActionMenu.jsx';
import BottomNavigation from './BottomNavigation.jsx';
import MobileMoreMenu from './MobileMoreMenu.jsx';
import SidebarNavigation from './SidebarNavigation.jsx';
import LegacyLocalDataPanel from '../shared/components/LegacyLocalDataPanel.jsx';
import GlobalSearchPalette from '../shared/components/GlobalSearchPalette.jsx';

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
  onGlobalSearchSelect,
  globalSearchIndex,
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
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    function handleShortcut(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
    }

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  function handleAction(actionKey) {
    onAddAction?.(actionKey);
    setAddMenuOpen(false);
    setMoreMenuOpen(false);
  }

  function handleSearchSubmit(event) {
    event.preventDefault();
    const normalizedQuery = searchQuery.trim();
    if (normalizedQuery) {
      setSearchOpen(true);
    }
  }

  function handleNavigate(pageKey) {
    onNavigate(pageKey);
    setSidebarOpen(false);
    setMoreMenuOpen(false);
  }

  function handleGlobalSearchSelect(result) {
    onGlobalSearchSelect?.(result);
    setSearchOpen(false);
    setMoreMenuOpen(false);
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
                placeholder="顧客・担当者・商品・案件・見積などを検索"
                onFocus={() => setSearchOpen(true)}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setSearchOpen(true);
                }}
              />
            </form>

            <div className="desktop-quick-actions">
              <button type="button" className="ghost-button compact-button help-button" aria-label="ヘルプ" onClick={onHelp}>
                ?
              </button>
              <button type="button" className="primary-button compact-button" onClick={() => setAddMenuOpen(true)}>
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

          <div className="main-content">
            <LegacyLocalDataPanel />
            {children}
          </div>
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
          onMore={() => setMoreMenuOpen(true)}
        />
        <MobileMoreMenu
          open={moreMenuOpen}
          onClose={() => setMoreMenuOpen(false)}
          onNavigate={handleNavigate}
          onAction={handleAction}
          onSearchOpen={() => {
            setMoreMenuOpen(false);
            setSearchOpen(true);
          }}
        />
        <AddActionMenu
          open={addMenuOpen}
          onClose={() => setAddMenuOpen(false)}
          onAction={handleAction}
        />
        <GlobalSearchPalette
          open={searchOpen}
          query={searchQuery}
          index={globalSearchIndex}
          onQueryChange={setSearchQuery}
          onClose={() => setSearchOpen(false)}
          onSelect={handleGlobalSearchSelect}
        />
      </div>
    </div>
  );
}
