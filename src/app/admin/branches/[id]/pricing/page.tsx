import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ActionButton } from '@/components/ui/action-button';
import { ActionForm, FieldError, SelectField, SubmitButton, TextField } from '@/components/ui/form';
import { Badge, EmptyState, PageHeader, Panel } from '@/components/ui/primitives';
import { createPriceRuleAction, togglePriceRuleAction } from '@/features/admin-branches/actions';
import { BranchTabs } from '@/features/admin-branches/components/branch-tabs';
import { PriceMatrix } from '@/features/admin-branches/components/price-matrix';
import { getBranchPricing } from '@/features/admin-branches/queries';
import { requireOwner } from '@/lib/auth/guards';
import { formatDate, formatDaysMask, formatVnd } from '@/lib/format';
import { halfHourOptions, WEEKDAY_OPTIONS } from '@/lib/options';
import { shortTime } from '@/lib/time';

export default async function PricingPage({ params }: { params: Promise<{ id: string }> }) {
  await requireOwner();
  const { id } = await params;
  const data = await getBranchPricing(id);
  if (!data) notFound();
  const { branch, rules, courts } = data;
  const courtName = Object.fromEntries(courts.map((c) => [c.id, c.name]));
  const times = halfHourOptions(true);
  const activeRules = rules.filter((r) => r.is_active);

  return (
    <>
      <PageHeader
        title={branch.name}
        back={
          <Link href="/admin/branches" className="text-sm text-muted hover:underline">
            Chi nhánh & sân
          </Link>
        }
      />
      <BranchTabs branchId={branch.id} active="pricing" />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-6">
          <Panel
            title="Xem trước theo tuần"
            description="Giá mỗi giờ cho từng khung 30 phút (giá chung của chi nhánh). Ô trống là giờ chưa có giá — khách không đặt được."
          >
            <PriceMatrix rules={activeRules} opensAt={branch.opens_at} closesAt={branch.closes_at} />
          </Panel>
          <Panel
            title="Quy tắc giá"
            description="Giá riêng của một sân luôn được ưu tiên hơn giá chung. Cùng phạm vi thì độ ưu tiên cao hơn thắng."
          >
            {rules.length === 0 ? (
              <EmptyState title="Chưa có quy tắc giá">Thêm ít nhất một quy tắc phủ giờ mở cửa để công bố chi nhánh.</EmptyState>
            ) : (
              <ul className="divide-y divide-line">
                {rules.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="font-medium">
                        <span className="tabular">
                          {shortTime(r.starts_at)}–{shortTime(r.ends_at)}
                        </span>
                        , {formatDaysMask(r.days_mask)}
                        {r.label ? <span className="text-muted"> ({r.label})</span> : null}
                      </p>
                      <p className="text-sm text-muted">
                        {r.court_id ? `Riêng ${courtName[r.court_id] ?? 'sân'}` : 'Tất cả sân'}, ưu tiên {r.priority}
                        {r.valid_from || r.valid_until
                          ? `, hiệu lực ${r.valid_from ? formatDate(r.valid_from) : '…'} – ${r.valid_until ? formatDate(r.valid_until) : '…'}`
                          : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-display text-xl tabular">{formatVnd(r.price_per_hour)}</span>
                      {r.is_active ? (
                        <ActionButton action={togglePriceRuleAction.bind(null, r.id, false)} label="Tắt" variant="ghost" />
                      ) : (
                        <>
                          <Badge>Đã tắt</Badge>
                          <ActionButton action={togglePriceRuleAction.bind(null, r.id, true)} label="Bật lại" variant="ghost" />
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
        <Panel title="Thêm quy tắc giá" description="Muốn đổi giá: thêm quy tắc mới rồi tắt quy tắc cũ — lịch sử giá được giữ lại.">
          <ActionForm action={createPriceRuleAction.bind(null, branch.id)} resetOnSuccess>
            <SelectField
              name="court_id"
              label="Áp dụng cho"
              placeholder="Tất cả sân"
              options={courts.map((c) => ({ value: c.id, label: c.name }))}
            />
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">Ngày áp dụng</legend>
              <div className="grid grid-cols-7 gap-1">
                {WEEKDAY_OPTIONS.map((d) => (
                  <label
                    key={d.value}
                    className="flex min-h-11 cursor-pointer flex-col items-center justify-center rounded-control border border-line text-sm has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-paper"
                  >
                    <input type="checkbox" name="days" value={d.value} defaultChecked className="sr-only" />
                    {d.label}
                  </label>
                ))}
              </div>
              <FieldError name="days" />
            </fieldset>
            <div className="grid grid-cols-2 gap-3">
              <SelectField name="starts_at" label="Từ" options={times} defaultValue={shortTime(branch.opens_at)} />
              <SelectField name="ends_at" label="Đến" options={times} defaultValue={shortTime(branch.closes_at)} />
            </div>
            <TextField name="price_per_hour" label="Giá mỗi giờ (₫)" inputMode="numeric" placeholder="120000" required />
            <TextField name="label" label="Tên gợi nhớ" placeholder="Giờ vàng" optional />
            <TextField
              name="priority"
              label="Độ ưu tiên"
              type="number"
              min={-100}
              max={100}
              defaultValue={0}
              hint="Dùng số cao hơn cho khuyến mãi hoặc ngày lễ để đè lên giá thường."
            />
            <div className="grid grid-cols-2 gap-3">
              <TextField name="valid_from" label="Hiệu lực từ" type="date" optional />
              <TextField name="valid_until" label="Đến ngày" type="date" optional />
            </div>
            <SubmitButton pendingLabel="Đang thêm…">Thêm quy tắc</SubmitButton>
          </ActionForm>
        </Panel>
      </div>
    </>
  );
}
