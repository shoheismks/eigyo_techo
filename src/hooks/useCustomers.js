import { useEffect, useMemo, useState } from 'react';
import { calculateCompanyScore } from '../services/scoringService.js';
import {
  canUseSupabase,
  deleteRemoteCustomer,
  fetchRemoteCustomers,
  hasCloudConfig,
  mergeCustomers,
  upsertRemoteCustomer,
  upsertRemoteCustomers,
} from '../services/customerSyncService.js';

const STORAGE_KEY = 'eigyo-techo-customers';

const defaultCustomer = {
  placeId: '',
  corporateNumber: '',
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
  tags: [],
  memo: '',
  nextFollowUpDate: '',
  isDoNotContact: false,
  doNotContactReason: '',
  dealHistories: [],
  proposedProducts: [],
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
    tags: Array.isArray(customer.tags) ? customer.tags : [],
    nextFollowUpDate: customer.nextFollowUpDate ?? customer.nextFollowDate ?? '',
    nextFollowDate: customer.nextFollowDate ?? customer.nextFollowUpDate ?? '',
    isDoNotContact: Boolean(customer.isDoNotContact),
    doNotContactReason: customer.doNotContactReason ?? '',
    dealHistories: Array.isArray(customer.dealHistories)
      ? customer.dealHistories.map(normalizeDealHistory)
      : [],
    proposedProducts: Array.isArray(customer.proposedProducts) ? customer.proposedProducts : [],
    contactStatus:
      customer.contactStatus ?? (customer.email || customer.inquiryUrl ? '取得済' : '未取得'),
    pipelineMemo: customer.pipelineMemo ?? customer.memo ?? '',
  };

  return {
    ...baseCustomer,
    ...calculateCompanyScore(baseCustomer),
  };
}

function normalizeDealHistory(history) {
  return {
    id: history.id ?? crypto.randomUUID(),
    date: history.date ?? '',
    type: history.type ?? 'メール',
    summary: history.summary ?? '',
    nextAction: history.nextAction ?? '',
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
  const [customers, setCustomers] = useState(() =>
    canUseSupabase() ? [] : readLocalCustomers(),
  );
  const [syncState, setSyncState] = useState(canUseSupabase() ? 'syncing' : 'local');
  const [syncError, setSyncError] = useState(getLocalReason);

  useEffect(() => {
    let ignore = false;

    async function syncFromSupabase() {
      if (!canUseSupabase()) {
        setCustomers(readLocalCustomers());
        setSyncState('local');
        setSyncError(getLocalReason());
        return;
      }

      try {
        setSyncState('syncing');
        setSyncError('');
        const localCustomers = readLocalCustomers();
        const remoteCustomers = (await fetchRemoteCustomers()).map(normalizeCustomer);
        const mergedCustomers = mergeCustomers(localCustomers, remoteCustomers).map(normalizeCustomer);

        if (localCustomers.length > 0) {
          await upsertRemoteCustomers(mergedCustomers);
        }

        const refreshedCustomers = (await fetchRemoteCustomers()).map(normalizeCustomer);
        const nextCustomers = refreshedCustomers.length > 0 ? refreshedCustomers : mergedCustomers;

        if (ignore) {
          return;
        }

        setCustomers(nextCustomers);
        saveLocalCustomers(nextCustomers);
        setSyncState('supabase');
      } catch (error) {
        setCustomers(readLocalCustomers());
        setSyncError(toSyncError(error));
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
        reloadFromCloud();
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

  async function reloadFromCloud() {
    if (!canUseSupabase()) {
      setCustomers(readLocalCustomers());
      setSyncState(hasCloudConfig() ? 'local' : 'local');
      setSyncError(getLocalReason());
      return;
    }

    try {
      setSyncState('syncing');
      setSyncError('');
      const remoteCustomers = (await fetchRemoteCustomers()).map(normalizeCustomer);
      setCustomers(remoteCustomers);
      saveLocalCustomers(remoteCustomers);
      setSyncState('supabase');
    } catch (error) {
      setCustomers(readLocalCustomers());
      setSyncError(toSyncError(error));
      setSyncState('local');
    }
  }

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
      syncCustomers(nextCustomers, exists ? null : normalized);
      return nextCustomers;
    });
  }

  function importCompanyName(companyName) {
    const normalizedCompanyName = companyName.trim().replace(/\s+/g, ' ');

    if (!normalizedCompanyName) {
      return {
        ok: false,
        reason: '会社名が空です',
      };
    }

    const exists = customers.some(
      (customer) =>
        customer.companyName.trim().toLowerCase() === normalizedCompanyName.toLowerCase(),
    );

    if (exists) {
      return {
        ok: false,
        reason: '既に営業手帳に追加されています',
      };
    }

    const importedCustomer = normalizeCustomer({
      id: crypto.randomUUID(),
      companyName: normalizedCompanyName,
      status: '未接触',
      source: 'chrome-extension',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    setCustomers((current) => {
      const nextCustomers = [importedCustomer, ...current];
      syncCustomers(nextCustomers, importedCustomer);
      return nextCustomers;
    });

    return {
      ok: true,
      reason: '営業手帳に追加しました',
      customerId: importedCustomer.id,
    };
  }

  function updateCustomer(id, updates) {
    setCustomers((current) => {
      const nextCustomers = current.map((customer) =>
        customer.id === id
          ? normalizeCustomer({ ...customer, ...updates, updatedAt: new Date().toISOString() })
          : customer,
      );
      const updatedCustomer = nextCustomers.find((customer) => customer.id === id);
      syncCustomers(nextCustomers, updatedCustomer);
      return nextCustomers;
    });
  }

  function removeCustomer(id) {
    setCustomers((current) => {
      const nextCustomers = current.filter((customer) => customer.id !== id);
      saveLocalCustomers(nextCustomers);

      if (canUseSupabase()) {
        deleteRemoteCustomer(id)
          .then(reloadFromCloud)
          .catch((error) => {
            setSyncError(toSyncError(error));
            setSyncState('local');
          });
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

  function syncCustomers(nextCustomers, changedCustomer = null) {
    saveLocalCustomers(nextCustomers);

    if (!canUseSupabase()) {
      setSyncState('local');
      if (hasCloudConfig()) {
        setSyncError(getLocalReason('Supabaseに接続できません。LocalStorageに保存しました。'));
      } else {
        setSyncError(getLocalReason());
      }
      return;
    }

    const writePromise = changedCustomer
      ? upsertRemoteCustomer(changedCustomer)
      : upsertRemoteCustomers(nextCustomers);

    setSyncState('syncing');
    setSyncError('');
    writePromise
      .then(reloadFromCloud)
      .catch((error) => {
        setSyncError(toSyncError(error));
        setSyncState('local');
      });
  }

  return {
    customers: sortedCustomers,
    addCustomer,
    importCompanyName,
    updateCustomer,
    removeCustomer,
    isSaved,
    reloadFromCloud,
    syncError,
    syncState,
  };
}

function toSyncError(error) {
  const message = error?.message || '';
  if (message.includes('Could not find the table')) {
    return 'Supabaseのcustomersテーブルが見つかりません。SQLを実行してください。';
  }

  return 'Supabase接続に失敗しました。LocalStorageで動作しています。';
}

function getLocalReason(fallback = '') {
  if (!hasCloudConfig()) {
    return 'Supabase環境変数が未設定です。LocalStorageで動作しています。';
  }

  if (!navigator.onLine) {
    return 'オフラインのためLocalStorageで動作しています。';
  }

  return fallback;
}
