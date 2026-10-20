import { getBrandInfo, getBrandTax } from '@/features/brand/queries';
import { listSalesForDay } from '@/features/admin-sales/queries';
import { accountForBranch } from '@/features/payments/lib/transfer';
import { getBankAccounts } from '@/features/payments/queries';
import { PosTerminal } from '@/features/pos/components/pos-terminal';
import { getPosCatalog } from '@/features/pos/queries';
import { requireBranchPermission } from '@/lib/auth/guards';
import { isOwner } from '@/lib/auth/permissions';
import { describeDateKey } from '@/lib/format';
import { todayKey } from '@/lib/time';

export const metadata = { title: 'Bán hàng' };

export default async function PosPage() {
  const { ctx, branch } = await requireBranchPermission('sale.record');
  const dateKey = todayKey();
  const [brandTax, brand, catalog, today, accounts] = await Promise.all([
    getBrandTax(),
    getBrandInfo(),
    getBrandTax().then((t) => getPosCatalog(branch.branchId, t)),
    listSalesForDay(branch.branchId, dateKey),
    getBankAccounts(),
  ]);
  const day = describeDateKey(dateKey);
  return (
    <PosTerminal
      branchName={branch.name}
      cashierName={ctx.displayName}
      dateLabel={`${day.weekdayLong}, ${day.dayMonth}`}
      today={{ count: today.count, revenue: today.revenue }}
      brand={{ name: brand.name, addressLine: brand.addressLine, hotline: brand.hotline, taxCode: brandTax.taxCode }}
      items={catalog.items}
      categories={catalog.categories}
      canDiscount={isOwner(ctx)}
      bankAccount={accountForBranch(accounts, branch.branchId)}
    />
  );
}
