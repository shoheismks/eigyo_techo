const customerPages = [
  'Customers',
  'CustomerDetail',
  'CustomerKarte',
  'Contacts',
  'BusinessCards',
  'Complaints',
  'LeadSearch',
  'CompanyEnrich',
  'MailAI',
  'Import',
];
const productPages = ['Products', 'ProductDetail'];

const navItems = [
  { key: 'Home', label: 'ホーム', helper: 'ダッシュボード' },
  { key: 'Customers', label: '取引先', helper: '顧客・担当者・名刺' },
  { key: 'Pipeline', label: '案件', helper: '商談・フォロー' },
  { key: 'Products', label: '商品', helper: '商品マスター' },
  { key: 'Suppliers', label: '仕入先', helper: '仕入先管理' },
  { key: 'Calendar', label: 'カレンダー', helper: 'フォロー予定' },
  { key: 'Analytics', label: '分析', helper: '営業状況' },
  { key: 'Settings', label: '設定', helper: '同期・ログアウト' },
];

function activeGroupFor(page) {
  if (customerPages.includes(page)) return 'Customers';
  if (productPages.includes(page)) return 'Products';
  if (page === 'Suppliers') return 'Suppliers';
  if (page === 'Calendar') return 'Calendar';
  if (page === 'Analytics') return 'Analytics';
  if (page === 'Settings') return 'Settings';
  if (page === 'Pipeline') return 'Pipeline';
  return 'Home';
}

export default function SidebarNavigation({ activePage, onNavigate, user }) {
  const activeGroup = activeGroupFor(activePage);

  return (
    <aside className="sidebar-nav" aria-label="PC用メインナビゲーション">
      <div className="sidebar-brand">
        <strong>営業手帳</strong>
        <span>{user?.email || 'Signed in'}</span>
      </div>

      <div className="sidebar-nav-list">
        {navItems.map((item) => (
          <button
            type="button"
            key={item.key}
            className={activeGroup === item.key ? 'active' : ''}
            onClick={() => onNavigate(item.key)}
          >
            <span>{item.label}</span>
            <small>{item.helper}</small>
          </button>
        ))}
      </div>
    </aside>
  );
}
