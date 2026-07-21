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
const pipelinePages = ['Pipeline', 'Invoices'];
const productPages = ['Products', 'ProductDetail'];

const tabs = [
  { key: 'Home', label: 'ホーム', icon: '⌂' },
  { key: 'Customers', label: '取引先', icon: '□' },
  { key: 'Add', label: '追加', icon: '+' },
  { key: 'Pipeline', label: '案件', icon: '◇' },
  { key: 'Products', label: '商品', icon: '▣' },
];

function activeTabFor(page) {
  if (customerPages.includes(page)) return 'Customers';
  if (pipelinePages.includes(page)) return 'Pipeline';
  if (productPages.includes(page)) return 'Products';
  return 'Home';
}

export default function BottomNavigation({ activePage, onNavigate, onAdd }) {
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
            onClick={() => (isAdd ? onAdd() : onNavigate(tab.key))}
          >
            <span aria-hidden="true">{tab.icon}</span>
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
