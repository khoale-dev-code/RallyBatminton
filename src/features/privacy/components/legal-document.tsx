import { Info } from 'lucide-react';

import { RichText } from '@/features/guide/components/rich-text';
import { cn } from '@/lib/cn';
import { formatVnd } from '@/lib/format';

import { fillPlaceholders, type LegalBlock } from '../lib/markup';
import { refundAmount, refundTiers } from '../lib/policy';
import { type BranchCancellation, type RetentionPolicy } from '../types';

/** 365 → "1 năm", 90 → "3 tháng", 1 → "1 ngày". */
export function formatRetention(days: number): string {
  if (days % 365 === 0) return `${days / 365} năm`;
  if (days % 30 === 0) return `${days / 30} tháng`;
  return `${days} ngày`;
}

const ACTION_LABEL: Record<RetentionPolicy['action'], string> = {
  anonymize: 'Ẩn danh hóa',
  delete: 'Xóa',
  keep: 'Lưu theo luật',
};

const tableWrap = 'overflow-x-auto rounded-2xl border border-line';
const thClass = 'bg-hall px-4 py-3 text-left text-sm font-semibold whitespace-nowrap';
const tdClass = 'border-t border-line px-4 py-3 align-top text-[0.95rem]';

function CancellationTable({ branches }: { branches: BranchCancellation[] }) {
  if (branches.length === 0) {
    return (
      <p className="rounded-2xl bg-hall px-4 py-3 text-sm text-muted">
        Chưa có chi nhánh mở đặt sân trực tuyến. Điều kiện cụ thể sẽ hiện ở đây khi chi nhánh được công bố.
      </p>
    );
  }
  const example = branches[0];
  const sampleHours = Math.max(example.partialRefundHours, Math.min(example.freeCancelHours - 1, example.partialRefundHours + 4));
  return (
    <div className="flex flex-col gap-4">
      <ul className="grid gap-3 md:grid-cols-2">
        {branches.map((b) => (
          <li key={b.slug} className="flex flex-col gap-3 rounded-2xl border border-line bg-paper p-4 sm:p-5">
            <p className="font-display text-xl">{b.name}</p>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-xl bg-hall px-3 py-2">
                <dt className="text-muted">Giữ chỗ chờ cọc</dt>
                <dd className="font-display text-2xl tabular">{b.holdMinutes} phút</dd>
              </div>
              <div className="rounded-xl bg-hall px-3 py-2">
                <dt className="text-muted">Tiền cọc</dt>
                <dd className="font-display text-2xl tabular">{b.depositPercent}%</dd>
              </div>
            </dl>
            <ul className="flex flex-col divide-y divide-line text-[0.95rem]">
              {refundTiers(b).map((t) => (
                <li key={t.label} className="flex items-center justify-between gap-3 py-2">
                  <span>{t.label}</span>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2.5 py-0.5 text-sm font-semibold tabular',
                      t.percent === 100
                        ? 'bg-court-soft text-court-deep'
                        : t.percent === 0
                          ? 'bg-shuttle-soft text-shuttle-deep'
                          : 'bg-amber-soft text-amber-deep',
                    )}
                  >
                    {t.percent === 0 ? 'Không hoàn' : `Hoàn ${t.percent}%`}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      {example.freeCancelHours > example.partialRefundHours && (
        <p className="flex gap-2 rounded-2xl bg-court-soft px-4 py-3 text-[0.95rem] text-ink/85">
          <Info className="mt-0.5 size-4 shrink-0 text-court-deep" aria-hidden />
          <span>
            Ví dụ tại {example.name}: bạn đã chuyển cọc {formatVnd(105_000)}, hủy khi còn {sampleHours} giờ nữa tới giờ chơi → được hoàn{' '}
            <strong className="font-semibold">{formatVnd(refundAmount(105_000, sampleHours, example))}</strong>.
          </span>
        </p>
      )}
    </div>
  );
}

function RetentionTable({ policies }: { policies: RetentionPolicy[] }) {
  if (policies.length === 0) return null;
  return (
    <div className={tableWrap} role="region" aria-label="Bảng thời hạn lưu trữ" tabIndex={0}>
      <table className="w-full min-w-[40rem] border-collapse">
        <thead>
          <tr>
            <th scope="col" className={thClass}>
              Loại dữ liệu
            </th>
            <th scope="col" className={thClass}>
              Thời hạn
            </th>
            <th scope="col" className={thClass}>
              Khi hết hạn
            </th>
          </tr>
        </thead>
        <tbody>
          {policies.map((p) => (
            <tr key={p.code}>
              <td className={tdClass}>
                <span className="font-medium">{p.label}</span>
                <span className="mt-0.5 block text-sm text-muted">{p.dataScope}</span>
              </td>
              <td className={cn(tdClass, 'whitespace-nowrap tabular')}>{formatRetention(p.retentionDays)}</td>
              <td className={tdClass}>
                <span className="font-medium">{ACTION_LABEL[p.action]}</span>
                <span className="mt-0.5 block text-sm text-muted">{p.basis}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Hiển thị văn bản pháp lý đã tách khối; {{...}} lấy từ cài đặt và cấu hình thật. */
export function LegalDocumentBody({
  blocks,
  values,
  cancellation,
  retention,
}: {
  blocks: LegalBlock[];
  values: Readonly<Record<string, string | null | undefined>>;
  cancellation: BranchCancellation[];
  retention: RetentionPolicy[];
}) {
  const t = (text: string) => <RichText text={fillPlaceholders(text, values)} />;
  return (
    <div className="flex flex-col gap-4 text-[1.02rem] leading-relaxed text-ink/85">
      {blocks.map((b, i) => {
        switch (b.kind) {
          case 'h2':
            return (
              <h2 key={i} id={b.id} className="mt-6 scroll-mt-24 text-[1.7rem] text-ink first:mt-0 sm:text-3xl">
                {fillPlaceholders(b.text, values)}
              </h2>
            );
          case 'h3':
            return (
              <h3 key={i} className="mt-2 text-xl text-ink">
                {fillPlaceholders(b.text, values)}
              </h3>
            );
          case 'p':
            return <p key={i}>{t(b.text)}</p>;
          case 'note':
            return (
              <p key={i} className="rounded-2xl border border-court/35 bg-court-soft px-4 py-3 text-ink">
                {t(b.text)}
              </p>
            );
          case 'ul':
            return (
              <ul key={i} className="flex flex-col gap-2">
                {b.items.map((item, j) => (
                  <li key={j} className="flex gap-3">
                    <span aria-hidden className="mt-[0.62rem] size-1.5 shrink-0 rotate-45 bg-court-strong" />
                    <span>{t(item)}</span>
                  </li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={i} className="flex flex-col gap-2">
                {b.items.map((item, j) => (
                  <li key={j} className="flex gap-3">
                    <span className="w-5 shrink-0 font-display text-court-deep tabular">{j + 1}.</span>
                    <span>{t(item)}</span>
                  </li>
                ))}
              </ol>
            );
          case 'table':
            return (
              <div key={i} className={tableWrap} role="region" aria-label={`Bảng: ${b.head.join(', ')}`} tabIndex={0}>
                <table className="w-full min-w-[36rem] border-collapse">
                  <thead>
                    <tr>
                      {b.head.map((h, j) => (
                        <th key={j} scope="col" className={thClass}>
                          {fillPlaceholders(h, values)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((row, r) => (
                      <tr key={r}>
                        {row.map((cell, c) => (
                          <td key={c} className={tdClass}>
                            {t(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case 'slot':
            if (b.key === 'bang_huy_coc') return <CancellationTable key={i} branches={cancellation} />;
            if (b.key === 'bang_luu_tru') return <RetentionTable key={i} policies={retention} />;
            return null;
        }
      })}
    </div>
  );
}
