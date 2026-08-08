import { useEffect, useMemo, useRef, useState } from 'react';
import {
  canUseCloud,
  deleteRecord,
  fetchRecords,
  upsertRecords,
} from '../services/recordSyncService.js';
import { getTableConfig } from '../config/TABLE_CONFIG.js';

const CLOUD_REQUIRED_MESSAGE = 'Supabase is required for business data. Check the network and Supabase settings.';
const LOCAL_CACHE_MESSAGE = 'Showing an explicitly allowed local cache because Supabase is unavailable.';
const LOCAL_CACHE_SAVE_MESSAGE = 'Saved to an explicitly allowed local cache because Supabase is unavailable.';
const LEGACY_LOCAL_WARNING = 'Old LocalStorage business data was detected. It will not be migrated or deleted automatically.';

function snakeToCamel(value) {
  return String(value || '').replace(/_([a-z])/g, (_, char) => char.toUpperCase());
}

function recordSortTime(record, orderColumn) {
  const camelKey = snakeToCamel(orderColumn);
  return new Date(record[camelKey] ?? record[orderColumn] ?? record.updatedAt ?? record.updated_at ?? record.createdAt ?? record.created_at ?? 0).getTime();
}

function localStorageAvailable() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function createRecordHook({ tableName, storageKey, normalize, toRow, fromRow, orderColumn = '' }) {
  const tableConfig = getTableConfig(tableName);
  const resolvedOrderColumn = orderColumn || tableConfig.orderColumn || 'updated_at';
  const allowLocalPersistence = tableConfig.localPersistence === true;
  const returnWritePromise = tableConfig.returnWritePromise === true;

  function readLocalSnapshot(userId = '') {
    if (!localStorageAvailable() || !storageKey) {
      return [];
    }

    try {
      const saved = window.localStorage.getItem(storageKey);
      return saved
        ? JSON.parse(saved)
            .map((record) => normalize(record, userId))
            .filter((record) => !userId || record.userId === userId)
        : [];
    } catch {
      return [];
    }
  }

  function writeLocalCache(records) {
    if (!allowLocalPersistence || !localStorageAvailable() || !storageKey) {
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(records.map((record) => normalize(record))));
  }

  function hasLegacyLocalRecords() {
    if (allowLocalPersistence || !localStorageAvailable() || !storageKey) {
      return false;
    }

    try {
      const saved = window.localStorage.getItem(storageKey);
      if (!saved) {
        return false;
      }

      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) && parsed.length > 0;
    } catch {
      return Boolean(window.localStorage.getItem(storageKey));
    }
  }

  return function useRecords(userId = '') {
    const [records, setRecords] = useState(() => (allowLocalPersistence ? readLocalSnapshot(userId) : []));
    const [syncState, setSyncState] = useState(canUseCloud() ? 'syncing' : allowLocalPersistence ? 'local' : 'error');
    const [syncError, setSyncError] = useState(() => (canUseCloud() || allowLocalPersistence ? '' : CLOUD_REQUIRED_MESSAGE));
    const [legacyLocalDataWarning, setLegacyLocalDataWarning] = useState('');
    const writeSequenceRef = useRef(0);

    async function reload(writeSequence = null) {
      if (!canUseCloud()) {
        if (allowLocalPersistence) {
          const localRecords = readLocalSnapshot(userId);
          setRecords(localRecords);
          setSyncState('local');
          setSyncError(LOCAL_CACHE_MESSAGE);
          return localRecords;
        }

        setRecords([]);
        setSyncState('error');
        setSyncError(CLOUD_REQUIRED_MESSAGE);
        return [];
      }

      try {
        setSyncState('syncing');
        setSyncError('');
        const remoteRecords = await fetchRecords(tableName, userId, fromRow, resolvedOrderColumn);

        if (writeSequence !== null && writeSequence !== writeSequenceRef.current) {
          return remoteRecords;
        }

        const nextRecords = remoteRecords.map((record) => normalize(record, userId));
        setRecords(nextRecords);
        writeLocalCache(nextRecords);
        setSyncState('supabase');
        setSyncError('');
        return nextRecords;
      } catch (error) {
        if (writeSequence !== null && writeSequence !== writeSequenceRef.current) {
          return [];
        }

        if (allowLocalPersistence) {
          const localRecords = readLocalSnapshot(userId);
          setRecords(localRecords);
          setSyncState('local');
          setSyncError(error.message || LOCAL_CACHE_MESSAGE);
          return localRecords;
        }

        setRecords([]);
        setSyncState('error');
        setSyncError(error.message || CLOUD_REQUIRED_MESSAGE);
        return [];
      }
    }

    useEffect(() => {
      setLegacyLocalDataWarning(hasLegacyLocalRecords() ? LEGACY_LOCAL_WARNING : '');
      reload();
    }, [userId]);

    const sortedRecords = useMemo(
      () =>
        [...records].sort(
          (a, b) => recordSortTime(b, resolvedOrderColumn) - recordSortTime(a, resolvedOrderColumn),
        ),
      [records, resolvedOrderColumn],
    );

    async function persistRecords(changedRecords) {
      if (allowLocalPersistence && !canUseCloud()) {
        const nextRecords = changedRecords.map((record) => normalize(record, userId));
        setRecords((current) => {
          const byId = new Map(current.map((record) => [record.id, record]));
          nextRecords.forEach((record) => byId.set(record.id, record));
          const mergedRecords = [...byId.values()];
          writeLocalCache(mergedRecords);
          return mergedRecords;
        });
        setSyncState('local');
        setSyncError(LOCAL_CACHE_SAVE_MESSAGE);
        return;
      }

      if (!canUseCloud()) {
        setSyncState('error');
        setSyncError(CLOUD_REQUIRED_MESSAGE);
        throw new Error(CLOUD_REQUIRED_MESSAGE);
      }

      const writeSequence = ++writeSequenceRef.current;
      setSyncState('syncing');
      setSyncError('');

      try {
        await upsertRecords(tableName, changedRecords, toRow);
        await reload(writeSequence);
      } catch (error) {
        if (writeSequence === writeSequenceRef.current) {
          setSyncState('error');
          setSyncError(error.message || CLOUD_REQUIRED_MESSAGE);
        }
        throw error;
      }
    }

    function addRecord(record) {
      const now = new Date().toISOString();
      const normalizedRecord = normalize({
        ...record,
        id: record.id ?? crypto.randomUUID(),
        userId,
        createdAt: now,
        updatedAt: now,
      }, userId);

      const writePromise = persistRecords([normalizedRecord]).then(() => normalizedRecord.id);
      if (returnWritePromise) {
        return writePromise;
      }

      writePromise.catch(() => {});
      return normalizedRecord.id;
    }

    function updateRecord(id, updates) {
      const currentRecord = records.find((record) => record.id === id);
      if (!currentRecord) {
        const error = new Error('Record was not found.');
        setSyncError(error.message);
        return Promise.reject(error);
      }

      const changedRecord = normalize({
        ...currentRecord,
        ...updates,
        userId,
        updatedAt: new Date().toISOString(),
      }, userId);

      return persistRecords([changedRecord]);
    }

    async function removeRecord(id) {
      if (allowLocalPersistence && !canUseCloud()) {
        setRecords((current) => {
          const nextRecords = current.filter((record) => record.id !== id);
          writeLocalCache(nextRecords);
          return nextRecords;
        });
        setSyncState('local');
        setSyncError(LOCAL_CACHE_SAVE_MESSAGE);
        return true;
      }

      if (!canUseCloud()) {
        setSyncState('error');
        setSyncError(CLOUD_REQUIRED_MESSAGE);
        return false;
      }

      const writeSequence = ++writeSequenceRef.current;
      setSyncState('syncing');
      setSyncError('');

      try {
        await deleteRecord(tableName, id, userId);
        await reload(writeSequence);
        return true;
      } catch (error) {
        if (writeSequence === writeSequenceRef.current) {
          setSyncState('error');
          setSyncError(error.message || CLOUD_REQUIRED_MESSAGE);
        }
        return false;
      }
    }

    return {
      records: sortedRecords,
      addRecord,
      updateRecord,
      removeRecord,
      reload,
      syncState,
      syncError,
      legacyLocalDataWarning,
    };
  };
}
