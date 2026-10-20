import { NextResponse, type NextRequest } from 'next/server';

import { getPayrollMonth } from '@/features/payroll/queries';
import { toCsv } from '@/features/payroll/lib/csv';
import { getStaffContext } from '@/lib/auth/context';

/** Xuất bảng lương CSV (UTF-8 BOM để Excel đọc đúng tiếng Việt). Chỉ chủ sân; RLS kiểm lại. */
export async function GET(request: NextRequest) {
  const ctx = await getStaffContext();
  if (!ctx || ctx.role !== 'owner' || !ctx.isActive) return new NextResponse('Forbidden', { status: 403 });
  const month = request.nextUrl.searchParams.get('month') ?? '';
  if (!/^\d{4}-\d{2}-01$/.test(month)) return new NextResponse('Tháng không hợp lệ', { status: 400 });

  const { period, rows } = await getPayrollMonth(month);
  const csv = toCsv(
    [
      'Mã NV',
      'Họ tên',
      'Số ca',
      'Phút công',
      'Phút tăng ca',
      'Lương giờ thường',
      'Tiền tăng ca',
      'Lương ca',
      'Điều chỉnh',
      'Thực lĩnh',
      'Trạng thái',
    ],
    rows.map((r) => [
      r.code,
      r.name,
      r.shifts,
      r.paidMinutes,
      r.overtimeMinutes,
      r.basePay - r.overtimePay,
      r.overtimePay,
      r.basePay,
      r.adjustments,
      r.netPay,
      period ? 'Đã chốt' : 'Tạm tính',
    ]),
  );
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="bang-luong-${month.slice(0, 7)}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
