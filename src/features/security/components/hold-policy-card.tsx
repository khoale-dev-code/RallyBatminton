import { ActionForm, SelectField, SubmitButton, TextField } from '@/components/ui/form';
import { Badge, Panel } from '@/components/ui/primitives';
import { formatDate } from '@/lib/format';

import { setHoldPolicyAction } from '../actions';
import { HOLD_LEVEL_INFO, type HoldStatus } from '../types';

/** Trang chi tiết khách: chế độ giữ sân online (tự động / tin cậy / tạm chặn). */
export function HoldPolicyCard({ customerId, status }: { customerId: string; status: HoldStatus }) {
  const info = HOLD_LEVEL_INFO[status.level];
  const manual = status.reason === 'manual';
  return (
    <Panel
      title="Giữ sân online"
      description={`Tự động giới hạn khi giữ rồi bỏ (không chuyển cọc) từ ${status.elevated_after} lần, tạm chặn từ ${status.block_after} lần trong ${status.window_days} ngày.`}
    >
      <div className="flex flex-col gap-3">
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <Badge tone={info.tone}>{info.label}</Badge>
          <span className="text-muted">{manual ? 'do nhân viên đặt' : 'tự động'}</span>
        </p>
        <p className="text-sm text-muted">
          {info.hint} Giữ rồi bỏ: {status.abandoned} lần / {status.window_days} ngày.
          {manual && status.note ? ` Lý do: ${status.note}.` : ''}
          {manual && status.until ? ` Đến ${formatDate(status.until)}.` : ''}
        </p>
        {status.can_edit && (
          <ActionForm action={setHoldPolicyAction} className="gap-3">
            <input type="hidden" name="customerId" value={customerId} />
            <SelectField
              name="policy"
              label="Đổi chế độ"
              defaultValue={manual ? status.level : 'auto'}
              options={[
                { value: 'auto', label: 'Tự động (theo lịch sử giữ sân)' },
                { value: 'trusted', label: 'Tin cậy — bỏ giới hạn (khách quen bị chặn nhầm)' },
                { value: 'blocked', label: 'Tạm chặn giữ online' },
              ]}
            />
            <TextField name="note" label="Lý do" placeholder="Vd. khách quen, đã gọi xác nhận" optional />
            <SelectField
              name="days"
              label="Áp dụng trong"
              defaultValue=""
              options={[
                { value: '', label: 'Đến khi đổi lại' },
                { value: '1', label: '1 ngày' },
                { value: '7', label: '7 ngày' },
                { value: '30', label: '30 ngày' },
                { value: '90', label: '90 ngày' },
              ]}
            />
            <SubmitButton size="sm" variant="outline" pendingLabel="Đang lưu…">
              Lưu
            </SubmitButton>
          </ActionForm>
        )}
      </div>
    </Panel>
  );
}
