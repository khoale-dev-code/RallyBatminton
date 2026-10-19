import { ruleForSlot, type PriceRuleLite } from '@/features/booking/lib/pricing';
import { buildDaySlots } from '@/features/booking/lib/slots';
import { cn } from '@/lib/cn';
import { formatVndShort } from '@/lib/format';
import { addDays, startOfIsoWeek, todayKey } from '@/lib/time';

const DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

/** Ma trận giá tuần hiện tại: phát hiện nhanh giờ thiếu giá hoặc giá bất thường. */
export function PriceMatrix({ rules, opensAt, closesAt }: { rules: PriceRuleLite[]; opensAt: string; closesAt: string }) {
  const monday = startOfIsoWeek(todayKey());
  const dates = DAYS.map((_, i) => addDays(monday, i));
  const slots = buildDaySlots(opensAt, closesAt, 30);
  const generalRules = rules.filter((r) => r.court_id === null);
  const prices = generalRules.map((r) => r.price_per_hour);
  const min = Math.min(...prices);
  const max = Math.max(...prices);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-separate border-spacing-[2px] text-center text-xs">
        <thead>
          <tr>
            <th className="w-14" />
            {DAYS.map((d) => (
              <th key={d} className="pb-1 font-medium">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {slots.map((s) => (
            <tr key={s.start}>
              <th scope="row" className="pr-2 text-right font-normal text-muted tabular">
                {s.start}
              </th>
              {dates.map((date) => {
                const rule = ruleForSlot(generalRules, '__general__', date, s.start, 30);
                const level = rule && max > min ? (rule.price_per_hour - min) / (max - min) : 0;
                return (
                  <td
                    key={date}
                    className={cn('h-6 rounded-[3px] tabular', rule ? 'text-ink' : 'bg-shuttle-soft text-shuttle-deep')}
                    style={rule ? { backgroundColor: `rgba(98, 187, 70, ${0.18 + level * 0.62})` } : undefined}
                  >
                    {rule ? formatVndShort(rule.price_per_hour) : '—'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
