import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ActionForm, SelectField, SubmitButton, TextField } from '@/components/ui/form';
import { Badge, PageHeader, Panel, Stat } from '@/components/ui/primitives';
import { adjustStockAction, recordCountAction } from '@/features/admin-inventory/actions';
import { getVariantStock } from '@/features/admin-inventory/queries';
import { requireBranchPermission } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/auth/permissions';
import { formatDateTime } from '@/lib/format';
import { isUuid } from '@/lib/ids';
import { STOCK_REASON } from '@/lib/labels';

export default async function VariantStockPage({ params }: { params: Promise<{ variantId: string }> }) {
  const { ctx, branch } = await requireBranchPermission('catalog.view');
  const { variantId } = await params;
  if (!isUuid(variantId)) notFound();
  const data = await getVariantStock(branch.branchId, variantId);
  if (!data) notFound();
  const { variant, label, level, movements } = data;
  const canAdjust = hasPermission(ctx, 'inventory.adjust', branch.branchId) && !variant.products?.is_bundle;
  const onHand = level?.on_hand ?? 0;

  return (
    <>
      <PageHeader
        title={label}
        description={`${variant.sku}, tại ${branch.name}`}
        back={
          <Link href="/admin/inventory" className="text-sm text-muted hover:underline">
            Tồn kho
          </Link>
        }
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel>
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
              <Stat label="Đang có" value={<span className="font-display text-4xl tabular">{onHand}</span>} />
              <Stat label="Cảnh báo khi ≤" value={<span className="font-display text-2xl tabular">{level?.reorder_level ?? 0}</span>} />
              <Stat
                label="Trạng thái"
                value={
                  level ? (
                    onHand <= level.reorder_level ? (
                      <Badge tone="red">Sắp hết</Badge>
                    ) : (
                      <Badge tone="green">Đủ hàng</Badge>
                    )
                  ) : (
                    <Badge>Chưa nhập</Badge>
                  )
                }
              />
            </div>
          </Panel>
          <Panel title="Sổ kho" description="100 biến động gần nhất. Bán, thuê và hủy đơn tự ghi vào đây.">
            {movements.length === 0 ? (
              <p className="text-muted">Chưa có biến động.</p>
            ) : (
              <ul className="divide-y divide-line">
                {movements.map((m) => (
                  <li key={m.id} className="flex items-start justify-between gap-4 py-3">
                    <span className="flex min-w-0 flex-col">
                      <span>{STOCK_REASON[m.reason]}</span>
                      <span className="text-sm text-muted">
                        {formatDateTime(m.created_at)}
                        {m.note ? `, ${m.note}` : ''}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end">
                      <span
                        className={
                          m.quantity_delta > 0
                            ? 'font-display text-lg text-court-deep tabular'
                            : 'font-display text-lg text-shuttle-deep tabular'
                        }
                      >
                        {m.quantity_delta > 0 ? `+${m.quantity_delta}` : m.quantity_delta}
                      </span>
                      <span className="text-xs text-muted tabular">còn {m.balance_after}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
        {canAdjust ? (
          <div className="flex flex-col gap-6">
            <Panel title="Nhập / xuất kho">
              <ActionForm action={adjustStockAction.bind(null, variant.id)} resetOnSuccess>
                <SelectField
                  name="reason"
                  label="Lý do"
                  options={[
                    { value: 'purchase', label: 'Nhập hàng' },
                    { value: 'opening', label: 'Tồn đầu kỳ' },
                    { value: 'adjustment', label: 'Điều chỉnh' },
                    { value: 'damage', label: 'Hư hỏng' },
                    { value: 'loss', label: 'Mất' },
                  ]}
                />
                <SelectField
                  name="direction"
                  label="Chiều"
                  options={[
                    { value: 'in', label: 'Cộng vào kho' },
                    { value: 'out', label: 'Trừ khỏi kho' },
                  ]}
                />
                <TextField name="quantity" label="Số lượng" type="number" min={1} required />
                <TextField name="note" label="Ghi chú" optional hint="Bắt buộc với điều chỉnh, hư hỏng, mất." />
                <SubmitButton>Ghi sổ kho</SubmitButton>
              </ActionForm>
            </Panel>
            {level && (
              <Panel title="Kiểm kê" description="Nhập số đếm thực tế; hệ thống tự ghi chênh lệch.">
                <ActionForm action={recordCountAction.bind(null, variant.id)} resetOnSuccess>
                  <TextField name="counted" label="Số đếm được" type="number" min={0} required />
                  <TextField name="note" label="Ghi chú" optional placeholder="Kiểm kê cuối tháng" />
                  <SubmitButton variant="outline">Ghi kết quả kiểm kê</SubmitButton>
                </ActionForm>
              </Panel>
            )}
          </div>
        ) : (
          <Panel>
            <p className="text-muted">Bạn có quyền xem tồn kho. Cần quyền &quot;Điều chỉnh tồn kho&quot; để nhập/xuất.</p>
          </Panel>
        )}
      </div>
    </>
  );
}
