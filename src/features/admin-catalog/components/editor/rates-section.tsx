'use client';

import { Plus, X } from 'lucide-react';

import { buttonClass } from '@/components/ui/button';
import { CollapsibleSection } from '@/components/ui/collapsible-section';
import { controlClass } from '@/components/ui/form';
import { cn } from '@/lib/cn';
import { RENTAL_RATE_KINDS } from '@/lib/labels';

import { type ProductEditorState } from '../../hooks/use-product-editor';

import { Field, MoneyInput, TextInput } from './fields';

const DURATIONS = [
  { value: '30', label: '30 phút' },
  { value: '60', label: '1 giờ' },
  { value: '90', label: '1 giờ 30' },
  { value: '120', label: '2 giờ' },
  { value: '180', label: '3 giờ' },
  { value: '240', label: '4 giờ' },
  { value: '1440', label: '1 ngày' },
];

/** Gói giá thuê khi tạo đồ cho thuê (sửa sau ở trang chi tiết). */
export function RatesSection({ ed }: { ed: ProductEditorState }) {
  const { draft, dispatch, errors } = ed;
  return (
    <CollapsibleSection
      title="Gói giá thuê"
      description="Giá riêng cho dùng tại sân, hết trận và mang ra ngoài. Chính sách trả trễ chỉnh sau ở trang sản phẩm."
      summary={`${draft.rates.length} gói`}
      open={ed.sections.rates}
      onOpenChange={(o) => ed.setSection('rates', o)}
    >
      <div className="flex flex-col gap-3">
        {draft.rates.length === 0 && <p className="text-muted">Chưa có gói — có thể thêm sau, nhưng chưa cho thuê được.</p>}
        {draft.rates.map((r, i) => (
          <div
            key={r.key}
            className="grid grid-cols-2 items-start gap-3 rounded-control border border-line p-3 sm:grid-cols-[11rem_minmax(0,1fr)_8rem_9rem_auto] sm:border-0 sm:p-0"
          >
            <Field id={`rate-kind-${r.key}`} label="Hình thức" className="col-span-2 sm:col-span-1">
              <select
                id={`rate-kind-${r.key}`}
                value={r.kind}
                onChange={(e) => {
                  const kind = RENTAL_RATE_KINDS.find((k) => k.value === e.target.value)?.value ?? 'on_site:duration';
                  dispatch({ type: 'rate', key: r.key, patch: { kind } });
                }}
                className={cn(controlClass, 'min-h-11')}
              >
                {RENTAL_RATE_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              id={`rate-label-${r.key}`}
              label="Tên gói"
              error={errors[`rental_rates.${i}.label`]}
              className="col-span-2 sm:col-span-1"
            >
              <TextInput
                id={`rate-label-${r.key}`}
                value={r.label}
                onValue={(v) => dispatch({ type: 'rate', key: r.key, patch: { label: v } })}
                error={errors[`rental_rates.${i}.label`]}
                placeholder={
                  r.kind === 'on_site:session' ? 'Hết trận' : (DURATIONS.find((d) => d.value === r.minutes)?.label ?? 'Theo thời lượng')
                }
                maxLength={40}
              />
            </Field>
            <Field id={`rate-min-${r.key}`} label="Thời lượng" error={errors[`rental_rates.${i}.duration_minutes`]}>
              <select
                id={`rate-min-${r.key}`}
                value={r.minutes}
                onChange={(e) => dispatch({ type: 'rate', key: r.key, patch: { minutes: e.target.value } })}
                className={cn(controlClass, 'min-h-11')}
              >
                {DURATIONS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field id={`rate-price-${r.key}`} label="Giá thuê" error={errors[`rental_rates.${i}.price`]}>
              <MoneyInput
                id={`rate-price-${r.key}`}
                value={r.price}
                onValue={(v) => dispatch({ type: 'rate', key: r.key, patch: { price: v } })}
                error={errors[`rental_rates.${i}.price`]}
                placeholder="0"
              />
            </Field>
            <button
              type="button"
              onClick={() => dispatch({ type: 'rate-remove', key: r.key })}
              aria-label={`Bỏ gói ${r.label || i + 1}`}
              className="col-span-2 inline-flex min-h-11 items-center justify-center gap-1 rounded-control text-sm text-muted hover:bg-hall hover:text-ink sm:col-span-1 sm:mt-6 sm:w-11"
            >
              <X className="size-4" aria-hidden />
              <span className="sm:sr-only">Bỏ gói này</span>
            </button>
          </div>
        ))}
        <button type="button" onClick={() => dispatch({ type: 'rate-add' })} className={buttonClass('outline', 'md', 'self-start')}>
          <Plus className="size-4" aria-hidden />
          Thêm gói giá
        </button>
      </div>
    </CollapsibleSection>
  );
}
