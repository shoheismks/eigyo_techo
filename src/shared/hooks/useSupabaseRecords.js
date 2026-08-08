import { useEffect, useMemo, useRef, useState } from 'react';
import {
  canUseCloud,
  deleteRecord,
  fetchRecords,
  getLocalSyncReason,
  mergeByUpdatedAt,
  upsertRecords,
} from '../services/recordSyncService.js';
import { getTableConfig } from '../config/TABLE_CONFIG.js';

function snakeToCamel(value) {
  return String(value || '').replace(/_([a-z])/g, (_, char) => char.toUpperCase());
}

function recordSortTime(record, orderColumn) {
  const camelKey = snakeToCamel(orderColumn);
  return new Date(record[camelKey] ?? record[orderColumn] ?? record.updatedAt ?? record.updated_at ?? record.createdAt ?? record.created_at ?? 0).getTime();
}

export function createRecordHook({ tableName, storageKey, normalize, toRow, fromRow, orderColumn = '' }) {
  const tableConfig = getTableConfig(tableName);
  const resolvedOrderColumn = orderColumn || tableConfig.orderColumn || 'updated_at';
  const disableLocalPersistence = tableConfig.disableLocalPersistence === true;

  function readLocal(userId = '') {
    if (disableLocalPersistence) {
      return [];
    }

    try {
      const saved = localStorage.getItem(storageKey);
      return saved
        ? JSON.parse(saved)
            .map((record) => normalize(record, userId))
            .filter((record) => !userId || record.userId === userId)
        : [];
    } catch {
      return [];
    }
  }

  function saveLocal(records) {
    if (disableLocalPersistence) {
      return;
    }

    localStorage.setItem(storageKey, JSON.stringify(records.map((record) => normalize(record))));
  }

  function hasLegacyLocalRecords() {
    if (!disableLocalPersistence) {
      return false;
    }

    try {
      const saved = localStorage.getItem(storageKey);
      if (!saved) {
        return false;
      }

      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) && parsed.length > 0;
    } catch {
      return true;
    }
  }

  function unavailableMessage() {
    return 'Supabase is unavailable. Data cannot be saved.';
  }

  return function useRecords(userId = '') {
    const [records, setRecords] = useState(() =>
      canUseCloud() || disableLocalPersistence ? [] : readLocal(userId),
    );
    const [syncState, setSyncState] = useState(canUseCloud() ? 'syncing' : disableLocalPersistence ? 'error' : 'local');
    const [syncError, setSyncError] = useState('');
    const [legacyLocalDataWarning, setLegacyLocalDataWarning] = useState('');
    const writeSequenceRef = useRef(0);

    async function reload(writeSequence = null) {
      if (!canUseCloud()) {
        if (disableLocalPersistence) {
          setRecords([]);
          setSyncState('error');
          setSyncError(unavailableMessage());
          return;
        }

        setRecords(readLocal(userId));
        setSyncState('local');
        setSyncError(getLocalSyncReason());
        return;
      }

      try {
        setSyncState('syncing');
        const remoteRecords = await fetchRecords(tableName, userId, fromRow, resolvedOrderColumn);

        if (writeSequence !== null && writeSequence !== writeSequenceRef.current) {
          return;
        }

        setRecords(remoteRecords.map((record) => normalize(record, userId)));
        saveLocal(remoteRecords);
        setSyncState('supabase');
        setSyncError('');
      } catch (error) {
        if (writeSequence !== null && writeSequence !== writeSequenceRef.current) {
          return;
        }

        if (disableLocalPersistence) {
          setSyncState('error');
          setSyncError(error.message || unavailableMessage());
          throw error;
        }

        setRecords(readLocal(userId));
        setSyncState('local');
        setSyncError(getLocalSyncReason(error.message));
      }
    }

    useEffect(() => {
      let ignore = false;
      setLegacyLocalDataWarning(
        hasLegacyLocalRecords()
          ? '\u65e7\u30ed\u30fc\u30ab\u30eb\u30c7\u30fc\u30bf\u304c\u3042\u308a\u307e\u3059\u3002\u5b89\u5168\u306e\u305f\u3081\u81ea\u52d5\u79fb\u884c\u30fb\u81ea\u52d5\u524a\u9664\u306f\u884c\u3044\u307e\u305b\u3093\u3002'
          : '',
      );

      async function sync() {
        if (!canUseCloud()) {
          if (disableLocalPersistence) {
            setRecords([]);
            setSyncState('error');
            setSyncError(unavailableMessage());
            return;
          }

          setRecords(readLocal(userId));
          setSyncState('local');
          setSyncError(getLocalSyncReason());
          return;
        }

        try {
          setSyncState('syncing');
          setSyncError('');
          const remoteRecords = await fetchRecords(tableName, userId, fromRow, resolvedOrderColumn);
          const localRecords = disableLocalPersistence ? [] : readLocal(userId);
          let nextRecords = remoteRecords.map((record) => normalize(record, userId));

          if (!disableLocalPersistence && localRecords.length > 0) {
            const mergedRecords = mergeByUpdatedAt(localRecords, remoteRecords)
              .map((record) => normalize(record, userId));
            await upsertRecords(tableName, mergedRecords, toRow);
            const refreshedRecords = await fetchRecords(tableName, userId, fromRow, resolvedOrderColumn);
            nextRecords = refreshedRecords.length > 0 ? refreshedRecords : mergedRecords;
          }

          if (ignore) {
            return;
          }

          setRecords(nextRecords);
          saveLocal(nextRecords);
          setSyncState('supabase');
        } catch (error) {
          if (ignore) {
            return;
          }

          if (disableLocalPersistence) {
            setRecords([]);
            setSyncState('error');
            setSyncError(error.message || unavailableMessage());
            return;
          }

          setRecords(readLocal(userId));
          setSyncState('local');
          setSyncError(getLocalSyncReason(error.message));
        }
      }

      sync();

      return () => {
        ignore = true;
      };
    }, [userId]);

    const sortedRecords = useMemo(
      () =>
        [...records].sort(
          (a, b) => recordSortTime(b, resolvedOrderColumn) - recordSortTime(a, resolvedOrderColumn),
        ),
      [records, resolvedOrderColumn],
    );

    async function syncRecords(nextRecords, changedRecord = null) {
      saveLocal(nextRecords);

      if (!canUseCloud()) {
        if (disableLocalPersistence) {
          setSyncState('error');
          setSyncError(unavailableMessage());
          throw new Error(unavailableMessage());
        }

        setSyncState('local');
        setSyncError(getLocalSyncReason());
        return;
      }

      const writeSequence = ++writeSequenceRef.current;
      setSyncState('syncing');
      const writePromise = changedRecord
        ? upsertRecords(tableName, [changedRecord], toRow)
        : upsertRecords(tableName, nextRecords, toRow);

      try {
        await writePromise;
        await reload(writeSequence);
      } catch (error) {
        if (writeSequence !== writeSequenceRef.current) {
          return;
        }

        setSyncState(disableLocalPersistence ? 'error' : 'local');
        setSyncError(disableLocalPersistence ? error.message || unavailableMessage() : getLocalSyncReason(error.message));
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

      if (disableLocalPersistence) {
        return syncRecords([normalizedRecord, ...records], normalizedRecord)
          .then(() => normalizedRecord.id);
      }

      setRecords((current) => {
        const nextRecords = [normalizedRecord, ...current];
        syncRecords(nextRecords, normalizedRecord);
        return nextRecords;
      });

      return normalizedRecord.id;
    }

    function updateRecord(id, updates) {
      if (disableLocalPersistence) {
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
        const nextRecords = records.map((record) => (record.id === id ? changedRecord : record));
        return syncRecords(nextRecords, changedRecord);
      }

      setRecords((current) => {
        const nextRecords = current.map((record) =>
          record.id === id
            ? normalize({ ...record, ...updates, userId, updatedAt: new Date().toISOString() }, userId)
            : record,
        );
        const changedRecord = nextRecords.find((record) => record.id === id);
        syncRecords(nextRecords, changedRecord);
        return nextRecords;
      });
    }

    function removeRecord(id) {
      if (disableLocalPersistence) {
        if (!canUseCloud()) {
          setSyncState('error');
          setSyncError(unavailableMessage());
          return Promise.resolve(false);
        }

        const writeSequence = ++writeSequenceRef.current;
        setSyncState('syncing');
        setSyncError('');
        return deleteRecord(tableName, id, userId)
          .then(() => reload(writeSequence))
          .then(() => true)
          .catch((error) => {
            if (writeSequence === writeSequenceRef.current) {
              setSyncState('error');
              setSyncError(error.message || unavailableMessage());
            }
            return false;
          });
      }

      setRecords((current) => {
        const nextRecords = current.filter((record) => record.id !== id);
        saveLocal(nextRecords);

        if (canUseCloud()) {
          deleteRecord(tableName, id, userId)
            .then(reload)
            .catch((error) => {
              setSyncState('local');
              setSyncError(getLocalSyncReason(error.message));
            });
        }

        return nextRecords;
      });
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
