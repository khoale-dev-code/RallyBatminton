import { ArrowRight, BellRing, FileClock, FileDown, FileLock2 } from 'lucide-react';
import { type Metadata } from 'next';
import Link from 'next/link';
import { type ReactNode } from 'react';

import { Badge } from '@/components/ui/primitives';
import { requireMember } from '@/features/member/queries';
import { ExportMyData, MarketingToggle } from '@/features/privacy/components/member-privacy';
import { DATA_REQUEST_HREF, LEGAL_CODES, LEGAL_PAGES, legalHref } from '@/features/privacy/consent-text';
import { DATA_REQUEST_STATUS, kindLabel } from '@/features/privacy/lib/policy';
import { listMyConsents, listMyDataRequests } from '@/features/privacy/queries';
import { formatDate, formatDateTime } from '@/lib/format';

export const metadata: Metadata = { title: 'Quyền riêng tư' };

const PURPOSE: Record<string, string> = {
  booking_terms: 'Xác nhận điều khoản khi đặt sân',
  account_terms: 'Xác nhận điều khoản khi tạo tài khoản',
  marketing: 'Nhận tin khuyến mãi',
};

const SOURCE: Record<string, string> = {
  booking_form: 'Form đặt sân',
  register_form: 'Đăng ký tài khoản',
  account: 'Trong tài khoản',
  data_request: 'Yêu cầu dữ liệu',
  staff: 'Nhân viên cập nhật',
};

function Section({ icon, title, description, children }: { icon: ReactNode; title: string; description: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="rounded-panel border border-line bg-paper p-4 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-court-soft text-court-deep">{icon}</span>
        <div>
          <h2 className="text-xl">{title}</h2>
          <p className="text-sm text-muted">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export default async function AccountPrivacyPage() {
  const profile = await requireMember();
  const [consents, requests] = await Promise.all([listMyConsents(), listMyDataRequests(profile.user_id)]);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex min-w-0 flex-col gap-5">
        <Section
          icon={<BellRing className="size-5" aria-hidden />}
          title="Nhận tin ưu đãi"
          description="Đồng ý riêng, không ảnh hưởng tới đặt sân hay quyền lợi thành viên."
        >
          <MarketingToggle enabled={profile.marketing_opt_in} />
        </Section>

        <Section
          icon={<FileDown className="size-5" aria-hidden />}
          title="Tải dữ liệu của tôi"
          description="Thông tin tài khoản, đơn đặt sân, thanh toán, điểm, lịch sử đồng ý — tệp JSON tạo ngay, không lưu lại."
        >
          <ExportMyData />
        </Section>

        <Section
          icon={<FileClock className="size-5" aria-hidden />}
          title="Lịch sử xác nhận và đồng ý"
          description="Rally lưu lại mỗi lần bạn xác nhận điều khoản hoặc đổi lựa chọn nhận tin, kèm phiên bản chính sách lúc đó."
        >
          {consents === null ? (
            <p className="text-sm text-muted">Chưa đọc được lịch sử. Vui lòng thử lại sau.</p>
          ) : consents.length === 0 ? (
            <p className="text-sm text-muted">Chưa có bản ghi nào.</p>
          ) : (
            <ul className="divide-y divide-line">
              {consents.map((c) => (
                <li key={c.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {PURPOSE[c.purpose] ?? c.purpose}
                      {c.bookings?.code ? <span className="font-normal text-muted"> · đơn {c.bookings.code}</span> : null}
                    </p>
                    <p className="text-sm text-muted">
                      {SOURCE[c.source] ?? c.source}
                      {c.privacy?.version ? ` · chính sách bảo vệ dữ liệu phiên bản ${c.privacy.version}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-sm">
                    <Badge tone={c.granted ? 'green' : 'neutral'}>{c.granted ? 'Đồng ý' : 'Rút lại'}</Badge>
                    <span className="text-muted tabular">{formatDateTime(c.created_at)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <aside className="flex flex-col gap-5">
        <Section
          icon={<FileLock2 className="size-5" aria-hidden />}
          title="Sửa, xóa dữ liệu"
          description="Yêu cầu sửa thông tin, xóa tài khoản, hạn chế hoặc phản đối xử lý."
        >
          <Link
            href={DATA_REQUEST_HREF}
            className="inline-flex min-h-11 w-full items-center justify-between gap-2 rounded-control bg-ink px-4 font-medium text-paper hover:bg-ink/85"
          >
            Gửi yêu cầu
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          {requests && requests.length > 0 && (
            <ul className="mt-4 flex flex-col gap-2">
              {requests.map((r) => {
                const st = DATA_REQUEST_STATUS[r.status] ?? { label: r.status, tone: 'neutral' as const };
                return (
                  <li key={r.id} className="rounded-control bg-hall px-3 py-2 text-sm">
                    <p className="flex items-center justify-between gap-2">
                      <span className="font-medium">{kindLabel(r.kind)}</span>
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </p>
                    <p className="text-muted tabular">
                      {r.code} · gửi {formatDate(r.received_at)}
                      {r.resolved_at ? ` · xong ${formatDate(r.resolved_at)}` : ` · hạn ${formatDate(r.extended_due_at ?? r.due_at)}`}
                    </p>
                    {r.resolution_note && <p className="mt-1">{r.resolution_note}</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
        <nav aria-label="Chính sách" className="flex flex-col gap-1 rounded-panel border border-line p-2 text-sm">
          {LEGAL_CODES.map((code) => (
            <Link key={code} href={legalHref(code)} className="rounded-control px-3 py-2 hover:bg-hall">
              {LEGAL_PAGES[code].label}
            </Link>
          ))}
        </nav>
      </aside>
    </div>
  );
}
