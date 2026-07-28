import { useEffect, useMemo, useState } from 'react';
import { APP_VERSION_LABEL } from '../shared/constants/appMeta.js';

const STORAGE_KEY_OPEN_GROUP = 'eigyoTecho.sidebar.openGroup';
const STORAGE_KEY_COMPACT = 'eigyoTecho.sidebar.compact';

const navGroups = [
  {
    id: 'home',
    key: 'Home',
    label: 'ホーム',
    helper: 'ダッシュボード',
    icon: 'H',
    pages: ['Home'],
  },
  {
    id: 'customers',
    key: 'Customers',
    label: '顧客',
    helper: '取引先・担当者',
    icon: '顧',
    pages: [
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
    ],
    items: [
      { key: 'Customers', label: '顧客一覧', helper: '取引先・カルテ' },
      { key: 'LeadSearch', label: '営業先検索', helper: 'リード検索' },
      { key: 'Contacts', label: '担当者', helper: '人物情報' },
      { key: 'BusinessCards', label: '名刺', helper: 'OCR・画像' },
      { key: 'Complaints', label: 'クレーム', helper: '対応履歴' },
      { key: 'MailAI', label: 'AIメール', helper: '文面作成' },
    ],
  },
  {
    id: 'sales',
    key: 'Pipeline',
    label: '営業',
    helper: '案件・帳票',
    icon: '営',
    pages: ['Pipeline', 'SalesOrders', 'Invoices'],
    items: [
      { key: 'Pipeline', label: '案件', helper: '商談・フォロー・見積' },
      { key: 'SalesOrders', label: '受注', helper: '受注・契約残' },
      { key: 'Invoices', label: '請求書', helper: '請求・入金' },
    ],
  },
  {
    id: 'products',
    key: 'Products',
    label: '商品',
    helper: '商品・価格',
    icon: '商',
    pages: ['Products', 'ProductDetail', 'CustomerProductPrices'],
    items: [
      { key: 'Products', label: '商品一覧', helper: '商品マスター' },
      { key: 'CustomerProductPrices', label: '顧客別価格', helper: '価格マスター' },
    ],
  },
  {
    id: 'logistics',
    key: 'Inventory',
    label: '在庫・物流',
    helper: '入出庫・出荷',
    icon: '在',
    pages: ['Inventory', 'Shipments', 'DeliveryNotes'],
    items: [
      { key: 'Inventory', label: '在庫一覧', helper: '入庫・出庫・棚卸' },
      { key: 'Shipments', label: '出荷', helper: 'ピッキング・出荷' },
      { key: 'DeliveryNotes', label: '納品書', helper: '納品書PDF' },
    ],
  },
  {
    id: 'suppliers',
    key: 'Suppliers',
    label: '仕入',
    helper: '仕入先・メーカー',
    icon: '仕',
    pages: ['Suppliers'],
    items: [
      { key: 'Suppliers', label: '仕入先', helper: '国内・海外メーカー' },
    ],
  },
  {
    id: 'schedule',
    key: 'Calendar',
    label: 'スケジュール',
    helper: '予定・タスク',
    icon: '予',
    pages: ['Calendar'],
    items: [
      { key: 'Calendar', label: 'カレンダー', helper: '予定管理' },
    ],
  },
  {
    id: 'analytics',
    key: 'Analytics',
    label: '分析',
    helper: '営業分析',
    icon: '分',
    pages: ['Analytics'],
    items: [
      { key: 'Analytics', label: '営業分析', helper: 'KPI・利益分析' },
    ],
  },
  {
    id: 'settings',
    key: 'Settings',
    label: '設定',
    helper: '会社・マスター',
    icon: '設',
    pages: ['Settings', 'Help'],
    items: [
      { key: 'Settings', label: '設定', helper: '会社情報・Backup' },
      { key: 'Help', label: 'ヘルプ', helper: '操作マニュアル' },
    ],
  },
];

function activeGroupFor(page) {
  return navGroups.find((group) => group.pages.includes(page)) || navGroups[0];
}

function readStoredValue(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  return window.localStorage.getItem(key) || fallback;
}

export default function SidebarNavigation({
  activePage,
  onNavigate,
  user,
  mobileOpen = false,
  onMobileClose,
}) {
  const activeGroup = useMemo(() => activeGroupFor(activePage), [activePage]);
  const [openGroupId, setOpenGroupId] = useState(() => readStoredValue(STORAGE_KEY_OPEN_GROUP, activeGroup.id));
  const [compact, setCompact] = useState(() => readStoredValue(STORAGE_KEY_COMPACT, 'false') === 'true');

  useEffect(() => {
    setOpenGroupId(activeGroup.id);
  }, [activeGroup.id]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY_OPEN_GROUP, openGroupId);
  }, [openGroupId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY_COMPACT, String(compact));
  }, [compact]);

  useEffect(() => {
    if (!mobileOpen) return undefined;

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onMobileClose?.();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen, onMobileClose]);

  function handleGroupClick(group) {
    if (!group.items?.length) {
      onNavigate(group.key);
      onMobileClose?.();
      return;
    }

    if (openGroupId !== group.id) {
      setOpenGroupId(group.id);
      return;
    }

    onNavigate(group.key);
    onMobileClose?.();
  }

  function handleSubNavigate(pageKey) {
    onNavigate(pageKey);
    onMobileClose?.();
  }

  return (
    <>
      <button
        type="button"
        className={`mobile-sidebar-backdrop ${mobileOpen ? 'open' : ''}`}
        aria-label="メニューを閉じる"
        onClick={onMobileClose}
      />
      <aside
        className={`sidebar-nav ${compact ? 'sidebar-compact' : ''} ${mobileOpen ? 'mobile-open' : ''}`}
        aria-label="メインナビゲーション"
      >
        <div className="sidebar-brand">
          <div>
            <strong>営業手帳</strong>
            <span>{APP_VERSION_LABEL}</span>
          </div>
          <span>{user?.email || 'Signed in'}</span>
          <button
            type="button"
            className="sidebar-collapse-button"
            onClick={() => setCompact((current) => !current)}
            aria-pressed={compact}
          >
            {compact ? '展開' : '縮小'}
          </button>
        </div>

        <div className="sidebar-nav-list grouped-sidebar-nav">
          {navGroups.map((group) => {
            const isActiveGroup = activeGroup.id === group.id;
            const isOpen = openGroupId === group.id;
            const panelId = `sidebar-group-${group.id}`;

            return (
              <section className="sidebar-nav-group" key={group.id}>
                <button
                  type="button"
                  className={`sidebar-group-button ${isActiveGroup ? 'active' : ''}`}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => handleGroupClick(group)}
                  title={compact ? group.label : undefined}
                >
                  <span className="sidebar-group-icon" aria-hidden="true">{group.icon}</span>
                  <span className="sidebar-group-text">
                    <strong>{group.label}</strong>
                    <small>{group.helper}</small>
                  </span>
                  {group.items?.length > 0 && <span className="sidebar-chevron" aria-hidden="true">{isOpen ? '−' : '+'}</span>}
                </button>

                {group.items?.length > 0 && (
                  <div
                    id={panelId}
                    className={`sidebar-subnav ${isOpen ? 'open' : ''}`}
                    aria-label={`${group.label}の詳細メニュー`}
                    hidden={!isOpen}
                  >
                    {group.items.map((item) => (
                      <button
                        type="button"
                        key={item.key}
                        className={activePage === item.key ? 'active' : ''}
                        onClick={() => handleSubNavigate(item.key)}
                      >
                        <span>{item.label}</span>
                        <small>{item.helper}</small>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </aside>
    </>
  );
}
