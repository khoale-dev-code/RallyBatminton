import Link from 'next/link';

import { ActionButton } from '@/components/ui/action-button';
import { buttonClass } from '@/components/ui/button';
import { PeriodNav } from '@/components/ui/day-nav';
import { ActionForm, SelectField, SubmitButton, TextField } from '@/components/ui/form';
import { Notice } from '@/components/ui/notice';
import { Badge, Disclosure, EmptyState, PageHeader, Panel, Stat } from '@/components/ui/primitives';
import { addAdjustmentAction, closePayrollAction, voidAdjustmentAction } from '@/features/payroll/actions';
import { getPayrollMonth, listEmployeesForPayroll } from '@/features/payroll/queries';
import { requireOwner } from '@/lib/auth/guards';
import { formatDateTime, formatMinutes, formatMonthKey, formatVnd } from '@/lib/format';
import { addMonths, monthKey, todayKey } from '@/lib/time';

export const metadata = { title: 'Bảng lương' };

export default async function PayrollPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requireOwner();
  const { month: raw } = await searchParams;
  const currentMonth = monthKey(todayKey());
  const month = raw && /^\d{4}-\d{2}-01$/.test(raw) ? raw : addMonths(currentMonth, -1);
  const [{ period, rows, adjustments, totals }, employees] = await Promise.all([getPayrollMonth(month), listEmployeesForPayroll()]);
  const closed = period !== null;
  const canClose = !closed && month < currentMonth;

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
      {!closed && totals.pendingOvertime > 0 && (
        <div className="mb-6">
          <Notice tone="info" title="Đề nghị tăng ca chưa được trả lời">
            {totals.pendingOvertime} đề nghị tăng ca nhân viên chưa đồng ý — chưa tính giá tăng ca. Nếu nhân viên đã đồng ý trực tiếp, hủy
            đề nghị và ghi lại với “Nhân viên đã đồng ý trực tiếp”.
          </Notice>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel>
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
              <Stat label="Tổng thực lĩnh" value={<span className="font-display text-3xl tabular">{formatVnd(totals.net)}</span>} />
              <Stat
                label="Tiền tăng ca"
                value={<span className="font-display text-3xl tabular">{formatVnd(totals.overtimePay)}</span>}
                hint={totals.overtimeMinutes > 0 ? `${formatMinutes(totals.overtimeMinutes)} tăng ca` : 'Chưa có tăng ca'}
              />
              <Stat label="Nhân viên" value={<span className="font-display text-3xl tabular">{rows.length}</span>} />
            </div>
          </Panel>
          {rows.length === 0 ? (
            <EmptyState title="Chưa có ca làm hoặc điều chỉnh trong tháng" />
          ) : (
            <>
              {/* Điện thoại: mỗi nhân viên một thẻ; từ máy tính bảng: bảng đầy đủ. */}
              <ul className="flex flex-col gap-3 md:hidden">
                {rows.map((r) => (
                  <li key={r.employeeId} className="rounded-panel border border-line bg-paper p-4">
                    <div className="flex items-start justify-between gap-3">
                      <Link href={`/admin/staff/${r.employeeId}`} className="min-w-0 font-medium hover:underline">
                        {r.name}
                        <span className="block text-sm font-normal text-muted">{r.code}</span>
                      </Link>
                      <span className="shrink-0 font-display text-xl whitespace-nowrap tabular">{formatVnd(r.netPay)}</span>
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                      <div>
                        <dt className="text-muted">Ca</dt>
                        <dd className="tabular">{r.shifts}</dd>
                      </div>
                      <div>
                        <dt className="text-muted">Giờ công</dt>
                        <dd className="tabular">{formatMinutes(r.paidMinutes)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted">Tăng ca</dt>
                        <dd className="tabular">
                          {r.overtimeMinutes === 0 ? '—' : `${formatMinutes(r.overtimeMinutes)} · ${formatVnd(r.overtimePay)}`}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted">Điều chỉnh</dt>
                        <dd className="tabular">{r.adjustments === 0 ? '—' : formatVnd(r.adjustments)}</dd>
                      </div>
                    </dl>
                    {(r.unresolved > 0 || r.missingRate > 0) && (
                      <p className="mt-2 text-sm text-amber-deep">
                        {[r.unresolved > 0 ? `${r.unresolved} ca chờ xử lý` : null, r.missingRate > 0 ? 'thiếu mức lương' : null]
                          .filter(Boolean)
                          .join(', ')}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
              <div className="scroll-x hidden rounded-panel border border-line bg-paper md:block">
                <table className="w-full min-w-[46rem] text-left text-[0.95rem]">
                  <thead className="border-b border-line text-sm text-muted">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-medium">
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
                        Trong đó tăng ca
                      </th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">
                        Điều chỉnh
                      </th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">
                        Thực lĩnh
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {rows.map((r) => (
                      <tr key={r.employeeId}>
                        <th scope="row" className="px-4 py-3 font-normal">
                          <Link href={`/admin/staff/${r.employeeId}`} className="hover:underline">
                            {r.name}
                          </Link>
                          <span className="block text-sm text-muted">
                            {r.code}
                            {r.unresolved > 0 && `, ${r.unresolved} ca chờ xử lý`}
                            {r.missingRate > 0 && ', thiếu mức lương'}
                          </span>
                        </th>
                        <td className="px-4 py-3 text-right tabular">{r.shifts}</td>
                        <td className="px-4 py-3 text-right tabular">{formatMinutes(r.paidMinutes)}</td>
                        <td className="px-4 py-3 text-right tabular">{formatVnd(r.basePay)}</td>
                        <td className="px-4 py-3 text-right tabular">
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
                        <td className="px-4 py-3 text-right tabular">{r.adjustments === 0 ? '—' : formatVnd(r.adjustments)}</td>
                        <td className="px-4 py-3 text-right font-display text-lg tabular">{formatVnd(r.netPay)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <Panel title="Thưởng, phụ cấp, khấu trừ">
            {adjustments.length === 0 ? (
              <p className="text-muted">Chưa có khoản điều chỉnh.</p>
            ) : (
              <ul className="divide-y divide-line">
                {adjustments.map((a) => (
                  <li key={a.id} className="flex flex-col gap-1 py-3">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={a.voided_at ? 'text-muted line-through' : ''}>{a.employees?.full_name}</span>
                      <span
                        className={
                          a.voided_at
                            ? 'text-muted line-through tabular'
                            : a.amount > 0
                              ? 'text-court-deep tabular'
                              : 'text-shuttle-deep tabular'
                        }
                      >
                        {a.amount > 0 ? '+' : ''}
                        {formatVnd(a.amount)}
                      </span>
                    </span>
                    <span className="text-sm text-muted">{a.reason}</span>
                    {!closed && !a.voided_at && (
                      <span>
                        <ActionButton
                          action={voidAdjustmentAction.bind(null, a.id)}
                          label="Hủy khoản này"
                          variant="ghost"
                          confirmMessage="Hủy khoản điều chỉnh này?"
                        />
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {!closed && (
              <div className="mt-4">
                <Disclosure summary="Thêm khoản điều chỉnh">
                  <ActionForm action={addAdjustmentAction.bind(null, month)} resetOnSuccess>
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
                    <SubmitButton size="sm">Thêm</SubmitButton>
                  </ActionForm>
                </Disclosure>
              </div>
            )}
          </Panel>
          {canClose && (
            <Panel
              title="Chốt bảng lương"
              description="Sau khi chốt, ca làm, mức lương và điều chỉnh của tháng sẽ bị khóa. Không thể hoàn tác."
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
      </div>
    </>
  );
}
