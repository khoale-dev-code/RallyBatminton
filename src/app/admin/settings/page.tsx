import { CheckCircle2, CircleAlert, Webhook } from 'lucide-react';

import { ActionForm, CheckboxField, SelectField, SubmitButton, TextareaField, TextField } from '@/components/ui/form';
import { PageHeader, Panel } from '@/components/ui/primitives';
import { AlertSettings } from '@/features/payments/components/alert-settings';
import { BankFields } from '@/features/payments/components/bank-fields';
import { updateBankSettingsAction, updateBrandAction, updateTaxSettingsAction } from '@/features/settings/actions';
import { requireOwner } from '@/lib/auth/guards';
import { publicEnv } from '@/lib/env';
import { getAlertEmailConfig, getCronSecret, getSepayApiConfig, getSepayWebhookAuth } from '@/lib/env.server';
import { formatDateTime } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import { formatPercent, TAX_INDUSTRIES, TAX_METHODS, VAT_PRESETS } from '@/lib/tax';

export const metadata = { title: 'Cài đặt thương hiệu' };

export default async function SettingsPage() {
  await requireOwner();
  const supabase = await createClient();
  const [{ data: brand }, { data: lastTxn }, { data: notify }, { data: auth }] = await Promise.all([
    supabase.from('brand_settings').select('*').maybeSingle(),
    supabase.from('bank_transactions').select('created_at').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('notification_settings').select('alert_emails, alert_on_review, alert_on_unmatched').maybeSingle(),
    supabase.auth.getUser(),
  ]);
  const sepay = getSepayWebhookAuth();
  const webhookReady = Boolean(sepay.secret ?? sepay.apiKey);
  const webhookUrl = `${publicEnv.siteUrl.replace(/\/$/, '')}/api/webhooks/sepay`;
  return (
    <>
      <PageHeader
        title="Cài đặt thương hiệu"
        description="Thông tin hiển thị ở chân trang website, hướng dẫn đặt cọc, phiếu thanh toán tại quầy và cách tính thuế."
      />
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
        <Panel title="Thương hiệu">
          <ActionForm action={updateBrandAction}>
            <TextField name="name" label="Tên thương hiệu" defaultValue={brand?.name ?? 'Rally Badminton'} required />
            <TextField name="hotline" label="Hotline" defaultValue={brand?.hotline ?? ''} inputMode="tel" optional />
            <TextField name="email" label="Email" type="email" defaultValue={brand?.email ?? ''} optional />
            <TextField name="address_line" label="Địa chỉ văn phòng" defaultValue={brand?.address_line ?? ''} optional />
            <TextField
              name="website_url"
              label="Website"
              type="url"
              defaultValue={brand?.website_url ?? ''}
              optional
              placeholder="https://"
            />
            <TextField
              name="facebook_url"
              label="Facebook"
              type="url"
              defaultValue={brand?.facebook_url ?? ''}
              optional
              placeholder="https://facebook.com/…"
            />
            <TextField
              name="zalo_url"
              label="Zalo"
              type="url"
              defaultValue={brand?.zalo_url ?? ''}
              optional
              placeholder="https://zalo.me/…"
            />
            <TextareaField
              name="payment_instructions"
              label="Hướng dẫn đặt cọc"
              defaultValue={brand?.payment_instructions ?? ''}
              optional
              rows={4}
              hint="Ví dụ số tài khoản và nội dung chuyển khoản. Khách thấy ngay sau khi giữ sân."
            />
            <SubmitButton pendingLabel="Đang lưu…">Lưu cài đặt</SubmitButton>
          </ActionForm>
        </Panel>
        <div id="chuyen-khoan" className="scroll-mt-20 xl:col-span-2">
          <Panel
            title="Nhận cọc chuyển khoản (SePay)"
            description="Khách thấy mã VietQR ngay sau khi giữ sân. Tiền về tài khoản → SePay báo về website → đơn tự xác nhận, không cần nhân viên kiểm tra."
          >
            <div className="grid gap-6 lg:grid-cols-2">
              <ActionForm action={updateBankSettingsAction}>
                <BankFields defaults={brand} emptyHint="Để trống cả hai ô để tắt mã QR chuyển khoản." />
                <CheckboxField
                  name="transfer_auto_confirm"
                  label="Tự xác nhận đơn khi nhận đủ tiền cọc"
                  hint="Tắt nếu muốn nhân viên tự bấm xác nhận (tiền vẫn được ghi vào đơn)."
                  defaultChecked={brand?.transfer_auto_confirm ?? true}
                />
                <SubmitButton pendingLabel="Đang lưu…">Lưu tài khoản nhận cọc</SubmitButton>
              </ActionForm>
              <div className="flex flex-col gap-3 rounded-control bg-hall/60 p-4 text-sm">
                <p className="flex items-center gap-2 font-medium">
                  <Webhook className="size-4" aria-hidden />
                  Kết nối SePay (làm một lần)
                </p>
                <ol className="ml-4 flex list-decimal flex-col gap-1.5 text-muted">
                  <li>Đăng ký SePay, liên kết đúng tài khoản ngân hàng ở bên trái.</li>
                  <li>
                    <span className="text-ink">Công ty → Cấu hình chung → Cấu trúc mã thanh toán</span>: tiền tố{' '}
                    <strong className="text-ink">RB</strong>, hậu tố 8–8 ký tự, kiểu <strong className="text-ink">Số và chữ</strong>.
                  </li>
                  <li>
                    <span className="text-ink">Webhooks → Thêm</span>: sự kiện Tiền vào, URL:
                    <code className="mt-1 block rounded bg-paper px-2 py-1 break-all text-ink">{webhookUrl}</code>
                  </li>
                  <li>
                    Bảo mật: chọn <strong className="text-ink">HMAC-SHA256</strong> (dán khóa vào biến <code>SEPAY_WEBHOOK_SECRET</code>)
                    hoặc <strong className="text-ink">API Key</strong> (biến <code>SEPAY_WEBHOOK_API_KEY</code>) trên máy chủ / Vercel.
                  </li>
                </ol>
                <p className={webhookReady ? 'flex items-center gap-2 text-court-deep' : 'flex items-center gap-2 text-shuttle-deep'}>
                  {webhookReady ? (
                    <CheckCircle2 className="size-4 shrink-0" aria-hidden />
                  ) : (
                    <CircleAlert className="size-4 shrink-0" aria-hidden />
                  )}
                  {webhookReady ? 'Máy chủ đã có khóa bảo mật webhook.' : 'Máy chủ chưa có khóa webhook — SePay gửi sẽ bị từ chối.'}
                </p>
                <p className="text-muted">
                  {lastTxn ? `Giao dịch gần nhất nhận lúc ${formatDateTime(lastTxn.created_at)}.` : 'Chưa nhận giao dịch nào từ SePay.'}
                </p>
              </div>
            </div>
          </Panel>
        </div>
        <div id="thong-bao" className="scroll-mt-20 xl:col-span-2">
          <Panel
            title="Báo cho chủ sân qua email"
            description="Khi tiền vào nhưng hệ thống không tự xác nhận được đơn (giờ đã có người đặt, đơn đã hủy, sai nội dung…), chủ sân nhận email ngay để liên hệ khách."
          >
            <AlertSettings
              settings={notify}
              ownerEmail={auth.user?.email ?? null}
              siteUrl={publicEnv.siteUrl.replace(/\/$/, '')}
              env={{
                resend: Boolean(getAlertEmailConfig().apiKey),
                sepayToken: Boolean(getSepayApiConfig().token),
                cron: Boolean(getCronSecret()),
              }}
            />
          </Panel>
        </div>
        <div id="thue" className="scroll-mt-20">
          <Panel
            title="Thuế"
            description="Áp dụng cho đơn bán tại quầy. Mỗi đơn ghi lại mức thuế lúc bán, đổi cài đặt không làm sai đơn cũ."
          >
            <ActionForm action={updateTaxSettingsAction}>
              <SelectField
                name="tax_method"
                label="Cách tính thuế"
                defaultValue={brand?.tax_method ?? 'deduction'}
                options={TAX_METHODS.map((m) => ({ value: m.value, label: `${m.label}: ${m.hint}` }))}
              />
              <SelectField
                name="default_vat_rate"
                label="Mức VAT mặc định (khấu trừ)"
                defaultValue={String(Number(brand?.default_vat_rate ?? 8))}
                options={[...new Set([...VAT_PRESETS, Number(brand?.default_vat_rate ?? 8)])]
                  .sort((a, b) => a - b)
                  .map((r) => ({ value: String(r), label: formatPercent(r) }))}
                hint="Sản phẩm chọn “Áp dụng mức thuế VAT mặc định” dùng mức này. Giá bán được hiểu là đã gồm VAT."
              />
              <TextField
                name="tax_code"
                label="Mã số thuế"
                defaultValue={brand?.tax_code ?? ''}
                optional
                inputMode="numeric"
                hint="In trên phiếu thanh toán tại quầy."
              />
              <details className="rounded-control bg-hall/60 px-3 py-2 text-sm">
                <summary className="min-h-9 cursor-pointer py-1.5 font-medium">Tỷ lệ thuế trực tiếp theo nhóm ngành nghề</summary>
                <ul className="mt-1 mb-2 flex flex-col gap-1.5">
                  {TAX_INDUSTRIES.map((i) => (
                    <li key={i.value} className="flex flex-wrap justify-between gap-x-3">
                      <span>{i.label}</span>
                      <span className="text-muted tabular">
                        GTGT {formatPercent(i.vat)} | TNCN {formatPercent(i.pit)}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
              <SubmitButton pendingLabel="Đang lưu…">Lưu cài đặt thuế</SubmitButton>
            </ActionForm>
          </Panel>
        </div>
      </div>
    </>
  );
}
