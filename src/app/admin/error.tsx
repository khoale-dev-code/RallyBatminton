'use client';

import { Button } from '@/components/ui/button';

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="flex max-w-xl flex-col gap-4 rounded-panel border border-line bg-paper p-6">
      <h1 className="text-2xl">Không tải được dữ liệu</h1>
      <p className="text-muted">
        Máy chủ hoặc database không phản hồi. Thử lại sau giây lát.
        {error.digest ? <span className="mt-2 block text-sm">Mã lỗi: {error.digest}</span> : null}
      </p>
      <div>
        <Button onClick={reset}>Thử lại</Button>
      </div>
    </section>
  );
}
