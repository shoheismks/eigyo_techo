import { createRecordHook } from '../../../shared/hooks/useSupabaseRecords.js';

export function normalizeBusinessCard(card = {}, userId = '') {
  return {
    id: card.id ?? crypto.randomUUID(),
    userId: card.userId ?? userId,
    contactId: card.contactId ?? '',
    customerId: card.customerId ?? '',
    rawText: card.rawText ?? '',
    imageFile: card.imageFile ?? null,
    extracted: card.extracted ?? {},
    createdAt: card.createdAt ?? new Date().toISOString(),
    updatedAt: card.updatedAt ?? new Date().toISOString(),
  };
}

function toRow(card) {
  return {
    id: card.id,
    user_id: card.userId,
    contact_id: card.contactId,
    customer_id: card.customerId,
    raw_text: card.rawText,
    image_file: card.imageFile,
    extracted: card.extracted,
    created_at: card.createdAt,
    updated_at: card.updatedAt,
  };
}

function fromRow(row) {
  return normalizeBusinessCard({
    id: row.id,
    userId: row.user_id,
    contactId: row.contact_id,
    customerId: row.customer_id,
    rawText: row.raw_text,
    imageFile: row.image_file,
    extracted: row.extracted,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export const useBusinessCards = createRecordHook({
  tableName: 'business_cards',
  storageKey: 'eigyo-techo-business-cards',
  normalize: normalizeBusinessCard,
  toRow,
  fromRow,
});
