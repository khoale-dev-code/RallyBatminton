import Link from 'next/link';
import { notFound } from 'next/navigation';

import { MediaImage } from '@/components/brand/media-image';
import { PhotoUploader } from '@/components/media/photo-uploader';
import { ActionButton } from '@/components/ui/action-button';
import { ActionForm, SelectField, SubmitButton, TextareaField, TextField } from '@/components/ui/form';
import { Notice } from '@/components/ui/notice';
import { Badge, PageHeader, Panel } from '@/components/ui/primitives';
import {
  setBranchAmenitiesAction,
  setBranchCoverAction,
  setBranchStatusAction,
  updateBranchAction,
} from '@/features/admin-branches/actions';
import { BranchTabs } from '@/features/admin-branches/components/branch-tabs';
import { BankFields } from '@/features/payments/components/bank-fields';
import { getBranchForEdit } from '@/features/admin-branches/queries';
import { requireOwner } from '@/lib/auth/guards';
import { BRANCH_STATUS } from '@/lib/labels';
import { halfHourOptions } from '@/lib/options';
import { shortTime } from '@/lib/time';

const PROBLEM_TEXT: Record<string, string> = {
  MISSING_ADDRESS: 'Thiếu địa chỉ',
  NO_ACTIVE_COURT: 'Chưa có sân đang hoạt động',
  COURT_WITHOUT_PRICE: 'Có sân chưa có bảng giá',
};

