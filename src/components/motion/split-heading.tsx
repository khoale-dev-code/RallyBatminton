'use client';

import { useRef, type ReactNode } from 'react';

import { gsap, MOTION_OK, SplitText, useGSAP } from './gsap';

interface SplitHeadingProps {
  as?: 'h1' | 'h2' | 'p';
  id?: string;
  className?: string;
  children: ReactNode;
  /** Chạy khi cuộn tới thay vì ngay khi tải trang. */
  onScroll?: boolean;
  delay?: number;
}

/** Tiêu đề trồi lên từng chữ sau "mặt nạ" (SplitText). Trình đọc màn hình vẫn đọc nguyên câu. */
export function SplitHeading({ as: Tag = 'h2', id, className, children, onScroll = false, delay = 0 }: SplitHeadingProps) {
  const ref = useRef<HTMLHeadingElement>(null);
  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        SplitText.create(el, {
          type: 'words',
          mask: 'words',
          autoSplit: true,
          onSplit: (self) => {
            // Mặt nạ mặc định cắt sát dòng chữ → mất dấu tiếng Việt (ạ, ọ, ầ…). Nới mặt nạ lên/xuống.
            gsap.set(self.masks, { paddingBlock: '0.22em', marginBlock: '-0.22em' });
            return gsap.from(self.words, {
              yPercent: 115,
              duration: 0.9,
              ease: 'expo.out',
              stagger: 0.06,
              delay,
              scrollTrigger: onScroll ? { trigger: el, start: 'top 85%', once: true } : undefined,
            });
          },
        });
      });
    },
    { scope: ref },
  );
  return (
    <Tag ref={ref} id={id} className={className}>
      {children}
    </Tag>
  );
}
