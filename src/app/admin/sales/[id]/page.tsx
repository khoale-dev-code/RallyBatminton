import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ActionForm, SubmitButton, TextField } from '@/components/ui/form';
import { Badge, DescriptionList, Disclosure, PageHeader, Panel } from '@/components/ui/primitives';
import { voidSaleAction } from '@/features/admin-sales/actions';
import { getSale } from '@/features/admin-sales/queries';
import { requireBranchPermission, withGuard } from '@/lib/auth/guards';
import { isOwner } from '@/lib/auth/permissions';
import { formatDateTime, formatPhone, formatVnd } from '@/lib/format';
import { isUuid } from '@/lib/ids';
import { PAYMENT_METHOD, PAYMENT_STATUS } from '@/lib/labels';
import { formatPercent } from '@/lib/tax';

export default async function SaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [{ ctx }, sale] = await withGuard(requireBranchPermission('sale.record'), () => getSale(id));
  if (!sale) notFound();
  const tz = sale.branches?.timezone;
  // Thuế đã chụp vào từng dòng lúc bán; giảm giá trên đơn chia theo tỷ lệ.
  const factor = sale.subtotal_amount > 0 ? (sale.total_amount ?? 0) / sale.subtotal_amount : 0;
  const vat = Math.round(sale.sale_lines.reduce((n, l) => n + l.vat_amount, 0) * factor);
  const pit = Math.round(sale.sale_lines.reduce((n, l) => n + l.pit_amount, 0) * factor);
  const method = sale.sale_lines.find((l) => l.tax_method)?.tax_method ?? null;

  return (
    <>
      <PageHeader
        title={`Đơn ${sale.code}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {sale.branches?.name}, {formatDateTime(sale.sold_at, tz)}
            {sale.status === 'voided' ? <Badge tone="red">Đã hủy</Badge> : <Badge tone="green">Hoàn tất</Badge>}
          </span>
        }
        back={
          <Link href="/admin/sales" className="text-sm text-muted hover:underline">
            Đơn bán
          </Link>
        }
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Panel title="Hàng đã bán">
          <ul className="divide-y divide-line">
            {sale.sale_lines.map((l) => (
              <li key={l.id} className="flex items-start justify-between gap-4 py-3">
                <span>
                  {l.product_name}
                  {l.variant_label && <span className="text-sm text-muted">, {l.variant_label}</span>}
                  <span className="block text-sm text-muted tabular">
                    {l.quantity}
                    {l.unit_name ? ` ${l.unit_name.toLowerCase()}` : ''}
                    {l.unit_conversion > 1 ? ` (= ${l.quantity * l.unit_conversion} đơn vị cơ bản)` : ''} × {formatVnd(l.unit_price)}
                  </span>
                  <span className="block text-xs text-muted tabular">
                    {l.vat_rate === null
                      ? 'Không chịu thuế'
                      : l.tax_method === 'direct'
                        ? `GTGT ${formatPercent(Number(l.vat_rate))} ${formatVnd(l.vat_amount)}, TNCN ${formatPercent(Number(l.pit_rate ?? 0))} ${formatVnd(l.pit_amount)}`
                        : `Đã gồm VAT ${formatPercent(Number(l.vat_rate))}: ${formatVnd(l.vat_amount)}`}
                  </span>
                </span>
                <span className="tabular">{formatVnd(l.line_total)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 flex flex-col gap-1 border-t border-line pt-4">
            <div className="flex justify-between text-muted">
              <dt>Tạm tính</dt>
              <dd className="tabular">{formatVnd(sale.subtotal_amount)}</dd>
            </div>
            {sale.discount_amount > 0 && (
              <div className="flex justify-between text-muted">
                <dt>Giảm giá</dt>
                <dd className="tabular">−{formatVnd(sale.discount_amount)}</dd>
              </div>
            )}
            <div className="flex items-baseline justify-between">
              <dt className="font-medium">Tổng</dt>
              <dd className="font-display text-2xl tabular">{formatVnd(sale.total_amount)}</dd>
            </div>
            {method === 'deduction' && vat > 0 && (
              <div className="flex justify-between text-sm text-muted">
                <dt>Trong đó thuế VAT</dt>
                <dd className="tabular">{formatVnd(vat)}</dd>
              </div>
            )}
            {method === 'direct' && vat + pit > 0 && (
              <div className="flex justify-between text-sm text-muted">
                <dt>Thuế khoán ước tính (GTGT + TNCN)</dt>
                <dd className="tabular">
                  {formatVnd(vat)} + {formatVnd(pit)}
                </dd>
              </div>
            )}
          </dl>
        </Panel>
        <div className="flex flex-col gap-6">
          <Panel title="Thanh toán">
            <ul className="flex flex-col gap-2">
              {sale.payments.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {PAYMENT_METHOD[p.method]}
                    {p.reference ? `, ${p.reference}` : ''}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="tabular">{formatVnd(p.amount)}</span>
                    <Badge tone={PAYMENT_STATUS[p.status].tone}>{PAYMENT_STATUS[p.status].label}</Badge>
                  </span>
                </li>
              ))}
              {sale.payments.length === 0 && <li className="text-muted">Đơn 0đ, không có thanh toán.</li>}
            </ul>
          </Panel>
          <Panel title="Khách và ghi chú">
            <DescriptionList
              className="sm:grid-cols-1"
              items={[
                {
                  label: 'Khách',
                  value: sale.customers ? (
                    <Link href={`/admin/customers/${sale.customers.id}`} className="underline underline-offset-4">
                      {sale.customers.full_name}, {formatPhone(sale.customers.phone)}
                    </Link>
                  ) : (
                    'Khách lẻ'
                  ),
                },
                { label: 'Ghi chú', value: sale.note ?? '—' },
                ...(sale.status === 'voided' ? [{ label: 'Lý do hủy', value: sale.void_reason ?? '—' }] : []),
              ]}
            />
          </Panel>
          {isOwner(ctx) && sale.status === 'completed' && (
            <Disclosure summary="Hủy đơn này" tone="danger">
              <ActionForm
                action={voidSaleAction.bind(null, sale.id)}
                confirmMessage="Hủy đơn? Hàng sẽ được cộng lại vào kho và thanh toán bị hủy."
              >
                <TextField name="reason" label="Lý do hủy" required minLength={3} />
                <SubmitButton variant="danger" size="sm">
                  Hủy đơn
                </SubmitButton>
              </ActionForm>
            </Disclosure>
          )}
        </div>
      </div>
    </>
  );
}
