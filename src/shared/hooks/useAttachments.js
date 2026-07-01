import { createRecordHook } from './useSupabaseRecords.js';

export function normalizeAttachmentRecord(attachment = {}, userId = '') {
  return {
    id: attachment.id ?? crypto.randomUUID(),
    userId: attachment.userId ?? userId,
    ownerType: attachment.ownerType ?? '',
    ownerId: attachment.ownerId ?? '',
    field: attachment.field ?? '',
    name: attachment.name ?? '',
    contentType: attachment.contentType ?? attachment.type ?? '',
    sizeBytes: attachment.sizeBytes ?? attachment.size ?? 0,
    storageBucket: attachment.storageBucket ?? 'app-attachments',
    storagePath: attachment.storagePath ?? attachment.path ?? '',
    publicUrl: attachment.publicUrl ?? attachment.url ?? '',
    metadata: attachment.metadata ?? {},
    createdAt: attachment.createdAt ?? attachment.uploadedAt ?? new Date().toISOString(),
    updatedAt: attachment.updatedAt ?? attachment.uploadedAt ?? new Date().toISOString(),
  };
}

function toRow(attachment) {
  return {
    id: attachment.id,
    user_id: attachment.userId,
    owner_type: attachment.ownerType,
    owner_id: attachment.ownerId,
    field: attachment.field,
    name: attachment.name,
    content_type: attachment.contentType,
    size_bytes: attachment.sizeBytes,
    storage_bucket: attachment.storageBucket,
    storage_path: attachment.storagePath,
    public_url: attachment.publicUrl,
    metadata: attachment.metadata,
    created_at: attachment.createdAt,
    updated_at: attachment.updatedAt,
  };
}

function fromRow(row) {
  return normalizeAttachmentRecord({
    id: row.id,
    userId: row.user_id,
    ownerType: row.owner_type,
    ownerId: row.owner_id,
    field: row.field,
    name: row.name,
    contentType: row.content_type,
    sizeBytes: row.size_bytes,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    publicUrl: row.public_url,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export const useAttachments = createRecordHook({
  tableName: 'attachments',
  storageKey: 'eigyo-techo-attachments',
  normalize: normalizeAttachmentRecord,
  toRow,
  fromRow,
});
