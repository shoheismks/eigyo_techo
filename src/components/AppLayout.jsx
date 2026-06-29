import AddActionMenu from './AddActionMenu.jsx';
import BottomNavigation from './BottomNavigation.jsx';
import SidebarNavigation from './SidebarNavigation.jsx';

const pageTitles = {
  Home: 'ホーム',
  Customers: '取引先',
  CustomerKarte: '顧客カルテ',
  CustomerDetail: '取引先編集',
  Pipeline: '案件',
  Products: '商品',
  ProductDetail: '商品編集',
  Suppliers: '仕入先',
  Calendar: 'カレンダー',
  Analytics: '分析',
  Settings: '設定',
  LeadSearch: '会社追加',
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
  onSignOut,
  addMenuOpen,
  setAddMenuOpen,
  notice,
  children,
}) {
  function handleAction(actionKey) {
    onAddAction(actionKey);
    setAddMenuOpen(false);
  }

  return (
    <div className="app-shell desktop-layout mobile-layout">
      <div className="app-frame app-layout">
        <SidebarNavigation activePage={activePage} onNavigate={onNavigate} user={user} />

        <main className="app-main">
          <header className="app-topbar">
            <div className="app-topbar-title">
              <strong>{pageTitleFor(activePage)}</strong>
              <span>営業手帳</span>
            </div>

            <label className="desktop-global-search" aria-label="全体検索">
              <span>検索</span>
              <input type="search" placeholder="会社名・商品・担当者を検索" />
            </label>

            <div className="desktop-quick-actions">
              <button type="button" className="primary-button compact-button" onClick={() => handleAction('company')}>
                追加
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
        </main>

        <BottomNavigation
          activePage={activePage}
          onNavigate={onNavigate}
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
