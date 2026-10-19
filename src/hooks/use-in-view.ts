'use client';

import { useEffect, useState } from 'react';

/**
 * Theo dõi phần tử có đang trong khung nhìn (ví dụ: ẩn thanh tóm tắt khi form đã hiện).
 * Trả về callback ref để hoạt động cả với phần tử hiển thị có điều kiện.
 */
export function useInView<T extends Element>(rootMargin = '0px'): [(el: T | null) => void, boolean] {
  const [element, setElement] = useState<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!element || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry?.isIntersecting ?? false), { rootMargin });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element, rootMargin]);
  return [setElement, element !== null && inView];
}
