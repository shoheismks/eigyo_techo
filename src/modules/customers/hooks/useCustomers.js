import { useEffect, useMemo, useRef, useState } from 'react';
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
import { normalizeBusinessCode } from '../../../shared/utils/businessCode.js';

const STORAGE_KEY = 'eigyo-techo-customers';

const STATUS_UNCONTACTED = '\u672a\u63a5\u89e6';
const STATUS_SENT = '\u9001\u4fe1\u6e08';
const STATUS_REPLIED = '\u8fd4\u4fe1\u3042\u308a';
const STATUS_MEETING = '\u5546\u8ac7\u4e2d';
const STATUS_ESTIMATE = '\u898b\u7a4d\u63d0\u51fa';
const STATUS_WON = '\u6210\u7d04';
const STATUS_LOST = '\u5931\u6ce8';
const CONTACT_NONE = '\u672a\u53d6\u5f97';
const CONTACT_DONE = '\u53d6\u5f97\u6e08';
const REPLY_TYPE = '\u8fd4\u4fe1';
const MAIL_TYPE = '\u30e1\u30fc\u30eb';

const VALID_STATUSES = [
  STATUS_UNCONTACTED,
  STATUS_SENT,
  STATUS_REPLIED,
  STATUS_MEETING,
  STATUS_ESTIMATE,
  STATUS_WON,
  STATUS_LOST,
];

const defaultCustomer = {
  userId: '',
  customerCode: '',
  placeId: '',
  corporateNumber: '',
  companyName: '',
  companyKana: '',
  industry: '',
  area: '',
  address: '',
  postalCode: '',
  phone: '',
  fax: '',
  website: '',
  email: '',
  emailType: '',
  inquiryUrl: '',
  status: STATUS_UNCONTACTED,
  tags: [],
  memo: '',
  companyNote: '',
  nextFollowUpDate: '',
  salesOwner: '',
  importanceRank: '',
  referralSource: '',
  prospectRank: '',
  paymentTerms: '',
  closingDay: '',
  deliveryDestination: '',
  billingDestination: '',
  creditMemo: '',
  isDoNotContact: false,
  doNotContactReason: '',
  dealHistories: [],
  proposedProducts: [],
  source: 'Manual',
  contactStatus: CONTACT_NONE,
  lastContactDate: '',
  nextFollowDate: '',
  pipelineMemo: '',
  score: 0,
  rank: 'D',
  customerRank: 'D',
  scoreReasons: [],
  updatedAt: '',
};

const legacyStatusMap = {
  '\u672a\u5bfe\u5fdc': STATUS_UNCONTACTED,
  '\u5bfe\u5fdc\u4e2d': STATUS_MEETING,
  '\u63d0\u6848\u6e08\u307f': STATUS_ESTIMATE,
};

function normalizeStatus(status) {
  const normalized = legacyStatusMap[status] ?? status;
  return VALID_STATUSES.includes(normalized) ? normalized : STATUS_UNCONTACTED;
}

function normalizeContactStatus(status, customer) {
  if ([CONTACT_NONE, CONTACT_DONE, '\u53d6\u5f97\u5931\u6557'].includes(status)) {
    return status;
  }

  return customer.email || customer.inquiryUrl ? CONTACT_DONE : CONTACT_NONE;
}

function normalizeReply(reply = {}, userId = '') {
  return {
    id: reply.id ?? crypto.randomUUID(),
    type: reply.type ?? REPLY_TYPE,
    summary: reply.summary ?? '',
    createdAt: reply.createdAt ?? new Date().toISOString(),
    createdBy: reply.createdBy ?? '',
    userId: reply.userId ?? userId,
    replies: Array.isArray(reply.replies)
      ? reply.replies.map((item) => normalizeReply(item, userId))
      : [],
  };
}