export default async function BranchEditPage({ params }: { params: Promise<{ id: string }> }) {
  await requireOwner();
  const { id } = await params;
  const data = await getBranchForEdit(id);
  if (!data) notFound();
  const { branch: b, amenities, selectedAmenities, publishProblems } = data;
  const status = BRANCH_STATUS[b.status];
  const times = halfHourOptions(true);

  return (
    <>
      <PageHeader
        title={b.name}
        back={
          <Link href="/admin/branches" className="text-sm text-muted hover:underline">
            Chi nhánh & sân
          </Link>
        }
        actions={
          b.status === 'published' ? (
            <Link href={`/branches/${b.slug}`} target="_blank" className="text-sm underline underline-offset-4">
              Xem trang khách
            </Link>
          ) : null
        }
      />
      <BranchTabs branchId={b.id} active="info" />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-6">
          <Panel title="Thông tin chung">
            <ActionForm action={updateBranchAction.bind(null, b.id)}>
              <TextField name="name" label="Tên chi nhánh" defaultValue={b.name} required />
              <TextField name="slug" label="Đường dẫn" defaultValue={b.slug} hint={`Trang khách: /branches/${b.slug}`} required />
              <TextField name="address_line" label="Số nhà, đường" defaultValue={b.address_line} required />
              <div className="grid gap-4 sm:grid-cols-3">
                <TextField name="ward" label="Phường/xã" defaultValue={b.ward ?? ''} optional />
                <TextField name="district" label="Quận/huyện" defaultValue={b.district ?? ''} optional />
                <TextField name="city" label="Tỉnh/thành" defaultValue={b.city} required />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField name="phone" label="Điện thoại" type="tel" defaultValue={b.phone ?? ''} optional />
                <TextField name="map_url" label="Link Google Maps" type="url" defaultValue={b.map_url ?? ''} optional />
              </div>
              <TextareaField
                name="map_embed"
                label="Bản đồ nhúng Google Maps"
                rows={3}
                defaultValue={b.map_embed_url ?? ''}
                optional
                className="font-mono text-xs"
                placeholder='<iframe src="https://www.google.com/maps/embed?pb=…"></iframe>'
                hint="Google Maps → tìm sân → Chia sẻ → Nhúng bản đồ → Sao chép HTML, rồi dán nguyên đoạn vào đây. Để trống: tự hiện bản đồ theo địa chỉ."
              />
              {b.map_embed_url && (
                <iframe
                  title={`Bản đồ ${b.name}`}
                  src={b.map_embed_url}
                  className="aspect-[16/9] w-full rounded-control border border-line"
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField name="latitude" label="Vĩ độ" inputMode="decimal" defaultValue={b.latitude ?? ''} optional />
                <TextField name="longitude" label="Kinh độ" inputMode="decimal" defaultValue={b.longitude ?? ''} optional />
              </div>

              <h3 className="mt-2 text-lg">Giờ mở cửa & quy tắc đặt</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField name="opens_at" label="Mở cửa" options={times} defaultValue={shortTime(b.opens_at)} />
                <SelectField name="closes_at" label="Đóng cửa" options={times} defaultValue={shortTime(b.closes_at)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <SelectField
                  name="slot_minutes"
                  label="Ô thời gian"
                  options={[
                    { value: '30', label: '30 phút' },
                    { value: '60', label: '60 phút' },
                  ]}
                  defaultValue={String(b.slot_minutes)}
                />
                <TextField
                  name="min_booking_minutes"
                  label="Tối thiểu (phút)"
                  type="number"
                  min={30}
                  step={30}
                  defaultValue={b.min_booking_minutes}
                />
                <TextField
                  name="max_booking_minutes"
                  label="Tối đa (phút)"
                  type="number"
                  min={30}
                  step={30}
                  defaultValue={b.max_booking_minutes}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <TextField name="hold_minutes" label="Giữ chỗ (phút)" type="number" min={5} max={30} defaultValue={b.hold_minutes} />
                <TextField
                  name="booking_window_days"
                  label="Đặt trước tối đa (ngày)"
                  type="number"
                  min={1}
                  max={90}
                  defaultValue={b.booking_window_days}
                />
                <TextField name="deposit_percent" label="Tỉ lệ cọc (%)" type="number" min={0} max={100} defaultValue={b.deposit_percent} />
              </div>

              <details className="rounded-control border border-line px-4 py-2" open={Boolean(b.bank_code)}>
                <summary className="min-h-10 cursor-pointer py-2 font-medium">Tài khoản nhận cọc riêng (không bắt buộc)</summary>
                <div className="flex flex-col gap-4 pt-2 pb-3">
                  <p className="text-sm text-muted">
                    Để trống thì khách chuyển cọc vào tài khoản ở Cài đặt thương hiệu. Tài khoản riêng cũng phải được liên kết với SePay.
                  </p>
                  <BankFields defaults={b} emptyHint="Trống = dùng tài khoản thương hiệu." />
                </div>
              </details>

              <h3 className="mt-2 text-lg">Chính sách hủy</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <TextField
                  name="free_cancel_hours"
                  label="Hoàn toàn bộ nếu hủy trước (giờ)"
                  type="number"
                  min={0}
                  defaultValue={b.free_cancel_hours}
                />
                <TextField
                  name="partial_refund_hours"
                  label="Hoàn một phần nếu trước (giờ)"
                  type="number"
                  min={0}
                  defaultValue={b.partial_refund_hours}
                />
                <TextField
                  name="partial_refund_percent"
                  label="Tỉ lệ hoàn một phần (%)"
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={b.partial_refund_percent}
                />
              </div>

              <h3 className="mt-2 text-lg">Nội dung hiển thị</h3>
              <TextareaField name="description" label="Giới thiệu" defaultValue={b.description ?? ''} optional rows={4} />
              <TextareaField name="parking_info" label="Gửi xe" defaultValue={b.parking_info ?? ''} optional rows={2} />
              <TextareaField name="house_rules" label="Nội quy sân" defaultValue={b.house_rules ?? ''} optional rows={4} />
              <SubmitButton pendingLabel="Đang lưu…">Lưu thông tin</SubmitButton>
            </ActionForm>
          </Panel>
        </div>

        <div className="flex flex-col gap-6">
          <Panel title="Trạng thái" actions={<Badge tone={status.tone}>{status.label}</Badge>}>
            {publishProblems.length > 0 && b.status !== 'published' && (
              <Notice tone="warning" title="Chưa đủ điều kiện công bố" className="mb-4">
                <ul className="list-inside list-disc">
                  {publishProblems.map((p) => (
                    <li key={p}>{PROBLEM_TEXT[p] ?? p}</li>
                  ))}
                </ul>
              </Notice>
            )}
            <div className="flex flex-col gap-3">
              {b.status !== 'published' && (
                <ActionButton
                  action={setBranchStatusAction.bind(null, b.id)}
                  hidden={{ status: 'published' }}
                  label="Công bố, mở đặt sân"
                  variant="court"
                  size="md"
                />
              )}
              {b.status === 'published' && (
                <ActionButton
                  action={setBranchStatusAction.bind(null, b.id)}
                  hidden={{ status: 'paused' }}
                  label="Tạm ngưng đặt trực tuyến"
                  size="md"
                />
              )}
              {b.status !== 'draft' && b.status !== 'archived' && (
                <ActionButton
                  action={setBranchStatusAction.bind(null, b.id)}
                  hidden={{ status: 'draft' }}
                  label="Chuyển về bản nháp"
                  size="md"
                  variant="ghost"
                />
              )}
              {b.status !== 'archived' && (
                <ActionButton
                  action={setBranchStatusAction.bind(null, b.id)}
                  hidden={{ status: 'archived' }}
                  label="Đóng chi nhánh"
                  variant="danger"
                  size="md"
                  confirmMessage="Đóng chi nhánh? Khách sẽ không thấy chi nhánh này; lịch sử đặt sân vẫn được giữ."
                />
              )}
            </div>
          </Panel>

          <Panel title="Ảnh bìa">
            <MediaImage
              path={b.cover_image_path}
              alt={b.name}
              className="mb-3 aspect-[4/3] rounded-control"
              fallbackLabel="Chưa có ảnh"
              sizes="320px"
            />
            <PhotoUploader
              folder="branches"
              ownerId={b.id}
              onUploaded={setBranchCoverAction.bind(null, b.id)}
              multiple={false}
              replaces={Boolean(b.cover_image_path)}
              label={b.cover_image_path ? 'Đổi ảnh bìa' : 'Tải ảnh bìa'}
            />
          </Panel>

          <Panel title="Tiện ích">
            <ActionForm action={setBranchAmenitiesAction.bind(null, b.id)}>
              <fieldset className="flex flex-col gap-2">
                <legend className="sr-only">Tiện ích chi nhánh</legend>
                {amenities.map((a) => (
                  <label key={a.code} className="flex min-h-9 items-center gap-3">
                    <input
                      type="checkbox"
                      name="amenities"
                      value={a.code}
                      defaultChecked={selectedAmenities.includes(a.code)}
                      className="size-5 accent-[#2e6b1f]"
                    />
                    {a.label}
                  </label>
                ))}
              </fieldset>
              <SubmitButton variant="outline" size="sm">
                Lưu tiện ích
              </SubmitButton>
            </ActionForm>
          </Panel>
        </div>
      </div>
    </>
  );
}
