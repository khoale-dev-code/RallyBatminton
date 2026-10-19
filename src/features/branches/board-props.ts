import { type BrandInfo } from '@/features/brand/queries';
import { publicEnv } from '@/lib/env';

import { type BranchDetail } from './queries';

/** Thuộc tính cho lưới đặt sân (dùng chung trang Đặt sân và trang chi tiết chi nhánh). */
export function bookingBoardProps(detail: BranchDetail, brand: BrandInfo) {
  const { branch, courts, priceRules } = detail;
  return {
    branch: {
      id: branch.id,
      name: branch.name,
      timezone: branch.timezone,
      opensAt: branch.opens_at,
      closesAt: branch.closes_at,
      slotMinutes: branch.slot_minutes,
      holdMinutes: branch.hold_minutes,
      minBookingMinutes: branch.min_booking_minutes,
      maxBookingMinutes: branch.max_booking_minutes,
      bookingWindowDays: branch.booking_window_days,
      depositPercent: branch.deposit_percent,
    },
    courts: courts.map((c) => ({ id: c.id, name: c.name, status: c.status })),
    priceRules,
    turnstileSiteKey: publicEnv.turnstileSiteKey,
    paymentInstructions: brand.paymentInstructions,
    hotline: branch.phone ?? brand.hotline,
  };
}
