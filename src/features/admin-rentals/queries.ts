import 'server-only';

import { formatVariantLabel } from '@/lib/format';
import { effectiveDue } from '@/lib/rental-fee';
import { createClient } from '@/lib/supabase/server';
import { parseTstzRange, todayKey, zonedToUtc } from '@/lib/time';

import { type ActiveBookingOption, type PriceBoardRow, type RentalBoardItem, type RentalHistoryItem, type RentalOption } from './types';

export type { ActiveBookingOption, PriceBoardRow, RentalBoardItem, RentalHistoryItem, RentalOption };

function variantLabel(size: string | null, color: string | null): string {
  return formatVariantLabel(size, color) ?? 'Mặc định';
}

const RATE_SELECT =
  'id, label, duration_minutes, price, is_active, usage, billing, grace_minutes, overtime_block_minutes, overtime_block_price, overtime_cap';

export async function getRentalCatalog(branchId: string): Promise<RentalOption[]> {
  const supabase = await createClient();
  const [{ data: products, error }, { data: levels }] = await Promise.all([
    supabase
      .from('products')
      .select(
        `id, name, is_bundle, product_variants!product_variants_product_id_fkey(id, size_label, color_label, is_active, deleted_at, sort_order), rental_rates(${RATE_SELECT}), bundle_components(component_variant_id, quantity)`,
      )
      .eq('kind', 'rental')
      .eq('is_active', true)
      .eq('show_on_pos', true)
      .is('deleted_at', null)
      .order('name'),
    supabase.from('inventory_levels').select('variant_id, on_hand').eq('branch_id', branchId),
  ]);
  if (error) throw error;
  const stock = new Map((levels ?? []).map((l) => [l.variant_id, l.on_hand]));
  return (products ?? [])
    .map((p) => {
      const rates = p.rental_rates
        .filter((r) => r.is_active)
        .sort((a, b) => a.duration_minutes - b.duration_minutes)
        .map((r) => ({
          id: r.id,
          label: r.label,
          durationMinutes: r.duration_minutes,
          price: r.price,
          usage: r.usage,
          billing: r.billing,
          policy: {
            graceMinutes: r.grace_minutes,
            blockMinutes: r.overtime_block_minutes,
            blockPrice: r.overtime_block_price ?? Math.ceil((r.price * r.overtime_block_minutes) / r.duration_minutes / 1000) * 1000,
            cap: r.overtime_cap,
          },
        }));
      const variants = p.is_bundle
        ? []
        : p.product_variants
            .filter((v) => v.is_active && v.deleted_at === null && stock.has(v.id))
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((v) => ({ id: v.id, label: variantLabel(v.size_label, v.color_label), onHand: stock.get(v.id) ?? 0 }));
      const bundleAvailable = p.is_bundle
        ? p.bundle_components.length === 0
          ? 0
          : Math.min(...p.bundle_components.map((c) => Math.floor((stock.get(c.component_variant_id) ?? 0) / c.quantity)))
        : null;
      return { productId: p.id, name: p.name, isBundle: p.is_bundle, variants, rates, bundleAvailable };
    })
    .filter((p) => p.rates.length > 0 && (p.isBundle || p.variants.length > 0));
}

/** Lượt đặt sân đã xác nhận / đang chơi, kết thúc sau bây giờ và bắt đầu trong 60 phút tới. */
export async function listActiveBookings(branchId: string, now: number): Promise<ActiveBookingOption[]> {
  const supabase = await createClient();
  const from = new Date(now).toISOString();
  const to = new Date(now + 60 * 60000).toISOString();
  const { data } = await supabase
    .from('bookings')
    .select('id, code, status, during, contact_name, courts(name), customers(full_name, phone)')
    .eq('branch_id', branchId)
    .eq('kind', 'customer')
    .in('status', ['confirmed', 'checked_in'])
    .filter('during', 'ov', `[${from},${to})`)
    .limit(60);
  return (data ?? [])
    .flatMap((b) => {
      const range = parseTstzRange(b.during);
      if (!range) return [];
      return [
        {
          id: b.id,
          code: b.code,
          courtName: b.courts?.name ?? 'Sân',
          startsAt: range.start.toISOString(),
          endsAt: range.end.toISOString(),
          customerName: b.customers?.full_name ?? b.contact_name ?? 'Khách',
          customerPhone: b.customers?.phone ?? '',
          checkedIn: b.status === 'checked_in',
        },
      ];
    })
    .sort((a, b) => Number(b.checkedIn) - Number(a.checkedIn) || a.courtName.localeCompare(b.courtName, 'vi', { numeric: true }));
}

const BOARD_SELECT =
  'id, code, status, quantity, rate_label, duration_minutes, unit_price, rental_fee, late_fee, late_fee_auto, damage_fee, late_minutes, usage, billing, collateral, grace_minutes, overtime_block_minutes, overtime_block_price, overtime_cap, starts_at, due_at, returned_at, products(name), customers(id, full_name, phone), bookings(during, status, courts(name)), payments(amount, kind, status)';

