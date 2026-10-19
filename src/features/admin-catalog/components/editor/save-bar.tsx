'use client';

import { Loader2 } from 'lucide-react';
import Link from 'next/link';

import { buttonClass } from '@/components/ui/button';
import { cn } from '@/lib/cn';

import { type ProductEditorState } from '../../hooks/use-product-editor';

/** Thanh lưu dính đáy màn hình: luôn thấy trạng thái và nút lưu khi cuộn form dài. */
export function SaveBar({ ed, mode, cancelHref }: { ed: ProductEditorState; mode: 'create' | 'edit'; cancelHref: string }) {
  const status = ed.progress
    ? ed.progress
    : ed.isPending
      ? 'Đang lưu…'
      : ed.message
        ? ed.message.text
        : ed.dirty
          ? 'Chưa lưu thay đổi'
          : mode === 'edit'
            ? 'Mọi thay đổi đã được lưu'
            : 'Điền thông tin rồi bấm Tạo sản phẩm';
  const tone = !ed.isPending && ed.message ? ed.message.tone : null;
  const idle = !ed.progress && !ed.isPending && !ed.message && !ed.dirty;
  return (
    <div className="sticky bottom-0 z-20 -mx-4 border-t border-line bg-paper/95 px-4 pt-3 pb-safe backdrop-blur sm:-mx-6 sm:px-6 lg:bottom-4 lg:mx-0 lg:rounded-panel lg:border lg:pb-3 lg:shadow-lift">
      <div className="flex items-center gap-3 pb-3 lg:pb-0">
        <p
          role={tone === 'error' ? 'alert' : 'status'}
          className={cn(
            'line-clamp-2 min-w-0 flex-1 text-sm',
            // Điện thoại: khi chưa có gì để báo thì chỉ để nút, đỡ chật.
            idle && 'max-sm:invisible',
            tone === 'error' ? 'text-shuttle-deep' : tone === 'success' ? 'text-court-deep' : 'text-muted',
          )}
        >
          {ed.dirty && !ed.isPending && !ed.message && (
            <span aria-hidden className="mr-1.5 inline-block size-2 rounded-full bg-amber-deep align-middle" />
          )}
          {status}
        </p>
        {mode === 'create' ? (
          <Link href={cancelHref} className={buttonClass('ghost', 'md', 'max-sm:hidden')}>
            Hủy
          </Link>
        ) : (
          <button
            type="button"
            onClick={ed.reset}
            disabled={!ed.dirty || ed.isPending}
            className={buttonClass('ghost', 'md', 'max-sm:hidden')}
          >
            Hủy thay đổi
          </button>
        )}
        <button
          type="button"
          onClick={ed.save}
          disabled={ed.isPending || (mode === 'edit' && !ed.dirty)}
          className={buttonClass('primary', 'md', 'shrink-0')}
        >
          {ed.isPending && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />}
          {mode === 'create' ? 'Tạo sản phẩm' : 'Lưu'}
        </button>
      </div>
    </div>
  );
}
