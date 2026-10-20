import { AlarmClockOff, ArrowRight, ClipboardCheck, Clock4, Hourglass, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { type ReactNode } from 'react';

import { Badge, EmptyState, PageHeader } from '@/components/ui/primitives';
import { ActualTimeDecision, FixDecision } from '@/features/attendance/components/review-actions';
import { getReviewQueue } from '@/features/attendance/queries';
import { initialsOf } from '@/features/member/lib/initials';
import { requireOwner, withGuard } from '@/lib/auth/guards';
import { formatDateKey, formatMinutes, formatTime } from '@/lib/format';
import { dateKeyInZone } from '@/lib/time';

export const metadata = { title: 'Duyệt chấm công' };

const minutesBetween = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60_000);

function Person({ name, code, sub }: { name: string; code: string; sub: ReactNode }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft font-display text-sm text-primary">
        {initialsOf(name)}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-medium">
          {name} <span className="font-normal text-muted">· {code}</span>
        </span>
        <span className="block text-sm text-muted">{sub}</span>
      </span>
    </span>
  );
}

function Section({
  icon,
  title,
  count,
  hint,
  children,
}: {
  icon: ReactNode;
  title: string;
  count: number;
  hint: string;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="flex items-center gap-2 text-xl">
          <span aria-hidden className="grid size-8 place-items-center rounded-control bg-primary-soft text-primary">
            {icon}
          </span>
          {title}
          <span className="rounded-full bg-hall px-2 font-sans text-sm text-muted tabular">{count}</span>
        </h2>
        <p className="max-w-xl text-sm text-muted">{hint}</p>
      </header>
      {children}
    </section>
  );
}

/**
 * Hàng đợi của chủ sân: yêu cầu sửa giờ của nhân viên, ca ra trễ hơn khung, ca tự đóng do quên ra, người hay quên.
 * Mở trang là tự đóng các ca quên quét ra đã quá hạn.
 */
