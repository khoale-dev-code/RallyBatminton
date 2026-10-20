import { BellRing, CheckCircle2, CircleAlert, Send } from 'lucide-react';
import { type ReactNode } from 'react';

import { ActionForm, CheckboxField, SubmitButton, TextareaField } from '@/components/ui/form';
import { sendTestAlertAction, updateNotificationSettingsAction } from '@/features/settings/actions';
import { cn } from '@/lib/cn';

interface AlertSettingsProps {
  settings: { alert_emails: string[]; alert_on_review: boolean; alert_on_unmatched: boolean } | null;
  ownerEmail: string | null;
  env: { resend: boolean; sepayToken: boolean; cron: boolean };
  siteUrl: string;
}

function EnvRow({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <li className={cn('flex items-start gap-2', ok ? 'text-court-deep' : 'text-shuttle-deep')}>
      {ok ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
      ) : (
        <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      )}
      <span>{children}</span>
    </li>
  );
}

/** Cài đặt email cảnh báo cho chủ sân + trạng thái các khóa trên máy chủ. */
export function AlertSettings({ settings, ownerEmail, env, siteUrl }: AlertSettingsProps) {
  if (!settings) {
    return (
      <p className="flex items-center gap-2 text-sm text-shuttle-deep">
        <CircleAlert className="size-4 shrink-0" aria-hidden />
        Chưa có bảng cài đặt thông báo — chạy <code>supabase/sql/16_alerts_reconcile.sql</code> trên Supabase.
      </p>
    );
  }
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ActionForm action={updateNotificationSettingsAction}>
        <TextareaField
          name="alert_emails"
          label="Email nhận cảnh báo"
          optional
          rows={2}
          defaultValue={settings.alert_emails.join(', ')}
          placeholder={ownerEmail ?? 'chusan@gmail.com'}
          hint={`Tối đa 5 email, cách nhau bằng dấu phẩy. Để trống = gửi tới email tài khoản chủ sân${ownerEmail ? ` (${ownerEmail})` : ''}.`}
        />
        <CheckboxField
          name="alert_on_review"
          label="Giao dịch cần xử lý"
          hint="Khách chuyển sau khi giữ chỗ hết hạn, giờ đã có người đặt, đơn đã hủy, chuyển dư…"
          defaultChecked={settings.alert_on_review}
        />
        <CheckboxField
          name="alert_on_unmatched"
          label="Tiền vào không khớp đơn"
          hint="Nội dung chuyển khoản thiếu / sai mã đơn RB…"
          defaultChecked={settings.alert_on_unmatched}
        />
        <SubmitButton pendingLabel="Đang lưu…">Lưu cài đặt thông báo</SubmitButton>
      </ActionForm>
      <div className="flex flex-col gap-4 rounded-control bg-hall/60 p-4 text-sm">
        <p className="flex items-center gap-2 font-medium">
          <BellRing className="size-4" aria-hidden />
          Cách hoạt động
        </p>
        <p className="text-muted">
          Ngay khi có giao dịch cần xử lý, website gửi một email có tên, số điện thoại khách và việc cần làm — không ai trực website vẫn
          biết ngay. Mỗi giao dịch chỉ báo một lần.
        </p>
        <ul className="flex flex-col gap-1.5">
          <EnvRow ok={env.resend}>
            {env.resend ? 'Đã có RESEND_API_KEY — gửi được email.' : 'Chưa có RESEND_API_KEY — chưa gửi được email (README mục 16).'}
          </EnvRow>
          <EnvRow ok={env.sepayToken}>
            {env.sepayToken ? 'Đã có SEPAY_API_TOKEN — đối soát dự phòng bật.' : 'Chưa có SEPAY_API_TOKEN — chưa đối soát dự phòng.'}
          </EnvRow>
          <EnvRow ok={env.cron}>
            {env.cron ? (
              <>
                Đã có CRON_SECRET — lịch chạy gọi <code className="break-all">{`${siteUrl}/api/cron/sepay-reconcile`}</code>
              </>
            ) : (
              'Chưa có CRON_SECRET — chưa chạy đối soát tự động được.'
            )}
          </EnvRow>
        </ul>
        {env.resend && (
          <ActionForm action={sendTestAlertAction} className="gap-2">
            <SubmitButton size="sm" variant="outline" pendingLabel="Đang gửi…">
              <Send className="size-4" aria-hidden />
              Gửi email thử
            </SubmitButton>
          </ActionForm>
        )}
      </div>
    </div>
  );
}
