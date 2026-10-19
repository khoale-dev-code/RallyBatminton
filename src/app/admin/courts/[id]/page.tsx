import Link from 'next/link';
import { notFound } from 'next/navigation';

import { MediaImage } from '@/components/brand/media-image';
import { PhotoUploader } from '@/components/media/photo-uploader';
import { ActionButton } from '@/components/ui/action-button';
import { ActionForm, CheckboxField, SelectField, SubmitButton, TextareaField, TextField } from '@/components/ui/form';
import { Badge, PageHeader, Panel } from '@/components/ui/primitives';
import { addCourtPhotoAction, deleteCourtPhotoAction, setCourtCoverAction, updateCourtAction } from '@/features/admin-branches/actions';
import { getCourtForEdit } from '@/features/admin-branches/queries';
import { requireOwner } from '@/lib/auth/guards';
import { COURT_STATUS } from '@/lib/labels';
import { Constants } from '@/lib/supabase/database.types';

export default async function CourtEditPage({ params }: { params: Promise<{ id: string }> }) {
  await requireOwner();
  const { id } = await params;
  const data = await getCourtForEdit(id);
  if (!data) notFound();
  const { court, surfaces } = data;
  const photos = [...court.court_photos].sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order);

  return (
    <>
      <PageHeader
        title={court.name}
        description={court.branches?.name}
        back={
          <Link href={`/admin/branches/${court.branch_id}/courts`} className="text-sm text-muted hover:underline">
            Danh sách sân
          </Link>
        }
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel title="Ảnh sân" description="Ảnh được nén WebP trước khi tải lên. Ảnh chính hiển thị đầu tiên trên trang khách.">
          {photos.length > 0 && (
            <ul className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photos.map((p) => (
                <li key={p.id} className="flex flex-col gap-2">
                  <MediaImage path={p.storage_path} alt={p.alt_text ?? court.name} className="aspect-[4/3] rounded-control" sizes="240px" />
                  <div className="flex flex-wrap items-center gap-2">
                    {p.is_cover ? (
                      <Badge tone="green">Ảnh chính</Badge>
                    ) : (
                      <ActionButton action={setCourtCoverAction.bind(null, p.id)} label="Đặt làm ảnh chính" variant="ghost" />
                    )}
                    <ActionButton
                      action={deleteCourtPhotoAction.bind(null, p.id)}
                      label="Xóa"
                      variant="danger"
                      confirmMessage="Xóa ảnh này?"
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <PhotoUploader folder="courts" ownerId={court.id} onUploaded={addCourtPhotoAction.bind(null, court.id)} />
        </Panel>
        <Panel title="Thông tin sân">
          <ActionForm action={updateCourtAction.bind(null, court.id)}>
            <TextField name="name" label="Tên sân" defaultValue={court.name} required />
            <SelectField
              name="status"
              label="Trạng thái"
              options={Constants.public.Enums.court_status.map((s) => ({ value: s, label: COURT_STATUS[s].label }))}
              defaultValue={court.status}
              hint="Bảo trì: khách thấy nhưng không đặt được. Ngừng sử dụng: ẩn khỏi trang khách."
            />
            <SelectField
              name="surface_code"
              label="Mặt sân"
              placeholder="Chưa chọn"
              options={surfaces.map((s) => ({ value: s.code, label: s.label }))}
              defaultValue={court.surface_code ?? ''}
            />
            <TextField name="sort_order" label="Thứ tự hiển thị" type="number" min={0} defaultValue={court.sort_order} />
            <CheckboxField name="is_indoor" label="Sân trong nhà" defaultChecked={court.is_indoor} />
            <TextareaField name="description" label="Mô tả ngắn" defaultValue={court.description ?? ''} optional rows={3} />
            <SubmitButton pendingLabel="Đang lưu…">Lưu sân</SubmitButton>
          </ActionForm>
        </Panel>
      </div>
    </>
  );
}
