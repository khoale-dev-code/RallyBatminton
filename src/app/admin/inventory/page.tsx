import Form from 'next/form';
import Link from 'next/link';

import { buttonClass } from '@/components/ui/button';
import { ActionForm, SelectField, SubmitButton, TextField } from '@/components/ui/form';
import { LinkTabs } from '@/components/ui/link-tabs';
import { Badge, Disclosure, EmptyState, PageHeader } from '@/components/ui/primitives';
import { receiveNewItemAction } from '@/features/admin-inventory/actions';
import { getBranchStock, listUnstockedVariants } from '@/features/admin-inventory/queries';
import { requireBranchPermission } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/auth/permissions';

export const metadata = { title: 'Tồn kho' };

interface Search {
  q?: string;
  low?: string;
  kind?: string;
}

export default async function InventoryPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { ctx, branch } = await requireBranchPermission('catalog.view');
  const sp = await searchParams;
  const kind = sp.kind === 'rental' ? 'rental' : sp.kind === 'sale' ? 'sale' : undefined;
  const lowOnly = sp.low === '1';
  const q = typeof sp.q === 'string' ? sp.q.slice(0, 60) : undefined;
  const canAdjust = hasPermission(ctx, 'inventory.adjust', branch.branchId);
  const [rows, unstocked] = await Promise.all([
    getBranchStock(branch.branchId, { q, lowOnly, kind }),
    canAdjust ? listUnstockedVariants(branch.branchId) : Promise.resolve([]),
  ]);
  const href = (extra: Partial<Search>) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ q, low: lowOnly ? '1' : undefined, kind, ...extra })) if (v) params.set(k, v);
    const s = params.toString();
    return s ? `/admin/inventory?${s}` : '/admin/inventory';
  };

  return (
    <>
      <PageHeader title="Tồn kho" description={`${branch.name}. Mọi thay đổi số lượng đều ghi vào sổ kho, không sửa tay được.`} />
      <LinkTabs
        label="Lọc theo loại"
        tabs={[
          { href: href({ kind: undefined }), label: 'Tất cả', active: kind === undefined },
          { href: href({ kind: 'sale' }), label: 'Hàng bán', active: kind === 'sale' },
          { href: href({ kind: 'rental' }), label: 'Đồ cho thuê', active: kind === 'rental' },
        ]}
      />
      <Form action="/admin/inventory" className="mb-4 flex flex-wrap items-center gap-2">
        {kind && <input type="hidden" name="kind" value={kind} />}
        <label htmlFor="q" className="sr-only">
          Tìm mặt hàng
        </label>
        <input
          id="q"
          name="q"
          defaultValue={q}
          placeholder="Tên hoặc SKU"
          className="min-h-11 min-w-0 flex-1 basis-full rounded-control border border-line bg-paper px-3 sm:basis-0"
        />
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" name="low" value="1" defaultChecked={lowOnly} className="size-4 accent-ink" />
          Chỉ hàng sắp hết
        </label>
        <button type="submit" className={buttonClass('outline', 'md', 'ml-auto sm:ml-0')}>
          Lọc
        </button>
      </Form>

      {canAdjust && unstocked.length > 0 && (
        <div className="mb-4">
          <Disclosure summary="Nhập mặt hàng mới về chi nhánh">
            <ActionForm action={receiveNewItemAction}>
              <SelectField
                name="variant_id"
                label="Mặt hàng"
                placeholder="Chọn mặt hàng"
                options={unstocked.map((u) => ({ value: u.id, label: u.label }))}
                required
              />
              <SelectField
                name="reason"
                label="Loại"
                options={[
                  { value: 'purchase', label: 'Nhập hàng' },
                  { value: 'opening', label: 'Tồn đầu kỳ' },
                ]}
              />
              <TextField name="quantity" label="Số lượng" type="number" min={1} required />
              <TextField name="note" label="Ghi chú" optional placeholder="Số phiếu nhập, nhà cung cấp" />
              <SubmitButton size="sm">Nhập kho</SubmitButton>
            </ActionForm>
          </Disclosure>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState title={lowOnly ? 'Không có hàng sắp hết' : 'Chưa có mặt hàng nào ở chi nhánh'} />
      ) : (
        <ul className="divide-y divide-line rounded-panel border border-line bg-paper">
          {rows.map((r) => (
            <li key={r.variantId}>
              <Link
                href={`/admin/inventory/${r.variantId}`}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-hall/60 sm:px-6"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="font-medium">{r.productName}</span>
                  <span className="text-sm text-muted">
                    {[r.variantLabel, r.sku, r.kind === 'rental' ? 'Đồ thuê' : null].filter(Boolean).join(', ')}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  {!r.isListed && <Badge>Ẩn</Badge>}
                  {r.low && <Badge tone="red">Sắp hết</Badge>}
                  <span className="w-14 text-right font-display text-2xl tabular">{r.onHand}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
