import { APP_VERSION_LABEL } from '../shared/constants/appMeta.js';

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
const pipelinePages = ['Pipeline'];
const salesOrderPages = ['SalesOrders', 'Shipments', 'DeliveryNotes'];
const inventoryPages = ['Inventory'];

const navGroups = [
  {
    label: '営業',
    items: [
      { key: 'Home', label: 'ダッシュボード', helper: '今日やること' },
      { key: 'Customers', label: '顧客', helper: '取引先・担当者' },
      { key: 'Pipeline', label: '案件', helper: '商談・フォロー' },
      { key: 'Calendar', label: 'カレンダー', helper: '予定管理' },
    ],
  },
  {
    label: '販売',
    items: [
      { key: 'Products', label: '商品', helper: '商品マスター' },
      { key: 'Inventory', label: '在庫管理', helper: '入庫・出庫・棚卸' },
      { key: 'Pipeline', label: '見積', helper: '見積作成' },
      { key: 'Pipeline', label: '成約確認書', helper: '約款・確認書' },
      { key: 'SalesOrders', label: '受注', helper: '受注一覧・詳細' },
      { key: 'Shipments', label: '出荷', helper: '出荷一覧・ピッキング' },
      { key: 'DeliveryNotes', label: '納品書', helper: '納品書PDF' },
      { key: 'Invoices', label: '請求書', helper: '請求・入金確認' },
    ],
  },
  {
    label: 'マスター',
    items: [
      { key: 'Suppliers', label: '仕入先', helper: '仕入先管理' },
      { key: 'Settings', label: '発行元', helper: '帳票発行元' },
      { key: 'Settings', label: '設定', helper: '同期・ログアウト' },
      { key: 'Analytics', label: '分析', helper: '営業状況' },
      { key: 'Help', label: 'ヘルプ', helper: '操作マニュアル' },
    ],
  },
];

function activeGroupFor(page) {
  if (customerPages.includes(page)) return 'Customers';
  if (productPages.includes(page)) return 'Products';
  if (pipelinePages.includes(page)) return 'Pipeline';
  if (salesOrderPages.includes(page)) return 'SalesOrders';
  if (page === 'DeliveryNotes') return 'SalesOrders';
  if (inventoryPages.includes(page)) return 'Inventory';
  if (page === 'Invoices') return 'Invoices';
  if (page === 'Suppliers') return 'Suppliers';
  if (page === 'Calendar') return 'Calendar';
  if (page === 'Analytics') return 'Analytics';
  if (page === 'Settings') return 'Settings';
  if (page === 'Help') return 'Help';
  return 'Home';
}

export default function SidebarNavigation({ activePage, onNavigate, user }) {
  const activeGroup = activeGroupFor(activePage);

  return (
    <aside className="sidebar-nav" aria-label="PC用メインナビゲーション">
      <div className="sidebar-brand">
        <strong>営業手帳</strong>
        <span>{APP_VERSION_LABEL}</span>
        <span>{user?.email || 'Signed in'}</span>
      </div>

      <div className="sidebar-nav-list grouped-sidebar-nav">
        {navGroups.map((group) => (
          <section className="sidebar-nav-group" key={group.label}>
            <p>{group.label}</p>
            {group.items.map((item) => (
              <button
                type="button"
                key={`${group.label}-${item.label}`}
                className={activeGroup === item.key ? 'active' : ''}
                onClick={() => onNavigate(item.key)}
              >
                <span>{item.label}</span>
                <small>{item.helper}</small>
              </button>
            ))}
          </section>
        ))}
      </div>
    </aside>
  );
}
