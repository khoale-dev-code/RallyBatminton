'use client';

import { Info, Receipt } from 'lucide-react';
import Link from 'next/link';
import { type ReactNode } from 'react';

import { CollapsibleSection } from '@/components/ui/collapsible-section';
import { controlClass } from '@/components/ui/form';
import { cn } from '@/lib/cn';
import { formatVnd } from '@/lib/format';
import {
  effectiveTax,
  formatPercent,
  industryOf,
  isTaxIndustry,
  TAX_INDUSTRIES,
  taxLabel,
  taxOfAmount,
  VAT_PRESETS,
  type BrandTax,
} from '@/lib/tax';

import { type ProductEditorState } from '../../hooks/use-product-editor';
import { parseMoney, parsePercent } from '../../lib/product-draft';

import { Check, Field, TextInput } from './fields';

interface TaxSectionProps {
  ed: ProductEditorState;
  brandTax: BrandTax;
  canManageTax: boolean;
}

/** Thuế sản phẩm: có/không chịu thuế, nhóm ngành nghề (trực tiếp), mức VAT (khấu trừ), tên trên hóa đơn. */
export function TaxSection({ ed, brandTax, canManageTax }: TaxSectionProps) {
  const { draft, dispatch, errors } = ed;
  const tax = effectiveTax(
    {
      taxable: draft.taxable,
      industry: draft.taxIndustry === '' ? null : draft.taxIndustry,
      vatUseDefault: draft.vatUseDefault,
      vatRate: parsePercent(draft.vatRate),
    },
    brandTax,
  );
  const price = parseMoney(draft.variants.find((v) => v.isDefault)?.price ?? '') ?? parseMoney(draft.basePrice);
  const sample = price !== null ? taxOfAmount(price, tax) : null;
  const unit = draft.unitLabel ? ` ${draft.unitLabel}` : '';
  const group = industryOf(draft.taxIndustry === '' ? null : draft.taxIndustry);
  const defaultLabel = formatPercent(brandTax.defaultVatRate);

  return (
    <CollapsibleSection
      title="Thuế"
      description="Giá bán đã gồm thuế. Mức thuế được ghi lại vào từng đơn tại thời điểm bán."
      summary={taxLabel(tax)}
      open={ed.sections.tax}
      onOpenChange={(o) => ed.setSection('tax', o)}
    >
      <div className="flex flex-col gap-5">
        <Field
          id="p-invoice-name"
          label="Tên sản phẩm trên hóa đơn"
          optional
          error={errors.invoice_name}
          hint="Bỏ trống để dùng tên sản phẩm. Dùng khi tên trên hóa đơn cần theo tên hàng hóa chuẩn."
        >
          <TextInput
            id="p-invoice-name"
            value={draft.invoiceName}
            onValue={(v) => dispatch({ type: 'patch', patch: { invoiceName: v } })}
            error={errors.invoice_name}
            maxLength={150}
            placeholder={draft.name || 'Nhập tên sản phẩm trên hóa đơn'}
          />
        </Field>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">Sản phẩm có chịu thuế không?</legend>
          <div className="grid grid-cols-2 gap-2">
            {[
              { on: true, label: 'Có thuế', hint: 'Tính thuế khi bán' },
              { on: false, label: 'Không chịu thuế', hint: 'Quà tặng, hàng miễn thuế' },
            ].map((o) => (
              <label
                key={String(o.on)}
                className={cn(
                  'flex min-h-14 cursor-pointer flex-col justify-center rounded-control border px-3 py-2 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ink/30',
                  draft.taxable === o.on ? 'border-ink bg-hall/60' : 'border-line hover:border-ink/40',
                )}
              >
                <input
                  type="radio"
                  name="p-taxable"
                  checked={draft.taxable === o.on}
                  onChange={() => dispatch({ type: 'patch', patch: { taxable: o.on } })}
                  className="sr-only"
                />
                <span className="font-medium">{o.label}</span>
                <span className="text-xs text-muted">{o.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {draft.taxable ? (
          <>
            <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
              <MethodPanel title="Thuế trực tiếp" active={brandTax.method === 'direct'}>
                <Field id="p-tax-industry" label="Nhóm ngành nghề" error={errors.tax_industry}>
                  <select
                    id="p-tax-industry"
                    value={draft.taxIndustry}
                    onChange={(e) =>
                      dispatch({ type: 'patch', patch: { taxIndustry: isTaxIndustry(e.target.value) ? e.target.value : '' } })
                    }
                    className={cn(controlClass, 'min-h-11')}
                  >
                    <option value="">Chọn nhóm ngành nghề</option>
                    {TAX_INDUSTRIES.map((i) => (
                      <option key={i.value} value={i.value}>
                        {i.label} — GTGT {formatPercent(i.vat)} | TNCN {formatPercent(i.pit)}
                      </option>
                    ))}
                  </select>
                </Field>
                <p className="flex flex-wrap gap-1.5 text-sm">
                  {draft.taxIndustry === '' ? (
                    <span className="text-muted">Chưa chọn — đơn bán dùng nhóm “Hoạt động kinh doanh khác” (GTGT 2% | TNCN 1%).</span>
                  ) : (
                    <>
                      <span className="rounded-full bg-paper px-2.5 py-0.5 tabular">GTGT {formatPercent(group.vat)}</span>
                      <span className="rounded-full bg-paper px-2.5 py-0.5 tabular">TNCN {formatPercent(group.pit)}</span>
                    </>
                  )}
                </p>
              </MethodPanel>

              <MethodPanel title="Thuế khấu trừ" active={brandTax.method === 'deduction'}>
                <Check
                  id="p-vat-default"
                  checked={draft.vatUseDefault}
                  onChecked={(v) => dispatch({ type: 'patch', patch: { vatUseDefault: v } })}
                  label={`Áp dụng mức thuế VAT mặc định của sản phẩm là ${defaultLabel}`}
                />
                <Field id="p-vat-rate" label="Mức thuế VAT" error={errors.vat_rate}>
                  <div className="relative">
                    <input
                      id="p-vat-rate"
                      value={draft.vatUseDefault ? String(brandTax.defaultVatRate).replace('.', ',') : draft.vatRate}
                      onChange={(e) => dispatch({ type: 'patch', patch: { vatRate: e.target.value.replace(/[^\d.,]/g, '') } })}
                      disabled={draft.vatUseDefault}
                      inputMode="decimal"
                      aria-invalid={errors.vat_rate ? true : undefined}
                      aria-describedby={errors.vat_rate ? 'p-vat-rate-error' : undefined}
                      className={cn(controlClass, 'min-h-11 pr-9 tabular')}
                    />
                    <span aria-hidden className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted">
                      %
                    </span>
                  </div>
                </Field>
                {!draft.vatUseDefault && (
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Mức VAT thường dùng">
                    {VAT_PRESETS.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => dispatch({ type: 'patch', patch: { vatRate: String(r) } })}
                        aria-pressed={parsePercent(draft.vatRate) === r}
                        className={cn(
                          'min-h-9 rounded-full border px-3 text-sm tabular',
                          parsePercent(draft.vatRate) === r ? 'border-ink bg-ink text-paper' : 'border-line bg-paper hover:border-ink',
                        )}
                      >
                        {r}%
                      </button>
                    ))}
                  </div>
                )}
              </MethodPanel>
            </div>

            {sample && tax && price !== null && (
              <p className="flex items-start gap-2 rounded-control bg-court-soft px-3 py-2.5 text-sm text-court-deep">
                <Receipt className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  {tax.method === 'deduction' ? (
                    <>
                      Mỗi{unit || ' sản phẩm'} {formatVnd(price)} đã gồm VAT {formatPercent(tax.vatRate)}: tiền thuế{' '}
                      <strong className="tabular">{formatVnd(sample.vat)}</strong>, giá chưa thuế{' '}
                      <span className="tabular">{formatVnd(price - sample.vat)}</span>.
                    </>
                  ) : (
                    <>
                      Mỗi{unit || ' sản phẩm'} {formatVnd(price)}: thuế khoán ước tính GTGT{' '}
                      <strong className="tabular">{formatVnd(sample.vat)}</strong> + TNCN{' '}
                      <strong className="tabular">{formatVnd(sample.pit)}</strong>.
                    </>
                  )}
                </span>
              </p>
            )}
          </>
        ) : (
          <p className="rounded-control bg-hall px-3 py-2.5 text-sm text-muted">
            Không tính thuế cho sản phẩm này. Đơn bán vẫn ghi doanh thu bình thường.
          </p>
        )}

        <p className="flex items-start gap-2 text-sm text-muted">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Cửa hàng đang tính thuế theo phương pháp{' '}
            <strong className="text-ink">{brandTax.method === 'deduction' ? 'khấu trừ' : 'trực tiếp'}</strong>.{' '}
            {canManageTax ? (
              <Link href="/admin/settings#thue" className="underline underline-offset-4 hover:text-ink">
                Đổi cách tính thuế
              </Link>
            ) : (
              'Chủ sân đổi được trong Cài đặt thương hiệu.'
            )}
          </span>
        </p>
      </div>
    </CollapsibleSection>
  );
}

function MethodPanel({ title, active, children }: { title: string; active: boolean; children: ReactNode }) {
  return (
    <section
      className={cn(
        'flex min-w-0 flex-col gap-3 rounded-control border p-3 sm:p-4',
        active ? 'border-ink/30 bg-hall/50' : 'border-line bg-hall/30',
      )}
      aria-label={title}
    >
      <h3 className="flex flex-wrap items-center justify-between gap-2 font-sans text-sm font-medium">
        {title}
        {active && <span className="rounded-full bg-court-soft px-2 py-0.5 text-xs font-medium text-court-deep">Đang áp dụng</span>}
      </h3>
      {children}
    </section>
  );
}
