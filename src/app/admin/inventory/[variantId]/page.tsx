import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowUpDown, ClipboardCheck, Clock3, PackageCheck, Warehouse } from 'lucide-react';

import { ActionForm, SelectField, SubmitButton, TextField } from '@/components/ui/form';
import { adjustStockAction, recordCountAction } from '@/features/admin-inventory/actions';
import { getVariantStock } from '@/features/admin-inventory/queries';
import { requireBranchData } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/auth/permissions';
import { formatDateTime } from '@/lib/format';
import { isUuid } from '@/lib/ids';
import { STOCK_REASON } from '@/lib/labels';
import '@/features/admin-inventory/rally-inventory-v16.css';

export default async function VariantStockPage({ params }: { params: Promise<{ variantId: string }> }) {
  const { variantId } = await params;
  if (!isUuid(variantId)) notFound();
  const { ctx, branch, data } = await requireBranchData('catalog.view', (branchId) => getVariantStock(branchId, variantId));
  if (!data) notFound();
  const { variant, label, level, movements } = data;
  const canAdjust = hasPermission(ctx, 'inventory.adjust', branch.branchId) && !variant.products?.is_bundle;
  const onHand = level?.on_hand ?? 0;
  const isLow = !!level && onHand <= level.reorder_level;
  const number = new Intl.NumberFormat('vi-VN');
  const recentMovements = movements.slice(0, 12);
  const olderMovements = movements.slice(12);

  const renderMovement = (m: (typeof movements)[number]) => (
    <li key={m.id} className="riv16-movement-row">
      <span className={`riv16-movement-symbol ${m.quantity_delta < 0 ? 'is-out' : 'is-in'}`} aria-hidden="true">{m.quantity_delta < 0 ? '−' : '+'}</span>
      <span className="riv16-movement-description"><strong>{STOCK_REASON[m.reason] ?? m.reason}</strong><small>{formatDateTime(m.created_at)}{m.note ? ` · ${m.note}` : ''}</small></span>
      <span className={`riv16-movement-delta ${m.quantity_delta < 0 ? 'is-out' : 'is-in'}`}>{m.quantity_delta > 0 ? '+' : ''}{number.format(m.quantity_delta)}</span>
      <span className="riv16-movement-balance">Còn {number.format(m.balance_after)}</span>
    </li>
  );

  return (
    <main className="riv16-page riv16-detail">
      <header className="riv16-heading">
        <div>
          <Link href="/admin/inventory" className="riv16-back"><ArrowLeft size={16} /> Quay lại danh sách kho</Link>
          <p className="riv16-eyebrow"><Warehouse size={14} /> CHI TIẾT MẶT HÀNG</p>
          <h1>{label}</h1>
          <p>SKU: <strong>{variant.sku}</strong> · Chi nhánh: <strong>{branch.name}</strong></p>
        </div>
        <span className={`riv16-detail-status ${isLow ? 'is-low' : ''}`}>{!level ? 'Chưa ghi nhận kho' : onHand === 0 ? 'Đã hết hàng' : isLow ? 'Sắp hết hàng' : 'Đủ hàng'}</span>
      </header>

      <section className="riv16-metrics riv16-detail-metrics" aria-label="Số liệu mặt hàng">
        <div className="riv16-metric"><span className="riv16-metric-icon"><PackageCheck size={19}/></span><span className="riv16-metric-label">Số lượng hiện có</span><strong>{number.format(onHand)}</strong><small>Đơn vị trong kho</small></div>
        <div className="riv16-metric"><span className="riv16-metric-icon riv16-icon-warn"><ClipboardCheck size={19}/></span><span className="riv16-metric-label">Ngưỡng cảnh báo</span><strong>{number.format(level?.reorder_level ?? 0)}</strong><small>Cảnh báo khi tồn ≤ ngưỡng</small></div>
        <div className="riv16-metric"><span className="riv16-metric-icon"><Clock3 size={19}/></span><span className="riv16-metric-label">Lịch sử ghi nhận</span><strong>{number.format(movements.length)}</strong><small>Tối đa 100 biến động gần nhất</small></div>
      </section>

      <nav className="riv16-detail-jumps" aria-label="Đi đến khu vực">
        {canAdjust && <a href="#riv16-actions">Nhập / xuất kho</a>}
        {canAdjust && level && <a href="#riv16-count">Kiểm kê</a>}
        <a href="#riv16-ledger">Sổ kho</a>
      </nav>

      {canAdjust ? (
        <section id="riv16-actions" className="riv16-workspace riv16-detail-panel">
          <header className="riv16-workspace-head"><div><h2><ArrowUpDown size={21}/> Nhập / xuất kho</h2><p>Chọn lý do và nhập số lượng điều chỉnh. Hệ thống tự ghi sổ kho.</p></div></header>
          <div className="riv16-form-area"><ActionForm action={adjustStockAction.bind(null, variant.id)} resetOnSuccess className="riv16-adjust-form">
            <SelectField name="reason" label="Lý do" options={[{ value: 'purchase', label: 'Nhập hàng' }, { value: 'opening', label: 'Tồn đầu kỳ' }, { value: 'adjustment', label: 'Điều chỉnh' }, { value: 'damage', label: 'Hư hỏng' }, { value: 'loss', label: 'Mất' }]} />
            <SelectField name="direction" label="Chiều thay đổi" options={[{ value: 'in', label: 'Cộng vào kho' }, { value: 'out', label: 'Trừ khỏi kho' }]} />
            <TextField name="quantity" label="Số lượng" type="number" min={1} required />
            <TextField name="note" label="Ghi chú" optional hint="Bắt buộc khi điều chỉnh, hư hỏng hoặc mất." />
            <div className="riv16-form-footer"><p>Chỉ chọn chiều phù hợp với lý do. Các quy tắc hợp lệ được kiểm tra ở máy chủ.</p><SubmitButton>Ghi sổ kho</SubmitButton></div>
          </ActionForm></div>
        </section>
      ) : <div className="riv16-readonly">Bạn có quyền xem sổ kho nhưng không có quyền điều chỉnh số lượng. Nếu cần, hãy liên hệ chủ sân.</div>}

      {canAdjust && level && <section id="riv16-count" className="riv16-workspace riv16-detail-panel">
        <header className="riv16-workspace-head"><div><h2><ClipboardCheck size={21}/> Kiểm kê thực tế</h2><p>Nhập đúng số đã đếm; chênh lệch sẽ được ghi nhận tự động.</p></div></header>
        <div className="riv16-form-area"><ActionForm action={recordCountAction.bind(null, variant.id)} resetOnSuccess className="riv16-count-form">
          <TextField name="counted" label="Số lượng đếm được" type="number" min={0} required />
          <TextField name="note" label="Ghi chú" optional placeholder="Ví dụ: Kiểm kê cuối tháng" />
          <div className="riv16-form-footer"><p>Tồn trên sổ hiện tại: <strong>{number.format(onHand)}</strong>. Ghi kết quả kiểm kê không sửa số lượng bằng tay.</p><SubmitButton variant="outline">Ghi kết quả kiểm kê</SubmitButton></div>
        </ActionForm></div>
      </section>}

      <section id="riv16-ledger" className="riv16-workspace riv16-ledger">
        <header className="riv16-workspace-head"><div><h2>Sổ kho và lịch sử biến động</h2><p>Đơn bán, cho thuê và các thao tác kho ghi nhận tại chi nhánh này.</p></div><span className="riv16-ledger-count">{number.format(movements.length)} bản ghi</span></header>
        {movements.length === 0 ? <div className="riv16-empty"><h3>Chưa có biến động</h3><p>Sổ kho sẽ xuất hiện ở đây sau khi phát sinh nhập, xuất hoặc kiểm kê.</p></div> : (
          <><ul className="riv16-movements">{recentMovements.map(renderMovement)}</ul>
          {olderMovements.length > 0 && <details className="riv16-more-movements"><summary>Xem thêm {number.format(olderMovements.length)} biến động cũ</summary><ul className="riv16-movements">{olderMovements.map(renderMovement)}</ul></details>}</>
        )}
      </section>
    </main>
  );
}
