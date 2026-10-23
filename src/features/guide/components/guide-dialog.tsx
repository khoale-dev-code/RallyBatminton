'use client';

import { Check, Link2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { gsap, MOTION_OK, useGSAP } from '@/components/motion/gsap';

const SHEET = '(max-width: 639px)';

/**
 * Hộp thoại đọc bài cẩm nang (mở khi bấm thẻ ở trang Cẩm nang — URL vẫn là /guide/<bài> để chia sẻ được).
 * Điện thoại: trượt lên từ dưới như bottom sheet. Đóng: nút X, phím Esc, bấm ra ngoài → quay lại trang trước.
 */
export function GuideDialog({ titleId, header, children }: { titleId: string; header: ReactNode; children: ReactNode }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closing = useRef(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog.open) dialog.showModal();
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prevOverflow;
      if (opener?.isConnected && !opener.closest('dialog')) opener.focus({ preventScroll: true });
    };
  }, []);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add({ motion: MOTION_OK, sheet: SHEET }, (ctx) => {
        if (!ctx.conditions?.motion) return;
        gsap.from(
          panelRef.current,
          ctx.conditions.sheet
            ? { yPercent: 100, duration: 0.5, ease: 'expo.out' }
            : { y: 36, scale: 0.97, autoAlpha: 0, duration: 0.5, ease: 'expo.out' },
        );
        gsap.from('[data-dialog-body] > div > *', { y: 18, autoAlpha: 0, duration: 0.5, ease: 'power3.out', stagger: 0.04, delay: 0.12 });
      });
    },
    { scope: dialogRef },
  );

  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    dialogRef.current?.setAttribute('data-closing', '');
    const panel = panelRef.current;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!panel || reduce) {
      router.back();
      return;
    }
    const sheet = window.matchMedia(SHEET).matches;
    gsap.to(panel, {
      ...(sheet ? { yPercent: 100 } : { y: 24, autoAlpha: 0 }),
      duration: 0.22,
      ease: 'power2.in',
      onComplete: () => router.back(),
    });
  }, [router]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      className="guide-dialog m-0 mt-auto max-h-none w-full max-w-none overflow-visible border-0 bg-transparent p-0 text-ink sm:m-auto sm:w-[min(50rem,calc(100%-3rem))]"
    >
      <div
        ref={panelRef}
        className="flex max-h-[94svh] flex-col overflow-hidden rounded-t-[1.75rem] bg-paper shadow-[0_40px_80px_-20px_rgb(0_0_0/0.45)] sm:max-h-[min(90svh,62rem)] sm:rounded-[1.75rem]"
      >
        <header className="relative flex items-start gap-3 border-b border-line px-5 pt-3 pb-4 sm:px-8 sm:pt-6 sm:pb-5">
          <span aria-hidden className="absolute top-2 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-line sm:hidden" />
          <div className="mt-3 min-w-0 flex-1 sm:mt-0">{header}</div>
          <div className="mt-3 flex shrink-0 gap-1 sm:mt-0">
            <button
              type="button"
              onClick={copyLink}
              aria-label={copied ? 'Đã sao chép liên kết' : 'Sao chép liên kết bài này'}
              title="Sao chép liên kết"
              className="grid size-10 place-items-center rounded-full text-muted transition-colors hover:bg-hall hover:text-ink"
            >
              {copied ? <Check className="size-5 text-court-deep" aria-hidden /> : <Link2 className="size-5" aria-hidden />}
            </button>
            <button
              type="button"
              onClick={close}
              aria-label="Đóng"
              className="grid size-10 place-items-center rounded-full bg-hall text-ink transition-colors hover:bg-line"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
        </header>
        <div data-dialog-body className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-5 pb-8 sm:px-8 sm:pt-6 sm:pb-10">
          {children}
        </div>
      </div>
    </dialog>
  );
}
