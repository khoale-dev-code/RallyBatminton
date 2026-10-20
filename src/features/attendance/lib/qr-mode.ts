/** Loại mã QR hiện trên màn hình quầy: vào ca, ra ca hoặc cả hai cạnh nhau. */
export type QrMode = 'checkin' | 'checkout' | 'both';

/** Tham số URL (?loai=vao|ra|ca-hai) → chế độ; mặc định hiện cả hai. */
export function parseQrMode(value: string | undefined): QrMode {
  if (value === 'vao') return 'checkin';
  if (value === 'ra') return 'checkout';
  return 'both';
}

/** Loại hành động gắn trong mã QR (?e=checkin|checkout); mã cũ không có → null (nhân viên tự chọn như trước). */
export function parseScanEvent(value: string | undefined): 'checkin' | 'checkout' | null {
  return value === 'checkin' || value === 'checkout' ? value : null;
}
