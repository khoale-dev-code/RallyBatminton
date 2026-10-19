'use client';

import { Info } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

import { type BrandTax } from '@/lib/tax';

import { useProductEditor } from '../../hooks/use-product-editor';
import { type ProductDraft } from '../../lib/product-draft';

import { GeneralSection } from './general-section';
import { InventorySection } from './inventory-section';
import { MediaPickerSection } from './media-section';
import { PricingSection } from './pricing-section';
import { RatesSection } from './rates-section';
import { SaveBar } from './save-bar';
import { SeoSection } from './seo-section';
import { TaxSection } from './tax-section';
import { KindCard, OrganizeCard, StatusCard } from './sidebar-cards';
import { type EditorBranch, type EditorCategory } from './types';
import { UnitsSection } from './units-section';
import { VariantsSection } from './variants-section';

export interface ProductEditorProps {
  mode: 'create' | 'edit';
  productId?: string;
  /** Dấu phiên bản dữ liệu (updated_at) — đổi thì nạp lại bản nháp từ server. */
  version?: string;
  initial: ProductDraft;
  categories: EditorCategory[];
  branches: EditorBranch[];
  tagSuggestions: string[];
  canManageCategories: boolean;
  siteHost: string;
  /** Cách tính thuế của thương hiệu và quyền đổi (chủ sân). */
  brandTax: BrandTax;
  canManageTax: boolean;
  readOnly?: boolean;
  archived?: boolean;
  /** Các khung do server dựng (màn sửa): ảnh, bày bán theo chi nhánh, gói thuê, combo, ngừng kinh doanh. */
  slots?: {
    media?: ReactNode;
    inventory?: ReactNode;
    main?: ReactNode;
    side?: ReactNode;
  };
}

/** Màn thêm/sửa sản phẩm kiểu một trang: các khung thu gọn được, cột phải là trạng thái và phân loại. */
export function ProductEditor({
  mode,
  productId,
  version,
  initial,
  categories,
  branches,
  tagSuggestions,
  canManageCategories,
  siteHost,
  brandTax,
  canManageTax,
  readOnly,
  archived,
  slots,
}: ProductEditorProps) {
  const ed = useProductEditor(mode, initial, productId, version);
  const { draft } = ed;
  const cancelHref = `/admin/catalog?kind=${draft.kind}`;

  // Ctrl/Cmd + S để lưu nhanh trên máy tính.
  const saveRef = useRef(ed.save);
  useEffect(() => {
    saveRef.current = ed.save;
  });
  useEffect(() => {
    if (readOnly) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [readOnly]);

  const path = draft.kind === 'sale' ? 'products' : 'rentals';

  return (
    <div className="flex flex-col gap-5">
      {readOnly && (
        <p className="flex items-start gap-2 rounded-control bg-hall px-3 py-2.5 text-sm">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          Bạn chỉ có quyền xem sản phẩm. Liên hệ chủ sân để được cấp quyền quản lý sản phẩm.
        </p>
      )}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <div className="flex min-w-0 flex-col gap-5">
          {mode === 'create' && <KindCard ed={ed} />}
          <GeneralSection ed={ed} />
          {mode === 'create' ? <MediaPickerSection ed={ed} /> : slots?.media}
          {draft.kind === 'sale' && <PricingSection ed={ed} />}
          {draft.kind === 'sale' && <TaxSection ed={ed} brandTax={brandTax} canManageTax={canManageTax} />}
          {draft.kind === 'rental' && mode === 'create' && <RatesSection ed={ed} />}
          <InventorySection ed={ed} mode={mode} branches={branches}>
            {slots?.inventory}
          </InventorySection>
          {draft.kind === 'sale' && <UnitsSection ed={ed} />}
          {!draft.isBundle && <VariantsSection ed={ed} mode={mode} />}
          {slots?.main}
          <SeoSection ed={ed} siteHost={siteHost} path={path} />
        </div>
        <aside className="flex min-w-0 flex-col gap-5" aria-label="Trạng thái và phân loại">
          <StatusCard ed={ed} archived={archived} />
          <OrganizeCard ed={ed} categories={categories} tagSuggestions={tagSuggestions} canManageCategories={canManageCategories} />
          {slots?.side}
        </aside>
      </div>
      {!readOnly && <SaveBar ed={ed} mode={mode} cancelHref={cancelHref} />}
    </div>
  );
}
