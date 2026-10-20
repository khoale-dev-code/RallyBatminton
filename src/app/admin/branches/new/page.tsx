import { CalendarClock, CircleDollarSign, Globe, LayoutGrid, MapPin, Phone, Store } from 'lucide-react';
import Link from 'next/link';
import { type ReactNode } from 'react';

import { ActionForm, SubmitButton, TextField } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/primitives';
import { createBranchAction } from '@/features/admin-branches/actions';
import { requireOwner } from '@/lib/auth/guards';

export const metadata = { title: 'Thêm chi nhánh' };

function FormGroup({ icon, title, hint, children }: { icon: ReactNode; title: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="grid gap-4 border-b border-line pb-6 last:border-b-0 last:pb-0 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-8">
      <legend className="sr-only">{title}</legend>
      <div className="flex items-start gap-3 md:flex-col md:gap-2">
        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-control bg-primary-soft text-primary">
          {icon}
        </span>
        <div>
          <p className="font-medium">{title}</p>
          {hint && <p className="text-sm text-muted">{hint}</p>}
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
    </fieldset>
  );
}

const STEPS = [
  { icon: Store, title: 'Tạo bản nháp', text: 'Tên, địa chỉ, số điện thoại. Khách chưa thấy chi nhánh.' },
  { icon: LayoutGrid, title: 'Thêm sân', text: 'Mở ngay sau khi tạo: tên sân, mặt sân, ảnh.' },
  { icon: CircleDollarSign, title: 'Bảng giá', text: 'Giá theo khung giờ, ngày thường / cuối tuần.' },
  { icon: CalendarClock, title: 'Giờ mở cửa & công bố', text: 'Đủ sân và giá là bấm Công bố để khách đặt online.' },
];

export default async function NewBranchPage() {
  await requireOwner();
  return (
    <>
      <PageHeader
        title="Thêm chi nhánh"
        description="Chi nhánh mới ở trạng thái bản nháp cho tới khi anh/chị bấm Công bố."
        back={
          <Link href="/admin/branches" className="text-sm text-muted hover:text-primary hover:underline">
            Chi nhánh & sân
          </Link>
        }
      />
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="rounded-panel border border-line bg-paper p-4 sm:p-6">
          <ActionForm action={createBranchAction}>
            <div className="flex flex-col gap-6">
              <FormGroup icon={<Store className="size-4" />} title="Thông tin chung" hint="Tên hiện trên website và hóa đơn.">
                <TextField name="name" label="Tên chi nhánh" placeholder="Rally Thủ Đức" required />
                <TextField
                  name="slug"
                  label="Đường dẫn trên website"
                  optional
                  placeholder="rally-thu-duc"
                  hint="Để trống sẽ tự tạo từ tên."
                />
              </FormGroup>
              <FormGroup icon={<MapPin className="size-4" />} title="Địa chỉ" hint="Khách dùng để tìm đường tới sân.">
                <TextField name="address_line" label="Số nhà, đường" placeholder="12 Võ Văn Ngân" required />
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField name="ward" label="Phường/xã" optional />
                  <TextField name="district" label="Quận/huyện" optional />
                </div>
                <TextField name="city" label="Tỉnh/thành phố" defaultValue="TP. Hồ Chí Minh" required />
              </FormGroup>
              <FormGroup icon={<Phone className="size-4" />} title="Liên hệ" hint="Hiện ở trang chi nhánh để khách gọi hỏi sân.">
                <TextField name="phone" label="Số điện thoại chi nhánh" type="tel" inputMode="tel" placeholder="0901 234 567" optional />
              </FormGroup>
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
                <Link href="/admin/branches" className="text-center text-sm text-muted hover:text-ink sm:mr-auto">
                  Hủy
                </Link>
                <SubmitButton pendingLabel="Đang tạo…">Tạo chi nhánh (bản nháp)</SubmitButton>
              </div>
            </div>
          </ActionForm>
        </section>

        <aside className="rounded-panel border border-line bg-paper p-5 xl:sticky xl:top-6">
          <p className="flex items-center gap-2 font-display text-lg">
            <Globe className="size-5 text-primary" aria-hidden />
            Các bước mở chi nhánh
          </p>
          <ol className="mt-4 flex flex-col">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative flex gap-3 pb-5 last:pb-0">
                {i < STEPS.length - 1 && <span aria-hidden className="absolute top-9 bottom-0 left-[1.0625rem] w-px bg-line" />}
                <span
                  className={
                    i === 0
                      ? 'relative grid size-9 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-paper'
                      : 'relative grid size-9 shrink-0 place-items-center rounded-full border border-line bg-paper text-sm font-semibold text-muted'
                  }
                >
                  {i + 1}
                </span>
                <div className="pt-1">
                  <p className="flex items-center gap-1.5 font-medium">
                    <s.icon className="size-4 text-muted" aria-hidden />
                    {s.title}
                  </p>
                  <p className="text-sm text-muted">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </>
  );
}
