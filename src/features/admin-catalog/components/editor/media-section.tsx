'use client';

import { ImagePlus, Star, X } from 'lucide-react';
import { useId, useState, type DragEvent } from 'react';

import { CollapsibleSection } from '@/components/ui/collapsible-section';
import { cn } from '@/lib/cn';

import { type ProductEditorState } from '../../hooks/use-product-editor';

/** Chọn ảnh khi tạo sản phẩm: xem trước ngay, tải lên Storage sau khi sản phẩm được tạo. */
export function MediaPickerSection({ ed }: { ed: ProductEditorState }) {
  const inputId = useId();
  const [over, setOver] = useState(false);
  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setOver(false);
    if (e.dataTransfer.files.length) ed.addPhotos(e.dataTransfer.files);
  };
  return (
    <CollapsibleSection
      title="Hình ảnh sản phẩm"
      description="Ảnh đầu tiên là ảnh chính. Ảnh được nén WebP rồi tải lên khi lưu."
      summary={ed.photos.length ? `${ed.photos.length} ảnh` : 'Chưa có ảnh'}
      open={ed.sections.media}
      onOpenChange={(o) => ed.setSection('media', o)}
    >
      <div className="flex flex-col gap-4">
        {ed.photos.length > 0 && (
          <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-5">
            {ed.photos.map((p, i) => (
              <li key={p.key} className="group relative overflow-hidden rounded-control border border-line bg-hall">
                {/* eslint-disable-next-line @next/next/no-img-element -- ảnh xem trước cục bộ (blob:) */}
                <img src={p.url} alt={`Ảnh ${i + 1}`} className="aspect-square w-full object-cover" />
                {i === 0 && (
                  <span className="absolute bottom-1.5 left-1.5 rounded-full bg-ink px-2 py-0.5 text-xs text-paper">Ảnh chính</span>
                )}
                <div className="absolute top-1.5 right-1.5 flex gap-1">
                  {i > 0 && (
                    <button
                      type="button"
                      onClick={() => ed.makeCover(p.key)}
                      aria-label="Đặt làm ảnh chính"
                      title="Đặt làm ảnh chính"
                      className="grid size-8 place-items-center rounded-full bg-paper/90 shadow-sm hover:bg-paper"
                    >
                      <Star className="size-4" aria-hidden />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => ed.removePhoto(p.key)}
                    aria-label="Bỏ ảnh"
                    title="Bỏ ảnh"
                    className="grid size-8 place-items-center rounded-full bg-paper/90 shadow-sm hover:bg-paper"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <label
          htmlFor={inputId}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
          className={cn(
            'flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-panel border-2 border-dashed px-4 py-6 text-center transition-colors',
            over ? 'border-court bg-court-soft' : 'border-line hover:border-ink/40',
          )}
        >
          <ImagePlus className="size-8 text-muted" aria-hidden />
          <span className="font-medium text-court-deep">Thêm ảnh</span>
          <span className="text-sm text-muted">Chọn hoặc kéo thả, tối đa 12 ảnh JPG, PNG, WebP</span>
        </label>
        <input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          onChange={(e) => {
            if (e.target.files) ed.addPhotos(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
    </CollapsibleSection>
  );
}