function normalizeDealHistory(history = {}, userId = '') {
  return {
    id: history.id ?? crypto.randomUUID(),
    date: history.date ?? '',
    type: history.type ?? MAIL_TYPE,
    summary: history.summary ?? '',
    nextAction: history.nextAction ?? '',
    createdAt: history.createdAt ?? new Date().toISOString(),
    createdBy: history.createdBy ?? '',
    createdByName: history.createdByName ?? '',
    contactIds: Array.isArray(history.contactIds) ? history.contactIds : [],
    contactNames: Array.isArray(history.contactNames) ? history.contactNames : [],
    companionUsers: Array.isArray(history.companionUsers) ? history.companionUsers : [],
    companionNames: Array.isArray(history.companionNames) ? history.companionNames : [],
    userId: history.userId ?? userId,
    replies: Array.isArray(history.replies)
      ? history.replies.map((reply) => normalizeReply(reply, userId))
      : [],
  };
}

function normalizeCustomer(customer = {}, userId = '') {
  const nextUserId = customer.userId ?? userId;
  const baseCustomer = {
    ...defaultCustomer,
    ...customer,
    id: customer.id ?? crypto.randomUUID(),
    userId: nextUserId,
    customerCode: normalizeBusinessCode(customer.customerCode ?? customer.customer_code ?? ''),
    status: normalizeStatus(customer.status),
    createdAt: customer.createdAt ?? new Date().toISOString(),
    updatedAt: customer.updatedAt ?? new Date().toISOString(),
    tags: Array.isArray(customer.tags) ? customer.tags : [],
    memo: customer.memo ?? '',
    companyNote: customer.companyNote ?? '',
    nextFollowUpDate: customer.nextFollowUpDate ?? customer.nextFollowDate ?? '',
    nextFollowDate: customer.nextFollowDate ?? customer.nextFollowUpDate ?? '',
    isDoNotContact: Boolean(customer.isDoNotContact),
    doNotContactReason: customer.doNotContactReason ?? '',
    dealHistories: Array.isArray(customer.dealHistories)
      ? customer.dealHistories.map((history) => normalizeDealHistory(history, nextUserId))
      : [],
    proposedProducts: Array.isArray(customer.proposedProducts) ? customer.proposedProducts : [],
    pipelineMemo: customer.pipelineMemo ?? customer.memo ?? '',
  };
  baseCustomer.contactStatus = normalizeContactStatus(customer.contactStatus, baseCustomer);

  return {
    ...baseCustomer,
    ...calculateCompanyScore(baseCustomer),
  };
}

function readLocalCustomers(userId = '') {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved
      ? JSON.parse(saved)
          .map((customer) => normalizeCustomer(customer, userId))
          .filter((customer) => !userId || customer.userId === userId)
      : [];
  } catch {
    return [];
  }
}

function saveLocalCustomers(customers) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(customers));
}

function toSyncError(error) {
  const message = error?.message || '';
  if (message.includes('Could not find the table')) {
    return 'Supabase customers table was not found. Please run the SQL setup.';
  }

  return 'Supabase sync failed. LocalStorage fallback is active.';
}

function getLocalReason(fallback = '') {
  if (!hasCloudConfig()) {
    return 'Supabase env vars are not set. LocalStorage fallback is active.';
  }

  if (!isOnline()) {
    return 'Offline. LocalStorage fallback is active.';
  }

  return fallback;
}

