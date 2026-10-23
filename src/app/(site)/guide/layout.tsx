import { type ReactNode } from 'react';

/** Cẩm nang: `modal` hiện bài dạng hộp thoại khi bấm từ trong web; mở link trực tiếp thì ra trang riêng. */
export default function GuideLayout({ children, modal }: { children: ReactNode; modal: ReactNode }) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
