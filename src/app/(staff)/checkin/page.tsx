import { ActionForm, SubmitButton } from '@/components/ui/form';
import { Notice } from '@/components/ui/notice';
import { Panel } from '@/components/ui/primitives';
import { scanAttendanceAction } from '@/features/attendance/actions';
import { parseScanEvent } from '@/features/attendance/lib/qr-mode';
import { QrScanner } from '@/features/attendance/components/qr-scanner';
import { getMyCurrentShifts } from '@/features/attendance/queries';
import { requireStaff } from '@/lib/auth/guards';
import { formatDateTime, formatTime } from '@/lib/format';

export const metadata = { title: 'Chấm công', robots: { index: false } };

export default async function CheckinPage({ searchParams }: { searchParams: Promise<{ t?: string; e?: string }> }) {
  const ctx = await requireStaff();
  const { t, e } = await searchParams;
  const token = typeof t === 'string' && /^[0-9a-f]{48}$/.test(t) ? t : null;
  // Mã QR ở quầy chia VÀO CA / RA CA: quét mã nào thì chỉ hiện đúng việc đó (mã cũ không có loại → tự chọn theo ca).
  const intended = parseScanEvent(e);

  if (!ctx.employeeId) {
    return (
      <Notice tone="info" title="Tài khoản chủ sân không chấm công">
        Chấm công dành cho tài khoản nhân viên có hồ sơ nhân sự.
      </Notice>
    );
  }

  const { open, next } = await getMyCurrentShifts(ctx.employeeId, new Date().toISOString());
  const tz = (open ?? next)?.branches?.timezone;

  return (
    <>
      <div>
        <p className="text-sm text-muted">Xin chào</p>
        <h1 className="text-3xl">{ctx.displayName}</h1>
      </div>

      <Panel>
        {open ? (
          <p>
            Đang trong ca tại <span className="font-medium">{open.branches?.name}</span> từ{' '}
            <span className="font-display text-lg tabular">{formatTime(open.checked_in_at ?? open.scheduled_start, tz)}</span>, ra ca dự
            kiến <span className="tabular">{formatTime(open.scheduled_end, tz)}</span>.
          </p>
        ) : next ? (
          <p>
            Ca tiếp theo: <span className="font-medium">{next.branches?.name}</span>,{' '}
            <span className="font-display text-lg tabular">
              {formatTime(next.scheduled_start, tz)}–{formatTime(next.scheduled_end, tz)}
            </span>{' '}
            <span className="text-muted">({formatDateTime(next.scheduled_start, tz)})</span>. Vào ca được từ 60 phút trước giờ bắt đầu.
          </p>
        ) : (
          <p className="text-muted">Không có ca nào trong 24 giờ tới.</p>
        )}
      </Panel>

      {token && intended === 'checkin' && open ? (
        <Notice tone="warning" title="Đây là mã VÀO CA">
          Bạn đang trong ca từ {formatTime(open.checked_in_at ?? open.scheduled_start, tz)}. Muốn kết thúc ca, hãy quét mã{' '}
          <strong>RA CA</strong> (màu đỏ) trên màn hình quầy.
        </Notice>
      ) : token && intended === 'checkout' && !open ? (
        <Notice tone="warning" title="Đây là mã RA CA">
          Bạn chưa vào ca nào. Muốn bắt đầu ca, hãy quét mã <strong>VÀO CA</strong> (màu xanh) trên màn hình quầy.
        </Notice>
      ) : token ? (
        <Panel
          title={open ? 'Ra ca' : 'Vào ca'}
          description="Mã QR chỉ có hiệu lực khoảng 90 giây. Nếu báo hết hạn, quét lại mã trên màn hình quầy."
        >
          <ActionForm action={scanAttendanceAction}>
            <input type="hidden" name="token" value={token} />
            {open ? (
              <SubmitButton name="event" value="checkout" variant="alert" size="lg" pendingLabel="Đang ghi…" className="w-full">
                Ra ca ngay
              </SubmitButton>
            ) : (
              <SubmitButton name="event" value="checkin" variant="primary" size="lg" pendingLabel="Đang ghi…" className="w-full">
                Vào ca ngay
              </SubmitButton>
            )}
          </ActionForm>
        </Panel>
      ) : (
        <Panel title="Quét mã tại quầy">
          <QrScanner />
        </Panel>
      )}
    </>
  );
}
