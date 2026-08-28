import { useCallback, useEffect, useState } from 'react';
import { canUseCloud } from '../../../shared/services/recordSyncService.js';
import {
  addProductAlias as persistProductAlias,
  deactivateProductAlias as persistProductAliasDeactivation,
  loadProductAliases,
} from '../services/productAliasService.js';

export function useProductAliases(userId = '') {
  const [productAliases, setProductAliases] = useState([]);
  const [syncState, setSyncState] = useState(canUseCloud() ? 'syncing' : 'error');
  const [syncError, setSyncError] = useState('');

  const reloadProductAliases = useCallback(async () => {
    if (!userId || !canUseCloud()) {
      setProductAliases([]);
      setSyncState('error');
      return [];
    }

    try {
      setSyncState('syncing');
      setSyncError('');
      const records = await loadProductAliases(userId);
      setProductAliases(records);
      setSyncState('supabase');
      return records;
    } catch (error) {
      setSyncState('error');
      setSyncError(error.message || 'Failed to load product aliases.');
      throw error;
    }
  }, [userId]);

  useEffect(() => {
    let active = true;
    reloadProductAliases().catch(() => {
      if (!active) return;
    });
    return () => {
      active = false;
    };
  }, [reloadProductAliases]);

  async function addProductAlias(alias) {
    const saved = await persistProductAlias(alias, userId);
    await reloadProductAliases();
    return saved;
  }

  async function deactivateProductAlias(aliasId) {
    const saved = await persistProductAliasDeactivation(aliasId, userId);
    await reloadProductAliases();
    return saved;
  }

  return {
    productAliases,
    addProductAlias,
    deactivateProductAlias,
    reloadProductAliases,
    syncState,
    syncError,
  };
}
