import AddActionMenu from './AddActionMenu.jsx';
import BottomNavigation from './BottomNavigation.jsx';
import SidebarNavigation from './SidebarNavigation.jsx';

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
    <div className="app-shell">
      <div className="app-frame app-layout">
        <SidebarNavigation activePage={activePage} onNavigate={onNavigate} user={user} />

        <main className="app-main">
          <header className="app-topbar">
            <div className="app-topbar-title">
              <strong>営業手帳</strong>
              <span>{user?.email}</span>
            </div>

            <div className="desktop-quick-actions">
              <button type="button" className="primary-button compact-button" onClick={() => handleAction('company')}>
                会社を追加
              </button>
              <button type="button" className="ghost-button compact-button" onClick={() => handleAction('business-card')}>
                名刺を撮影
              </button>
              <button type="button" className="ghost-button compact-button" onClick={() => handleAction('product')}>
                商品追加
              </button>
            </div>

            <button type="button" className="text-button compact-button logout-button" onClick={onSignOut}>
              ログアウト
            </button>
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
