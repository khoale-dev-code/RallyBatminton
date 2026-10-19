import { ActionForm, SelectField, SubmitButton, TextareaField, TextField } from '@/components/ui/form';
import { PageHeader, Panel } from '@/components/ui/primitives';
import { updateBrandAction, updateTaxSettingsAction } from '@/features/settings/actions';
import { requireOwner } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { formatPercent, TAX_INDUSTRIES, TAX_METHODS, VAT_PRESETS } from '@/lib/tax';

export const metadata = { title: 'Cài đặt thương hiệu' };

export default async function SettingsPage() {
  await requireOwner();
  const supabase = await createClient();
  const { data: brand } = await supabase.from('brand_settings').select('*').maybeSingle();
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
