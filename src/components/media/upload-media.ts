'use client';

import { MEDIA_BUCKET } from '@/lib/storage';
import { getBrowserClient } from '@/lib/supabase/browser';

import { resizeImage } from './resize-image';

export type MediaFolder = 'courts' | 'products' | 'branches';

/** Kiểm tra, nén WebP rồi tải ảnh lên Storage bằng phiên đăng nhập (policy Storage kiểm quyền). Trả về đường dẫn. */
export async function uploadMediaFile(folder: MediaFolder, ownerId: string, file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Chỉ nhận tệp ảnh (JPG, PNG, WebP).');
  if (file.size > 15 * 1024 * 1024) throw new Error('Ảnh gốc quá lớn (tối đa 15 MB).');
  const blob = await resizeImage(file);
  const path = `${folder}/${ownerId}/${crypto.randomUUID()}.webp`;
  const { error } = await getBrowserClient().storage.from(MEDIA_BUCKET).upload(path, blob, {
    contentType: 'image/webp',
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) throw new Error('Không tải được ảnh lên. Kiểm tra quyền hoặc kết nối mạng.');
  return path;
}
