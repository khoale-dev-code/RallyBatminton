import Form from 'next/form';
import Link from 'next/link';
import { ArrowRight, Boxes, ClipboardList, PackageCheck, PackageX, Search, SlidersHorizontal, Truck, Warehouse } from 'lucide-react';

import { ActionForm, SelectField, SubmitButton, TextField } from '@/components/ui/form';
import { receiveNewItemAction } from '@/features/admin-inventory/actions';
import { getBranchStock, listUnstockedVariants } from '@/features/admin-inventory/queries';
import { requireBranchData } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/auth/permissions';
import '@/features/admin-inventory/rally-inventory-v16.css';

export const metadata = { title: 'Quản lý tồn kho' };

interface SearchParams {
  q?: string;
  low?: string;
  kind?: string;
}

export default async function InventoryPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const kind = sp.kind === 'rental' ? 'rental' : sp.kind === 'sale' ? 'sale' : undefined;
  const lowOnly = sp.low === '1';
  const q = typeof sp.q === 'string' ? sp.q.trim().slice(0, 60) : '';
  // Dung mot lan truy van cho ca bo loc va cac chi so. Backend hien gioi han 500 SKU / chi nhanh.
  const {
    ctx,
    branch,
    data: [allRows, unstockedAll],
  } = await requireBranchData('catalog.view', (branchId) =>
    Promise.all([getBranchStock(branchId, {}), listUnstockedVariants(branchId)]),
  );
  const canAdjust = hasPermission(ctx, 'inventory.adjust', branch.branchId);
  const unstocked = canAdjust ? unstockedAll : [];
  const normalizedTerm = q.toLocaleLowerCase('vi');
  const rows = allRows.filter((r) => {
    if (kind && r.kind !== kind) return false;
    if (lowOnly && !r.low) return false;
    if (!normalizedTerm) return true;
    return r.productName.toLocaleLowerCase('vi').includes(normalizedTerm) || r.sku.toLocaleLowerCase('vi').includes(normalizedTerm);
  });
  const lowCount = allRows.filter((r) => r.low).length;
  const outCount = allRows.filter((r) => r.onHand === 0).length;
  const rentalCount = allRows.filter((r) => r.kind === 'rental').length;
  const number = new Intl.NumberFormat('vi-VN');
  const href = (extra: Partial<SearchParams>) => {
    const params = new URLSearchParams();
    const merged = { q: q || undefined, low: lowOnly ? '1' : undefined, kind, ...extra };
    for (const [key, value] of Object.entries(merged)) if (value) params.set(key, value);
    return params.size ? `/admin/inventory?${params.toString()}` : '/admin/inventory';
  };

  return (
    <main className="riv16-page">
      <header className="riv16-heading">
        <div>
          <p className="riv16-eyebrow"><Warehouse size={14} aria-hidden="true" /> VẬN HÀNH / TỒN KHO</p>
          <h1>Quản lý tồn kho</h1>
          <p>Kiểm tra số lượng, tìm mặt hàng sắp hết và theo dõi nhập xuất tại <strong>{branch.name}</strong>.</p>
        </div>
        <span className="riv16-branch"><span className="riv16-status-dot" /> {branch.name}</span>
      </header>

      <section className="riv16-metrics" aria-label="Tổng quan tồn kho">
        <div className="riv16-metric"><span className="riv16-metric-icon"><Boxes size={19} /></span><span className="riv16-metric-label">Mặt hàng theo dõi</span><strong>{number.format(allRows.length)}</strong><small>SKU đã có dòng tồn kho</small></div>
        <div className="riv16-metric"><span className="riv16-metric-icon riv16-icon-warn"><ClipboardList size={19} /></span><span className="riv16-metric-label">Chạm ngưỡng cảnh báo</span><strong>{number.format(lowCount)}</strong><small>Gồm cả mặt hàng đã hết</small></div>
        <div className="riv16-metric"><span className="riv16-metric-icon riv16-icon-danger"><PackageX size={19} /></span><span className="riv16-metric-label">Đã hết hàng</span><strong>{number.format(outCount)}</strong><small>Tồn hiện tại bằng 0</small></div>
        <div className="riv16-metric"><span className="riv16-metric-icon"><PackageCheck size={19} /></span><span className="riv16-metric-label">Biến thể cho thuê</span><strong>{number.format(rentalCount)}</strong><small>Đang theo dõi tại chi nhánh</small></div>
      </section>

      <section className="riv16-workspace" aria-labelledby="inventory-list-heading">
        <header className="riv16-workspace-head">
          <div><h2 id="inventory-list-heading">Danh sách mặt hàng</h2><p>Chọn một mặt hàng để xem sổ kho, nhập xuất hoặc kiểm kê.</p></div>
          {canAdjust && unstocked.length > 0 && <a className="riv16-new-link" href="#riv16-receive"><Truck size={17} /> Nhập mặt hàng mới <ArrowRight size={16}/></a>}
        </header>
        <nav className="riv16-tabs" aria-label="Loại hàng tồn kho">
          <Link className={`riv16-tab${!kind ? ' is-active' : ''}`} href={href({ kind: undefined })} aria-current={!kind ? 'page' : undefined}>Tất cả</Link>
          <Link className={`riv16-tab${kind === 'sale' ? ' is-active' : ''}`} href={href({ kind: 'sale' })} aria-current={kind === 'sale' ? 'page' : undefined}>Hàng bán</Link>
          <Link className={`riv16-tab${kind === 'rental' ? ' is-active' : ''}`} href={href({ kind: 'rental' })} aria-current={kind === 'rental' ? 'page' : undefined}>Đồ cho thuê</Link>
        </nav>
        <Form data-nav-progress action="/admin/inventory" className="riv16-search-form">
          {kind && <input type="hidden" name="kind" value={kind} />}
          <label className="riv16-search-field" htmlFor="inventory-search">
            <Search size={19} aria-hidden="true" />
            <span className="sr-only">Tìm theo tên hoặc mã SKU</span>
            <input id="inventory-search" name="q" defaultValue={q} placeholder="Tìm theo tên sản phẩm hoặc SKU..." autoComplete="off" />
          </label>
          <label className="riv16-low-filter"><input type="checkbox" name="low" value="1" defaultChecked={lowOnly} /> <span>Chỉ hàng sắp hết</span></label>
          <button type="submit" className="riv16-filter-submit"><SlidersHorizontal size={17} /> Áp dụng</button>
          {(q || lowOnly) && <Link className="riv16-clear" href={href({ q: undefined, low: undefined })}>Xóa lọc</Link>}
        </Form>

        <div className="riv16-list-meta">
          <span>Hiển thị <strong>{number.format(rows.length)}</strong> mặt hàng{q && <> cho “{q}”</>}</span>
          {allRows.length >= 500 && <span className="riv16-limit-note">Danh sách nguồn giới hạn 500 SKU; liên hệ quản trị để mở rộng truy vấn nếu cần.</span>}
        </div>

        {rows.length === 0 ? (
          <div className="riv16-empty"><Search size={27} aria-hidden="true"/><h3>Không tìm thấy mặt hàng phù hợp</h3><p>Thử đổi từ khóa, nhóm hàng hoặc tắt bộ lọc sắp hết.</p><Link href="/admin/inventory">Hiển thị tất cả</Link></div>
        ) : (
          <div className="riv16-list" role="region" aria-label="Danh sách tồn kho">
            <div className="riv16-table-heading" aria-hidden="true"><span>Mặt hàng / SKU</span><span>Phân loại</span><span>Tồn hiện tại</span><span>Ngưỡng cảnh báo</span><span>Trạng thái</span><span> </span></div>
            <ul>
              {rows.map((r) => {
                const empty = r.onHand === 0;
                return (
                  <li key={r.variantId}>
                    <Link href={`/admin/inventory/${r.variantId}`} className="riv16-inventory-row" aria-label={`Chi tiết tồn kho ${r.productName}, ${r.onHand} sản phẩm`}>
                      <span className="riv16-item-cell"><span className="riv16-product-icon"><Boxes size={19}/></span><span className="riv16-item-name"><strong>{r.productName}</strong><small>{[r.variantLabel, r.sku].filter(Boolean).join(' · ')}</small></span></span>
                      <span className="riv16-kind-cell"><span className={`riv16-kind ${r.kind === 'rental' ? 'is-rental' : ''}`}>{r.kind === 'rental' ? 'Đồ thuê' : 'Hàng bán'}</span></span>
                      <span className="riv16-qty-cell" data-label="Tồn hiện tại"><strong>{number.format(r.onHand)}</strong></span>
                      <span className="riv16-threshold-cell" data-label="Ngưỡng cảnh báo">≤ {number.format(r.reorderLevel)}</span>
                      <span className="riv16-state-cell">{empty ? <span className="riv16-badge danger">Hết hàng</span> : r.low ? <span className="riv16-badge warn">Sắp hết</span> : <span className="riv16-badge success">Đủ hàng</span>}{!r.isListed && <span className="riv16-badge muted">Đang ẩn</span>}</span>
                      <ArrowRight className="riv16-row-arrow" size={17} aria-hidden="true"/>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      {canAdjust && unstocked.length > 0 && (
        <section id="riv16-receive" className="riv16-receive-section">
          <details className="riv16-accordion">
            <summary><span><Truck size={20}/><strong>Nhập mặt hàng mới vào chi nhánh</strong><small>Chỉ dùng cho biến thể chưa từng được ghi nhận tồn tại {branch.name}.</small></span><span className="riv16-accordion-plus" aria-hidden="true">+</span></summary>
            <div className="riv16-accordion-body">
              <ActionForm action={receiveNewItemAction} className="riv16-entry-form">
                <SelectField name="variant_id" label="Mặt hàng" placeholder="Chọn mặt hàng chưa có tồn" options={unstocked.map((u) => ({ value: u.id, label: u.label }))} required />
                <SelectField name="reason" label="Loại nhập" options={[{ value: 'purchase', label: 'Nhập hàng' }, { value: 'opening', label: 'Tồn đầu kỳ' }]} />
                <TextField name="quantity" label="Số lượng" type="number" min={1} required />
                <TextField name="note" label="Ghi chú" optional placeholder="Số phiếu nhập / nhà cung cấp" />
                <SubmitButton size="md">Xác nhận nhập kho</SubmitButton>
              </ActionForm>
            </div>
          </details>
        </section>
      )}
      <p className="riv16-safety-note">Mọi giao dịch nhập, xuất và kiểm kê đều được ghi vào sổ kho. Số lượng không được chỉnh trực tiếp từ danh sách.</p>
    </main>
  );
}
