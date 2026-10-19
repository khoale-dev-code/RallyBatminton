import { publicEnv } from './env';

export const MEDIA_BUCKET = 'public-media';

/** Đường dẫn trong bucket công khai → URL tải ảnh. */
export function mediaUrl(path: string | null | undefined): string | null {
  if (!path || !publicEnv.supabaseUrl) return null;
  return `${publicEnv.supabaseUrl}/storage/v1/object/public/${MEDIA_BUCKET}/${path}`;
}
