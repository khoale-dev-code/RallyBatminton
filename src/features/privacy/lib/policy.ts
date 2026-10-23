/** Cấu hình hủy / cọc của một chi nhánh (cột trong bảng branches). */
export interface CancellationPolicy {
  holdMinutes: number;
  depositPercent: number;
  freeCancelHours: number;
  partialRefundHours: number;
  partialRefundPercent: number;
}

/**
 * Số tiền được hoàn — cùng công thức với private.refund_entitlement trong database:
 * còn ≥ freeCancelHours → hoàn hết; còn ≥ partialRefundHours → hoàn partialRefundPercent% (làm tròn xuống 1.000đ); còn lại 0.
 */
export function refundAmount(paid: number, hoursBeforeStart: number, p: CancellationPolicy): number {
  if (paid <= 0) return 0;
  if (hoursBeforeStart >= p.freeCancelHours) return paid;
  if (hoursBeforeStart >= p.partialRefundHours) return Math.floor((paid * p.partialRefundPercent) / 100 / 1000) * 1000;
  return 0;
}

/** Các mốc hủy của chi nhánh, từ sớm tới muộn (bỏ mốc trùng khi hai ngưỡng bằng nhau). */
export function refundTiers(p: CancellationPolicy): Array<{ label: string; percent: number }> {
  const tiers: Array<{ label: string; percent: number }> = [
    { label: `Hủy trước giờ chơi từ ${p.freeCancelHours} giờ trở lên`, percent: 100 },
  ];
  if (p.partialRefundHours < p.freeCancelHours) {
    tiers.push({ label: `Hủy trước ${p.partialRefundHours} – dưới ${p.freeCancelHours} giờ`, percent: p.partialRefundPercent });
  }
  tiers.push({
    label: p.partialRefundHours > 0 ? `Hủy khi còn dưới ${p.partialRefundHours} giờ` : 'Hủy sát giờ chơi',
    percent: 0,
  });
  return tiers;
}

/** Loại yêu cầu của chủ thể dữ liệu và thời hạn thực hiện (Điều 5 Nghị định 356/2025/NĐ-CP). */
export const DATA_REQUEST_KINDS = [
  { kind: 'access', label: 'Xem dữ liệu của tôi', hint: 'Rally cho bạn biết đang lưu những dữ liệu nào về bạn.', days: 10 },
  { kind: 'export', label: 'Nhận bản sao dữ liệu', hint: 'Nhận tệp dữ liệu của bạn (đơn đặt sân, giao dịch…).', days: 10 },
  { kind: 'correct', label: 'Sửa dữ liệu sai', hint: 'Ví dụ: tên, số điện thoại, email bị ghi sai.', days: 10 },
  {
    kind: 'delete',
    label: 'Xóa dữ liệu của tôi',
    hint: 'Xóa tên, số điện thoại, email; đơn và giao dịch được giữ ở dạng không định danh theo luật kế toán.',
    days: 20,
  },
  { kind: 'withdraw', label: 'Rút lại đồng ý nhận tin', hint: 'Ngừng nhận tin khuyến mãi, ưu đãi.', days: 15 },
  { kind: 'restrict', label: 'Hạn chế xử lý', hint: 'Tạm ngừng dùng dữ liệu của bạn trong khi chờ kiểm tra.', days: 15 },
  { kind: 'object', label: 'Phản đối xử lý', hint: 'Bạn không đồng ý với một mục đích xử lý cụ thể.', days: 15 },
  { kind: 'complaint', label: 'Khiếu nại', hint: 'Phản ánh việc Rally xử lý dữ liệu của bạn.', days: 15 },
] as const;

export type DataRequestKind = (typeof DATA_REQUEST_KINDS)[number]['kind'];

export const DATA_REQUEST_KIND_VALUES = DATA_REQUEST_KINDS.map((k) => k.kind) as [DataRequestKind, ...DataRequestKind[]];

export const kindLabel = (kind: string): string => DATA_REQUEST_KINDS.find((k) => k.kind === kind)?.label ?? kind;

export const DATA_REQUEST_STATUS: Record<string, { label: string; tone: 'neutral' | 'green' | 'red' | 'amber' | 'ink' }> = {
  received: { label: 'Mới nhận', tone: 'amber' },
  in_progress: { label: 'Đang xử lý', tone: 'neutral' },
  extended: { label: 'Đã gia hạn', tone: 'amber' },
  completed: { label: 'Hoàn tất', tone: 'green' },
  rejected: { label: 'Từ chối', tone: 'red' },
  cancelled: { label: 'Đã hủy', tone: 'neutral' },
};

export const OPEN_REQUEST_STATUSES = ['received', 'in_progress', 'extended'] as const;

/** Hạn đang áp dụng và tình trạng (quá hạn / còn ≤ 2 ngày). */
export function requestDeadline(
  r: { due_at: string; extended_due_at: string | null; status: string },
  nowMs: number,
): { due: string; state: 'closed' | 'overdue' | 'soon' | 'ok'; daysLeft: number } {
  const due = r.extended_due_at ?? r.due_at;
  const daysLeft = Math.ceil((Date.parse(due) - nowMs) / 86_400_000);
  if (!(OPEN_REQUEST_STATUSES as readonly string[]).includes(r.status)) return { due, state: 'closed', daysLeft };
  if (daysLeft < 0) return { due, state: 'overdue', daysLeft };
  if (daysLeft <= 2) return { due, state: 'soon', daysLeft };
  return { due, state: 'ok', daysLeft };
}
