import { AlarmClock, ArrowRight, ExternalLink, FileText, Inbox, Landmark, ShieldAlert, Timer, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { type ReactNode } from 'react';

import { Badge, EmptyState, PageHeader } from '@/components/ui/primitives';
import { RetentionRow, RunRetention } from '@/features/privacy/components/admin-privacy';
import { formatRetention } from '@/features/privacy/components/legal-document';
import { LEGAL_CODES, LEGAL_PAGES, legalHref } from '@/features/privacy/consent-text';
import { DATA_REQUEST_STATUS, kindLabel, requestDeadline } from '@/features/privacy/lib/policy';
import {
  getLegalInfo,
  listDataRequests,
  listLatestLegalDocuments,
  listRetentionAdmin,
  listWebhookEvents,
} from '@/features/privacy/queries';
import { requireOwner, withGuard } from '@/lib/auth/guards';
import { requestNow } from '@/lib/time';
import { cn } from '@/lib/cn';
import { formatDate, formatDateTime, formatPhone } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Dữ liệu cá nhân' };

function Section({
  id,
  icon,
  title,
  hint,
  actions,
  children,
}: {
  id: string;
  icon: ReactNode;
  title: string;
  hint: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="flex scroll-mt-24 flex-col gap-3">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-start gap-3">
          <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-control bg-primary-soft text-primary">
            {icon}
          </span>
          <div>
            <h2 id={`${id}-title`} className="text-xl">
              {title}
            </h2>
            <p className="max-w-2xl text-sm text-muted">{hint}</p>
          </div>
        </div>
        {actions}
      </header>
      {children}
    </section>
  );
}

const DUE_TONE = {
  overdue: 'bg-shuttle text-paper',
  soon: 'bg-amber-soft text-amber-deep',
  ok: 'bg-hall text-muted',
  closed: 'bg-hall text-muted',
} as const;

export default async function PrivacyAdminPage() {
  const [, [open, closed, docs, retention, webhooks, legal, preview]] = await withGuard(requireOwner(), async () =>
    Promise.all([
      listDataRequests('open'),
      listDataRequests('closed'),
      listLatestLegalDocuments(),
      listRetentionAdmin(),
      listWebhookEvents(30),
      getLegalInfo(),
      (await createClient()).rpc('apply_retention', { p_dry_run: true }),
    ]),
  );

  if (open === null || docs === null) {
    return (
      <>
        <PageHeader title="Dữ liệu cá nhân" />
        <EmptyState title="Chưa dùng được trang này">
          Chạy file supabase/sql/22_privacy_security.sql trong Supabase rồi tải lại trang.
        </EmptyState>
      </>
    );
  }

  const now = requestNow();
  const missing = [
    !legal?.legal_name && 'tên doanh nghiệp',
    !legal?.tax_code && 'mã số thuế',
    !legal?.privacy_contact && 'đầu mối bảo vệ dữ liệu',
  ].filter((m): m is string => Boolean(m));
  const dueCounts =
    preview.data && typeof preview.data === 'object' && !Array.isArray(preview.data)
      ? Object.fromEntries(
          Object.entries(preview.data).map(([k, v]) => [
            k,
            v && typeof v === 'object' && !Array.isArray(v) && typeof v.due === 'number' ? v.due : 0,
          ]),
        )
      : {};
  const dueAutomatic = (retention ?? []).filter((r) => r.isAutomatic).reduce((s, r) => s + (dueCounts[r.code] ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Dữ liệu cá nhân"
        description="Yêu cầu của khách, văn bản pháp lý, thời hạn lưu trữ và nhật ký thanh toán — theo Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15 và Nghị định 356/2025/NĐ-CP."
        actions={
          <Link href="/legal" target="_blank" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary">
            Trang công khai
            <ExternalLink className="size-4" aria-hidden />
          </Link>
        }
      />

      {missing.length > 0 && (
        <p className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-panel border border-amber-deep/25 bg-amber-soft px-4 py-3 text-sm text-amber-deep">
          <TriangleAlert className="size-4" aria-hidden />
          Chính sách đang thiếu {missing.join(', ')}.
          <Link href="/admin/settings#phap-ly" className="font-semibold underline underline-offset-4">
            Điền trong Cài đặt
          </Link>
        </p>
      )}

      <div className="flex flex-col gap-10">
        <Section
          id="yeu-cau"
          icon={<Inbox className="size-4" />}
          title={`Yêu cầu đang mở (${open.length})`}
          hint="Phản hồi khách trong 2 ngày làm việc. Hạn hoàn thành: xem / sửa / cung cấp 10 ngày, rút đồng ý / hạn chế / phản đối 15 ngày, xóa 20 ngày; gia hạn tối đa 1 lần."
        >
          {open.length === 0 ? (
            <p className="rounded-panel border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
              Không có yêu cầu nào đang chờ.
            </p>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-panel border border-line bg-paper">
              {open.map((r) => {
                const d = requestDeadline(r, now);
                const st = DATA_REQUEST_STATUS[r.status] ?? { label: r.status, tone: 'neutral' as const };
                const ackLate = !r.acknowledged_at && Date.parse(r.ack_due_at) < now;
                return (
                  <li key={r.id}>
                    <Link
                      href={`/admin/privacy/requests/${r.id}`}
                      className="flex flex-col gap-2 p-4 transition-colors hover:bg-primary-soft/40 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{kindLabel(r.kind)}</span>
                          <Badge tone={st.tone}>{st.label}</Badge>
                          {r.verified ? <Badge tone="green">Đã xác minh</Badge> : <Badge tone="amber">Chưa xác minh</Badge>}
                        </span>
                        <span className="block truncate text-sm text-muted">
                          {r.code} · {r.requester_name}
                          {r.phone ? ` · ${formatPhone(r.phone)}` : ''}
                          {r.email ? ` · ${r.email}` : ''} · gửi {formatDateTime(r.received_at)}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-wrap items-center gap-2 text-sm">
                        {ackLate && (
                          <span className="rounded-full bg-shuttle-soft px-2.5 py-0.5 font-medium text-shuttle-deep">Quá hạn phản hồi</span>
                        )}
                        <span
                          className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-medium tabular', DUE_TONE[d.state])}
                        >
                          <AlarmClock className="size-3.5" aria-hidden />
                          {d.state === 'overdue' ? `Quá hạn ${-d.daysLeft} ngày` : `Hạn ${formatDate(d.due)} · còn ${d.daysLeft} ngày`}
                        </span>
                        <ArrowRight className="size-4 text-muted" aria-hidden />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          {closed && closed.length > 0 && (
            <details className="rounded-panel border border-line bg-paper">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Đã xử lý gần đây ({closed.length})</summary>
              <ul className="divide-y divide-line border-t border-line">
                {closed.slice(0, 30).map((r) => {
                  const st = DATA_REQUEST_STATUS[r.status] ?? { label: r.status, tone: 'neutral' as const };
                  return (
                    <li key={r.id}>
                      <Link
                        href={`/admin/privacy/requests/${r.id}`}
                        className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-hall"
                      >
                        <span className="min-w-0 truncate">
                          {kindLabel(r.kind)} · {r.code} · {r.requester_name}
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <Badge tone={st.tone}>{st.label}</Badge>
                          <span className="text-muted tabular">{r.resolved_at ? formatDate(r.resolved_at) : ''}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </details>
          )}
        </Section>

        <Section
          id="van-ban"
          icon={<FileText className="size-4" />}
          title="Văn bản pháp lý"
          hint="Sửa nội dung → đăng phiên bản mới. Phiên bản cũ giữ nguyên để chứng minh khách đã xác nhận bản nào. Bản mặc định là bản nháp — hãy rà soát (nên nhờ luật sư) trước khi vận hành."
        >
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {LEGAL_CODES.map((code) => {
              const doc = docs.find((d) => d.code === code);
              const scheduled = doc && Date.parse(doc.effectiveAt) > now;
              return (
                <li key={code} className="flex flex-col gap-2 rounded-panel border border-line bg-paper p-4">
                  <p className="font-medium">{LEGAL_PAGES[code].label}</p>
                  <p className="text-sm text-muted">
                    {doc ? `Phiên bản ${doc.version} · ${scheduled ? 'hiệu lực từ' : 'từ'} ${formatDate(doc.effectiveAt)}` : 'Chưa có'}
                  </p>
                  {scheduled && <Badge tone="amber">Đã hẹn ngày hiệu lực</Badge>}
                  <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-2 text-sm">
                    <Link href={`/admin/privacy/documents/${code}`} className="font-medium text-primary hover:underline">
                      Sửa
                    </Link>
                    <Link href={legalHref(code)} target="_blank" className="text-muted hover:text-primary">
                      Xem trên web
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </Section>

        <Section
          id="luu-tru"
          icon={<Timer className="size-4" />}
          title="Thời hạn lưu trữ"
          hint='Hiện trong Chính sách bảo vệ dữ liệu. Loại bật "Tự động" được dọn mỗi đêm (cùng lịch tự đóng ca) hoặc khi bấm nút. Đơn và giao dịch luôn giữ theo luật kế toán, chỉ ẩn danh tên / SĐT.'
          actions={<RunRetention due={dueAutomatic} />}
        >
          {retention && (
            <ul className="divide-y divide-line overflow-hidden rounded-panel border border-line bg-paper">
              {retention.map((r) => (
                <li key={r.code} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 lg:max-w-xl">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {r.label}
                      <Badge tone={r.action === 'keep' ? 'neutral' : r.isAutomatic ? 'green' : 'amber'}>
                        {r.action === 'keep' ? 'Lưu theo luật' : r.isAutomatic ? 'Tự động' : 'Thủ công'}
                      </Badge>
                      {(dueCounts[r.code] ?? 0) > 0 && <Badge tone="red">{dueCounts[r.code]} hết hạn</Badge>}
                    </p>
                    <p className="text-sm text-muted">
                      {formatRetention(r.retentionDays)} · {r.basis}
                    </p>
                    {r.lastRunAt && (
                      <p className="text-xs text-muted">
                        Lần chạy gần nhất {formatDateTime(r.lastRunAt)} · {r.lastRunCount ?? 0} bản ghi
                      </p>
                    )}
                  </div>
                  <RetentionRow policy={r} />
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          id="webhook"
          icon={<Landmark className="size-4" />}
          title="Nhật ký thông báo thanh toán"
          hint="Mọi lần SePay gọi webhook, kể cả bị từ chối. Xác thực HMAC-SHA256 trên dữ liệu gốc + thời gian ±5 phút, hoặc API Key; mỗi mã giao dịch chỉ ghi nhận một lần."
        >
          {!webhooks || webhooks.length === 0 ? (
            <p className="rounded-panel border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
              Chưa có thông báo nào.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-panel border border-line bg-paper">
              <table className="w-full min-w-[40rem] text-sm">
                <thead className="bg-hall text-left">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-medium">
                      Thời điểm
                    </th>
                    <th scope="col" className="px-4 py-2.5 font-medium">
                      Xác thực
                    </th>
                    <th scope="col" className="px-4 py-2.5 font-medium">
                      Mã giao dịch
                    </th>
                    <th scope="col" className="px-4 py-2.5 font-medium">
                      Kết quả
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {webhooks.map((w) => (
                    <tr key={w.id}>
                      <td className="px-4 py-2.5 tabular">{formatDateTime(w.received_at)}</td>
                      <td className="px-4 py-2.5">
                        {w.auth_result === 'ok' ? (
                          <Badge tone="green">{w.auth_method === 'hmac' ? 'HMAC hợp lệ' : 'API Key hợp lệ'}</Badge>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-shuttle-deep">
                            <ShieldAlert className="size-4" aria-hidden />
                            {w.auth_result === 'not_configured' ? 'Chưa cấu hình khóa' : 'Bị từ chối'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs">{w.provider_txn_id ?? '—'}</td>
                      <td className="px-4 py-2.5">
                        HTTP {w.http_status}
                        {w.outcome ? ` · ${w.outcome}` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>
    </>
  );
}
