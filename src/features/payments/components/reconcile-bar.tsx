import { RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react';

import { ActionForm, SubmitButton } from '@/components/ui/form';
import { formatDateTime } from '@/lib/format';

import { reconcileNowAction } from '../actions';
import { type ReconcileRun } from '../admin-queries';

const SOURCE: Record<string, string> = { cron: 'tự động', vercel: 'tự động (Vercel)', manual: 'bấm tay' };

/** Dải "Đối soát với SePay" ở trang Giao dịch ngân hàng (chỉ chủ sân). */
export function ReconcileBar({ run, tokenReady }: { run: ReconcileRun | null; tokenReady: boolean }) {
  const failed = Boolean(run?.error);
  return (
    <div className="mb-6 flex flex-col gap-3 rounded-panel border border-line bg-paper p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3 text-sm">
        {failed || !tokenReady ? (
          <TriangleAlert className="mt-0.5 size-5 shrink-0 text-shuttle-deep" aria-hidden />
        ) : (
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-court-deep" aria-hidden />
        )}
        <div className="min-w-0">
          <p className="font-medium">Đối soát dự phòng với SePay</p>
          <p className="text-muted">
            {!tokenReady
              ? 'Chưa có SEPAY_API_TOKEN trên máy chủ — chỉ dựa vào webhook (SePay tự gửi lại tối đa 7 lần).'
              : run
                ? `Lần gần nhất ${formatDateTime(run.started_at)} (${SOURCE[run.source] ?? run.source}): ${
                    run.error ? `lỗi — ${run.error}` : `kiểm tra ${run.fetched} giao dịch, ghi bù ${run.new_count}.`
                  }`
                : 'Chưa chạy lần nào. Website tự hỏi SePay mỗi 15 phút khi đã bật lịch chạy (README mục 16).'}
          </p>
        </div>
      </div>
      {tokenReady && (
        <ActionForm action={reconcileNowAction} className="shrink-0">
          <SubmitButton size="sm" variant="outline" pendingLabel="Đang hỏi SePay…">
            <RefreshCw className="size-4" aria-hidden />
            Đối soát ngay
          </SubmitButton>
        </ActionForm>
      )}
    </div>
  );
}
