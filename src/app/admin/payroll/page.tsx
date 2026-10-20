import { Clock3, Gift, Minus, Plus, TrendingUp, TriangleAlert, Wallet } from 'lucide-react';
import Link from 'next/link';
import { type ReactNode } from 'react';

import { ActionButton } from '@/components/ui/action-button';
import { buttonClass } from '@/components/ui/button';
import { PeriodNav } from '@/components/ui/day-nav';
import { ActionForm, SelectField, SubmitButton, TextField } from '@/components/ui/form';
import { Notice } from '@/components/ui/notice';
import { Badge, Disclosure, EmptyState, PageHeader, Panel } from '@/components/ui/primitives';
import { addAdjustmentAction, closePayrollAction, voidAdjustmentAction } from '@/features/payroll/actions';
import { getReviewQueue } from '@/features/attendance/queries';
import { initialsOf } from '@/features/member/lib/initials';
import { getPayrollMonth, listEmployeesForPayroll } from '@/features/payroll/queries';
import { requireOwner, withGuard } from '@/lib/auth/guards';
import { cn } from '@/lib/cn';
import { formatDateTime, formatMinutes, formatMonthKey, formatVnd } from '@/lib/format';
import { addMonths, monthKey, todayKey } from '@/lib/time';

export const metadata = { title: 'Bảng lương' };

type PayrollRow = Awaited<ReturnType<typeof getPayrollMonth>>['rows'][number];

function Avatar({ name }: { name: string }) {
  return (
    <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft font-display text-sm text-primary">
      {initialsOf(name)}
    </span>
  );
}

function Kpi({ icon, label, value, hint }: { icon: ReactNode; label: string; value: string; hint: string }) {
  return (
    <div className="flex min-w-0 flex-col justify-between gap-2 rounded-panel border border-line bg-paper p-4 last:col-span-2 sm:gap-3 sm:p-5 xl:last:col-span-1">
      <span className="flex items-center gap-2 text-sm text-muted">
        <span className="grid size-7 place-items-center rounded-full bg-primary-soft text-primary">{icon}</span>
        {label}
      </span>
      <span className="font-display text-xl whitespace-nowrap tabular sm:text-3xl">{value}</span>
      <span className="text-sm text-muted">{hint}</span>
    </div>
  );
}

function RowWarnings({ r, compact = false }: { r: PayrollRow; compact?: boolean }) {
  const items = [r.unresolved > 0 ? `${r.unresolved} ca chờ xử lý` : null, r.missingRate > 0 ? 'thiếu mức lương' : null].filter(
    (x): x is string => x !== null,
  );
  if (items.length === 0) return null;
  return (
    <span className={cn('inline-flex items-center gap-1 text-amber-deep', compact ? 'text-xs' : 'mt-2 text-sm')}>
      <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
      {items.join(', ')}
    </span>
  );
}

