import { z } from 'zod';

import { formatDateTime, formatPhone, formatVnd } from '@/lib/format';

/** Một giao dịch cần chủ sân xử lý (từ service_pending_alerts). */
export const alertItemSchema = z.object({
  id: z.string(),
  amount: z.number(),
  content: z.string().nullish(),
  status: z.enum(['review', 'unmatched']),
  status_note: z.string().nullish(),
  transaction_at: z.string(),
  gateway: z.string().nullish(),
  booking_code: z.string().nullish(),
  contact_name: z.string().nullish(),
  contact_phone: z.string().nullish(),
  starts_at: z.string().nullish(),
  court_name: z.string().nullish(),
  branch_name: z.string().nullish(),
});
export type AlertItem = z.infer<typeof alertItemSchema>;

export const pendingAlertsSchema = z.object({
  recipients: z.array(z.string()).catch([]),
  items: z.array(alertItemSchema).catch([]),
});

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

/** Một câu tóm tắt dễ hiểu, ví dụ “Khách A chuyển 42.000 đ nhưng giờ đã có người đặt — cần liên hệ khách”. */
export function alertHeadline(item: AlertItem): string {
  const amount = formatVnd(item.amount);
  if (item.status === 'unmatched' || !item.booking_code) {
    const reason = item.status_note?.startsWith('Không có đơn')
      ? 'mã đơn trong nội dung không tồn tại'
      : 'nội dung chuyển khoản không có mã đơn';
    return `Nhận ${amount} nhưng ${reason} — cần gán vào đơn hoặc hoàn tiền`;
  }
  const who = item.contact_name ? `Khách ${item.contact_name}` : 'Khách';
  const note = item.status_note ?? 'cần kiểm tra đơn';
  if (/đã có người khác đặt/i.test(note)) return `${who} chuyển ${amount} nhưng giờ đã có người đặt — cần liên hệ khách`;
  if (/hết hạn/i.test(note)) return `${who} chuyển ${amount} sau khi giữ chỗ hết hạn — cần liên hệ khách`;
  if (/hủy|không đến/i.test(note)) return `${who} chuyển ${amount} cho đơn đã hủy — cần hoàn tiền hoặc đặt lại`;
  if (/chuyển dư/i.test(note)) return `${who} chuyển dư (${amount}) — cần hoàn phần dư`;
  return `${who} chuyển ${amount} — ${note}`;
}

export function alertSubject(items: AlertItem[]): string {
  if (items.length === 1) return `[Rally] ${alertHeadline(items[0])}`;
  return `[Rally] ${items.length} giao dịch chuyển khoản cần xử lý`;
}

function row(label: string, value: string | null | undefined): string {
  if (!value) return '';
  return `<tr><td style="padding:2px 12px 2px 0;color:#555;white-space:nowrap">${escapeHtml(label)}</td><td style="padding:2px 0;color:#000">${escapeHtml(value)}</td></tr>`;
}

/** Email HTML gọn, đọc được trên điện thoại; mỗi giao dịch một khối kèm SĐT khách để gọi ngay. */
export function alertEmailHtml(items: AlertItem[], adminUrl: string): string {
  const blocks = items
    .map((item) => {
      const tone = item.status === 'review' ? '#ED1C24' : '#b45309';
      const phone = item.contact_phone
        ? `<a href="tel:${escapeHtml(item.contact_phone)}" style="color:#000;font-weight:600">${escapeHtml(formatPhone(item.contact_phone))}</a>`
        : '';
      return `<div style="border:1px solid #e5e5e5;border-left:4px solid ${tone};border-radius:8px;padding:12px 14px;margin:0 0 12px">
<p style="margin:0 0 8px;font-weight:700;font-size:15px;color:#000">${escapeHtml(alertHeadline(item))}</p>
<table style="font-size:13px;border-collapse:collapse">
${row('Số tiền', formatVnd(item.amount))}
${row('Lúc', formatDateTime(item.transaction_at))}
${row('Nội dung CK', item.content)}
${row('Đơn', item.booking_code)}
${row('Sân', [item.court_name, item.branch_name].filter(Boolean).join(' · ') || null)}
${row('Giờ chơi', item.starts_at ? formatDateTime(item.starts_at) : null)}
${row('Ghi chú', item.status_note)}
${phone ? `<tr><td style="padding:2px 12px 2px 0;color:#555">Liên hệ</td><td>${escapeHtml(item.contact_name ?? '')} ${phone}</td></tr>` : ''}
</table></div>`;
    })
    .join('\n');
  return `<!doctype html><html><body style="margin:0;background:#f6f6f6;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:20px 16px">
<p style="margin:0 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#62BB46;font-weight:700">Rally Badminton</p>
<h1 style="margin:0 0 16px;font-size:20px;color:#000">${items.length === 1 ? 'Có giao dịch cần xử lý' : `Có ${items.length} giao dịch cần xử lý`}</h1>
${blocks}
<p style="margin:16px 0"><a href="${escapeHtml(adminUrl)}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600">Mở Giao dịch ngân hàng</a></p>
<p style="margin:0;font-size:12px;color:#777">Tiền đã vào tài khoản; hệ thống chưa thể tự xác nhận đơn. Sau khi gọi khách, ghi lại cách xử lý trong trang quản trị.</p>
</div></body></html>`;
}

export function alertEmailText(items: AlertItem[], adminUrl: string): string {
  const lines = items.map((item) =>
    [
      `• ${alertHeadline(item)}`,
      item.booking_code ? `  Đơn ${item.booking_code}` : null,
      item.contact_phone ? `  Liên hệ: ${item.contact_name ?? ''} ${formatPhone(item.contact_phone)}` : null,
      item.content ? `  Nội dung CK: ${item.content}` : null,
    ]
      .filter(Boolean)
      .join('\n'),
  );
  return `${lines.join('\n\n')}\n\nXử lý tại: ${adminUrl}`;
}
