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
const productPages = ['Products', 'ProductDetail', 'CustomerProductPrices'];
const pipelinePages = ['Pipeline'];
const salesOrderPages = ['SalesOrders', 'Shipments', 'DeliveryNotes', 'Invoices'];
const inventoryPages = ['Inventory'];

const navGroups = [
  {
    label: '営業',
    items: [
      { key: 'Home', label: 'ダッシュボード', helper: '今日やること' },
      {
        key: 'Customers',
        label: '顧客',
        helper: '取引先・担当者',
        subItems: [
          { key: 'LeadSearch', label: '営業先検索' },
          { key: 'Contacts', label: '担当者' },
          { key: 'BusinessCards', label: '名刺' },
          { key: 'Complaints', label: 'クレーム' },
          { key: 'MailAI', label: 'AIメール' },
        ],
      },
      { key: 'Pipeline', label: '案件', helper: '商談・フォロー' },
      { key: 'Calendar', label: 'カレンダー', helper: '予定管理' },
    ],
  },
  {
    label: '販売・物流',
    items: [
      {
        key: 'Products',
        label: '商品',
        helper: '商品・価格',
        subItems: [{ key: 'CustomerProductPrices', label: '顧客別価格' }],
      },
      { key: 'Inventory', label: '在庫管理', helper: '入庫・出庫・棚卸' },
      {
        key: 'SalesOrders',
        label: '受注・帳票',
        helper: '受注から納品まで',
        subItems: [
          { key: 'Shipments', label: '出荷' },
          { key: 'DeliveryNotes', label: '納品書' },
          { key: 'Invoices', label: '請求書' },
        ],
      },
    ],
  },
  {
    label: '仕入・分析',
    items: [
      { key: 'Suppliers', label: '仕入先', helper: '仕入先管理' },
      { key: 'Analytics', label: '分析', helper: '営業状況' },
    ],
  },
  {
    label: '設定',
    items: [
      {
        key: 'Settings',
        label: '設定',
        helper: '同期・発行元',
        subItems: [{ key: 'Help', label: 'ヘルプ' }],
      },
    ],
  },
];

function activeGroupFor(page) {
  if (customerPages.includes(page)) return 'Customers';
  if (productPages.includes(page)) return 'Products';
  if (pipelinePages.includes(page)) return 'Pipeline';
  if (salesOrderPages.includes(page)) return 'SalesOrders';
  if (inventoryPages.includes(page)) return 'Inventory';
  if (page === 'Suppliers') return 'Suppliers';
  if (page === 'Calendar') return 'Calendar';
  if (page === 'Analytics') return 'Analytics';
  if (page === 'Help') return 'Settings';
  if (page === 'Settings') return 'Settings';
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
            {group.items.map((item) => {
              const isActive = activeGroup === item.key;
              return (
                <div className="sidebar-nav-item" key={`${group.label}-${item.key}`}>
                  <button
                    type="button"
                    className={isActive ? 'active' : ''}
                    onClick={() => onNavigate(item.key)}
                  >
                    <span>{item.label}</span>
                    <small>{item.helper}</small>
                  </button>
                  {isActive && item.subItems?.length > 0 && (
                    <div className="sidebar-subnav" aria-label={`${item.label}の詳細メニュー`}>
                      {item.subItems.map((subItem) => (
                        <button
                          type="button"
                          key={subItem.key}
                          className={activePage === subItem.key ? 'active' : ''}
                          onClick={() => onNavigate(subItem.key)}
                        >
                          <span>{subItem.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        ))}
      </div>
    </aside>
  );
}