function isOnline() {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

export function useCustomers(userId = '') {
  const [customers, setCustomers] = useState(() =>
    canUseSupabase() ? [] : readLocalCustomers(userId),
  );
  const [syncState, setSyncState] = useState(canUseSupabase() ? 'syncing' : 'local');
  const [syncError, setSyncError] = useState(getLocalReason);
  const writeSequenceRef = useRef(0);

  useEffect(() => {
    let ignore = false;

    async function syncFromSupabase() {
      if (!canUseSupabase()) {
        setCustomers(readLocalCustomers(userId));
        setSyncState('local');
        setSyncError(getLocalReason());
        return;
      }

      try {
        setSyncState('syncing');
        setSyncError('');
        const localCustomers = readLocalCustomers(userId);
        const remoteCustomers = (await fetchRemoteCustomers(userId)).map((customer) =>
          normalizeCustomer(customer, userId),
        );
        const mergedCustomers = mergeCustomers(localCustomers, remoteCustomers).map((customer) =>
          normalizeCustomer(customer, userId),
        );

        if (localCustomers.length > 0) {
          await upsertRemoteCustomers(mergedCustomers);
        }

        const refreshedCustomers = (await fetchRemoteCustomers(userId)).map((customer) =>
          normalizeCustomer(customer, userId),
        );
        const nextCustomers = refreshedCustomers.length > 0 ? refreshedCustomers : mergedCustomers;

        if (ignore) {
          return;
        }

        setCustomers(nextCustomers);
        saveLocalCustomers(nextCustomers);
        setSyncState('supabase');
      } catch (error) {
        setCustomers(readLocalCustomers(userId));
        setSyncError(toSyncError(error));
        setSyncState('local');
      }
    }

    syncFromSupabase();

    return () => {
      ignore = true;
    };
  }, [userId]);

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
  }, []);

  const sortedCustomers = useMemo(
    () =>
      [...customers].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [customers],
  );

  async function reloadFromCloud(writeSequence = null) {
    if (!canUseSupabase()) {
      setCustomers(readLocalCustomers(userId));
      setSyncState('local');
      setSyncError(getLocalReason());
      return;
    }

    try {
      setSyncState('syncing');
      setSyncError('');
      const remoteCustomers = (await fetchRemoteCustomers(userId)).map((customer) =>
        normalizeCustomer(customer, userId),
      );

      if (writeSequence !== null && writeSequence !== writeSequenceRef.current) {
        return;
      }

      setCustomers(remoteCustomers);
      saveLocalCustomers(remoteCustomers);
      setSyncState('supabase');
    } catch (error) {
      if (writeSequence !== null && writeSequence !== writeSequenceRef.current) {
        return;
      }

      setCustomers(readLocalCustomers(userId));
      setSyncError(toSyncError(error));
      setSyncState('local');
    }
  }

  function syncCustomers(nextCustomers, changedCustomer = null) {
    saveLocalCustomers(nextCustomers);

    if (!canUseSupabase()) {
      setSyncState('local');
      setSyncError(
        hasCloudConfig()
          ? getLocalReason('Supabase unavailable. Saved to LocalStorage.')
          : getLocalReason(),
      );
      return;
    }

    const writeSequence = ++writeSequenceRef.current;
    const writePromise = changedCustomer
      ? upsertRemoteCustomer(changedCustomer)
      : upsertRemoteCustomers(nextCustomers);

    setSyncState('syncing');
    setSyncError('');
    writePromise
      .then(() => reloadFromCloud(writeSequence))
      .catch((error) => {
        if (writeSequence !== writeSequenceRef.current) {
          return;
        }

        setSyncError(toSyncError(error));
        setSyncState('local');
      });
  }

  function addCustomer(customer) {
    const normalized = normalizeCustomer({
      ...customer,
      userId,
      updatedAt: new Date().toISOString(),
    }, userId);

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
        reason: 'Company name is empty.',
      };
    }

    const exists = customers.some(
      (customer) =>
        customer.companyName.trim().toLowerCase() === normalizedCompanyName.toLowerCase(),
    );

    if (exists) {
      return {
        ok: false,
        reason: 'Already added to Eigyo Techo.',
      };
    }

    const importedCustomer = normalizeCustomer({
      id: crypto.randomUUID(),
      userId,
      companyName: normalizedCompanyName,
      status: STATUS_UNCONTACTED,
      source: 'chrome-extension',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, userId);

    setCustomers((current) => {
      const nextCustomers = [importedCustomer, ...current];
      syncCustomers(nextCustomers, importedCustomer);
      return nextCustomers;
    });

    return {
      ok: true,
      reason: 'Added to Eigyo Techo.',
      customerId: importedCustomer.id,
    };
  }

  function updateCustomer(id, updates) {
    setCustomers((current) => {
      const nextCustomers = current.map((customer) =>
        customer.id === id
          ? normalizeCustomer({ ...customer, ...updates, userId, updatedAt: new Date().toISOString() }, userId)
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
