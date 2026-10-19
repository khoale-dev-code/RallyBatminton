'use client';

import Link from 'next/link';

import { CollapsibleSection } from '@/components/ui/collapsible-section';
import { controlClass } from '@/components/ui/form';
import { TagInput } from '@/components/ui/tag-input';
import { cn } from '@/lib/cn';

import { type ProductEditorState } from '../../hooks/use-product-editor';
import { emptyRate } from '../../lib/product-draft';

import { Check, Field } from './fields';
import { type EditorCategory } from './types';

/** Chọn loại khi tạo mới: hàng bán / đồ cho thuê / combo thuê. Không đổi được sau khi tạo. */
export function KindCard({ ed }: { ed: ProductEditorState }) {
  const { draft, dispatch } = ed;
  const options = [
    { value: 'sale' as const, label: 'Hàng bán', hint: 'Đồ uống, cầu, phụ kiện' },
    { value: 'rental' as const, label: 'Đồ cho thuê', hint: 'Vợt, giày theo giờ' },
  ];
  return (
    <CollapsibleSection title="Loại sản phẩm" summary={draft.kind === 'sale' ? 'Hàng bán' : draft.isBundle ? 'Combo thuê' : 'Đồ cho thuê'}>
      <fieldset className="flex flex-col gap-3">
        <legend className="sr-only">Loại sản phẩm</legend>
        <div className="grid grid-cols-2 gap-2">
          {options.map((o) => (
            <label
              key={o.value}
              className={cn(
                'flex min-h-16 cursor-pointer flex-col justify-center rounded-control border px-3 py-2 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ink/30',
                draft.kind === o.value ? 'border-ink bg-hall/60' : 'border-line hover:border-ink/40',
              )}
            >
              <input
                type="radio"
                name="product-kind"
                value={o.value}
                checked={draft.kind === o.value}
                onChange={() =>
                  dispatch({
                    type: 'patch',
                    patch:
                      o.value === 'rental'
                        ? { kind: 'rental', rates: draft.rates.length ? draft.rates : [emptyRate()] }
                        : { kind: 'sale', isBundle: false },
                  })
                }
                className="sr-only"
              />
              <span className="font-medium">{o.label}</span>
              <span className="text-xs text-muted">{o.hint}</span>
            </label>
          ))}
        </div>
        {draft.kind === 'rental' && (
          <Check
            id="p-bundle"
            checked={draft.isBundle}
            onChecked={(on) => {
              if (on) dispatch({ type: 'variants-toggle', on: false });
              dispatch({ type: 'patch', patch: { isBundle: on } });
            }}
            label="Combo thuê (gồm nhiều món)"
            hint="Ví dụ vợt + giày. Chọn món thành phần sau khi tạo."
          />
        )}
        <p className="text-xs text-muted">Không đổi được loại sau khi tạo.</p>
      </fieldset>
    </CollapsibleSection>
  );
}

export function StatusCard({ ed, archived }: { ed: ProductEditorState; archived?: boolean }) {
  const { draft, dispatch } = ed;
  const channels = [draft.showOnWebsite && 'Website', draft.showOnPos && 'Quầy'].filter(Boolean).join(', ');
  return (
    <CollapsibleSection title="Trạng thái" summary={!draft.isActive ? 'Đang ẩn' : channels || 'Không hiển thị'}>
      <div className="flex flex-col gap-1">
        <Check
          id="p-active"
          checked={draft.isActive}
          onChecked={(v) => dispatch({ type: 'patch', patch: { isActive: v } })}
          disabled={archived}
          label="Đang kinh doanh"
          hint={archived ? 'Sản phẩm đã ngừng — mở bán lại ở cuối trang.' : 'Tắt để tạm ẩn ở mọi nơi.'}
        />
        <p className="mt-2 text-sm font-medium">Kênh bán</p>
        <Check
          id="p-web"
          checked={draft.showOnWebsite}
          onChecked={(v) => dispatch({ type: 'patch', patch: { showOnWebsite: v } })}
          label="Website"
          hint="Khách xem trên trang sản phẩm"
        />
        <Check
          id="p-pos"
          checked={draft.showOnPos}
          onChecked={(v) => dispatch({ type: 'patch', patch: { showOnPos: v } })}
          label={draft.kind === 'sale' ? 'Quầy bán hàng' : 'Quầy cho thuê'}
          hint="Nhân viên chọn được khi lập đơn"
        />
      </div>
    </CollapsibleSection>
  );
}

export function OrganizeCard({
  ed,
  categories,
  tagSuggestions,
  canManageCategories,
}: {
  ed: ProductEditorState;
  categories: EditorCategory[];
  tagSuggestions: string[];
  canManageCategories: boolean;
}) {
  const { draft, dispatch, errors } = ed;
  const category = categories.find((c) => c.id === draft.categoryId)?.name;
  return (
    <CollapsibleSection
      title="Phân loại"
      summary={[category, draft.tags.length ? `${draft.tags.length} nhãn` : null].filter(Boolean).join(', ') || 'Chưa phân loại'}
      open={ed.sections.sidebar}
      onOpenChange={(o) => ed.setSection('sidebar', o)}
    >
      <div className="flex flex-col gap-4">
        <Field
          id="p-category"
          label="Nhóm sản phẩm"
          error={errors.category_id}
          hint={
            canManageCategories ? (
              <Link href="/admin/catalog/categories" className="underline underline-offset-4 hover:text-ink">
                Quản lý nhóm sản phẩm
              </Link>
            ) : undefined
          }
        >
          <select
            id="p-category"
            value={draft.categoryId}
            onChange={(e) => dispatch({ type: 'patch', patch: { categoryId: e.target.value } })}
            className={cn(controlClass, 'min-h-11')}
          >
            <option value="">Không phân nhóm</option>
            {categories
              .filter((c) => c.isActive || c.id === draft.categoryId)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.isActive ? '' : ' (đang ẩn)'}
                </option>
              ))}
          </select>
        </Field>
        <Field id="p-tags" label="Nhãn" error={errors.tags} hint="Dùng để tìm nhanh, ví dụ: lạnh, khuyến mãi, size lớn.">
          <TagInput
            id="p-tags"
            value={draft.tags}
            onChange={(tags) => dispatch({ type: 'patch', patch: { tags } })}
            suggestions={tagSuggestions}
            placeholder="Thêm nhãn"
            invalid={Boolean(errors.tags)}
          />
        </Field>
      </div>
    </CollapsibleSection>
  );
}
