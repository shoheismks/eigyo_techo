import { useEffect, useMemo, useRef, useState } from 'react';
import {
  canUseCloud,
  deleteRecord,
  fetchRecords,
  getLocalSyncReason,
  mergeByUpdatedAt,
  upsertRecords,
} from '../services/recordSyncService.js';

export function createRecordHook({ tableName, storageKey, normalize, toRow, fromRow }) {
  function readLocal(userId = '') {
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
    localStorage.setItem(storageKey, JSON.stringify(records.map((record) => normalize(record))));
  }

  return function useRecords(userId = '') {
    const [records, setRecords] = useState(() => (canUseCloud() ? [] : readLocal(userId)));
    const [syncState, setSyncState] = useState(canUseCloud() ? 'syncing' : 'local');
    const [syncError, setSyncError] = useState('');
    const writeSequenceRef = useRef(0);

    async function reload(writeSequence = null) {
      if (!canUseCloud()) {
        setRecords(readLocal(userId));
        setSyncState('local');
        setSyncError(getLocalSyncReason());
        return;
      }

      try {
        setSyncState('syncing');
        const remoteRecords = await fetchRecords(tableName, userId, fromRow);

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

        setRecords(readLocal(userId));
        setSyncState('local');
        setSyncError(getLocalSyncReason(error.message));
      }
    }

    useEffect(() => {
      let ignore = false;

      async function sync() {
        if (!canUseCloud()) {
          setRecords(readLocal(userId));
          setSyncState('local');
          setSyncError(getLocalSyncReason());
          return;
        }

        try {
          setSyncState('syncing');
          setSyncError('');
          const localRecords = readLocal(userId);
          const remoteRecords = await fetchRecords(tableName, userId, fromRow);
          const mergedRecords = mergeByUpdatedAt(localRecords, remoteRecords)
            .map((record) => normalize(record, userId));

          if (localRecords.length > 0) {
            await upsertRecords(tableName, mergedRecords, toRow);
          }

          const refreshedRecords = await fetchRecords(tableName, userId, fromRow);
          const nextRecords = refreshedRecords.length > 0 ? refreshedRecords : mergedRecords;

          if (ignore) {
            return;
          }

          setRecords(nextRecords);
          saveLocal(nextRecords);
          setSyncState('supabase');
        } catch (error) {
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
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        ),
      [records],
    );

    function syncRecords(nextRecords, changedRecord = null) {
      saveLocal(nextRecords);

      if (!canUseCloud()) {
        setSyncState('local');
        setSyncError(getLocalSyncReason());
        return;
      }

      const writeSequence = ++writeSequenceRef.current;
      setSyncState('syncing');
      const writePromise = changedRecord
        ? upsertRecords(tableName, [changedRecord], toRow)
        : upsertRecords(tableName, nextRecords, toRow);

      writePromise
        .then(() => reload(writeSequence))
        .catch((error) => {
          if (writeSequence !== writeSequenceRef.current) {
            return;
          }

          setSyncState('local');
          setSyncError(getLocalSyncReason(error.message));
        });
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

      setRecords((current) => {
        const nextRecords = [normalizedRecord, ...current];
        syncRecords(nextRecords, normalizedRecord);
        return nextRecords;
      });

      return normalizedRecord.id;
    }

    function updateRecord(id, updates) {
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
    };
  };
}
