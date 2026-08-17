export const LEGACY_LOCAL_DATA_GROUPS = [
  { id: 'customers', label: '顧客', keys: ['eigyo-techo-customers'] },
  { id: 'quotes', label: '見積', keys: ['eigyo-techo-quotes'] },
  { id: 'sales-orders', label: '受注', keys: ['eigyo-techo-sales-orders'] },
  { id: 'shipments', label: '出荷', keys: ['eigyo-techo-shipments'] },
  { id: 'delivery-notes', label: '納品書', keys: ['eigyo-techo-delivery-notes'] },
  {
    id: 'inventory',
    label: '在庫',
    keys: [
      'eigyo-techo-inventories',
      'eigyo-techo-inventory-lots',
      'eigyo-techo-inventory-movements',
      'eigyo-techo-inventory-reservations',
      'eigyo-techo-stocktakes',
      'eigyo-techo-stocktake-lines',
    ],
  },
  {
    id: 'customer-product-prices',
    label: '顧客別価格',
    keys: [
      'eigyo-techo-customer-product-prices',
      'eigyo-techo-customer-product-price-history',
    ],
  },
  { id: 'issuers', label: '発行元', keys: ['eigyo-techo-issuers'] },
  { id: 'contacts', label: '担当者', keys: ['eigyo-techo-contacts'] },
  { id: 'business-cards', label: '名刺', keys: ['eigyo-techo-business-cards'] },
  { id: 'complaints', label: 'クレーム', keys: ['eigyo-techo-complaints'] },
  { id: 'suppliers', label: '仕入先', keys: ['eigyo-techo-suppliers'] },
  { id: 'projects', label: '案件', keys: ['eigyo-techo-projects'] },
  { id: 'samples', label: 'サンプル', keys: ['eigyo-techo-samples'] },
  { id: 'adoptions', label: '採用管理', keys: ['eigyo-techo-adoptions'] },
  { id: 'attachments', label: '添付ファイル', keys: ['eigyo-techo-attachments'] },
  { id: 'invoices', label: '請求書', keys: ['eigyo-techo-invoices'] },
];

function localStorageAvailable() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function countLegacyLocalValue(rawValue) {
  if (!rawValue) {
    return 0;
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (Array.isArray(parsed)) {
      return parsed.length;
    }
    if (parsed && typeof parsed === 'object') {
      return Object.keys(parsed).length || 1;
    }
    return parsed ? 1 : 0;
  } catch {
    return rawValue ? 1 : 0;
  }
}

export function parseLegacyLocalValue(rawValue) {
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue);
  } catch {
    return rawValue;
  }
}

export function summarizeLegacyLocalData(groups = LEGACY_LOCAL_DATA_GROUPS) {
  if (!localStorageAvailable()) {
    return [];
  }

  return groups
    .map((group) => {
      const entries = group.keys
        .map((key) => {
          const rawValue = window.localStorage.getItem(key);
          const count = countLegacyLocalValue(rawValue);
          return {
            key,
            count,
            rawValue,
            value: parseLegacyLocalValue(rawValue),
          };
        })
        .filter((entry) => entry.count > 0);

      return {
        ...group,
        entries,
        count: entries.reduce((sum, entry) => sum + entry.count, 0),
      };
    })
    .filter((group) => group.count > 0);
}

export function removeLegacyLocalDataGroups(groups) {
  if (!localStorageAvailable()) {
    return [];
  }

  const removedKeys = [];
  groups.forEach((group) => {
    group.entries.forEach((entry) => {
      window.localStorage.removeItem(entry.key);
      removedKeys.push(entry.key);
    });
  });
  return removedKeys;
}
