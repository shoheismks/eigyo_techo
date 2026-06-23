import { useEffect, useMemo, useState } from 'react';
import { calculateCompanyScore } from '../services/scoringService.js';
import {
  canUseSupabase,
  deleteRemoteCustomer,
  fetchRemoteCustomers,
  mergeCustomers,
  upsertRemoteCustomers,
} from '../services/customerSyncService.js';

const STORAGE_KEY = 'eigyo-techo-customers';

const defaultCustomer = {
  placeId: '',
  companyName: '',
  industry: '',
  area: '',
  address: '',
  phone: '',
  website: '',
  email: '',
  emailType: '',
  inquiryUrl: '',
  status: '未接触',
  memo: '',
  source: 'Manual',
  contactStatus: '未取得',
  lastContactDate: '',
  nextFollowDate: '',
  pipelineMemo: '',
  score: 0,
  rank: '★☆☆☆☆',
  scoreReasons: [],
  updatedAt: '',
};

const legacyStatusMap = {
  未対応: '未接触',
  対応中: '商談中',
  提案済み: '見積提出',
};

function normalizeStatus(status) {
  return legacyStatusMap[status] ?? status ?? '未接触';
}

function normalizeCustomer(customer) {
  const baseCustomer = {
    ...defaultCustomer,
    ...customer,
    id: customer.id ?? crypto.randomUUID(),
    status: normalizeStatus(customer.status),
    createdAt: customer.createdAt ?? new Date().toISOString(),
    updatedAt: customer.updatedAt ?? new Date().toISOString(),
    contactStatus:
      customer.contactStatus ?? (customer.email || customer.inquiryUrl ? '取得済' : '未取得'),
    pipelineMemo: customer.pipelineMemo ?? customer.memo ?? '',
  };

  return {
    ...baseCustomer,
    ...calculateCompanyScore(baseCustomer),
  };
}

function readLocalCustomers() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved).map(normalizeCustomer) : [];
  } catch {
    return [];
  }
}

function saveLocalCustomers(customers) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(customers));
}

export function useCustomers() {
  const [customers, setCustomers] = useState(readLocalCustomers);
  const [syncState, setSyncState] = useState(canUseSupabase() ? 'syncing' : 'local');

  useEffect(() => {
    let ignore = false;

    async function syncFromSupabase() {
      if (!canUseSupabase()) {
        setSyncState('local');
        return;
      }

      try {
        const localCustomers = readLocalCustomers();
        const remoteCustomers = (await fetchRemoteCustomers()).map(normalizeCustomer);
        const mergedCustomers = mergeCustomers(localCustomers, remoteCustomers).map(normalizeCustomer);

        if (ignore) {
          return;
        }

        setCustomers(mergedCustomers);
        saveLocalCustomers(mergedCustomers);

        if (localCustomers.length > 0) {
          await upsertRemoteCustomers(mergedCustomers);
        }

        setSyncState('supabase');
      } catch {
        setSyncState('local');
      }
    }

    syncFromSupabase();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    saveLocalCustomers(customers);
  }, [customers]);

  useEffect(() => {
    function handleOnline() {
      if (canUseSupabase()) {
        upsertRemoteCustomers(customers).then(
          () => setSyncState('supabase'),
          () => setSyncState('local'),
        );
      }
    }

    function handleOffline() {
      setSyncState('local');
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [customers]);

  const sortedCustomers = useMemo(
    () =>
      [...customers].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [customers],
  );

  function addCustomer(customer) {
    const normalized = normalizeCustomer({
      ...customer,
      updatedAt: new Date().toISOString(),
    });

    setCustomers((current) => {
      const exists = current.some((item) => {
        if (normalized.placeId && item.placeId === normalized.placeId) {
          return true;
        }

        return (
          item.companyName === normalized.companyName &&
          item.address === normalized.address
        );
      });

      const nextCustomers = exists ? current : [normalized, ...current];
      syncCustomers(nextCustomers, exists ? [] : [normalized]);
      return nextCustomers;
    });
  }

  function updateCustomer(id, updates) {
    setCustomers((current) => {
      const nextCustomers = current.map((customer) =>
        customer.id === id
          ? normalizeCustomer({ ...customer, ...updates, updatedAt: new Date().toISOString() })
          : customer,
      );
      const updatedCustomer = nextCustomers.find((customer) => customer.id === id);
      syncCustomers(nextCustomers, updatedCustomer ? [updatedCustomer] : []);
      return nextCustomers;
    });
  }

  function removeCustomer(id) {
    setCustomers((current) => {
      const nextCustomers = current.filter((customer) => customer.id !== id);
      saveLocalCustomers(nextCustomers);

      if (canUseSupabase()) {
        deleteRemoteCustomer(id).catch(() => setSyncState('local'));
      }

      return nextCustomers;
    });
  }

  function isSaved(companyName, address, placeId = '') {
    return customers.some((customer) => {
      if (placeId && customer.placeId === placeId) {
        return true;
      }

      return customer.companyName === companyName && customer.address === address;
    });
  }

  function syncCustomers(nextCustomers, changedCustomers = []) {
    saveLocalCustomers(nextCustomers);

    if (!canUseSupabase()) {
      setSyncState('local');
      return;
    }

    const targetCustomers = changedCustomers.length > 0 ? changedCustomers : nextCustomers;
    upsertRemoteCustomers(targetCustomers).then(
      () => setSyncState('supabase'),
      () => setSyncState('local'),
    );
  }

  return {
    customers: sortedCustomers,
    addCustomer,
    updateCustomer,
    removeCustomer,
    isSaved,
    syncState,
  };
}
