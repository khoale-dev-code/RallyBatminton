import 'server-only';

import { listPublishedBranches, type BranchSummary, type QueryResult } from '@/features/branches/queries';
import { createPublicClient } from '@/lib/supabase/public';
import { dateKeyInZone, DEFAULT_TZ, zonedToUtc } from '@/lib/time';

import { candidateStarts, isOpenAt, quickSlots, type QuickSlot } from './lib/quick-slots';

export interface HomeBranch extends BranchSummary {
  isOpen: boolean;
  /** Ngày của các giờ gợi ý (hôm nay, hoặc ngày mai khi đã hết giờ). */
  slotsDate: string;
  slotsIsToday: boolean;
  slots: QuickSlot[];
}

const MAX_BRANCHES = 8;

/** Chi nhánh cho trang chủ, kèm trạng thái mở cửa và 4 giờ gần nhất còn bao nhiêu sân trống. */
export async function getHomeBranches(now: Date): Promise<QueryResult<HomeBranch[]>> {
  const result = await listPublishedBranches();
  if (!result.ok) return result;
  const supabase = createPublicClient();
  const tz = DEFAULT_TZ;
  const branches = await Promise.all(
    result.data.slice(0, MAX_BRANCHES).map(async (b): Promise<HomeBranch> => {
      const { dateKey, starts } = candidateStarts(b.opensAt, b.closesAt, now, tz);
      const base = {
        ...b,
        isOpen: isOpenAt(b.opensAt, b.closesAt, now, tz),
        slotsDate: dateKey,
        slotsIsToday: dateKey === dateKeyInZone(now, tz),
      };
      const first = starts[0];
      const last = starts.at(-1);
      if (first === undefined || last === undefined || b.courtCount === 0) return { ...base, slots: [] };
      const dayStart = zonedToUtc(dateKey, '00:00', tz).getTime();
      const { data } = await supabase.rpc('get_branch_busy_slots', {
        p_branch_id: b.id,
        p_from: new Date(dayStart + first * 60000).toISOString(),
        p_to: new Date(dayStart + (last + 60) * 60000).toISOString(),
      });
      const busy = (data ?? []).map((r) => ({ courtId: r.court_id, start: new Date(r.starts_at), end: new Date(r.ends_at) }));
      return { ...base, slots: quickSlots(dateKey, starts, b.courtCount, busy, tz) };
    }),
  );
  return { ok: true, data: branches };
}
