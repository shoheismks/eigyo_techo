import { useEffect, useMemo, useRef, useState } from 'react';
import { calculateCompanyScore } from '../services/scoringService.js';
import {
  canUseSupabase,
  deleteRemoteCustomer,
  fetchRemoteCustomers,
  hasCloudConfig,
  upsertRemoteCustomer,
} from '../services/customerSyncService.js';
import { normalizeOfficeFields } from '../services/customerOfficeService.js';
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
  defaultIssuerId: '',
  parentCustomerId: '',
  officeType: 'head_office',
  branchName: '',
  branchCode: '',
  isHeadOffice: true,
  billingCustomerId: '',
  shippingCustomerId: '',
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
  const officeFields = normalizeOfficeFields(customer);
  const baseCustomer = {
    ...defaultCustomer,
    ...customer,
    id: customer.id ?? crypto.randomUUID(),
    userId: nextUserId,
    customerCode: normalizeBusinessCode(customer.customerCode ?? customer.customer_code ?? ''),
    ...officeFields,
    status: normalizeStatus(customer.status),
    createdAt: customer.createdAt ?? new Date().toISOString(),
    updatedAt: customer.updatedAt ?? new Date().toISOString(),
    tags: Array.isArray(customer.tags) ? customer.tags : [],
    memo: customer.memo ?? '',
    companyNote: customer.companyNote ?? '',
    defaultIssuerId: customer.defaultIssuerId ?? customer.default_issuer_id ?? '',
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

function hasLegacyLocalCustomers() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return false;
    }

    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) && parsed.length > 0;
  } catch {
    return true;
  }
}

function legacyLocalDataMessage() {
  return '\u65e7\u30ed\u30fc\u30ab\u30eb\u9867\u5ba2\u30c7\u30fc\u30bf\u304c\u3042\u308a\u307e\u3059\u3002\u5b89\u5168\u306e\u305f\u3081\u81ea\u52d5\u79fb\u884c\u30fb\u81ea\u52d5\u524a\u9664\u306f\u884c\u3044\u307e\u305b\u3093\u3002';
}

function toSyncError(error) {
  const message = error?.message || '';
  if (message.includes('Could not find the table')) {
    return 'Supabase customers table was not found. Please run the SQL setup.';
  }

  return message || 'Supabase customers sync failed.';
}

function getUnavailableReason(fallback = '') {
  if (!hasCloudConfig()) {
    return 'Supabase env vars are not set. Customer data cannot be saved.';
  }

  if (!isOnline()) {
    return 'Offline. Customer data cannot be saved.';
  }

  return fallback;
}

function isOnline() {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

export function useCustomers(userId = '') {
  const [customers, setCustomers] = useState([]);
  const [syncState, setSyncState] = useState(canUseSupabase() ? 'syncing' : 'error');
  const [syncError, setSyncError] = useState(() => getUnavailableReason());
  const [legacyLocalDataWarning, setLegacyLocalDataWarning] = useState('');
  const writeSequenceRef = useRef(0);

  useEffect(() => {
    setLegacyLocalDataWarning(hasLegacyLocalCustomers() ? legacyLocalDataMessage() : '');
  }, []);

  useEffect(() => {
    let ignore = false;

    async function syncFromSupabase() {
      if (!canUseSupabase()) {
        setCustomers([]);
        setSyncState('error');
        setSyncError(getUnavailableReason());
        return;
      }

      try {
        setSyncState('syncing');
        setSyncError('');
        const remoteCustomers = (await fetchRemoteCustomers(userId)).map((customer) =>
          normalizeCustomer(customer, userId),
        );

        if (ignore) {
          return;
        }

        setCustomers(remoteCustomers);
        setSyncState('supabase');
      } catch (error) {
        if (ignore) {
          return;
        }

        setCustomers([]);
        setSyncError(toSyncError(error));
        setSyncState('error');
      }
    }

    syncFromSupabase();

    return () => {
      ignore = true;
    };
  }, [userId]);

  useEffect(() => {
    function handleOnline() {
      if (canUseSupabase()) {
        reloadFromCloud();
      }
    }

    function handleOffline() {
      setSyncState('error');
      setSyncError(getUnavailableReason());
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
      setCustomers([]);
      setSyncState('error');
      setSyncError(getUnavailableReason());
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
      setSyncState('supabase');
    } catch (error) {
      if (writeSequence !== null && writeSequence !== writeSequenceRef.current) {
        return;
      }

      setSyncError(toSyncError(error));
      setSyncState('error');
      throw error;
    }
  }

  async function persistCustomer(changedCustomer) {
    if (!canUseSupabase()) {
      const message = getUnavailableReason();
      setSyncState('error');
      setSyncError(message);
      throw new Error(message);
    }

    const writeSequence = ++writeSequenceRef.current;
    setSyncState('syncing');
    setSyncError('');

    try {
      await upsertRemoteCustomer(changedCustomer);
      await reloadFromCloud(writeSequence);
    } catch (error) {
      if (writeSequence === writeSequenceRef.current) {
        setSyncError(toSyncError(error));
        setSyncState('error');
      }

      throw error;
    }
  }

  async function addCustomer(customer) {
    const normalized = normalizeCustomer({
      ...customer,
      userId,
      updatedAt: new Date().toISOString(),
    }, userId);

    const exists = customers.some((item) => {
      if (normalized.placeId && item.placeId === normalized.placeId) {
        return true;
      }

      return (
        item.companyName === normalized.companyName &&
        item.address === normalized.address
      );
    });

    if (exists) {
      return normalized;
    }

    try {
      await persistCustomer(normalized);
      return normalized;
    } catch {
      return null;
    }
  }

  async function importCompanyName(companyName) {
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

    try {
      await persistCustomer(importedCustomer);
    } catch (error) {
      return {
        ok: false,
        reason: toSyncError(error),
      };
    }

    return {
      ok: true,
      reason: 'Added to Eigyo Techo.',
      customerId: importedCustomer.id,
    };
  }

  async function updateCustomer(id, updates) {
    const currentCustomer = customers.find((customer) => customer.id === id);

    if (!currentCustomer) {
      const message = 'Customer data was not found.';
      setSyncError(message);
      return null;
    }

    const updatedCustomer = normalizeCustomer({
      ...currentCustomer,
      ...updates,
      userId,
      updatedAt: new Date().toISOString(),
    }, userId);

    try {
      await persistCustomer(updatedCustomer);
      return updatedCustomer;
    } catch {
      return null;
    }
  }

  async function removeCustomer(id) {
    const hasChildren = customers.some((customer) => customer.parentCustomerId === id);

    if (hasChildren) {
      const message = 'Cannot delete a head office while branch offices are linked. Remove branch links first.';
      setSyncError(message);
      return false;
    }

    if (!canUseSupabase()) {
      const message = getUnavailableReason();
      setSyncState('error');
      setSyncError(message);
      return false;
    }

    const writeSequence = ++writeSequenceRef.current;
    setSyncState('syncing');
    setSyncError('');

    try {
      await deleteRemoteCustomer(id);
      await reloadFromCloud(writeSequence);
    } catch (error) {
      if (writeSequence === writeSequenceRef.current) {
        setSyncError(toSyncError(error));
        setSyncState('error');
      }

      return false;
    }

    return true;
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
    legacyLocalDataWarning,
  };
}
