import { type Enums } from '@/lib/supabase/database.types';

export type MemberTier = Enums<'member_tier'>;

/** 1 điểm cho mỗi 10.000đ tiền sân của đơn hoàn tất (khớp private.member_points_for_amount). */
export const VND_PER_POINT = 10_000;

export interface TierDef {
  tier: MemberTier;
  label: string;
  /** Điểm tích lũy tối thiểu (khớp private.member_tier_for). */
  min: number;
  /** Lớp màu cho huy hiệu trên nền sáng. */
  badge: string;
  /** Lớp màu cho thẻ thành viên. */
  card: string;
}

export const MEMBER_TIERS: readonly TierDef[] = [
  { tier: 'member', label: 'Thành viên', min: 0, badge: 'bg-court-soft text-court-deep', card: 'from-[#0c3322] to-[#165c2c]' },
  { tier: 'silver', label: 'Bạc', min: 300, badge: 'bg-[#eceff3] text-[#3d4652]', card: 'from-[#2b3138] to-[#5d6772]' },
  { tier: 'gold', label: 'Vàng', min: 1000, badge: 'bg-amber-soft text-amber-deep', card: 'from-[#4a3505] to-[#a57b14]' },
  { tier: 'diamond', label: 'Kim cương', min: 3000, badge: 'bg-ink text-paper', card: 'from-[#000000] to-[#1f3d2a]' },
];

export function tierDef(tier: MemberTier): TierDef {
  return MEMBER_TIERS.find((t) => t.tier === tier) ?? MEMBER_TIERS[0]!;
}

export interface TierProgress {
  current: TierDef;
  next: TierDef | null;
  /** Điểm còn thiếu để lên hạng kế tiếp (0 khi đã cao nhất). */
  remaining: number;
  /** Tiến độ trong hạng hiện tại, 0–100. */
  percent: number;
}

export function tierProgress(lifetimePoints: number): TierProgress {
  const points = Math.max(0, Math.floor(lifetimePoints));
  let index = 0;
  MEMBER_TIERS.forEach((t, i) => {
    if (points >= t.min) index = i;
  });
  const current = MEMBER_TIERS[index]!;
  const next = MEMBER_TIERS[index + 1] ?? null;
  if (!next) return { current, next: null, remaining: 0, percent: 100 };
  const span = next.min - current.min;
  return {
    current,
    next,
    remaining: next.min - points,
    percent: Math.min(100, Math.round(((points - current.min) / span) * 100)),
  };
}

export function pointsForAmount(amount: number): number {
  return Math.max(0, Math.floor(amount / VND_PER_POINT));
}
