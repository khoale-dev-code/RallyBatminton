'use client';

import { AlertTriangle, CirclePlus, Trash2 } from 'lucide-react';

import { CollapsibleSection } from '@/components/ui/collapsible-section';
import { cn } from '@/lib/cn';

import { type ProductEditorState } from '../../hooks/use-product-editor';
import { margin, parseMoney, variantTitle } from '../../lib/product-draft';

import { AttributeRow } from './attribute-row';
import { Check, Field, MoneyInput, TextInput } from './fields';

export function VariantsSection({ ed, mode }: { ed: ProductEditorState; mode: 'create' | 'edit' }) {
  const { draft, dispatch, errors } = ed;
  const sale = draft.kind === 'sale';
  const basePrice = parseMoney(draft.basePrice);
  const archived = draft.archivedVariantIds.length;

  return (
    <CollapsibleSection
      title="Biến thể"
      description="Mỗi tổ hợp thuộc tính là một biến thể có SKU, giá và tồn kho riêng."
      summary={draft.hasVariants ? `${draft.variants.length} biến thể` : 'Một biến thể'}
      open={ed.sections.variants}
      onOpenChange={(o) => ed.setSection('variants', o)}
    >
      <div className="flex flex-col gap-4">
        <Check
          id="p-has-variants"
          checked={draft.hasVariants}
          onChecked={(on) => dispatch({ type: 'variants-toggle', on })}
          label="Sản phẩm này có nhiều biến thể. Ví dụ như khác nhau về kích thước, màu sắc."
          hint={
            mode === 'edit' && draft.hasVariants ? 'Tắt sẽ giữ lại biến thể mặc định và ngừng các biến thể còn lại khi lưu.' : undefined
          }
        />

        {draft.hasVariants && (
          <>
            <div className="rounded-control border border-line px-3 sm:px-4">
              {draft.option1Name !== null && (
                <AttributeRow
                  slot={1}
                  name={draft.option1Name}
                  values={draft.sizeOptions}
                  otherName={draft.option2Name}
                  onName={(name) => dispatch({ type: 'attr-name', slot: 1, name })}
                  onValues={(values) => dispatch({ type: 'options', which: 'size', values })}
                  onRemove={() => dispatch({ type: 'attr-remove', slot: 1 })}
                  nameError={errors.option1_name}
                />
              )}
              {draft.option2Name !== null && (
                <AttributeRow
                  slot={2}
                  name={draft.option2Name}
                  values={draft.colorOptions}
                  otherName={draft.option1Name}
                  onName={(name) => dispatch({ type: 'attr-name', slot: 2, name })}
                  onValues={(values) => dispatch({ type: 'options', which: 'color', values })}
                  onRemove={() => dispatch({ type: 'attr-remove', slot: 2 })}
                  nameError={errors.option2_name}
                />
              )}
              {(draft.option1Name === null || draft.option2Name === null) && (
                <div className="border-t border-line py-3 first:border-t-0">
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'attr-add' })}
                    className="inline-flex min-h-10 items-center gap-2 rounded-control border border-dashed border-court-deep/50 px-4 text-sm font-medium text-court-deep hover:bg-court-soft"
                  >
                    <CirclePlus className="size-4" aria-hidden />
                    Thêm thuộc tính khác
                  </button>
                </div>
              )}
            </div>

            {errors.variants && (
              <p className="text-sm text-shuttle-deep" role="alert">
                {errors.variants}
              </p>
            )}
            {draft.variants.length > 100 && <p className="text-sm text-shuttle-deep">Tối đa 100 biến thể — bớt giá trị thuộc tính.</p>}

            <ul className="flex flex-col gap-3">
              {draft.variants.map((v, i) => {
                const err = (f: string) => errors[`variants.${i}.${f}`];
                const price = parseMoney(v.price) ?? basePrice;
                const m = sale ? margin(price, parseMoney(v.costPrice)) : null;
                return (
                  <li
                    key={v.key}
                    className={cn(
                      'rounded-control border p-3 sm:p-4',
                      v.isDefault ? 'border-ink/40 bg-hall/40' : 'border-line',
                      !v.isActive && 'opacity-70',
                    )}
                  >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                      <p className="font-medium">{variantTitle(v)}</p>
                      <div className="flex flex-wrap items-center gap-x-4">
                        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name="default-variant"
                            checked={v.isDefault}
                            onChange={() => dispatch({ type: 'variant-default', key: v.key })}
                            className="size-4.5 accent-court-deep"
                          />
                          Mặc định
                        </label>
                        {mode === 'edit' && v.id && (
                          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={v.isActive}
                              disabled={v.isDefault}
                              onChange={(e) => dispatch({ type: 'variant', key: v.key, patch: { isActive: e.target.checked } })}
                              className="size-4.5 accent-court-deep"
                            />
                            Đang bán
                          </label>
                        )}
                        {draft.variants.length > 1 && (
                          <button
                            type="button"
                            onClick={() => dispatch({ type: 'variant-remove', key: v.key })}
                            aria-label={`Bỏ biến thể ${variantTitle(v)}`}
                            title="Bỏ biến thể này"
                            className="-mr-2 grid size-11 place-items-center rounded-control text-muted hover:bg-hall hover:text-shuttle-deep"
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </button>
                        )}
                      </div>
                    </div>
                    {err('size_label') && <p className="mb-2 text-sm text-shuttle-deep">{err('size_label')}</p>}
                    <div className="grid grid-cols-2 gap-3">
                      <Field id={`v-sku-${v.key}`} label="SKU" required error={err('sku')} className="col-span-2 sm:col-span-1">
                        <TextInput
                          id={`v-sku-${v.key}`}
                          value={v.sku}
                          onValue={(x) => dispatch({ type: 'variant', key: v.key, patch: { sku: x.toUpperCase() } })}
                          error={err('sku')}
                          autoCapitalize="characters"
                          autoComplete="off"
                          spellCheck={false}
                          maxLength={40}
                        />
                      </Field>
                      <Field id={`v-barcode-${v.key}`} label="Mã vạch" error={err('barcode')} className="col-span-2 sm:col-span-1">
                        <TextInput
                          id={`v-barcode-${v.key}`}
                          value={v.barcode}
                          onValue={(x) => dispatch({ type: 'variant', key: v.key, patch: { barcode: x.replace(/\s/g, '') } })}
                          error={err('barcode')}
                          inputMode="numeric"
                          autoComplete="off"
                          maxLength={32}
                        />
                      </Field>
                      {sale && (
                        <Field id={`v-price-${v.key}`} label="Giá bán" error={err('price_override')}>
                          <MoneyInput
                            id={`v-price-${v.key}`}
                            value={v.price}
                            onValue={(x) => dispatch({ type: 'variant', key: v.key, patch: { price: x } })}
                            error={err('price_override')}
                            placeholder={basePrice !== null ? basePrice.toLocaleString('vi-VN') : 'Giá chung'}
                          />
                        </Field>
                      )}
                      <Field id={`v-cost-${v.key}`} label="Giá vốn" error={err('cost_price')} hint={m ? `Lãi ${m.percent}%` : undefined}>
                        <MoneyInput
                          id={`v-cost-${v.key}`}
                          value={v.costPrice}
                          onValue={(x) => dispatch({ type: 'variant', key: v.key, patch: { costPrice: x } })}
                          error={err('cost_price')}
                          placeholder="0"
                        />
                      </Field>
                    </div>
                    {mode === 'edit' && v.id && v.onHand !== null && (
                      <p className="mt-2 text-sm text-muted">
                        Tồn các chi nhánh: <span className="tabular text-ink">{v.onHand.toLocaleString('vi-VN')}</span>
                      </p>
                    )}
                    {mode === 'edit' && !v.id && <p className="mt-2 text-sm text-court-deep">Biến thể mới — tạo khi lưu.</p>}
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {mode === 'edit' && archived > 0 && (
          <p className="flex items-start gap-2 rounded-control bg-amber-soft px-3 py-2.5 text-sm text-amber-deep">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {archived} biến thể đã có sẽ ngừng kinh doanh khi lưu. Lịch sử bán và tồn kho cũ vẫn được giữ.
          </p>
        )}
      </div>
    </CollapsibleSection>
  );
}
