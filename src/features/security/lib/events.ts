import { z } from 'zod';

import { formatDateTime } from '@/lib/format';
import { type Tone } from '@/lib/labels';

export const SECURITY_EVENT_KINDS = [
  'booking_abuse_phone',
  'booking_abuse_client',
  'booking_branch_cap',
  'booking_rate',
  'login_locked',
  'login_spray',
  'webhook_rejected',
  'mfa_change',
  'security_setting',
  'hold_policy',
] as const;
export type SecurityEventKind = (typeof SECURITY_EVENT_KINDS)[number];
export type SecuritySeverity = 'info' | 'warning' | 'critical';

/** Tên dễ hiểu + việc nên làm cho từng loại sự kiện (hiện trên trang Bảo mật và trong email). */
export const EVENT_INFO: Record<SecurityEventKind, { label: string; advice: string }> = {
  booking_abuse_phone: {
    label: 'Số điện thoại giữ sân rồi bỏ nhiều lần',
    advice: 'Hệ thống đã tạm chặn giữ online cho số này. Nếu là khách quen bị chặn nhầm, mở hồ sơ khách và chọn “Tin cậy”.',
  },
  booking_abuse_client: {
    label: 'Một thiết bị / mạng giữ sân quá nhiều',
    advice: 'Có thể là công cụ tự động giữ sân ảo. Hệ thống đã từ chối thêm lượt giữ từ nơi này; theo dõi tiếp ở Lịch đặt sân.',
  },
  booking_branch_cap: {
    label: 'Chi nhánh chạm giới hạn lượt giữ chưa thanh toán',
    advice:
      'Quá nhiều lượt giữ cùng lúc — dấu hiệu bị chiếm giờ trống. Khách mới tạm thời không giữ online được. Kiểm tra Lịch đặt sân; nếu bị tấn công, bật Attack Mode trên Vercel hoặc tạm dừng đặt sân online.',
  },
  booking_rate: { label: 'Giữ sân quá nhanh', advice: 'Thường là khách bấm nhiều lần; chỉ cần theo dõi.' },
  login_locked: {
    label: 'Tài khoản bị khóa tạm do sai mật khẩu nhiều lần',
    advice: 'Nếu không phải chính chủ đăng nhập: đổi mật khẩu tài khoản đó và bật xác thực 2 lớp.',
  },
  login_spray: {
    label: 'Một mạng thử đăng nhập sai hàng loạt',
    advice: 'Dấu hiệu dò mật khẩu. Mạng đó đã bị khóa 15 phút. Cân nhắc chặn IP trong Vercel Firewall và bắt buộc 2 lớp.',
  },
  webhook_rejected: {
    label: 'Thông báo thanh toán giả / sai khóa bị từ chối',
    advice: 'Có người gọi webhook SePay không đúng chữ ký. Nếu chính bạn vừa đổi khóa, cập nhật SEPAY_WEBHOOK_SECRET cho khớp.',
  },
  mfa_change: { label: 'Thay đổi xác thực 2 lớp', advice: 'Kiểm tra đúng là bạn hoặc nhân viên của bạn đã thay đổi.' },
  security_setting: { label: 'Thay đổi cài đặt bảo mật', advice: 'Kiểm tra đúng là bạn đã thay đổi.' },
  hold_policy: { label: 'Nhân viên đổi chế độ giữ sân của khách', advice: 'Chỉ để theo dõi.' },
};

export const SEVERITY_INFO: Record<SecuritySeverity, { label: string; tone: Tone }> = {
  info: { label: 'Thông tin', tone: 'neutral' },
  warning: { label: 'Cần chú ý', tone: 'amber' },
  critical: { label: 'Nghiêm trọng', tone: 'red' },
};

export const securityEventSchema = z.object({
  id: z.string(),
  kind: z.enum(SECURITY_EVENT_KINDS),
  severity: z.enum(['info', 'warning', 'critical']),
  subject: z.string().nullish(),
  occurrences: z.number(),
  first_seen_at: z.string(),
  last_seen_at: z.string(),
  branch_name: z.string().nullish(),
});
export type SecurityEventItem = z.infer<typeof securityEventSchema>;

export const pendingSecurityAlertsSchema = z.object({
  recipients: z.array(z.string()).catch([]),
  items: z.array(securityEventSchema).catch([]),
});

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

export function eventHeadline(item: SecurityEventItem): string {
  const base = EVENT_INFO[item.kind].label;
  const who = [item.subject, item.branch_name].filter(Boolean).join(' · ');
  const times = item.occurrences > 1 ? ` (${item.occurrences} lần)` : '';
  return who ? `${base}: ${who}${times}` : `${base}${times}`;
}

export function securityAlertSubject(items: SecurityEventItem[]): string {
  const critical = items.some((i) => i.severity === 'critical');
  const prefix = critical ? '[Rally] KHẨN — ' : '[Rally] ';
  if (items.length === 1) return prefix + eventHeadline(items[0]);
  return `${prefix}${items.length} cảnh báo bảo mật cần xem`;
}

export function securityAlertHtml(items: SecurityEventItem[], adminUrl: string): string {
  const blocks = items
    .map((item) => {
      const tone = item.severity === 'critical' ? '#ED1C24' : '#b45309';
      return `<div style="border:1px solid #e5e5e5;border-left:4px solid ${tone};border-radius:8px;padding:12px 14px;margin:0 0 12px">
<p style="margin:0 0 6px;font-weight:700;font-size:15px;color:#000">${escapeHtml(eventHeadline(item))}</p>
<p style="margin:0 0 6px;font-size:13px;color:#555">${escapeHtml(SEVERITY_INFO[item.severity].label)} · lần đầu ${escapeHtml(formatDateTime(item.first_seen_at))} · gần nhất ${escapeHtml(formatDateTime(item.last_seen_at))}</p>
<p style="margin:0;font-size:13px;color:#000">${escapeHtml(EVENT_INFO[item.kind].advice)}</p>
</div>`;
    })
    .join('\n');
  return `<!doctype html><html lang="vi"><body style="margin:0;padding:16px;font-family:Arial,Helvetica,sans-serif;background:#f6f6f6">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:18px">
<p style="margin:0 0 12px;font-size:16px;font-weight:700">Cảnh báo bảo mật — Rally</p>
${blocks}
<p style="margin:16px 0 0"><a href="${escapeHtml(adminUrl)}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600">Mở trang Bảo mật</a></p>
<p style="margin:12px 0 0;font-size:12px;color:#777">Email tự động. Không trả lời email này.</p>
</div></body></html>`;
}

export function securityAlertText(items: SecurityEventItem[], adminUrl: string): string {
  const lines = items.map(
    (item) =>
      `- ${eventHeadline(item)} [${SEVERITY_INFO[item.severity].label}, gần nhất ${formatDateTime(item.last_seen_at)}]\n  ${EVENT_INFO[item.kind].advice}`,
  );
  return `Cảnh báo bảo mật — Rally\n\n${lines.join('\n')}\n\nMở trang Bảo mật: ${adminUrl}\n`;
}
