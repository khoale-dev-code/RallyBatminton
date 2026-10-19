'use client';

import { CollapsibleSection } from '@/components/ui/collapsible-section';

import { type ProductEditorState } from '../../hooks/use-product-editor';

import { Field, TextArea, TextInput } from './fields';

function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/** Tối ưu tìm kiếm: tiêu đề/mô tả riêng cho Google, có bản xem trước. */
export function SeoSection({ ed, siteHost, path }: { ed: ProductEditorState; siteHost: string; path: string }) {
  const { draft, dispatch, errors } = ed;
  const title = clip(draft.seoTitle || draft.name || 'Tên sản phẩm', 70);
  const description = clip(draft.seoDescription || draft.excerpt || draft.description || 'Mô tả ngắn hiện trên kết quả tìm kiếm.', 160);
  return (
    <CollapsibleSection
      title="Tối ưu tìm kiếm (SEO)"
      description="Bỏ trống để dùng tên và trích dẫn của sản phẩm."
      summary={draft.seoTitle || draft.seoDescription ? 'Đã tùy chỉnh' : 'Tự động'}
      open={ed.sections.seo}
      onOpenChange={(o) => ed.setSection('seo', o)}
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-control border border-line bg-paper p-3" aria-label="Xem trước trên Google">
          <p className="text-xs text-muted">Xem trước trên Google</p>
          <p className="mt-1 truncate text-sm text-ink/70">
            {siteHost} › {path}
          </p>
          <p className="mt-0.5 text-lg leading-snug break-words text-[#1a0dab]">{title}</p>
          <p className="mt-0.5 text-sm leading-relaxed break-words text-ink/75">{description}</p>
        </div>
        <Field id="p-seo-title" label="Tiêu đề trang" optional error={errors.seo_title} counter={{ value: draft.seoTitle.length, max: 70 }}>
          <TextInput
            id="p-seo-title"
            value={draft.seoTitle}
            onValue={(v) => dispatch({ type: 'patch', patch: { seoTitle: v } })}
            error={errors.seo_title}
            maxLength={70}
            placeholder={draft.name}
          />
        </Field>
        <Field
          id="p-seo-desc"
          label="Mô tả trang"
          optional
          error={errors.seo_description}
          counter={{ value: draft.seoDescription.length, max: 320 }}
        >
          <TextArea
            id="p-seo-desc"
            value={draft.seoDescription}
            onValue={(v) => dispatch({ type: 'patch', patch: { seoDescription: v } })}
            error={errors.seo_description}
            rows={3}
            maxLength={320}
          />
        </Field>
      </div>
    </CollapsibleSection>
  );
}
