import { Bell, CircleAlert, ClockCheck, Gauge, Landmark, Palette, Receipt, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

import { ActionForm, CheckboxField, SelectField, SubmitButton, TextareaField, TextField } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/primitives';
import { updateAttendanceSettingsAction } from '@/features/attendance/actions';
import { getAttendanceSettings } from '@/features/attendance/queries';
import { AlertSettings } from '@/features/payments/components/alert-settings';
import { saveLegalInfoAction } from '@/features/privacy/actions';
import { BankFields } from '@/features/payments/components/bank-fields';
import { updateBankSettingsAction, updateBrandAction, updateTaxSettingsAction } from '@/features/settings/actions';
import { ServerSpeed } from '@/features/settings/components/server-speed';
import { SettingsNav } from '@/features/settings/components/settings-nav';
import { isSettingsSection, type SettingsSectionId } from '@/features/settings/lib/sections';
import { SettingsSection } from '@/features/settings/components/settings-section';
import { requireOwner, withGuard } from '@/lib/auth/guards';
import { getAlertEmailConfig, getSepayWebhookAuth } from '@/lib/env.server';
import { createClient } from '@/lib/supabase/server';
import { formatPercent, TAX_INDUSTRIES, TAX_METHODS, VAT_PRESETS } from '@/lib/tax';

export const metadata = { title: 'Cài đặt thương hiệu' };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ muc?: string }> }) {
  const { muc } = await searchParams;
  const active: SettingsSectionId = isSettingsSection(muc) ? muc : 'thuong-hieu';
  const supabase = await createClient();
  const [, [{ data: brand }, { data: notify }, { data: auth }, rules]] = await withGuard(requireOwner(), () =>
    Promise.all([
      supabase.from('brand_settings').select('*').maybeSingle(),
      supabase.from('notification_settings').select('alert_emails, alert_on_review, alert_on_unmatched').maybeSingle(),
      supabase.auth.getUser(),
      getAttendanceSettings(),
    ]),
  );
  const sepay = getSepayWebhookAuth();
  const webhookReady = Boolean(sepay.secret ?? sepay.apiKey);
  const helpBox = 'flex flex-col gap-3 rounded-control bg-hall/70 p-4 text-sm';
  return (
    <>
      <PageHeader
        title="Cài đặt thương hiệu"
        description="Thông tin thương hiệu, nhận tiền chuyển khoản, email cảnh báo, thuế và tốc độ máy chủ."
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[13rem_minmax(0,1fr)] xl:gap-8">
        <SettingsNav active={active} />
        <div className="flex min-w-0 flex-col gap-6">
          {active === 'thuong-hieu' && (
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
          )}

          {active === 'chuyen-khoan' && (
            <SettingsSection
              id="chuyen-khoan"
              icon={Landmark}
              title="Nhận cọc chuyển khoản (SePay)"
              description="Khách thấy mã VietQR ngay sau khi giữ sân. Tiền về tài khoản → SePay báo về website → đơn tự xác nhận, không cần nhân viên kiểm tra."
            >
              {!webhookReady && (
                <p className="mb-4 flex items-start gap-2 rounded-control bg-shuttle-soft px-3 py-2 text-sm text-shuttle-deep">
                  <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                  Máy chủ chưa có khóa webhook SePay (SEPAY_WEBHOOK_SECRET hoặc SEPAY_WEBHOOK_API_KEY) — tiền về sẽ không tự xác nhận đơn.
                </p>
              )}
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
          )}

          {active === 'thong-bao' && (
            <SettingsSection
              id="thong-bao"
              icon={Bell}
              title="Báo cho chủ sân qua email"
              description="Khi tiền vào nhưng hệ thống không tự xác nhận được đơn (giờ đã có người đặt, đơn đã hủy, sai nội dung…), chủ sân nhận email ngay để liên hệ khách."
            >
              <AlertSettings settings={notify} ownerEmail={auth.user?.email ?? null} emailReady={Boolean(getAlertEmailConfig().apiKey)} />
            </SettingsSection>
          )}

          {active === 'thue' && (
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
          )}

          {active === 'phap-ly' && (
            <SettingsSection
              id="phap-ly"
              icon={ShieldCheck}
              title="Pháp lý & dữ liệu cá nhân"
              description="Bên kiểm soát dữ liệu cá nhân và đầu mối liên hệ — tự điền vào Chính sách bảo vệ dữ liệu cá nhân và chân trang website."
              aside={
                <div className={helpBox}>
                  <p className="font-medium">Văn bản, yêu cầu của khách, thời hạn lưu trữ</p>
                  <p className="text-muted">
                    Sửa chính sách, điều khoản, xử lý yêu cầu xem / xóa dữ liệu và thời hạn lưu trữ ở mục Dữ liệu cá nhân.
                  </p>
                  <Link href="/admin/privacy" className="font-medium text-primary underline-offset-4 hover:underline">
                    Mở Dữ liệu cá nhân
                  </Link>
                  <Link href="/legal/bao-mat" target="_blank" className="font-medium text-primary underline-offset-4 hover:underline">
                    Xem chính sách trên website
                  </Link>
                </div>
              }
            >
              <ActionForm action={saveLegalInfoAction}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    name="legal_name"
                    label="Tên doanh nghiệp / hộ kinh doanh"
                    defaultValue={brand?.legal_name ?? ''}
                    optional
                    maxLength={200}
                    hint="Đúng như trên giấy đăng ký kinh doanh."
                  />
                  <TextField
                    name="legal_address"
                    label="Địa chỉ đăng ký"
                    defaultValue={brand?.legal_address ?? ''}
                    optional
                    maxLength={300}
                  />
                  <TextField
                    name="privacy_contact"
                    label="Đầu mối bảo vệ dữ liệu cá nhân"
                    defaultValue={brand?.privacy_contact ?? ''}
                    optional
                    maxLength={120}
                    placeholder="Ví dụ: Nguyễn Văn A — Quản lý"
                    hint="Người / bộ phận nhận và xử lý yêu cầu của khách."
                  />
                  <TextField
                    name="privacy_email"
                    label="Email về dữ liệu cá nhân"
                    type="email"
                    defaultValue={brand?.privacy_email ?? ''}
                    optional
                    hint="Để trống thì dùng email liên hệ chung."
                  />
                </div>
                <p className="text-sm text-muted">Mã số thuế lấy ở mục Thuế phía trên.</p>
                <div>
                  <SubmitButton pendingLabel="Đang lưu…">Lưu thông tin pháp lý</SubmitButton>
                </div>
              </ActionForm>
            </SettingsSection>
          )}

          {active === 'cham-cong' && (
            <SettingsSection
              id="cham-cong"
              icon={ClockCheck}
              title="Chấm công"
              description="Công chỉ tính trong khung ca (+ tăng ca đã đồng ý). Phần ngoài khung, quên quét, đi trễ… xử lý theo các quy tắc dưới đây."
              aside={
                <div className={helpBox}>
                  <p className="font-medium">Cách tính công một ca</p>
                  <ul className="ml-4 flex list-disc flex-col gap-1.5 text-muted">
                    <li>Đến sớm: công tính từ giờ bắt đầu ca.</li>
                    <li>Ra muộn: công tính tới hết ca (+ tăng ca đã đồng ý). Muộn hơn ngưỡng thì vào Duyệt chấm công.</li>
                    <li>Quên quét: nhân viên gửi yêu cầu sửa giờ, chủ sân duyệt / từ chối.</li>
                    <li>Đi trễ chỉ để theo dõi — không tự trừ tiền.</li>
                  </ul>
                </div>
              }
            >
              <ActionForm action={updateAttendanceSettingsAction}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    name="late_grace_minutes"
                    label="Ân hạn đi trễ (phút)"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={60}
                    defaultValue={rules.late_grace_minutes}
                    hint="Vào trễ trong khoảng này không tính là đi trễ."
                  />
                  <TextField
                    name="late_out_review_minutes"
                    label="Ra ca trễ cần xem lại sau (phút)"
                    type="number"
                    inputMode="numeric"
                    min={5}
                    max={240}
                    defaultValue={rules.late_out_review_minutes}
                    hint="Quét ra muộn hơn khung ca từng này phút sẽ hiện ở Duyệt chấm công."
                  />
                  <TextField
                    name="fix_request_hours"
                    label="Hạn gửi yêu cầu sửa giờ (giờ)"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={168}
                    defaultValue={rules.fix_request_hours}
                    hint="Tính từ giờ kết thúc ca. 24 = trong ngày hôm sau."
                  />
                  <TextField
                    name="forgot_warn_count"
                    label="Cảnh báo hay quên từ lần thứ"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={31}
                    defaultValue={rules.forgot_warn_count}
                    hint="Số lần quên chấm công (được duyệt) trong tháng."
                  />
                  <TextField
                    name="qr_ttl_seconds"
                    label="Mã QR hết hạn sau (giây)"
                    type="number"
                    inputMode="numeric"
                    min={20}
                    max={180}
                    defaultValue={rules.qr_ttl_seconds}
                    hint="Ngắn hơn thì khó gửi mã cho người ở xa chấm hộ. Nên 30–60."
                  />
                </div>
                <CheckboxField
                  name="auto_close_forgotten"
                  label="Tự đóng ca quên quét ra"
                  hint="Quá hạn quét ra (4 giờ sau hết ca) thì đóng ca đúng giờ kết thúc theo lịch, để không chặn chốt lương."
                  defaultChecked={rules.auto_close_forgotten}
                />
                <div>
                  <SubmitButton pendingLabel="Đang lưu…">Lưu quy tắc chấm công</SubmitButton>
                </div>
              </ActionForm>
            </SettingsSection>
          )}

          {active === 'toc-do' && (
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
          )}
        </div>
      </div>
    </>
  );
}
