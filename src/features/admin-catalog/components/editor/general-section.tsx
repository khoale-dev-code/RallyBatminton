'use client';

import { CollapsibleSection } from '@/components/ui/collapsible-section';

import { type ProductEditorState } from '../../hooks/use-product-editor';

import { Field, TextArea, TextInput } from './fields';

export function GeneralSection({ ed }: { ed: ProductEditorState }) {
  const { draft, dispatch, errors } = ed;
  return (
    <CollapsibleSection
      title="Thông tin chung"
      summary={draft.name || 'Chưa có tên'}
      open={ed.sections.general}
      onOpenChange={(o) => ed.setSection('general', o)}
    >
      <div className="flex flex-col gap-4">
        <Field id="p-name" label="Tên sản phẩm" required error={errors.name}>
          <TextInput
            id="p-name"
            value={draft.name}
            onValue={(v) => dispatch({ type: 'name', name: v })}
            error={errors.name}
            maxLength={150}
            placeholder="Ví dụ: Nước suối Aquafina 500ml"
            autoComplete="off"
          />
        </Field>
        <Field id="p-brand" label="Thương hiệu" optional error={errors.brand_name}>
          <TextInput
            id="p-brand"
            value={draft.brandName}
            onValue={(v) => dispatch({ type: 'patch', patch: { brandName: v } })}
            error={errors.brand_name}
            maxLength={60}
            placeholder="Yonex, Lining, Aquafina…"
          />
        </Field>
        <Field
          id="p-desc"
          label="Mô tả sản phẩm"
          optional
          error={errors.description}
          counter={{ value: draft.description.length, max: 4000 }}
          hint="Xuống dòng để tách đoạn. Hiện trên trang chi tiết sản phẩm."
        >
          <TextArea
            id="p-desc"
            value={draft.description}
            onValue={(v) => dispatch({ type: 'patch', patch: { description: v } })}
            error={errors.description}
            rows={6}
            maxLength={4000}
          />
        </Field>
        <Field
          id="p-excerpt"
          label="Trích dẫn"
          optional
          error={errors.excerpt}
          counter={{ value: draft.excerpt.length, max: 300 }}
          hint="Một câu ngắn hiện ngay dưới tên sản phẩm."
        >
          <TextInput
            id="p-excerpt"
            value={draft.excerpt}
            onValue={(v) => dispatch({ type: 'patch', patch: { excerpt: v } })}
            error={errors.excerpt}
            maxLength={300}
            placeholder="Ví dụ: Ướp lạnh sẵn tại quầy"
          />
        </Field>
      </div>
    </CollapsibleSection>
  );
}
