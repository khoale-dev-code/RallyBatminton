import { type OvertimePolicy, type RentalBilling, type RentalUsage } from '@/lib/rental-fee';

export interface RentalRateOption {
  id: string;
  label: string;
  durationMinutes: number;
  price: number;
  usage: RentalUsage;
  billing: RentalBilling;
  policy: OvertimePolicy;
}

export interface RentalOption {
  productId: string;
  name: string;
  isBundle: boolean;
  variants: Array<{ id: string; label: string; onHand: number }>;
  rates: RentalRateOption[];
  /** Combo: số bộ tối đa có thể phát dựa trên tồn từng thành phần. */
  bundleAvailable: number | null;
}

/** Lượt đặt sân đang chơi / sắp vào sân — để gắn đồ thuê "hết trận". */
export interface ActiveBookingOption {
  id: string;
  code: string;
  courtName: string;
  startsAt: string;
  endsAt: string;
  customerName: string;
  customerPhone: string;
  checkedIn: boolean;
}

/** Một phiếu đang cho thuê trên bảng (dữ liệu thuần để truyền xuống client). */
export interface RentalBoardItem {
  id: string;
  code: string;
  productName: string;
  quantity: number;
  rateLabel: string;
  durationMinutes: number;
  unitPrice: number;
  rentalFee: number;
  paid: number;
  usage: RentalUsage;
  billing: RentalBilling;
  customerId: string;
  customerName: string;
  customerPhone: string;
  collateral: string | null;
  courtName: string | null;
  startsAt: string;
  /** Hạn trả thực tế (thuê theo trận: theo giờ kết thúc sân). */
  dueAt: string;
  policy: OvertimePolicy;
}

export interface RentalHistoryItem {
  id: string;
  code: string;
  productName: string;
  quantity: number;
  usage: RentalUsage;
  billing: RentalBilling;
  rateLabel: string;
  customerName: string;
  customerPhone: string;
  courtName: string | null;
  startsAt: string;
  returnedAt: string | null;
  lateMinutes: number | null;
  rentalFee: number;
  lateFee: number;
  lateFeeAuto: number;
  damageFee: number;
  status: 'out' | 'returned' | 'voided';
}

export interface PriceBoardRow {
  productId: string;
  name: string;
  isBundle: boolean;
  rates: Array<{ id: string; label: string; durationMinutes: number; price: number; usage: RentalUsage; billing: RentalBilling }>;
}
