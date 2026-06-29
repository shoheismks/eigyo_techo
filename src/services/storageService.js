import { supabase, hasSupabaseConfig } from '../lib/supabase.js';

export const ATTACHMENT_BUCKET = 'app-attachments';

export function isUploadable() {
  return hasSupabaseConfig && Boolean(supabase) && navigator.onLine;
}

export async function compressImageFile(file, maxWidth = 1600, quality = 0.82) {
  if (!file?.type?.startsWith('image/')) {
    return file;
  }

  const image = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / image.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise((resolve) => {
    canvas.toBlob(resolve, file.type || 'image/jpeg', quality);
  });

  if (!blob || blob.size >= file.size) {
    return file;
  }

  return new File([blob], file.name, { type: blob.type || file.type });
}

export async function uploadAttachment({ file, userId, ownerType, ownerId, field }) {
  if (!file) {
    return null;
  }

  if (!isUploadable()) {
    throw new Error('Supabase Storageに接続できません。オンライン状態と環境変数を確認してください。');
  }

  const uploadFile = await compressImageFile(file);
  const extension = getExtension(file.name);
  const safeField = field || 'attachment';
  const path = `${userId}/${ownerType}/${ownerId}/${safeField}-${crypto.randomUUID()}${extension}`;

  const { error } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .upload(path, uploadFile, {
      cacheControl: '3600',
      contentType: uploadFile.type || 'application/octet-stream',
      upsert: false,
    });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from(ATTACHMENT_BUCKET).getPublicUrl(path);

  return {
    id: crypto.randomUUID(),
    name: file.name,
    type: file.type,
    size: uploadFile.size,
    path,
    url: data.publicUrl,
    ownerType,
    ownerId,
    field: safeField,
    uploadedAt: new Date().toISOString(),
  };
}

function getExtension(fileName = '') {
  const index = fileName.lastIndexOf('.');
  return index >= 0 ? fileName.slice(index) : '';
}
