import { ArrowLeft, Mail, Phone, ShieldCheck, ShieldQuestion, UserRound } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Badge, PageHeader, Panel } from '@/components/ui/primitives';
import { AnonymizePanel, DataRequestActions, ExportCustomerData } from '@/features/privacy/components/admin-privacy';
import { DATA_REQUEST_STATUS, kindLabel, requestDeadline } from '@/features/privacy/lib/policy';
import { getDataRequest } from '@/features/privacy/queries';
import { requireOwner, withGuard } from '@/lib/auth/guards';
import { requestNow } from '@/lib/time';
import { formatDateTime, formatPhone } from '@/lib/format';
import { zUuid } from '@/lib/validation';

export const metadata = { title: 'Yêu cầu dữ liệu cá nhân' };

export default async function DataRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!zUuid().safeParse(id).success) notFound();
  const [, r] = await withGuard(requireOwner(), () => getDataRequest(id));
  if (!r) notFound();

  const now = requestNow();
  const d = requestDeadline(r, now);
  const st = DATA_REQUEST_STATUS[r.status] ?? { label: r.status, tone: 'neutral' as const };
  const isOpen = ['received', 'in_progress', 'extended'].includes(r.status);
  const customer = r.customers;
  const rows: Array<[string, string]> = [
    ['Nhận lúc', formatDateTime(r.received_at)],
    ['Hạn phản hồi', `${formatDateTime(r.ack_due_at)}${r.acknowledged_at ? ` — đã phản hồi ${formatDateTime(r.acknowledged_at)}` : ''}`],
    ['Hạn hoàn thành', formatDateTime(r.due_at)],
    ...(r.extended_due_at
      ? ([['Gia hạn tới', `${formatDateTime(r.extended_due_at)} — ${r.extension_reason ?? ''}`]] as Array<[string, string]>)
      : []),
    ...(r.resolved_at ? ([['Đóng lúc', formatDateTime(r.resolved_at)]] as Array<[string, string]>) : []),
    ['Kênh', r.channel === 'account' ? 'Tài khoản thành viên' : 'Website'],
  ];

  return (
    <>
      <PageHeader
        back={
          <Link href="/admin/privacy" className="inline-flex items-center gap-1 text-sm text-muted hover:text-primary">
            <ArrowLeft className="size-4" aria-hidden />
            Dữ liệu cá nhân
          </Link>
        }
        title={kindLabel(r.kind)}
        description={`Mã ${r.code}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge tone={st.tone}>{st.label}</Badge>
            {isOpen && (
              <Badge tone={d.state === 'overdue' ? 'red' : d.state === 'soon' ? 'amber' : 'neutral'}>
                {d.state === 'overdue' ? `Quá hạn ${-d.daysLeft} ngày` : `Còn ${d.daysLeft} ngày`}
              </Badge>
            )}
          </div>
        }
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel title="Nội dung">
            {r.redacted_at ? (
              <p className="text-muted">Đã xóa nội dung theo thời hạn lưu trữ.</p>
            ) : (
              <blockquote className="border-l-2 border-primary/40 pl-3 whitespace-pre-line">{r.details}</blockquote>
            )}
            <dl className="mt-5 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              {rows.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-muted">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            {r.resolution_note && (
              <div className="mt-5 rounded-control bg-hall px-3 py-2 text-sm">
                <p className="font-medium">Kết quả xử lý</p>
                <p className="whitespace-pre-line">{r.resolution_note}</p>
              </div>
            )}
          </Panel>

          {customer && (
            <Panel
              title="Hồ sơ khách liên quan"
              description={
                customer.anonymized_at
                  ? `Đã ẩn danh hóa lúc ${formatDateTime(customer.anonymized_at)}.`
                  : 'Khớp theo số điện thoại / mã đơn / tài khoản.'
              }
              actions={
                <Link href={`/admin/customers/${customer.id}`} className="text-sm text-primary hover:underline">
                  Mở hồ sơ
                </Link>
              }
            >
              <p className="flex items-center gap-2">
                <UserRound className="size-4 text-muted" aria-hidden />
                {customer.full_name}
                {customer.anonymized_at ? null : <span className="text-muted">· {formatPhone(customer.phone)}</span>}
                {customer.auth_user_id && <Badge tone="ink">Thành viên</Badge>}
              </p>
              {!customer.anonymized_at && (
                <div className="mt-4 flex flex-col gap-3">
                  {(r.kind === 'access' || r.kind === 'export') && <ExportCustomerData customerId={customer.id} requestId={r.id} />}
                  {r.kind === 'delete' &&
                    isOpen &&
                    (r.verified ? (
                      <AnonymizePanel customerId={customer.id} requestId={r.id} />
                    ) : (
                      <p className="text-sm text-amber-deep">Xác minh người gửi trước khi xóa dữ liệu.</p>
                    ))}
                </div>
              )}
            </Panel>
          )}
        </div>

        <aside className="flex flex-col gap-5">
          <Panel title="Người gửi">
            <ul className="flex flex-col gap-2 text-sm">
              <li className="font-medium">{r.requester_name}</li>
              {r.phone && (
                <li className="flex items-center gap-2">
                  <Phone className="size-4 text-muted" aria-hidden />
                  <a href={`tel:${r.phone}`} className="hover:underline">
                    {formatPhone(r.phone)}
                  </a>
                </li>
              )}
              {r.email && (
                <li className="flex items-center gap-2">
                  <Mail className="size-4 text-muted" aria-hidden />
                  <a href={`mailto:${r.email}`} className="break-all hover:underline">
                    {r.email}
                  </a>
                </li>
              )}
              {r.booking_code && <li className="text-muted">Mã đơn khai: {r.booking_code}</li>}
              <li className="mt-1 flex items-start gap-2">
                {r.verified ? (
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-court-deep" aria-hidden />
                ) : (
                  <ShieldQuestion className="mt-0.5 size-4 shrink-0 text-amber-deep" aria-hidden />
                )}
                <span>
                  {r.verified ? (r.verification_note ?? 'Đã xác minh') : 'Chưa xác minh — gọi lại số điện thoại đã đặt sân để xác minh.'}
                </span>
              </li>
            </ul>
          </Panel>
          {isOpen && (
            <Panel title="Xử lý">
              <DataRequestActions id={r.id} verified={r.verified} canExtend={!r.extended_due_at} />
            </Panel>
          )}
        </aside>
      </div>
    </>
  );
}
