const customerPages = [
  'Customers',
  'CustomerDetail',
  'CustomerKarte',
  'Contacts',
  'BusinessCards',
  'Complaints',
  'LeadSearch',
  'CompanyEnrich',
  'Import',
];
const morePages = [
  'Pipeline',
  'Quotes',
  'SalesOrders',
  'Shipments',
  'DeliveryNotes',
  'Invoices',
  'Products',
  'ProductDetail',
  'Inventory',
  'CustomerProductPrices',
  'Suppliers',
  'MailAI',
  'Analytics',
  'Settings',
  'Help',
];

const tabs = [
  { key: 'Home', label: 'ホーム', icon: '⌂' },
  { key: 'Customers', label: '顧客', icon: '□' },
  { key: 'Add', label: '＋', icon: '+' },
  { key: 'Calendar', label: 'スケジュール', icon: '予' },
  { key: 'More', label: 'その他', icon: '☰' },
];

function activeTabFor(page) {
  if (customerPages.includes(page)) return 'Customers';
  if (page === 'Calendar') return 'Calendar';
  if (morePages.includes(page)) return 'More';
  return 'Home';
}

export default function BottomNavigation({ activePage, onNavigate, onAdd, onMore }) {
  const currentTab = activeTabFor(activePage);

  return (
    <nav className="bottom-nav" aria-label="スマホ用メインナビゲーション">
      {tabs.map((tab) => {
        const isAdd = tab.key === 'Add';
        const isActive = !isAdd && currentTab === tab.key;

        return (
          <button
            type="button"
            key={tab.key}
            className={`${isActive ? 'active' : ''} ${isAdd ? 'add-tab' : ''}`}
            onClick={() => {
              if (isAdd) onAdd();
              else if (tab.key === 'More') onMore();
              else onNavigate(tab.key);
            }}
          >
            <span aria-hidden="true">{tab.icon}</span>
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
