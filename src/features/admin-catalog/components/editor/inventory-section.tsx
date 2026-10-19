'use client';

import { Boxes } from 'lucide-react';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';

import { CollapsibleSection } from '@/components/ui/collapsible-section';
import { StepperInput } from '@/components/ui/stepper-input';
import { cn } from '@/lib/cn';

import { type ProductEditorState } from '../../hooks/use-product-editor';
import { variantTitle } from '../../lib/product-draft';

import { Check, Field, TextInput } from './fields';
import { type EditorBranch } from './types';

interface InventorySectionProps {
  ed: ProductEditorState;
  mode: 'create' | 'edit';
  branches: EditorBranch[];
  /** Màn sửa: khung bày bán theo chi nhánh (server) đặt bên trong. */
  children?: ReactNode;
}

export function InventorySection({ ed, mode, branches, children }: InventorySectionProps) {
  const { draft, dispatch, errors } = ed;
  const single = !draft.hasVariants ? draft.variants[0] : undefined;
  const stockable = !draft.isBundle;
  const listedCount = branches.filter((b) => draft.stock[b.id]?.listed).length;
  const totalOnHand = draft.variants.reduce((sum, v) => sum + (v.onHand ?? 0), 0);

  const summary =
    mode === 'create'
      ? stockable
        ? `Bán tại ${listedCount}/${branches.length} chi nhánh`
        : single?.sku || 'Combo — không có tồn riêng'
      : stockable
        ? `Tồn ${totalOnHand.toLocaleString('vi-VN')}`
        : single?.sku;

  return (
    <CollapsibleSection
      title="Kho hàng"
      description={
        mode === 'create'
          ? 'Chọn chi nhánh bày bán và nhập tồn đầu kỳ. Nhập/xuất sau này làm ở mục Tồn kho.'
          : 'Tồn kho thay đổi qua phiếu nhập, kiểm kê, bán và cho thuê.'
      }
      summary={summary}
      open={ed.sections.inventory}
      onOpenChange={(o) => ed.setSection('inventory', o)}
    >
      <div className="flex flex-col gap-5">
        {single && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="p-sku" label="Mã SKU" required error={errors['variants.0.sku']} hint="Tự gợi ý theo tên; chữ in hoa, số, dấu gạch.">
              <TextInput
                id="p-sku"
                value={single.sku}
                onValue={(v) => dispatch({ type: 'variant', key: single.key, patch: { sku: v.toUpperCase() } })}
                error={errors['variants.0.sku']}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                maxLength={40}
              />
            </Field>
            <Field
              id="p-barcode"
              label="Mã vạch"
              optional
              error={errors['variants.0.barcode']}
              hint="Mã EAN/UPC in trên bao bì, dùng để quét tại quầy."
            >
              <TextInput
                id="p-barcode"
                value={single.barcode}
                onValue={(v) => dispatch({ type: 'variant', key: single.key, patch: { barcode: v.replace(/\s/g, '') } })}
                error={errors['variants.0.barcode']}
                inputMode="numeric"
                autoComplete="off"
                maxLength={32}
              />
            </Field>
          </div>
        )}

        {stockable && mode === 'create' && <OpeningStock ed={ed} branches={branches} />}

        {stockable && mode === 'edit' && (
          <div className="flex flex-col gap-3 rounded-control bg-hall/70 p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2">
              <Boxes className="size-5 shrink-0 text-muted" aria-hidden />
              <span>
                Tổng tồn các chi nhánh: <strong className="tabular">{totalOnHand.toLocaleString('vi-VN')}</strong>
                {draft.unitLabel ? ` ${draft.unitLabel}` : ''}
              </span>
            </p>
            <Link
              href="/admin/inventory"
              className="inline-flex min-h-11 items-center text-sm font-medium text-court-deep underline-offset-4 hover:underline"
            >
              Nhập hàng / kiểm kê
            </Link>
          </div>
        )}

        {!stockable && <p className="text-sm text-muted">Combo không có tồn riêng: khi cho thuê, kho trừ từng món thành phần.</p>}

        {stockable && mode === 'create' && (
          <Field
            id="p-reorder"
            label="Cảnh báo sắp hết khi tồn ≤"
            optional
            error={errors.reorder_level}
            hint="Áp cho mọi chi nhánh bày bán; chỉnh riêng từng chi nhánh sau."
            className="sm:max-w-xs"
          >
            <TextInput
              id="p-reorder"
              value={draft.reorderLevel}
              onValue={(v) => dispatch({ type: 'patch', patch: { reorderLevel: v.replace(/[^\d]/g, '') } })}
              error={errors.reorder_level}
              inputMode="numeric"
              placeholder="0"
            />
          </Field>
        )}

        {children}
      </div>
    </CollapsibleSection>
  );
}

