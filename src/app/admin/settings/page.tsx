import { Bell, CheckCircle2, CircleAlert, Gauge, Landmark, Palette, Receipt, Webhook } from 'lucide-react';

import { ActionForm, CheckboxField, SelectField, SubmitButton, TextareaField, TextField } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/primitives';
import { AlertSettings } from '@/features/payments/components/alert-settings';
import { BankFields } from '@/features/payments/components/bank-fields';
import { updateBankSettingsAction, updateBrandAction, updateTaxSettingsAction } from '@/features/settings/actions';
import { ServerSpeed } from '@/features/settings/components/server-speed';
import { SettingsNav } from '@/features/settings/components/settings-nav';
import { SettingsSection } from '@/features/settings/components/settings-section';
import { requireOwner, withGuard } from '@/lib/auth/guards';
import { cn } from '@/lib/cn';
import { siteOrigin } from '@/lib/site-origin';
import { getAlertEmailConfig, getCronSecret, getSepayApiConfig, getSepayWebhookAuth } from '@/lib/env.server';
import { formatDateTime } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import { formatPercent, TAX_INDUSTRIES, TAX_METHODS, VAT_PRESETS } from '@/lib/tax';

export const metadata = { title: 'Cài đặt thương hiệu' };

export default async function SettingsPage() {
  const supabase = await createClient();
  const [, [{ data: brand }, { data: lastTxn }, { data: notify }, { data: auth }]] = await withGuard(requireOwner(), () =>
    Promise.all([
      supabase.from('brand_settings').select('*').maybeSingle(),
      supabase.from('bank_transactions').select('created_at').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('notification_settings').select('alert_emails, alert_on_review, alert_on_unmatched').maybeSingle(),
      supabase.auth.getUser(),
    ]),
  );
  const sepay = getSepayWebhookAuth();
  const webhookReady = Boolean(sepay.secret ?? sepay.apiKey);
  const origin = await siteOrigin();
  const webhookUrl = `${origin}/api/webhooks/sepay`;
  const helpBox = 'flex flex-col gap-3 rounded-control bg-hall/70 p-4 text-sm';
  return (
    <>
      <PageHeader
        title="Cài đặt thương hiệu"
        description="Thông tin thương hiệu, nhận tiền chuyển khoản, email cảnh báo, thuế và tốc độ máy chủ."
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[13rem_minmax(0,1fr)] xl:gap-8">
        <SettingsNav />
        <div className="flex min-w-0 flex-col gap-6">
          <SettingsSection
            id="thuong-hieu"
            icon={Palette}
            title="Thương hiệu"
            description="Hiện ở chân trang website, phiếu thanh toán tại quầy và hướng dẫn đặt cọc cho khách."
            aside={
              <div className="overflow-hidden rounded-control bg-hall-dark text-paper">
                <p className="border-b border-paper/10 px-4 py-2 text-xs tracking-wide text-paper/60 uppercase">Xem trước chân trang</p>
                <div className="flex flex-col gap-2 p-4 text-sm">
                  <p className="font-display text-xl">{brand?.name ?? 'Rally Badminton'}</p>
                  {brand?.address_line && <p className="text-paper/75">{brand.address_line}</p>}
                  <p className="flex flex-col gap-1 text-paper/75">
                    {brand?.hotline && <span>Hotline: {brand.hotline}</span>}
                    {brand?.email && <span>{brand.email}</span>}
                  </p>
                  <p className="mt-1 flex gap-2">
                    {brand?.facebook_url && <span className="rounded-full bg-paper/10 px-2.5 py-0.5 text-xs">Facebook</span>}
                    {brand?.zalo_url && <span className="rounded-full bg-paper/10 px-2.5 py-0.5 text-xs">Zalo</span>}
                    {brand?.website_url && <span className="rounded-full bg-paper/10 px-2.5 py-0.5 text-xs">Website</span>}
                  </p>
                </div>
                <div className="h-1 bg-[linear-gradient(90deg,#004b93_0_70%,#ed1c24_70%_100%)]" aria-hidden />
              </div>
            }
          >
            <ActionForm action={updateBrandAction}>
              <div className="grid gap-4 sm:grid-cols-2">
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
                  wrapperClassName="sm:col-span-2"
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
              </div>
              <TextareaField
                name="payment_instructions"
                label="Hướng dẫn đặt cọc"
                defaultValue={brand?.payment_instructions ?? ''}
                optional
                rows={4}
                hint="Ví dụ số tài khoản và nội dung chuyển khoản. Khách thấy ngay sau khi giữ sân."
              />
              <div>
                <SubmitButton pendingLabel="Đang lưu…">Lưu thông tin thương hiệu</SubmitButton>
              </div>
            </ActionForm>
          </SettingsSection>

          <SettingsSection
            id="chuyen-khoan"
            icon={Landmark}
            title="Nhận cọc chuyển khoản (SePay)"
            description="Khách thấy mã VietQR ngay sau khi giữ sân. Tiền về tài khoản → SePay báo về website → đơn tự xác nhận, không cần nhân viên kiểm tra."
            aside={
              <div className={helpBox}>
                <p className="flex items-center gap-2 font-medium">
                  <Webhook className="size-4 text-primary" aria-hidden />
                  Kết nối SePay (làm một lần)
                </p>
                <ol className="ml-4 flex list-decimal flex-col gap-1.5 text-muted">
                  <li>Đăng ký SePay, liên kết đúng tài khoản ngân hàng bên trái.</li>
                  <li>
                    <span className="text-ink">Công ty → Cấu hình chung → Cấu trúc mã thanh toán</span>: tiền tố{' '}
                    <strong className="text-ink">RB</strong>, hậu tố 8–8 ký tự, kiểu <strong className="text-ink">Số và chữ</strong>.
                  </li>
                  <li>
                    <span className="text-ink">Webhooks → Thêm</span>: sự kiện Tiền vào, URL:
                    <code className="mt-1 block rounded bg-paper px-2 py-1 text-xs break-all text-ink">{webhookUrl}</code>
                  </li>
                  <li>
                    Bảo mật: <strong className="text-ink">HMAC-SHA256</strong> (biến <code>SEPAY_WEBHOOK_SECRET</code>) hoặc{' '}
                    <strong className="text-ink">API Key</strong> (biến <code>SEPAY_WEBHOOK_API_KEY</code>) trên Vercel.
                  </li>
                </ol>
                <p
                  className={cn(
                    'flex items-center gap-2 rounded-control px-3 py-2',
                    webhookReady ? 'bg-primary-soft text-primary' : 'bg-shuttle-soft text-shuttle-deep',
                  )}
                >
                  {webhookReady ? (
                    <CheckCircle2 className="size-4 shrink-0" aria-hidden />
                  ) : (
                    <CircleAlert className="size-4 shrink-0" aria-hidden />
                  )}
                  {webhookReady ? 'Máy chủ đã có khóa bảo mật webhook.' : 'Máy chủ chưa có khóa webhook — SePay gửi sẽ bị từ chối.'}
                </p>
                <p className="text-muted">
                  {lastTxn ? `Giao dịch gần nhất: ${formatDateTime(lastTxn.created_at)}.` : 'Chưa nhận giao dịch nào từ SePay.'}
                </p>
              </div>
            }
          >
            <ActionForm action={updateBankSettingsAction}>
              <BankFields defaults={brand} emptyHint="Để trống cả hai ô để tắt mã QR chuyển khoản." />
              <CheckboxField
                name="transfer_auto_confirm"
                label="Tự xác nhận đơn khi nhận đủ tiền cọc"
                hint="Tắt nếu muốn nhân viên tự bấm xác nhận (tiền vẫn được ghi vào đơn)."
                defaultChecked={brand?.transfer_auto_confirm ?? true}
              />
              <div>
                <SubmitButton pendingLabel="Đang lưu…">Lưu tài khoản nhận cọc</SubmitButton>
              </div>
            </ActionForm>
          </SettingsSection>

          <SettingsSection
            id="thong-bao"
            icon={Bell}
            title="Báo cho chủ sân qua email"
            description="Khi tiền vào nhưng hệ thống không tự xác nhận được đơn (giờ đã có người đặt, đơn đã hủy, sai nội dung…), chủ sân nhận email ngay để liên hệ khách."
          >
            <AlertSettings
              settings={notify}
              ownerEmail={auth.user?.email ?? null}
              siteUrl={origin}
              env={{
                resend: Boolean(getAlertEmailConfig().apiKey),
                sepayToken: Boolean(getSepayApiConfig().token),
                cron: Boolean(getCronSecret()),
              }}
            />
          </SettingsSection>

          <SettingsSection
            id="thue"
            icon={Receipt}
            title="Thuế"
            description="Áp dụng cho đơn bán tại quầy. Mỗi đơn ghi lại mức thuế lúc bán, đổi cài đặt không làm sai đơn cũ."
            aside={
              <div className={helpBox}>
                <p className="font-medium">Tỷ lệ thuế trực tiếp theo nhóm ngành</p>
                <ul className="flex flex-col divide-y divide-line">
                  {TAX_INDUSTRIES.map((i) => (
                    <li key={i.value} className="flex flex-col gap-0.5 py-2 first:pt-0 last:pb-0">
                      <span>{i.label}</span>
                      <span className="text-xs text-muted tabular">
                        GTGT {formatPercent(i.vat)} · TNCN {formatPercent(i.pit)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            }
          >
            <ActionForm action={updateTaxSettingsAction}>
              <SelectField
                name="tax_method"
                label="Cách tính thuế"
                defaultValue={brand?.tax_method ?? 'deduction'}
                options={TAX_METHODS.map((m) => ({ value: m.value, label: `${m.label}: ${m.hint}` }))}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  name="default_vat_rate"
                  label="Mức VAT mặc định (khấu trừ)"
                  defaultValue={String(Number(brand?.default_vat_rate ?? 8))}
                  options={[...new Set([...VAT_PRESETS, Number(brand?.default_vat_rate ?? 8)])]
                    .sort((a, b) => a - b)
                    .map((r) => ({ value: String(r), label: formatPercent(r) }))}
                  hint="Giá bán được hiểu là đã gồm VAT."
                />
                <TextField
                  name="tax_code"
                  label="Mã số thuế"
                  defaultValue={brand?.tax_code ?? ''}
                  optional
                  inputMode="numeric"
                  hint="In trên phiếu thanh toán tại quầy."
                />
              </div>
              <div>
                <SubmitButton pendingLabel="Đang lưu…">Lưu cài đặt thuế</SubmitButton>
              </div>
            </ActionForm>
          </SettingsSection>

          <SettingsSection
            id="toc-do"
            icon={Gauge}
            title="Tốc độ máy chủ"
            description="Đo thời gian máy chủ web hỏi database. Trang quản trị mở chậm (trên 1 giây) thường do hai máy chủ ở hai vùng khác nhau."
            aside={
              <div className={helpBox}>
                <p className="font-medium">Đặt máy chủ web cùng vùng với database</p>
                <ol className="ml-4 flex list-decimal flex-col gap-1.5 text-muted">
                  <li>Supabase → Project Settings → General: xem Region (Singapore = ap-southeast-1).</li>
                  <li>Vercel → Settings → Functions → Function Region: chọn cùng vùng (Singapore = sin1), lưu rồi Redeploy.</li>
                  <li>Bấm Đo lại: nên dưới 30 ms.</li>
                </ol>
              </div>
            }
          >
            <ServerSpeed />
          </SettingsSection>
        </div>
      </div>
    </>
  );
}