export async function listRentals(branchId: string) {
  const supabase = await createClient();
  const dayStart = zonedToUtc(todayKey(), '00:00').toISOString();
  const since = new Date(Date.now() - 3 * 86400000).toISOString();
  const [{ data: out, error }, { data: recent }, { data: today }] = await Promise.all([
    supabase.from('rentals').select(BOARD_SELECT).eq('branch_id', branchId).eq('status', 'out').order('due_at').limit(200),
    supabase
      .from('rentals')
      .select(BOARD_SELECT)
      .eq('branch_id', branchId)
      .neq('status', 'out')
      .gte('created_at', since)
      .order('returned_at', { ascending: false, nullsFirst: false })
      .limit(60),
    supabase
      .from('rentals')
      .select('status, starts_at, returned_at, rental_fee, late_fee, damage_fee')
      .eq('branch_id', branchId)
      .neq('status', 'voided')
      .or(`starts_at.gte.${dayStart},returned_at.gte.${dayStart}`)
      .limit(1000),
  ]);
  if (error) throw error;

  const board: RentalBoardItem[] = (out ?? []).map((r) => {
    const range =
      r.bookings && ['confirmed', 'checked_in', 'completed'].includes(r.bookings.status) ? parseTstzRange(r.bookings.during) : null;
    const paid = r.payments.filter((p) => p.status === 'succeeded').reduce((n, p) => n + (p.kind === 'charge' ? p.amount : -p.amount), 0);
    return {
      id: r.id,
      code: r.code,
      productName: r.products?.name ?? 'Đồ thuê',
      quantity: r.quantity,
      rateLabel: r.rate_label,
      durationMinutes: r.duration_minutes,
      unitPrice: r.unit_price,
      rentalFee: r.rental_fee ?? 0,
      paid,
      usage: r.usage,
      billing: r.billing,
      customerId: r.customers?.id ?? '',
      customerName: r.customers?.full_name ?? 'Khách',
      customerPhone: r.customers?.phone ?? '',
      collateral: r.collateral,
      courtName: r.bookings?.courts?.name ?? null,
      startsAt: r.starts_at,
      dueAt: effectiveDue(r.due_at, r.billing, range?.end ?? null).toISOString(),
      policy: {
        graceMinutes: r.grace_minutes,
        blockMinutes: r.overtime_block_minutes,
        blockPrice: r.overtime_block_price,
        cap: r.overtime_cap,
      },
    };
  });

  const history: RentalHistoryItem[] = (recent ?? []).map((r) => ({
    id: r.id,
    code: r.code,
    productName: r.products?.name ?? 'Đồ thuê',
    quantity: r.quantity,
    usage: r.usage,
    billing: r.billing,
    rateLabel: r.rate_label,
    customerName: r.customers?.full_name ?? 'Khách',
    customerPhone: r.customers?.phone ?? '',
    courtName: r.bookings?.courts?.name ?? null,
    startsAt: r.starts_at,
    returnedAt: r.returned_at,
    lateMinutes: r.late_minutes,
    rentalFee: r.rental_fee ?? 0,
    lateFee: r.late_fee,
    lateFeeAuto: r.late_fee_auto,
    damageFee: r.damage_fee,
    status: r.status,
  }));

  let revenueToday = 0;
  let lateFeesToday = 0;
  let returnedToday = 0;
  for (const r of today ?? []) {
    if (r.starts_at >= dayStart) revenueToday += r.rental_fee ?? 0;
    if (r.returned_at && r.returned_at >= dayStart) {
      revenueToday += r.late_fee + r.damage_fee;
      lateFeesToday += r.late_fee;
      returnedToday += 1;
    }
  }

  return { board, history, today: { revenue: revenueToday, lateFees: lateFeesToday, returned: returnedToday } };
}

/** Bảng giá thuê để nhân viên báo giá nhanh (tại sân / hết trận / mang về). */
export async function listPriceBoard(): Promise<PriceBoardRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('products')
    .select('id, name, is_bundle, rental_rates(id, label, duration_minutes, price, is_active, usage, billing)')
    .eq('kind', 'rental')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name');
  return (data ?? [])
    .map((p) => ({
      productId: p.id,
      name: p.name,
      isBundle: p.is_bundle,
      rates: p.rental_rates
        .filter((r) => r.is_active)
        .sort((a, b) => a.duration_minutes - b.duration_minutes)
        .map((r) => ({
          id: r.id,
          label: r.label,
          durationMinutes: r.duration_minutes,
          price: r.price,
          usage: r.usage,
          billing: r.billing,
        })),
    }))
    .filter((p) => p.rates.length > 0);
}

export async function getRental(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('rentals')
    .select(
      '*, branches(name, timezone), products(name, is_bundle), customers(id, full_name, phone), bookings(id, code, during, status, courts(name)), rental_lines(id, variant_id, quantity, returned_quantity, damaged_quantity, lost_quantity, product_variants(sku, size_label, color_label, products!product_variants_product_id_fkey(name))), payments(id, kind, method, amount, status, reference, note, created_at)',
    )
    .eq('id', id)
    .maybeSingle();
  if (!data) return null;
  const paid = data.payments.filter((p) => p.status === 'succeeded').reduce((n, p) => n + (p.kind === 'charge' ? p.amount : -p.amount), 0);
  const due = (data.rental_fee ?? 0) + data.late_fee + data.damage_fee;
  const range =
    data.bookings && ['confirmed', 'checked_in', 'completed'].includes(data.bookings.status) ? parseTstzRange(data.bookings.during) : null;
  return {
    rental: data,
    dueAt: effectiveDue(data.due_at, data.billing, range?.end ?? null).toISOString(),
    booking: data.bookings
      ? { id: data.bookings.id, code: data.bookings.code, courtName: data.bookings.courts?.name ?? 'Sân', range }
      : null,
    policy: {
      graceMinutes: data.grace_minutes,
      blockMinutes: data.overtime_block_minutes,
      blockPrice: data.overtime_block_price,
      cap: data.overtime_cap,
    },
    lines: data.rental_lines.map((l) => ({
      ...l,
      label: [l.product_variants?.products?.name, formatVariantLabel(l.product_variants?.size_label, l.product_variants?.color_label)]
        .filter(Boolean)
        .join(', '),
    })),
    paid,
    due,
    balance: due - paid,
  };
}