export default async function PayrollPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month: raw } = await searchParams;
  const currentMonth = monthKey(todayKey());
  const month = raw && /^\d{4}-\d{2}-01$/.test(raw) ? raw : addMonths(currentMonth, -1);
  const [, [{ period, rows, adjustments, totals }, employees, review]] = await withGuard(requireOwner(), () =>
    Promise.all([getPayrollMonth(month), listEmployeesForPayroll(), getReviewQueue()]),
  );
  // Việc chấm công chờ chủ sân (yêu cầu sửa giờ chặn chốt lương; ca ra trễ chỉ nhắc).
  const pendingFixes = review?.fixes.length ?? 0;
  const lateOuts = review?.late_outs.length ?? 0;
  const closed = period !== null;
  const canClose = !closed && month < currentMonth;
  const sum = rows.reduce(
    (acc, r) => ({
      shifts: acc.shifts + r.shifts,
      paidMinutes: acc.paidMinutes + r.paidMinutes,
      basePay: acc.basePay + r.basePay,
      adjustments: acc.adjustments + r.adjustments,
    }),
    { shifts: 0, paidMinutes: 0, basePay: 0, adjustments: 0 },
  );
  const activeAdjustments = adjustments.filter((a) => !a.voided_at).length;

  return (
    <>
      <PageHeader
        title="Bảng lương"
        description={
          <span className="flex flex-wrap items-center gap-2">
            {formatMonthKey(month)}
            {closed ? <Badge tone="green">Đã chốt {formatDateTime(period.closed_at)}</Badge> : <Badge tone="amber">Tạm tính</Badge>}
          </span>
        }
        actions={
          <a href={`/admin/payroll/export?month=${month}`} className={buttonClass('outline')} download>
            Tải CSV
          </a>
        }
      />
      <PeriodNav
        prevHref={`/admin/payroll?month=${addMonths(month, -1)}`}
        nextHref={`/admin/payroll?month=${addMonths(month, 1)}`}
        prevLabel="Tháng trước"
        nextLabel="Tháng sau"
        currentHref={`/admin/payroll?month=${currentMonth}`}
        currentLabel="Tháng này"
      />

      {!closed && (totals.unresolved > 0 || totals.missingRate > 0) && (
        <div className="mb-6">
          <Notice tone="warning" title="Cần xử lý trước khi chốt">
            {totals.unresolved > 0 && (
              <span className="block">
                {totals.unresolved} ca chưa có kết quả (chưa ra ca hoặc chưa đánh dấu vắng/nghỉ). Mở ca trong Lịch ca để điều chỉnh.
              </span>
            )}
            {totals.missingRate > 0 && (
              <span className="block">{totals.missingRate} ca có mặt nhưng nhân viên chưa có mức lương áp dụng.</span>
            )}
          </Notice>
        </div>
      )}
      {!closed && (pendingFixes > 0 || lateOuts > 0) && (
        <div className="mb-6">
          <Notice tone="warning" title="Chấm công cần duyệt">
            {pendingFixes > 0 && (
              <span className="block">{pendingFixes} yêu cầu sửa giờ chưa duyệt — phải xử lý trước khi chốt lương.</span>
            )}
            {lateOuts > 0 && (
              <span className="block">
                {lateOuts} ca ra trễ hơn khung: công đang tính tới hết khung ca, xem lại nếu nhân viên ở lại làm thật.
              </span>
            )}
            <Link href="/admin/timesheet" className="mt-1 inline-block font-medium underline underline-offset-4">
              Mở Duyệt chấm công
            </Link>
          </Notice>
        </div>
      )}
      {!closed && totals.pendingOvertime > 0 && (
        <div className="mb-6">
          <Notice tone="info" title="Đề nghị tăng ca chưa được trả lời">
            {totals.pendingOvertime} đề nghị tăng ca nhân viên chưa đồng ý — chưa tính giá tăng ca. Nếu nhân viên đã đồng ý trực tiếp, hủy
            đề nghị và ghi lại với “Nhân viên đã đồng ý trực tiếp”.
          </Notice>
        </div>
      )}

      <section aria-label="Tổng quan tháng" className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <div className="col-span-2 flex flex-col justify-between gap-3 rounded-panel bg-primary p-5 text-paper xl:col-span-1 shadow-[0_18px_40px_-24px_rgb(0_75_147/0.9)]">
          <span className="flex items-center gap-2 text-sm text-paper/80">
            <Wallet className="size-4" aria-hidden />
            Tổng thực lĩnh
          </span>
          <span className="font-display text-3xl tabular sm:text-4xl">{formatVnd(totals.net)}</span>
          <span className="text-sm text-paper/75">{closed ? 'Đã chốt — số liệu khóa' : 'Tạm tính đến hôm nay'}</span>
        </div>
        <Kpi
          icon={<Clock3 className="size-4" aria-hidden />}
          label="Lương theo ca"
          value={formatVnd(sum.basePay)}
          hint={`${formatMinutes(sum.paidMinutes)} công · ${sum.shifts} ca`}
        />
        <Kpi
          icon={<TrendingUp className="size-4" aria-hidden />}
          label="Tiền tăng ca"
          value={formatVnd(totals.overtimePay)}
          hint={totals.overtimeMinutes > 0 ? `${formatMinutes(totals.overtimeMinutes)} tăng ca (đã gồm trong lương ca)` : 'Chưa có tăng ca'}
        />
        <Kpi
          icon={<Gift className="size-4" aria-hidden />}
          label="Thưởng / khấu trừ"
          value={`${sum.adjustments > 0 ? '+' : ''}${formatVnd(sum.adjustments)}`}
          hint={`${activeAdjustments} khoản · ${rows.length} nhân viên`}
        />
      </section>

      {rows.length === 0 ? (
        <EmptyState title="Chưa có ca làm hoặc điều chỉnh trong tháng" />
      ) : (
        <>
          {/* Điện thoại: mỗi nhân viên một thẻ; từ máy tính bảng: bảng đầy đủ. */}
          <ul className="mb-6 flex flex-col gap-3 md:hidden">
            {rows.map((r) => (
              <li key={r.employeeId} className="rounded-panel border border-line bg-paper p-4">
                <div className="flex items-center gap-3">
                  <Avatar name={r.name} />
                  <Link href={`/admin/staff/${r.employeeId}`} className="min-w-0 flex-1 font-medium hover:text-primary">
                    <span className="block truncate">{r.name}</span>
                    <span className="block text-sm font-normal text-muted">{r.code}</span>
                  </Link>
                  <span className="shrink-0 font-display text-xl whitespace-nowrap text-primary tabular">{formatVnd(r.netPay)}</span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 rounded-control bg-hall/70 p-3 text-sm">
                  <div>
                    <dt className="text-muted">Ca · giờ công</dt>
                    <dd className="tabular">
                      {r.shifts} ca · {formatMinutes(r.paidMinutes)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Lương ca</dt>
                    <dd className="tabular">{formatVnd(r.basePay)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Tăng ca</dt>
                    <dd className="tabular">
                      {r.overtimeMinutes === 0 ? '—' : `${formatVnd(r.overtimePay)} · ${formatMinutes(r.overtimeMinutes)}`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Điều chỉnh</dt>
                    <dd className={cn('tabular', r.adjustments < 0 && 'text-shuttle-deep')}>
                      {r.adjustments === 0 ? '—' : `${r.adjustments > 0 ? '+' : ''}${formatVnd(r.adjustments)}`}
                    </dd>
                  </div>
                </dl>
                <RowWarnings r={r} />
              </li>
            ))}
          </ul>

          <div className="scroll-x mb-6 hidden rounded-panel border border-line bg-paper md:block">
            <table className="w-full min-w-[52rem] text-left text-[0.95rem]">
              <thead>
                <tr className="border-b border-line bg-hall/60 text-xs tracking-wide text-muted uppercase">
                  <th scope="col" className="px-5 py-3 font-medium">
                    Nhân viên
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Ca
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Giờ công
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Lương ca
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Tăng ca
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Điều chỉnh
                  </th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">
                    Thực lĩnh
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.employeeId} className="transition-colors hover:bg-primary-soft/40">
                    <th scope="row" className="px-5 py-3 font-normal">
                      <span className="flex items-center gap-3">
                        <Avatar name={r.name} />
                        <span className="min-w-0">
                          <Link href={`/admin/staff/${r.employeeId}`} className="block font-medium whitespace-nowrap hover:text-primary">
                            {r.name}
                          </Link>
                          <span className="block text-sm text-muted">{r.code}</span>
                          <RowWarnings r={r} compact />
                        </span>
                      </span>
                    </th>
                    <td className="px-4 py-3 text-right tabular">{r.shifts}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap tabular">{formatMinutes(r.paidMinutes)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap tabular">{formatVnd(r.basePay)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap tabular">
                      {r.overtimeMinutes === 0 ? (
                        <span className="text-muted">—</span>
                      ) : (
                        <>
                          {formatVnd(r.overtimePay)}
                          <span className="block text-xs text-muted">{formatMinutes(r.overtimeMinutes)}</span>
                        </>
                      )}
                      {r.pendingOvertime > 0 && <span className="block text-xs text-amber-deep">{r.pendingOvertime} chờ đồng ý</span>}
                    </td>
                    <td
                      className={cn(
                        'px-4 py-3 text-right whitespace-nowrap tabular',
                        r.adjustments > 0 && 'text-primary',
                        r.adjustments < 0 && 'text-shuttle-deep',
                        r.adjustments === 0 && 'text-muted',
                      )}
                    >
                      {r.adjustments === 0 ? '—' : `${r.adjustments > 0 ? '+' : ''}${formatVnd(r.adjustments)}`}
                    </td>
                    <td className="px-5 py-3 text-right font-display text-lg whitespace-nowrap tabular">{formatVnd(r.netPay)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-line bg-hall/60 font-medium">
                  <th scope="row" className="px-5 py-3 text-left">
                    Tổng {rows.length} nhân viên
                  </th>
                  <td className="px-4 py-3 text-right tabular">{sum.shifts}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap tabular">{formatMinutes(sum.paidMinutes)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap tabular">{formatVnd(sum.basePay)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap tabular">
                    {totals.overtimePay === 0 ? '—' : formatVnd(totals.overtimePay)}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap tabular">
                    {sum.adjustments === 0 ? '—' : `${sum.adjustments > 0 ? '+' : ''}${formatVnd(sum.adjustments)}`}
                  </td>
                  <td className="px-5 py-3 text-right font-display text-xl whitespace-nowrap text-primary tabular">
                    {formatVnd(totals.net)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}

      <div className={cn('grid grid-cols-1 items-start gap-6', canClose && 'lg:grid-cols-[minmax(0,1fr)_22rem]')}>
        <Panel
          title="Thưởng, phụ cấp, khấu trừ"
          description={closed ? 'Tháng đã chốt — không thêm / hủy được.' : 'Cộng hoặc trừ vào thực lĩnh của nhân viên trong tháng.'}
        >
          {adjustments.length === 0 ? (
            <p className="rounded-control bg-hall/60 px-4 py-3 text-sm text-muted">Chưa có khoản điều chỉnh.</p>
          ) : (
            <ul className="grid gap-x-6 sm:grid-cols-2">
              {adjustments.map((a) => (
                <li key={a.id} className="flex items-start gap-3 border-b border-line py-3">
                  <span
                    aria-hidden
                    className={cn(
                      'mt-0.5 grid size-8 shrink-0 place-items-center rounded-full',
                      a.voided_at
                        ? 'bg-hall text-muted'
                        : a.amount > 0
                          ? 'bg-primary-soft text-primary'
                          : 'bg-shuttle-soft text-shuttle-deep',
                    )}
                  >
                    {a.amount > 0 ? <Plus className="size-4" /> : <Minus className="size-4" />}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={cn('truncate font-medium', a.voided_at && 'text-muted line-through')}>{a.employees?.full_name}</span>
                      <span
                        className={cn(
                          'shrink-0 font-medium whitespace-nowrap tabular',
                          a.voided_at ? 'text-muted line-through' : a.amount > 0 ? 'text-primary' : 'text-shuttle-deep',
                        )}
                      >
                        {a.amount > 0 ? '+' : ''}
                        {formatVnd(a.amount)}
                      </span>
                    </span>
                    <span className="text-sm text-muted">
                      {a.reason}
                      {a.voided_at ? ' · đã hủy' : ''}
                    </span>
                    {!closed && !a.voided_at && (
                      <span className="mt-1">
                        <ActionButton
                          action={voidAdjustmentAction.bind(null, a.id)}
                          label="Hủy khoản này"
                          variant="ghost"
                          confirmMessage="Hủy khoản điều chỉnh này?"
                        />
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {!closed && (
            <div className="mt-4">
              <Disclosure summary="+ Thêm khoản điều chỉnh">
                <ActionForm action={addAdjustmentAction.bind(null, month)} resetOnSuccess>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <SelectField
                      name="employee_id"
                      label="Nhân viên"
                      placeholder="Chọn nhân viên"
                      options={employees.map((e) => ({ value: e.id, label: `${e.full_name} (${e.code})` }))}
                      required
                    />
                    <SelectField
                      name="direction"
                      label="Loại"
                      options={[
                        { value: 'plus', label: 'Cộng (thưởng, phụ cấp)' },
                        { value: 'minus', label: 'Trừ (tạm ứng, phạt)' },
                      ]}
                    />
                    <TextField name="amount" label="Số tiền (đ)" inputMode="numeric" required />
                    <TextField name="reason" label="Lý do" required />
                  </div>
                  <SubmitButton size="sm">Thêm khoản</SubmitButton>
                </ActionForm>
              </Disclosure>
            </div>
          )}
        </Panel>
        {canClose && (
          <Panel
            title="Chốt bảng lương"
            description="Sau khi chốt, ca làm, mức lương và điều chỉnh của tháng bị khóa. Không thể hoàn tác."
            className="lg:sticky lg:top-6"
          >
            <ActionButton
              action={closePayrollAction.bind(null, month)}
              label={`Chốt ${formatMonthKey(month).toLowerCase()}`}
              variant="primary"
              size="md"
              confirmMessage={`Chốt bảng lương ${formatMonthKey(month)}? Thao tác này không hoàn tác được.`}
            />
          </Panel>
        )}
      </div>
    </>
  );
}
