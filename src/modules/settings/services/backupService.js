const BACKUP_FORMAT = 'eigyo-techo-backup';
const BACKUP_VERSION = 1;

const DATASET_KEYS = [
  'customers',
  'products',
  'inventories',
  'inventoryLots',
  'inventoryMovements',
  'inventoryReservations',
  'stocktakes',
  'stocktakeLines',
  'contacts',
  'businessCards',
  'suppliers',
  'projects',
  'complaints',
  'samples',
  'quotes',
  'issuers',
  'adoptions',
  'attachments',
];

export function createBackupPayload({ user, userId, datasets }) {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    user: {
      id: userId || user?.id || '',
      email: user?.email || '',
    },
    storagePolicy: 'metadata-and-url-only',
    datasets: DATASET_KEYS.reduce((acc, key) => {
      acc[key] = sanitizeForBackup(datasets?.[key] ?? []);
      return acc;
    }, {}),
  };
}

export function downloadBackup(payload) {
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  link.href = url;
  link.download = `eigyo-techo-backup-${timestamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function readBackupFile(file) {
  if (!file) {
    throw new Error('JSON file is not selected.');
  }

  const text = await file.text();
  const payload = JSON.parse(text);

  if (payload?.format !== BACKUP_FORMAT || !payload.datasets) {
    throw new Error('This is not an Eigyo Techo backup file.');
  }

  return payload;
}

export function restoreBackupPayload(payload, handlers) {
  const summary = {};

  DATASET_KEYS.forEach((key) => {
    const records = Array.isArray(payload.datasets?.[key]) ? payload.datasets[key] : [];
    const handler = handlers?.[key];

    if (!handler) {
      summary[key] = { imported: 0, skipped: records.length };
      return;
    }

    records.forEach((record) => {
      const existing = handler.records.some((item) => item.id === record.id);
      if (existing) {
        handler.update(record.id, record);
      } else {
        handler.add(record);
      }
    });

    summary[key] = { imported: records.length, skipped: 0 };
  });

  return summary;
}

export function countBackupRecords(payload) {
  return DATASET_KEYS.reduce((total, key) => {
    const records = payload.datasets?.[key];
    return total + (Array.isArray(records) ? records.length : 0);
  }, 0);
}

function sanitizeForBackup(value) {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof File !== 'undefined' && value instanceof File) {
    return null;
  }

  if (typeof Blob !== 'undefined' && value instanceof Blob) {
    return null;
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeForBackup);
  }

  if (typeof value === 'object') {
    return Object.entries(value).reduce((acc, [key, item]) => {
      if (key === 'dataUrl') {
        return acc;
      }

      acc[key] = sanitizeForBackup(item);
      return acc;
    }, {});
  }

  return value;
}
