import { AlarmClock, ArrowRight, CheckCircle2, ChevronDown, Clock3, ExternalLink, FileText, Inbox, Landmark, ShieldAlert, ShieldCheck, Timer, TriangleAlert } from 'lucide-react';
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
import '@/features/privacy/rally-privacy-admin-v17.css';
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
    <section id={id} aria-labelledby={`${id}-title`} className="rp17-section">
      <header className="rp17-section-header">
        <div className="rp17-section-heading">
          <span aria-hidden className="rp17-section-icon">{icon}</span>
          <div className="rp17-section-copy">
            <h2 id={`${id}-title`}>{title}</h2>
            <p>{hint}</p>
          </div>
        </div>
        {actions && <div className="rp17-section-action">{actions}</div>}
      </header>
      <div className="rp17-section-body">{children}</div>
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

  const flaggedWebhooks = (webhooks ?? []).filter((w) => w.auth_result !== 'ok').length;
  const existingDocs = docs.filter((d) => Boolean(d)).length;
  const retentionGroups = [
    {
      key: 'auto',
      title: 'Dọn tự động',
      description: 'Các nhóm dữ liệu được xử lý theo lịch đã cấu hình.',
      rows: (retention ?? []).filter((r) => r.action !== 'keep' && r.isAutomatic),
    },
    {
      key: 'manual',
      title: 'Xử lý thủ công',
      description: 'Các nhóm chỉ được xử lý khi người có quyền thực hiện.',
      rows: (retention ?? []).filter((r) => r.action !== 'keep' && !r.isAutomatic),
    },
    {
      key: 'keep',
      title: 'Lưu theo quy định',
      description: 'Dữ liệu giao dịch và bằng chứng cần tuân thủ thời hạn lưu trữ.',
      rows: (retention ?? []).filter((r) => r.action === 'keep'),
    },
  ];

  return (
    <main className="rp17-page">
      <header className="rp17-hero">
        <div className="rp17-hero-top"><span className="rp17-eyebrow"><ShieldCheck size={15} aria-hidden /> RALLY ADMIN / QUẢN TRỊ DỮ LIỆU</span><span className="rp17-private"><span /> Nội bộ · Chỉ chủ sân</span></div>
        <div className="rp17-hero-main">
          <div>
            <h1>Dữ liệu cá nhân</h1>
            <p>Quản lý yêu cầu của khách, chính sách, thời hạn lưu trữ và nhật ký thanh toán tại một nơi.</p>
          </div>
          <Link href="/legal" target="_blank" rel="noopener noreferrer" className="rp17-public-link">
            Xem trang pháp lý <ExternalLink size={16} aria-hidden />
          </Link>
        </div>
      </header>

      <section className="rp17-metrics" aria-label="Tổng quan dữ liệu cá nhân">
        <div className="rp17-metric">
          <span className="rp17-metric-icon blue"><Inbox size={19} aria-hidden /></span>
          <div><strong>{open.length}</strong><span>Yêu cầu cần xử lý</span><small>{open.length ? 'Ưu tiên phản hồi đúng hạn' : 'Không có yêu cầu chờ'}</small></div>
        </div>
        <div className="rp17-metric">
          <span className="rp17-metric-icon teal"><FileText size={19} aria-hidden /></span>
          <div><strong>{existingDocs}<small>/{LEGAL_CODES.length}</small></strong><span>Văn bản hiện có</span><small>Kiểm tra phiên bản và hiệu lực</small></div>
        </div>
        <div className="rp17-metric">
          <span className="rp17-metric-icon amber"><Clock3 size={19} aria-hidden /></span>
          <div><strong>{dueAutomatic}</strong><span>Bản ghi đến hạn tự dọn</span><small>Chỉ nhóm đã bật tự động</small></div>
        </div>
        <div className="rp17-metric">
          <span className="rp17-metric-icon red"><ShieldAlert size={19} aria-hidden /></span>
          <div><strong>{flaggedWebhooks}</strong><span>Webhook cần kiểm tra</span><small>Trong {(webhooks ?? []).length} sự kiện gần nhất</small></div>
        </div>
      </section>

      <nav className="rp17-jump" aria-label="Đi đến khu vực quản lý">
        <a href="#yeu-cau"><Inbox size={16} aria-hidden /> Yêu cầu khách <span>{open.length}</span></a>
        <a href="#van-ban"><FileText size={16} aria-hidden /> Văn bản pháp lý</a>
        <a href="#luu-tru"><Timer size={16} aria-hidden /> Thời hạn lưu trữ</a>
        <a href="#webhook"><Landmark size={16} aria-hidden /> Nhật ký thanh toán</a>
      </nav>

      {missing.length > 0 && (
        <p role="alert" className="rp17-alert">
          <TriangleAlert className="size-4" aria-hidden />
          Chính sách đang thiếu {missing.join(', ')}.
          <Link href="/admin/settings?muc=phap-ly" className="font-semibold underline underline-offset-4">
            Điền trong Cài đặt
          </Link>
        </p>
      )}

      <div className="rp17-sections">
        <Section
          id="yeu-cau"
          icon={<Inbox className="size-4" />}
          title={`Yêu cầu đang mở (${open.length})`}
          hint="Phản hồi khách trong 2 ngày làm việc. Hạn hoàn thành: xem / sửa / cung cấp 10 ngày, rút đồng ý / hạn chế / phản đối 15 ngày, xóa 20 ngày; gia hạn tối đa 1 lần."
        >
          {open.length === 0 ? (
            <div className="rp17-empty">
              <span className="rp17-empty-icon"><CheckCircle2 size={23} aria-hidden /></span>
              <strong>Không có yêu cầu đang chờ</strong>
              <p>Những yêu cầu mới từ khách sẽ xuất hiện tại đây để bạn xử lý.</p>
            </div>
          ) : (
            <ul className="rp17-request-list">
              {open.map((r) => {
                const d = requestDeadline(r, now);
                const st = DATA_REQUEST_STATUS[r.status] ?? { label: r.status, tone: 'neutral' as const };
                const ackLate = !r.acknowledged_at && Date.parse(r.ack_due_at) < now;
                return (
                  <li key={r.id}>
                    <Link
                      href={`/admin/privacy/requests/${r.id}`}
                      className="rp17-request-row"
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
            <details className="rp17-closed-requests">
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
          <ul className="rp17-legal-grid">
            {LEGAL_CODES.map((code) => {
              const doc = docs.find((d) => d.code === code);
              const scheduled = doc && Date.parse(doc.effectiveAt) > now;
              return (
                <li key={code} className="rp17-legal-card">
                  <div className="rp17-legal-icon"><FileText size={19} aria-hidden /></div><h3>{LEGAL_PAGES[code].label}</h3>
                  <p className="text-sm text-muted">
                    {doc ? `Phiên bản ${doc.version} · ${scheduled ? 'hiệu lực từ' : 'từ'} ${formatDate(doc.effectiveAt)}` : 'Chưa có'}
                  </p>
                  {scheduled && <Badge tone="amber">Đã hẹn ngày hiệu lực</Badge>}
                  <div className="rp17-legal-actions">
                    <Link href={`/admin/privacy/documents/${code}`} className="rp17-doc-edit">
                      Sửa
                    </Link>
                    <Link href={legalHref(code)} target="_blank" className="rp17-doc-view">
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
            <div className="rp17-retention-groups">
              {retentionGroups.filter((group) => group.rows.length > 0).map((group) => (
                <details key={group.key} className="rp17-retention-group" open={group.key === 'auto'}>
                  <summary>
                    <span className="rp17-retention-group-text">
                      <strong>{group.title} <em>{group.rows.length}</em></strong>
                      <small>{group.description}</small>
                    </span>
                    <ChevronDown size={18} aria-hidden className="rp17-details-chevron" />
                  </summary>
                  <ul className="rp17-retention-list">
                    {group.rows.map((r) => (
                      <li key={r.code} className="rp17-retention-row">
                        <div className="rp17-retention-copy">
                          <p className="rp17-retention-label">
                            {r.label}
                            <Badge tone={r.action === 'keep' ? 'neutral' : r.isAutomatic ? 'green' : 'amber'}>
                              {r.action === 'keep' ? 'Lưu theo luật' : r.isAutomatic ? 'Tự động' : 'Thủ công'}
                            </Badge>
                            {(dueCounts[r.code] ?? 0) > 0 && <Badge tone="red">{dueCounts[r.code]} hết hạn</Badge>}
                          </p>
                          <p className="rp17-retention-description">{formatRetention(r.retentionDays)} · {r.basis}</p>
                          {r.lastRunAt && <small>Lần chạy gần nhất: {formatDateTime(r.lastRunAt)} · {r.lastRunCount ?? 0} bản ghi</small>}
                        </div>
                        <div className="rp17-retention-form"><RetentionRow policy={r} /></div>
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
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
            <div className="rp17-webhook-wrap">
              <table className="rp17-webhook-table">
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
                      <td data-label="Thời điểm" className="px-4 py-2.5 tabular">{formatDateTime(w.received_at)}</td>
                      <td data-label="Xác thực" className="px-4 py-2.5">
                        {w.auth_result === 'ok' ? (
                          <Badge tone="green">{w.auth_method === 'hmac' ? 'HMAC hợp lệ' : 'API Key hợp lệ'}</Badge>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-shuttle-deep">
                            <ShieldAlert className="size-4" aria-hidden />
                            {w.auth_result === 'not_configured' ? 'Chưa cấu hình khóa' : 'Bị từ chối'}
                          </span>
                        )}
                      </td>
                      <td data-label="Mã giao dịch" className="px-4 py-2.5 font-mono text-xs">{w.provider_txn_id ?? '—'}</td>
                      <td data-label="Kết quả" className="px-4 py-2.5">
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
    </main>
  );
}