export default async function TimesheetReviewPage() {
  const [, q] = await withGuard(requireOwner(), () => getReviewQueue());
  if (!q) {
    return (
      <>
        <PageHeader title="Duyệt chấm công" />
        <EmptyState title="Chưa dùng được trang này">
          Chạy file supabase/sql/21_attendance_rules.sql trong Supabase rồi tải lại trang.
        </EmptyState>
      </>
    );
  }
  const cfg = q.settings;
  const nothing = q.fixes.length === 0 && q.late_outs.length === 0 && q.auto_closed.length === 0 && q.frequent.length === 0;

  return (
    <>
      <PageHeader
        title="Duyệt chấm công"
        description={`Giờ quét QR thật luôn được giữ để đối chiếu. Công chỉ tính trong khung ca (+ tăng ca đã đồng ý); phần ngoài khung cần chủ sân duyệt. Ân hạn đi trễ ${cfg.late_grace_minutes} phút.`}
        actions={
          <Link href="/admin/settings#cham-cong" className="text-sm text-muted underline-offset-4 hover:text-primary hover:underline">
            Đổi quy tắc chấm công
          </Link>
        }
      />

      {nothing && <EmptyState title="Không có việc cần duyệt">Yêu cầu sửa giờ và ca ra trễ của nhân viên sẽ hiện ở đây.</EmptyState>}

      <div className="flex flex-col gap-8">
        {q.frequent.length > 0 && (
          <div className="flex items-start gap-3 rounded-panel border border-amber-deep/25 bg-amber-soft p-4 text-amber-deep">
            <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
            <div>
              <p className="font-medium">Hay quên chấm công tháng này (từ {cfg.forgot_warn_count} lần)</p>
              <p className="text-sm">
                {q.frequent.map((f) => `${f.employee_name} (${f.count} lần)`).join(', ')}. Có thể nhắc nhở hoặc ghi khoản phạt trong Bảng
                lương — hệ thống không tự trừ tiền.
              </p>
            </div>
          </div>
        )}

        {q.fixes.length > 0 && (
          <Section
            icon={<ClipboardCheck className="size-4" />}
            title="Yêu cầu sửa giờ"
            count={q.fixes.length}
            hint="Nhân viên khai giờ thật khi quên quét. Đối chiếu camera / người làm cùng ca rồi duyệt hoặc từ chối (ghi lý do)."
          >
            <ul className="grid gap-3 xl:grid-cols-2">
              {q.fixes.map((f) => {
                const tz = f.timezone;
                const recorded = f.recorded_at;
                const diff = recorded ? Math.abs(minutesBetween(f.claimed_at, recorded)) : null;
                return (
                  <li key={f.id} className="flex flex-col gap-3 rounded-panel border border-line bg-paper p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <Person
                        name={f.employee_name}
                        code={f.employee_code}
                        sub={`${f.branch_name} · ${formatDateKey(dateKeyInZone(new Date(f.scheduled_start), tz))} · ca ${formatTime(f.scheduled_start, tz)}–${formatTime(f.scheduled_end, tz)}`}
                      />
                      <Badge tone={f.kind === 'in' ? 'green' : 'red'}>Sửa giờ {f.kind === 'in' ? 'vào' : 'ra'}</Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 rounded-control bg-hall/70 px-3 py-2 text-sm">
                      <span className="text-muted">Đang ghi</span>
                      <span className="font-medium tabular">{recorded ? formatTime(recorded, tz) : 'chưa có'}</span>
                      <ArrowRight className="size-4 text-muted" aria-label="đổi thành" />
                      <span className="text-muted">Khai</span>
                      <span className="font-display text-lg text-primary tabular">{formatTime(f.claimed_at, tz)}</span>
                      {diff !== null && <span className="text-muted">({formatMinutes(diff)})</span>}
                    </div>
                    <blockquote className="border-l-2 border-primary/40 pl-3 text-[0.95rem]">“{f.reason}”</blockquote>
                    {f.month_fixes >= cfg.forgot_warn_count - 1 && (
                      <p className="flex items-center gap-1.5 text-sm text-amber-deep">
                        <TriangleAlert className="size-4" aria-hidden />
                        Tháng này đã được duyệt {f.month_fixes} lần quên chấm công.
                      </p>
                    )}
                    <FixDecision requestId={f.id} />
                  </li>
                );
              })}
            </ul>
          </Section>
        )}

        {q.late_outs.length > 0 && (
          <Section
            icon={<Clock4 className="size-4" />}
            title="Ra ca trễ cần xem lại"
            count={q.late_outs.length}
            hint={`Quét ra muộn hơn khung ca (+ tăng ca đã đồng ý) từ ${cfg.late_out_review_minutes} phút. Công đang tính tới hết khung; trả thêm chỉ khi nhân viên ở lại làm thật.`}
          >
            <ul className="divide-y divide-line overflow-hidden rounded-panel border border-line bg-paper">
              {q.late_outs.map((s) => {
                const tz = s.timezone;
                const capEnd = new Date(new Date(s.scheduled_end).getTime() + s.overtime_minutes * 60_000).toISOString();
                return (
                  <li key={s.shift_id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                    <Person
                      name={s.employee_name}
                      code={s.employee_code}
                      sub={`${s.branch_name} · ${formatDateKey(dateKeyInZone(new Date(s.scheduled_start), tz))}`}
                    />
                    <dl className="grid grid-cols-3 gap-x-4 text-sm lg:w-[26rem]">
                      <div>
                        <dt className="text-muted">Khung ca</dt>
                        <dd className="tabular">
                          {formatTime(s.scheduled_start, tz)}–{formatTime(capEnd, tz)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted">Quét ra</dt>
                        <dd className="font-medium text-shuttle-deep tabular">
                          {formatTime(s.checked_out_at, tz)} (+{formatMinutes(minutesBetween(capEnd, s.checked_out_at))})
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted">Công đang tính</dt>
                        <dd className="tabular">{formatMinutes(s.paid_minutes)}</dd>
                      </div>
                    </dl>
                    <div className="flex flex-wrap items-center gap-3">
                      <ActualTimeDecision shiftId={s.shift_id} />
                      <Link href={`/admin/shifts/${s.shift_id}`} className="text-sm text-muted hover:text-primary hover:underline">
                        Chi tiết
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Section>
        )}

        {q.auto_closed.length > 0 && (
          <Section
            icon={<AlarmClockOff className="size-4" />}
            title="Tự đóng ca (quên quét ra) — 14 ngày"
            count={q.auto_closed.length}
            hint="Quá hạn quét ra nên hệ thống đóng ca đúng giờ kết thúc theo lịch. Nếu nhân viên ở lại muộn hơn, họ gửi yêu cầu sửa giờ ra."
          >
            <ul className="divide-y divide-line overflow-hidden rounded-panel border border-line bg-paper">
              {q.auto_closed.map((s) => (
                <li key={s.shift_id}>
                  <Link
                    href={`/admin/shifts/${s.shift_id}`}
                    className="flex flex-wrap items-center justify-between gap-3 p-4 transition-colors hover:bg-primary-soft/40"
                  >
                    <Person
                      name={s.employee_name}
                      code={s.employee_code}
                      sub={`${s.branch_name} · ${formatDateKey(dateKeyInZone(new Date(s.scheduled_start), s.timezone))}`}
                    />
                    <span className="flex items-center gap-2 text-sm text-muted tabular">
                      <Hourglass className="size-4" aria-hidden />
                      vào {formatTime(s.checked_in_at, s.timezone)} · tự đóng {formatTime(s.checked_out_at, s.timezone)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </>
  );
}
