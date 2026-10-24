import { BellRing, CloudCog, LogOut, RefreshCw, WifiOff } from 'lucide-react';
import { type ReactNode } from 'react';

import { ActionForm, CheckboxField, SubmitButton } from '@/components/ui/form';
import { Badge, PageHeader, Panel } from '@/components/ui/primitives';
import { InstallPanel } from '@/features/manager/components/install-panel';
import { savePushPrefsAction } from '@/features/push/actions';
import { PushPanel } from '@/features/push/components/push-panel';
import { PUSH_PREF_FIELDS } from '@/features/push/lib/push';
import { getMyPushState } from '@/features/push/queries';
import { requireStaff } from '@/lib/auth/guards';
import { formatDate, formatDateTime } from '@/lib/format';

export const metadata = { title: 'Ứng dụng & thông báo' };

function Fact({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-control bg-primary-soft text-primary">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block font-medium">{title}</span>
        <span className="block text-sm text-muted">{children}</span>
      </span>
    </li>
  );
}

export default async function ManagerAppPage() {
  const ctx = await requireStaff();
  const push = await getMyPushState();
  const owner = ctx.role === 'owner';
  return (
    <>
      <PageHeader
        title="Ứng dụng & thông báo"
        description="Cài trang quản trị thành ứng dụng trên máy tính quầy, điện thoại hoặc máy tính bảng: có biểu tượng riêng, mở thành cửa sổ riêng, không cần gõ địa chỉ."
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel title="Cài trên thiết bị này">
            <InstallPanel />
          </Panel>
          <Panel
            id="thong-bao"
            title="Thông báo trên thiết bị này"
            description="Nhận thông báo ngay cả khi không mở Rally Manager. Nội dung chỉ có sân, giờ, mã đơn, số tiền — không có tên hay số điện thoại khách."
          >
            {push ? <PushPanel /> : <p className="text-sm text-muted">Chưa cài đặt — chạy supabase/sql/24_push_notifications.sql.</p>}
          </Panel>
          {push && (
            <Panel
              title="Loại thông báo muốn nhận"
              description="Áp dụng cho mọi thiết bị của bạn. Nhân viên chỉ nhận thông báo của chi nhánh mình có quyền."
            >
              <ActionForm action={savePushPrefsAction}>
                {PUSH_PREF_FIELDS.filter((f) => owner || !f.ownerOnly).map((f) => (
                  <CheckboxField key={f.key} name={f.key} label={f.label} hint={f.hint} defaultChecked={push.prefs[f.key]} />
                ))}
                <SubmitButton size="sm" variant="outline" pendingLabel="Đang lưu…">
                  Lưu lựa chọn
                </SubmitButton>
              </ActionForm>
              {push.devices.length > 0 && (
                <div className="mt-5 border-t border-line pt-4">
                  <p className="mb-2 text-sm font-medium">Thiết bị đã bật ({push.devices.length})</p>
                  <ul className="flex flex-col gap-2 text-sm">
                    {push.devices.map((d) => (
                      <li key={d.id} className="flex flex-wrap items-center justify-between gap-2">
                        <span>
                          {d.label ?? 'Thiết bị'}
                          <span className="block text-xs text-muted">
                            Bật {formatDate(d.createdAt)}
                            {d.lastSentAt ? ` · nhận gần nhất ${formatDateTime(d.lastSentAt)}` : ''}
                          </span>
                        </span>
                        <Badge tone={d.disabled ? 'neutral' : 'green'}>{d.disabled ? 'Đã ngừng' : 'Đang nhận'}</Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Panel>
          )}
        </div>
        <Panel title="Cách Rally Manager hoạt động">
          <ul className="flex flex-col gap-4">
            <Fact icon={<CloudCog className="size-5" />} title="Một nguồn dữ liệu duy nhất">
              Ứng dụng dùng chung máy chủ và database với website: lịch sân, đơn, tồn kho, doanh thu, quyền nhân viên luôn khớp nhau. Đơn
              khách đặt online hiện ngay trên lịch.
            </Fact>
            <Fact icon={<WifiOff className="size-5" />} title="Khi mất Internet">
              Hiện cảnh báo, không gửi thao tác mới (thu tiền, đặt sân) cho tới khi có mạng và không tự gửi lại — tránh ghi trùng. Có mạng
              lại thì tự tải dữ liệu mới.
            </Fact>
            <Fact icon={<RefreshCw className="size-5" />} title="Cập nhật tự động">
              Mỗi lần website có bản mới, Rally Manager báo &quot;Có phiên bản mới&quot; — bấm Tải lại. Không cần cài lại.
            </Fact>
            <Fact icon={<BellRing className="size-5" />} title="Thông báo đẩy">
              Đơn online mới, đã nhận cọc, giao dịch cần xử lý, cảnh báo bảo mật — hiện trên điện thoại / máy quầy kể cả khi đang không mở
              ứng dụng. Bấm vào thông báo mở đúng trang, đúng chi nhánh.
            </Fact>
            <Fact icon={<LogOut className="size-5" />} title="Máy dùng chung">
              Ứng dụng không lưu dữ liệu khách / doanh thu trên máy. Hết ca bấm Đăng xuất (thiết bị cũng ngừng nhận thông báo của bạn);
              người sau đăng nhập bằng tài khoản của mình.
            </Fact>
          </ul>
        </Panel>
      </div>
    </>
  );
}
