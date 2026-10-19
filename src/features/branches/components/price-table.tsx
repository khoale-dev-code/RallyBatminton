import { formatDaysMask, formatVnd } from '@/lib/format';
import { describeRuleWindow, type PriceRuleLite } from '@/features/booking/lib/pricing';

interface PriceTableProps {
  rules: Array<PriceRuleLite & { label: string | null }>;
  courtNames: Record<string, string>;
}

/** Bảng giá đọc được: giá chung trước, giá riêng từng sân sau. */
export function PriceTable({ rules, courtNames }: PriceTableProps) {
  if (rules.length === 0) return <p className="text-muted">Chi nhánh đang cập nhật bảng giá.</p>;
  const groups = new Map<string, typeof rules>();
  for (const r of rules) {
    const key = r.court_id ? (courtNames[r.court_id] ?? 'Sân khác') : 'Tất cả sân';
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  return (
    <div className="flex flex-col gap-5">
      {[...groups.entries()].map(([title, items]) => (
        <div key={title}>
          <h4 className="mb-2 text-base font-medium">{title}</h4>
          <table className="w-full text-[0.95rem]">
            <thead className="sr-only">
              <tr>
                <th>Khung giờ</th>
                <th>Ngày</th>
                <th>Giá mỗi giờ</th>
              </tr>
            </thead>
            <tbody>
              {items
                .sort((a, b) => a.starts_at.localeCompare(b.starts_at) || b.priority - a.priority)
                .map((r) => (
                  <tr key={r.id} className="border-b border-line/70 last:border-0">
                    <td className="py-2 pr-3 tabular">{describeRuleWindow(r)}</td>
                    <td className="py-2 pr-3 text-muted">
                      {formatDaysMask(r.days_mask)}
                      {r.label ? <span className="block text-xs">{r.label}</span> : null}
                    </td>
                    <td className="py-2 text-right font-display text-lg tabular">{formatVnd(r.price_per_hour)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
