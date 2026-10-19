'use client';

import { CirclePlus, Trash2 } from 'lucide-react';

import { CollapsibleSection } from '@/components/ui/collapsible-section';
import { formatVnd } from '@/lib/format';

import { type ProductEditorState } from '../../hooks/use-product-editor';
import { parseMoney } from '../../lib/product-draft';

import { Check, Field, MoneyInput, TextInput } from './fields';

const BASE_UNITS = ['lon', 'chai', 'hộp', 'cái', 'đôi', 'gói', 'ống', 'cuộn', 'quả'];
const PACK_UNITS = ['Lốc', 'Thùng', 'Két', 'Hộp', 'Bịch', 'Ống', 'Cặp'];

/** Đơn vị tính: đơn vị cơ bản (đếm tồn kho) và các đơn vị quy đổi (lốc, thùng…). */
export function UnitsSection({ ed }: { ed: ProductEditorState }) {
  const { draft, dispatch, errors } = ed;
  const base = draft.unitLabel.trim();
  const basePrice = parseMoney(draft.variants.find((v) => v.isDefault)?.price ?? '') ?? parseMoney(draft.basePrice);
  const summary =
    draft.hasUnits && draft.units.length
      ? [base || 'Chưa có đơn vị cơ bản', ...draft.units.map((u) => u.name).filter(Boolean)].join(', ')
      : base || 'Chưa đặt';

  return (
    <CollapsibleSection
      title="Đơn vị tính"
      description="Tồn kho luôn đếm theo đơn vị cơ bản. Bán 1 thùng 24 lon thì kho trừ 24 lon."
      summary={summary}
      open={ed.sections.units}
      onOpenChange={(o) => ed.setSection('units', o)}
    >
      <div className="flex flex-col gap-4">
        <Check
          id="p-has-units"
          checked={draft.hasUnits}
          onChecked={(on) => dispatch({ type: 'units-toggle', on })}
          label="Sản phẩm có nhiều đơn vị tính (ví dụ: lon, lốc, thùng…)"
        />
        <Field
          id="p-unit"
          label="Đơn vị cơ bản"
          required={draft.hasUnits}
          optional={!draft.hasUnits}
          error={errors.unit_label}
          hint="Đơn vị nhỏ nhất để đếm tồn kho và tính giá bán, ví dụ: lon."
          className="sm:max-w-xs"
        >
          <TextInput
            id="p-unit"
            value={draft.unitLabel}
            onValue={(v) => dispatch({ type: 'patch', patch: { unitLabel: v } })}
            error={errors.unit_label}
            list="p-unit-options"
            maxLength={20}
            autoComplete="off"
            placeholder="Nhập đơn vị cơ bản"
          />
          <datalist id="p-unit-options">
            {BASE_UNITS.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </Field>

        {draft.hasUnits && (
          <>
            <ul className="flex flex-col gap-3">
              {draft.units.map((u, i) => {
                const err = (f: string) => errors[`units.${i}.${f}`];
                const conv = Number(u.conversion.replace(/[^\d]/g, '')) || 0;
                const auto = basePrice !== null && conv >= 2 ? basePrice * conv : null;
                const price = parseMoney(u.price) ?? auto;
                return (
                  <li key={u.key} className="rounded-control border border-line p-3 sm:p-4">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto] sm:items-start">
                      <Field id={`u-name-${u.key}`} label="Đơn vị" error={err('name')}>
                        <TextInput
                          id={`u-name-${u.key}`}
                          value={u.name}
                          onValue={(v) => dispatch({ type: 'unit', key: u.key, patch: { name: v } })}
                          error={err('name')}
                          list="p-pack-options"
                          maxLength={20}
                          autoComplete="off"
                          placeholder="Thùng"
                        />
                      </Field>
                      <Field id={`u-conv-${u.key}`} label={`Quy đổi (${base || 'đơn vị cơ bản'})`} error={err('conversion')}>
                        <div className="relative">
                          <span aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted">
                            =
                          </span>
                          <TextInput
                            id={`u-conv-${u.key}`}
                            value={u.conversion}
                            onValue={(v) => dispatch({ type: 'unit', key: u.key, patch: { conversion: v.replace(/[^\d]/g, '') } })}
                            error={err('conversion')}
                            inputMode="numeric"
                            placeholder="24"
                            className="pl-7 tabular"
                          />
                        </div>
                      </Field>
                      <Field
                        id={`u-price-${u.key}`}
                        label="Giá bán"
                        error={err('price')}
                        hint={!u.price && auto !== null ? `Tự tính: ${formatVnd(auto)}` : undefined}
                        className="col-span-2 sm:col-span-1"
                      >
                        <MoneyInput
                          id={`u-price-${u.key}`}
                          value={u.price}
                          onValue={(v) => dispatch({ type: 'unit', key: u.key, patch: { price: v } })}
                          error={err('price')}
                          placeholder={auto !== null ? auto.toLocaleString('vi-VN') : 'Giá × quy đổi'}
                        />
                      </Field>
                      <button
                        type="button"
                        onClick={() => dispatch({ type: 'unit-remove', key: u.key })}
                        aria-label={`Bỏ đơn vị ${u.name || i + 1}`}
                        title="Bỏ đơn vị này"
                        className="col-span-2 inline-flex min-h-11 items-center justify-center gap-1 rounded-control text-sm text-shuttle-deep hover:bg-shuttle-soft sm:col-span-1 sm:mt-6 sm:w-11"
                      >
                        <Trash2 className="size-4" aria-hidden />
                        <span className="sm:sr-only">Bỏ đơn vị này</span>
                      </button>
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                      <Field id={`u-barcode-${u.key}`} label="Mã vạch" optional error={err('barcode')}>
                        <TextInput
                          id={`u-barcode-${u.key}`}
                          value={u.barcode}
                          onValue={(v) => dispatch({ type: 'unit', key: u.key, patch: { barcode: v.replace(/\s/g, '') } })}
                          error={err('barcode')}
                          inputMode="numeric"
                          autoComplete="off"
                          maxLength={32}
                        />
                      </Field>
                      {u.name && conv >= 2 && (
                        <p className="rounded-control bg-hall px-3 py-2.5 text-sm tabular">
                          1 {u.name} = {conv} {base || 'đơn vị'}
                          {price !== null ? `, ${formatVnd(price)}` : ''}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            <datalist id="p-pack-options">
              {PACK_UNITS.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
            {draft.units.length < 10 && (
              <button
                type="button"
                onClick={() => dispatch({ type: 'unit-add' })}
                className="inline-flex min-h-11 items-center gap-2 self-start rounded-control border border-dashed border-court-deep/50 px-4 text-sm font-medium text-court-deep hover:bg-court-soft"
              >
                <CirclePlus className="size-4" aria-hidden />
                Thêm đơn vị khác
              </button>
            )}
          </>
        )}
      </div>
    </CollapsibleSection>
  );
}
