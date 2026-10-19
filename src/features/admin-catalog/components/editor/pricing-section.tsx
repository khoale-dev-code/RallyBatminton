'use client';

import { CollapsibleSection } from '@/components/ui/collapsible-section';
import { formatVnd } from '@/lib/format';

import { type ProductEditorState } from '../../hooks/use-product-editor';
import { margin, parseMoney } from '../../lib/product-draft';

import { Field, MoneyInput } from './fields';

export function PricingSection({ ed }: { ed: ProductEditorState }) {
  const { draft, dispatch, errors } = ed;
  const single = !draft.hasVariants ? draft.variants[0] : undefined;
  const price = parseMoney(draft.basePrice);
  const m = single ? margin(price, parseMoney(single.costPrice)) : null;
  return (
    <CollapsibleSection
      title="Giá sản phẩm"
      summary={price !== null ? `${formatVnd(price)}${draft.unitLabel ? `/${draft.unitLabel}` : ''}` : 'Chưa có giá'}
      open={ed.sections.pricing}
      onOpenChange={(o) => ed.setSection('pricing', o)}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          id="p-price"
          label="Giá bán"
          required
          error={errors.base_price}
          hint={draft.hasVariants ? 'Giá chung; từng biến thể có thể đặt giá riêng.' : undefined}
        >
          <MoneyInput
            id="p-price"
            value={draft.basePrice}
            onValue={(v) => dispatch({ type: 'patch', patch: { basePrice: v } })}
            error={errors.base_price}
            placeholder="0"
          />
        </Field>
        <Field
          id="p-compare"
          label="Giá so sánh"
          optional
          error={errors.compare_at_price}
          hint="Giá trước giảm, hiện gạch ngang trên website."
        >
          <MoneyInput
            id="p-compare"
            value={draft.compareAtPrice}
            onValue={(v) => dispatch({ type: 'patch', patch: { compareAtPrice: v } })}
            error={errors.compare_at_price}
            placeholder="0"
          />
        </Field>
        {single && (
          <>
            <Field
              id="p-cost"
              label="Giá vốn"
              optional
              error={errors['variants.0.cost_price']}
              hint="Chỉ nhân sự quản lý thấy; khách không xem được."
            >
              <MoneyInput
                id="p-cost"
                value={single.costPrice}
                onValue={(v) => dispatch({ type: 'variant', key: single.key, patch: { costPrice: v } })}
                error={errors['variants.0.cost_price']}
                placeholder="0"
              />
            </Field>
            <dl className="grid grid-cols-2 gap-3 self-end rounded-control bg-hall px-3 py-2.5 text-sm">
              <div>
                <dt className="text-muted">Lợi nhuận</dt>
                <dd className="font-display text-lg tabular">{m ? formatVnd(m.profit) : '—'}</dd>
              </div>
              <div>
                <dt className="text-muted">Biên lợi nhuận</dt>
                <dd className="font-display text-lg tabular">{m ? `${m.percent}%` : '—'}</dd>
              </div>
            </dl>
          </>
        )}
      </div>
    </CollapsibleSection>
  );
}
