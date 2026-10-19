import Link from 'next/link';

import { ActionForm, CheckboxField, SelectField, SubmitButton, TextField } from '@/components/ui/form';
import { PageHeader, Panel } from '@/components/ui/primitives';
import { createCounterBookingAction, createCourtBlockAction } from '@/features/admin-bookings/actions';
import { listCourtsForBranch } from '@/features/admin-bookings/queries';
import { requireBranchPermission } from '@/lib/auth/guards';
import { isOwner } from '@/lib/auth/permissions';
import { newIdempotencyKey } from '@/lib/ids';
import { halfHourOptions } from '@/lib/options';
import { isDateKey, minutesToTime, timeToMinutes, todayKey } from '@/lib/time';

export const metadata = { title: 'Tạo đơn tại quầy' };

interface SearchParams {
  court?: string;
  date?: string;
  start?: string;
}

export default async function NewBookingPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { ctx, branch } = await requireBranchPermission('booking.operate');
  const sp = await searchParams;
  const { branch: info, courts } = await listCourtsForBranch(branch.branchId);
  const date = sp.date && isDateKey(sp.date) ? sp.date : todayKey(info?.timezone);
  const start = sp.start && /^\d{2}:\d{2}$/.test(sp.start) ? sp.start : undefined;
  const end = start ? minutesToTime(Math.min(timeToMinutes(start) + 60, 24 * 60)) : undefined;
  const times = halfHourOptions(true);
  const courtOptions = courts.map((c) => ({ value: c.id, label: c.name }));
  const defaultCourt = courts.some((c) => c.id === sp.court) ? sp.court : courts[0]?.id;

  return (
    <>
      <PageHeader
        title="Tạo đơn tại quầy"
        description={`${branch.name}. Giá tính theo bảng giá hiện hành; database kiểm tra trùng lịch.`}
        back={
          <Link href={`/admin/bookings?date=${date}`} className="text-sm text-muted hover:underline">
            Lịch đặt sân
          </Link>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Đơn của khách">
          <ActionForm action={createCounterBookingAction}>
            <input type="hidden" name="idempotency_key" value={newIdempotencyKey()} />
            <SelectField name="court_id" label="Sân" options={courtOptions} defaultValue={defaultCourt} />
            <TextField name="date" label="Ngày" type="date" defaultValue={date} required />
            <div className="grid grid-cols-2 gap-3">
              <SelectField name="start" label="Từ" options={times} defaultValue={start ?? '18:00'} />
              <SelectField name="end" label="Đến" options={times} defaultValue={end ?? '19:00'} />
            </div>
            <TextField name="phone" label="Số điện thoại khách" type="tel" inputMode="tel" required />
            <TextField name="contact_name" label="Tên khách" required />
            <TextField name="internal_note" label="Ghi chú nội bộ" optional />
            {isOwner(ctx) && <TextField name="discount" label="Giảm giá (₫)" inputMode="numeric" optional />}
            <CheckboxField name="hold_only" label="Chỉ giữ chỗ (chưa xác nhận)" hint="Bỏ chọn để xác nhận ngay khi khách đặt tại quầy." />
            <SubmitButton pendingLabel="Đang tạo…">Tạo đơn</SubmitButton>
          </ActionForm>
        </Panel>
        <Panel title="Khóa sân" description="Bảo trì, vệ sinh, sự kiện. Khung giờ bị khóa không nhận đặt.">
          <ActionForm action={createCourtBlockAction} resetOnSuccess>
            <SelectField name="court_id" label="Sân" options={courtOptions} defaultValue={defaultCourt} />
            <TextField name="date" label="Ngày" type="date" defaultValue={date} required />
            <div className="grid grid-cols-2 gap-3">
              <SelectField name="start" label="Từ" options={times} defaultValue={start ?? '06:00'} />
              <SelectField name="end" label="Đến" options={times} defaultValue={end ?? '08:00'} />
            </div>
            <TextField name="reason" label="Lý do" placeholder="Thay thảm sân" required />
            <SubmitButton variant="outline" pendingLabel="Đang khóa…">
              Khóa sân
            </SubmitButton>
          </ActionForm>
        </Panel>
      </div>
    </>
  );
}
