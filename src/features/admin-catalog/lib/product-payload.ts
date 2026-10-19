import { z } from 'zod';

/**
 * Dữ liệu gửi lên create_product_full / update_product_full.
 * Dùng chung cho trình duyệt (báo lỗi ngay) và Server Action (kiểm tra lại trước khi gọi database).
 */
export const SKU_PATTERN = /^[A-Z0-9][A-Z0-9._-]{1,39}$/;
export const BARCODE_PATTERN = /^[0-9A-Za-z._-]{4,32}$/;

const money = z.number({ error: 'Nhập số tiền' }).int().min(0, 'Không được âm').max(100_000_000, 'Tối đa 100 triệu');
const optionalText = (max: number, label: string) => z.string().max(max, `${label} tối đa ${max} ký tự`).nullable();

export const variantPayloadSchema = z.object({
  id: z.uuid().nullable(),
  sku: z.string().regex(SKU_PATTERN, 'SKU gồm chữ in hoa, số, dấu chấm, gạch (2–40 ký tự)'),
  size_label: optionalText(30, 'Size'),
  color_label: optionalText(30, 'Màu'),
  price_override: money.nullable(),
  cost_price: money.nullable(),
  barcode: z.string().regex(BARCODE_PATTERN, 'Mã vạch gồm 4–32 chữ, số, dấu chấm, gạch').nullable(),
  is_default: z.boolean(),
  is_active: z.boolean(),
});