/** Bảng tồn đầu kỳ: mỗi chi nhánh bật "Bán tại đây" và nhập số lượng (theo từng biến thể nếu có). */
function OpeningStock({ ed, branches }: { ed: ProductEditorState; branches: EditorBranch[] }) {
  const { draft, dispatch } = ed;
  const [tab, setTab] = useState(branches[0]?.id ?? '');
  if (branches.length === 0) {
    return <p className="text-sm text-muted">Bạn chưa được giao chi nhánh nào để bày bán sản phẩm.</p>;
  }

  if (!draft.hasVariants) {
    const v = draft.variants[0];
    return (
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-2 text-sm font-medium">Bày bán & tồn đầu kỳ</legend>
        <ul className="divide-y divide-line rounded-control border border-line">
          {branches.map((b) => {
            const s = draft.stock[b.id];
            const listed = s?.listed ?? false;
            return (
              <li key={b.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <Check
                    id={`stock-listed-${b.id}`}
                    checked={listed}
                    onChecked={(on) => dispatch({ type: 'stock-listed', branchId: b.id, listed: on })}
                    label={b.name}
                    hint={!b.canStock && listed ? 'Không có quyền nhập tồn — tồn bắt đầu từ 0' : undefined}
                  />
                </div>
                {v && (
                  <StepperInput
                    label={`tồn đầu kỳ tại ${b.name}`}
                    value={s?.qty[v.key] ?? 0}
                    onChange={(n) => dispatch({ type: 'stock-qty', branchId: b.id, variantKey: v.key, qty: n })}
                    disabled={!listed || !b.canStock}
                  />
                )}
              </li>
            );
          })}
        </ul>
      </fieldset>
    );
  }

  const current = branches.find((b) => b.id === tab) ?? branches[0];
  if (!current) return null;
  const s = draft.stock[current.id];
  const listed = s?.listed ?? false;
  return (
    <fieldset className="flex min-w-0 flex-col gap-3">
      <legend className="mb-2 text-sm font-medium">Bày bán & tồn đầu kỳ theo chi nhánh</legend>
      {branches.length > 1 && (
        <div role="tablist" aria-label="Chi nhánh" className="scroll-x -mx-1 flex gap-1.5 px-1 pb-1">
          {branches.map((b) => {
            const on = draft.stock[b.id]?.listed ?? false;
            return (
              <button
                key={b.id}
                type="button"
                role="tab"
                aria-selected={b.id === current.id}
                onClick={() => setTab(b.id)}
                className={cn(
                  'inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm whitespace-nowrap',
                  b.id === current.id ? 'border-ink bg-ink text-paper' : 'border-line bg-paper hover:border-ink',
                )}
              >
                <span aria-hidden className={cn('size-2 rounded-full', on ? 'bg-court' : 'bg-line')} />
                {b.name}
              </button>
            );
          })}
        </div>
      )}
      <div className="rounded-control border border-line" role="tabpanel" aria-label={current.name}>
        <div className="border-b border-line px-3 py-1">
          <Check
            id={`stock-listed-${current.id}`}
            checked={listed}
            onChecked={(on) => dispatch({ type: 'stock-listed', branchId: current.id, listed: on })}
            label={`Bán tại ${current.name}`}
            hint={!current.canStock ? 'Bạn không có quyền nhập tồn ở chi nhánh này — tồn bắt đầu từ 0.' : undefined}
          />
        </div>
        <ul className={cn('divide-y divide-line', !listed && 'opacity-60')}>
          {draft.variants.map((v) => (
            <li key={v.key} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium">{variantTitle(v)}</span>
                <span className="truncate text-xs text-muted tabular">{v.sku || 'Chưa có SKU'}</span>
              </span>
              <StepperInput
                label={`tồn đầu kỳ ${variantTitle(v)} tại ${current.name}`}
                value={s?.qty[v.key] ?? 0}
                onChange={(n) => dispatch({ type: 'stock-qty', branchId: current.id, variantKey: v.key, qty: n })}
                disabled={!listed || !current.canStock}
              />
            </li>
          ))}
        </ul>
      </div>
    </fieldset>
  );
}
