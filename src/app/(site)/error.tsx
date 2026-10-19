'use client';

import { Button, LinkButton } from '@/components/ui/button';

export default function SiteError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="mx-auto flex w-full max-w-xl flex-col gap-4 px-5 py-16">
      <h1 className="text-3xl">Không tải được trang</h1>
      <p className="text-muted">Kết nối tới máy chủ bị gián đoạn. Thử tải lại; nếu cần đặt sân gấp, hãy gọi hotline của chi nhánh.</p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={reset}>Tải lại</Button>
        <LinkButton href="/">Về trang chủ</LinkButton>
      </div>
    </section>
  );
}