export const productPayloadSchema = z
  .object({
    kind: z.enum(['sale', 'rental']),
    is_bundle: z.boolean(),
    name: z.string().trim().min(2, 'Nhập tên sản phẩm (tối thiểu 2 ký tự)').max(150, 'Tên tối đa 150 ký tự'),
    category_id: z.uuid().nullable(),
    brand_name: optionalText(60, 'Thương hiệu'),
    description: optionalText(4000, 'Mô tả'),
    excerpt: optionalText(300, 'Trích dẫn'),
    base_price: money.nullable(),
    compare_at_price: money.nullable(),
    unit_label: optionalText(20, 'Đơn vị tính'),
    tags: z.array(z.string().min(1).max(30, 'Mỗi nhãn tối đa 30 ký tự')).max(20, 'Tối đa 20 nhãn'),
    seo_title: optionalText(70, 'Tiêu đề SEO'),
    seo_description: optionalText(320, 'Mô tả SEO'),
    show_on_website: z.boolean(),
    show_on_pos: z.boolean(),
    is_active: z.boolean(),
    invoice_name: optionalText(150, 'Tên trên hóa đơn'),
    taxable: z.boolean(),
    tax_industry: z.enum(['goods', 'service', 'rental', 'production', 'other']).nullable(),
    vat_use_default: z.boolean(),
    vat_rate: z.number({ error: 'Nhập mức thuế' }).min(0, 'Không được âm').max(20, 'Tối đa 20%').nullable(),
    variants: z.array(variantPayloadSchema).min(1, 'Cần ít nhất một biến thể').max(100, 'Tối đa 100 biến thể'),
    archived_variant_ids: z.array(z.uuid()).max(100),
    stock: z
      .array(z.object({ branch_id: z.uuid(), variant_index: z.number().int().min(0), quantity: z.number().int().min(0).max(100_000) }))
      .max(5000),
    reorder_level: z.number().int().min(0).max(100_000),
    option1_name: optionalText(30, 'Tên thuộc tính'),
    option2_name: optionalText(30, 'Tên thuộc tính'),
    units: z
      .array(
        z.object({
          id: z.uuid().nullable(),
          name: z.string().trim().min(1, 'Nhập tên đơn vị').max(20, 'Tên đơn vị tối đa 20 ký tự'),
          conversion: z
            .number({ error: 'Nhập số quy đổi' })
            .int('Số quy đổi là số nguyên')
            .min(2, 'Quy đổi tối thiểu 2')
            .max(10000, 'Tối đa 10.000'),
          price: money.nullable(),
          barcode: z.string().regex(BARCODE_PATTERN, 'Mã vạch gồm 4–32 chữ, số, dấu chấm, gạch').nullable(),
        }),
      )
      .max(10, 'Tối đa 10 đơn vị'),
    archived_unit_ids: z.array(z.uuid()).max(50),
    rental_rates: z
      .array(
        z.object({
          label: z.string().trim().min(1, 'Nhập tên gói').max(40),
          duration_minutes: z.number().int().min(15, 'Tối thiểu 15 phút').max(10080, 'Tối đa 7 ngày'),
          price: z.number().int().min(1000, 'Tối thiểu 1.000đ').max(100_000_000),
          usage: z.enum(['on_site', 'take_out']),
          billing: z.enum(['duration', 'session']),
        }),
      )
      .max(20),
  })
  .superRefine((p, ctx) => {
    if (p.taxable && !p.vat_use_default && p.vat_rate === null) {
      ctx.addIssue({ code: 'custom', path: ['vat_rate'], message: 'Nhập mức thuế VAT hoặc dùng mức mặc định' });
    }
    if (p.kind === 'sale' && p.base_price === null) {
      ctx.addIssue({ code: 'custom', path: ['base_price'], message: 'Hàng bán cần có giá bán' });
    }
    if (p.compare_at_price !== null && (p.base_price === null || p.compare_at_price <= p.base_price)) {
      ctx.addIssue({ code: 'custom', path: ['compare_at_price'], message: 'Giá so sánh phải lớn hơn giá bán' });
    }
    if (p.is_bundle && p.kind !== 'rental') {
      ctx.addIssue({ code: 'custom', path: ['is_bundle'], message: 'Chỉ đồ cho thuê mới là combo' });
    }
    const unitNames = new Set<string>([(p.unit_label ?? '').trim().toLowerCase()]);
    if (p.units.length > 0 && !p.unit_label) {
      ctx.addIssue({ code: 'custom', path: ['unit_label'], message: 'Nhập đơn vị cơ bản trước khi thêm đơn vị khác' });
    }
    p.units.forEach((u, i) => {
      const n = u.name.trim().toLowerCase();
      if (unitNames.has(n)) ctx.addIssue({ code: 'custom', path: ['units', i, 'name'], message: 'Trùng tên với đơn vị khác' });
      unitNames.add(n);
    });
    const skus = new Map<string, number>();
    const combos = new Map<string, number>();
    p.variants.forEach((v, i) => {
      const prevSku = skus.get(v.sku);
      if (prevSku !== undefined) ctx.addIssue({ code: 'custom', path: ['variants', i, 'sku'], message: 'SKU bị trùng với biến thể khác' });
      else skus.set(v.sku, i);
      const combo = `${(v.size_label ?? '').toLowerCase()}|${(v.color_label ?? '').toLowerCase()}`;
      if (p.variants.length > 1 && combos.has(combo)) {
        ctx.addIssue({ code: 'custom', path: ['variants', i, 'size_label'], message: 'Trùng giá trị thuộc tính với biến thể khác' });
      } else combos.set(combo, i);
    });
    if (p.variants.filter((v) => v.is_default).length !== 1) {
      ctx.addIssue({ code: 'custom', path: ['variants'], message: 'Chọn đúng một biến thể mặc định' });
    }
    const durations = new Set<string>();
    p.rental_rates.forEach((r, i) => {
      const key = `${r.usage}:${r.billing}:${r.duration_minutes}`;
      if (durations.has(key)) {
        ctx.addIssue({
          code: 'custom',
          path: ['rental_rates', i, 'duration_minutes'],
          message: 'Trùng hình thức và thời lượng với gói khác',
        });
      }
      durations.add(key);
      if (r.billing === 'session' && r.usage !== 'on_site') {
        ctx.addIssue({ code: 'custom', path: ['rental_rates', i, 'duration_minutes'], message: 'Gói hết trận chỉ dùng tại sân' });
      }
    });
    p.stock.forEach((s, i) => {
      if (s.variant_index >= p.variants.length) ctx.addIssue({ code: 'custom', path: ['stock', i], message: 'Dòng tồn kho không hợp lệ' });
    });
  });

export type ProductPayload = z.infer<typeof productPayloadSchema>;
export type VariantPayload = z.infer<typeof variantPayloadSchema>;

/** Lỗi theo đường dẫn "variants.0.sku" → thông báo. */
export type PayloadErrors = Partial<Record<string, string>>;

export function payloadErrors(error: z.ZodError): PayloadErrors {
  const out: PayloadErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join('.') || '_form';
    out[key] ??= issue.message;
  }
  return out;
}
