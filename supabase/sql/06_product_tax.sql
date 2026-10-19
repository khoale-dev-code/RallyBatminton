-- =============================================================================
-- RALLY BADMINTON — 06_product_tax.sql   (BẮT BUỘC cho phần "Thuế" của sản phẩm)
-- Chạy SAU 05_product_details.sql. Chạy lại nhiều lần an toàn.
--
--   * brand_settings: phương pháp tính thuế (khấu trừ / trực tiếp), mức VAT mặc định, mã số thuế
--   * products: tên trên hóa đơn, có/không chịu thuế, nhóm ngành nghề (thuế trực tiếp),
--               mức VAT riêng hoặc theo mặc định (thuế khấu trừ)
--   * sale_lines: chụp lại thuế tại thời điểm bán (đổi cấu hình sau không làm sai đơn cũ)
--
-- Quy ước giá: giá bán ĐÃ GỒM thuế GTGT (phương pháp khấu trừ) — tiền thuế được tách ra từ giá.
-- Phương pháp trực tiếp (hộ kinh doanh): thuế = tỷ lệ % × doanh thu theo nhóm ngành nghề
-- (GTGT + TNCN, Thông tư 40/2021/TT-BTC). Số liệu là ước tính để đối chiếu, không thay hóa đơn điện tử.
-- =============================================================================

begin;

-- 1. Cài đặt thuế cấp thương hiệu --------------------------------------------------
alter table public.brand_settings
  add column if not exists tax_method text not null default 'deduction'
    constraint brand_settings_tax_method check (tax_method in ('deduction', 'direct')),
  add column if not exists default_vat_rate numeric(4, 2) not null default 8
    constraint brand_settings_default_vat check (default_vat_rate between 0 and 20),
  add column if not exists tax_code text
    constraint brand_settings_tax_code check (tax_code is null or tax_code ~ '^[0-9]{10}(-[0-9]{3})?$');

comment on column public.brand_settings.tax_method is 'deduction = khấu trừ (VAT đã gồm trong giá); direct = trực tiếp theo tỷ lệ % doanh thu.';
comment on column public.brand_settings.default_vat_rate is 'Mức VAT mặc định (%) cho sản phẩm chọn "áp dụng mức mặc định".';

-- 2. Thuế theo sản phẩm -------------------------------------------------------------
alter table public.products
  add column if not exists invoice_name text
    constraint products_invoice_name_len check (invoice_name is null or char_length(btrim(invoice_name)) between 1 and 150),
  add column if not exists taxable boolean not null default false,
  add column if not exists tax_industry text
    constraint products_tax_industry check (tax_industry is null or tax_industry in ('goods', 'service', 'rental', 'production', 'other')),
  add column if not exists vat_use_default boolean not null default true,
  add column if not exists vat_rate numeric(4, 2)
    constraint products_vat_rate check (vat_rate is null or vat_rate between 0 and 20);

comment on column public.products.taxable is 'Sản phẩm có chịu thuế. false = không tính thuế (hàng không chịu thuế, quà tặng…).';
comment on column public.products.tax_industry is 'Nhóm ngành nghề cho phương pháp trực tiếp: goods, service, rental, production, other.';
comment on column public.products.vat_rate is 'Mức VAT riêng (%) khi vat_use_default = false.';

-- 3. Tỷ lệ thuế trực tiếp theo nhóm ngành nghề (Thông tư 40/2021/TT-BTC) --------------
create or replace function private.direct_tax_rates(p_industry text, out vat_rate numeric, out pit_rate numeric)
language sql
immutable
set search_path = ''
as $$
  select r.vat, r.pit
    from (values ('goods', 1.0, 0.5), ('service', 5.0, 2.0), ('rental', 5.0, 5.0),
                 ('production', 3.0, 1.5), ('other', 2.0, 1.0)) as r(code, vat, pit)
   where r.code = coalesce(p_industry, 'other');
$$;
grant execute on function private.direct_tax_rates(text) to authenticated, service_role;

-- 4. Ghi cấu hình thuế khi tạo/sửa sản phẩm (INVOKER: RLS catalog.edit vẫn áp dụng) ----
create or replace function private.apply_product_tax(p_id uuid, p jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not (p ? 'taxable') then
    return; -- client cũ chưa gửi phần thuế: giữ nguyên
  end if;
  update public.products
     set invoice_name = nullif(btrim(coalesce(p ->> 'invoice_name', '')), ''),
         taxable = coalesce((p ->> 'taxable')::boolean, false),
         tax_industry = nullif(p ->> 'tax_industry', ''),
         vat_use_default = coalesce((p ->> 'vat_use_default')::boolean, true),
         vat_rate = case when coalesce((p ->> 'vat_use_default')::boolean, true) then null
                         else nullif(p ->> 'vat_rate', '')::numeric end
   where id = p_id;
end;
$$;
grant execute on function private.apply_product_tax(uuid, jsonb) to authenticated;

-- 5. Chụp thuế vào dòng bán ------------------------------------------------------------
alter table public.sale_lines
  add column if not exists tax_method text
    constraint sale_lines_tax_method check (tax_method is null or tax_method in ('deduction', 'direct')),
  add column if not exists vat_rate numeric(4, 2),
  add column if not exists vat_amount bigint not null default 0,
  add column if not exists pit_rate numeric(4, 2),
  add column if not exists pit_amount bigint not null default 0;

comment on column public.sale_lines.vat_amount is 'Khấu trừ: VAT tách từ thành tiền (giá đã gồm VAT). Trực tiếp: GTGT = tỷ lệ × thành tiền.';

create or replace function private.sale_line_tax()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_method text;
  v_default numeric;
  v_prod record;
  v_total bigint := new.quantity::bigint * new.unit_price;
  v_rates record;
begin
  select b.tax_method, b.default_vat_rate into v_method, v_default from public.brand_settings b where b.id;
  v_method := coalesce(v_method, 'deduction');
  select p.taxable, p.tax_industry, p.vat_use_default, p.vat_rate, p.kind
    into v_prod
    from public.product_variants v join public.products p on p.id = v.product_id
   where v.id = new.variant_id;

  new.tax_method := v_method;
  new.vat_rate := null; new.vat_amount := 0; new.pit_rate := null; new.pit_amount := 0;
  if not found or not coalesce(v_prod.taxable, false) then
    return new;
  end if;

  if v_method = 'deduction' then
    new.vat_rate := case when v_prod.vat_use_default then coalesce(v_default, 8) else coalesce(v_prod.vat_rate, v_default, 8) end;
    new.vat_amount := round(v_total * new.vat_rate / (100 + new.vat_rate));
  else
    select * into v_rates from private.direct_tax_rates(v_prod.tax_industry);
    new.vat_rate := v_rates.vat_rate;
    new.pit_rate := v_rates.pit_rate;
    new.vat_amount := round(v_total * v_rates.vat_rate / 100);
    new.pit_amount := round(v_total * v_rates.pit_rate / 100);
  end if;
  return new;
end;
$$;

drop trigger if exists sale_lines_tax on public.sale_lines;
create trigger sale_lines_tax before insert on public.sale_lines
  for each row execute function private.sale_line_tax();

-- 6. Hàm tạo/sửa sản phẩm: thêm phần thuế (giữ nguyên phần còn lại của 05) -------------
create or replace function public.create_product_full(p jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_kind public.product_kind := (p ->> 'kind')::public.product_kind;
  v_bundle boolean := coalesce((p ->> 'is_bundle')::boolean, false);
  v_ids uuid[] := '{}';
  v_vid uuid;
  v_item record;
  v_default_index integer;
  v_reorder integer := greatest(coalesce((p ->> 'reorder_level')::integer, 0), 0);
begin
  if jsonb_typeof(p -> 'variants') is distinct from 'array' or jsonb_array_length(p -> 'variants') = 0 then
    raise exception using errcode = 'P0001', message = 'VARIANT_REQUIRED';
  end if;
  if v_bundle and jsonb_array_length(p -> 'variants') <> 1 then
    raise exception using errcode = 'P0001', message = 'BUNDLE_SINGLE_VARIANT';
  end if;

  insert into public.products (
    kind, name, category_id, brand_name, description, excerpt, base_price, compare_at_price,
    unit_label, tags, seo_title, seo_description, show_on_website, show_on_pos, is_active, is_bundle, created_by)
  values (
    v_kind,
    btrim(p ->> 'name'),
    nullif(p ->> 'category_id', '')::uuid,
    nullif(btrim(coalesce(p ->> 'brand_name', '')), ''),
    nullif(btrim(coalesce(p ->> 'description', '')), ''),
    nullif(btrim(coalesce(p ->> 'excerpt', '')), ''),
    case when v_kind = 'sale' then (p ->> 'base_price')::integer end,
    case when v_kind = 'sale' then nullif(p ->> 'compare_at_price', '')::integer end,
    nullif(btrim(coalesce(p ->> 'unit_label', '')), ''),
    private.clean_tags(p -> 'tags'),
    nullif(btrim(coalesce(p ->> 'seo_title', '')), ''),
    nullif(btrim(coalesce(p ->> 'seo_description', '')), ''),
    coalesce((p ->> 'show_on_website')::boolean, true),
    coalesce((p ->> 'show_on_pos')::boolean, true),
    coalesce((p ->> 'is_active')::boolean, true),
    v_bundle,
    (select auth.uid()))
  returning id into v_id;

  perform private.apply_product_tax(v_id, p);

  select coalesce(min(x.ord) filter (where (x.value ->> 'is_default')::boolean), 1)::integer
    into v_default_index
    from jsonb_array_elements(p -> 'variants') with ordinality as x(value, ord);

  for v_item in
    select x.value as v, x.ord::integer as ord
      from jsonb_array_elements(p -> 'variants') with ordinality as x(value, ord)
     order by x.ord
  loop
    insert into public.product_variants (
      product_id, sku, size_label, color_label, price_override, cost_price, barcode, is_default, sort_order)
    values (
      v_id,
      upper(btrim(v_item.v ->> 'sku')),
      nullif(btrim(coalesce(v_item.v ->> 'size_label', '')), ''),
      nullif(btrim(coalesce(v_item.v ->> 'color_label', '')), ''),
      case when v_kind = 'sale' then nullif(v_item.v ->> 'price_override', '')::integer end,
      nullif(v_item.v ->> 'cost_price', '')::integer,
      nullif(btrim(coalesce(v_item.v ->> 'barcode', '')), ''),
      v_item.ord = v_default_index,
      v_item.ord)
    returning id into v_vid;
    v_ids := v_ids || v_vid;
  end loop;

  -- Bày bán tại chi nhánh + tồn đầu kỳ (combo không có tồn riêng).
  if not v_bundle and jsonb_typeof(p -> 'stock') = 'array' then
    for v_item in
      select (x.value ->> 'branch_id')::uuid as branch_id,
             coalesce((x.value ->> 'variant_index')::integer, 0) as idx,
             greatest(coalesce((x.value ->> 'quantity')::integer, 0), 0) as qty
        from jsonb_array_elements(p -> 'stock') as x(value)
    loop
      if v_item.idx < 0 or v_item.idx >= cardinality(v_ids) then
        raise exception using errcode = 'P0001', message = 'INVALID_LINES';
      end if;
      insert into public.inventory_levels (branch_id, variant_id, reorder_level, is_listed)
      values (v_item.branch_id, v_ids[v_item.idx + 1], v_reorder, true)
      on conflict (branch_id, variant_id) do nothing;
      if v_item.qty > 0 then
        perform public.adjust_stock(v_item.branch_id, v_ids[v_item.idx + 1], v_item.qty, 'opening',
                                    'Tồn đầu kỳ khi tạo sản phẩm');
      end if;
    end loop;
  end if;

  if v_kind = 'rental' and jsonb_typeof(p -> 'rental_rates') = 'array' then
    insert into public.rental_rates (product_id, label, duration_minutes, price)
    select v_id, btrim(x.value ->> 'label'), (x.value ->> 'duration_minutes')::integer, (x.value ->> 'price')::integer
      from jsonb_array_elements(p -> 'rental_rates') as x(value);
  end if;

  return v_id;
end;
$$;

create or replace function public.update_product_full(p_id uuid, p jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_prod public.products;
  v_item record;
  v_vid uuid;
  v_default uuid;
  v_archived uuid[] := coalesce(
    (select array_agg(x::uuid) from jsonb_array_elements_text(coalesce(p -> 'archived_variant_ids', '[]'::jsonb)) as x), '{}');
begin
  select * into v_prod from public.products where id = p_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'PRODUCT_NOT_FOUND';
  end if;

  update public.products
     set name = btrim(p ->> 'name'),
         category_id = nullif(p ->> 'category_id', '')::uuid,
         brand_name = nullif(btrim(coalesce(p ->> 'brand_name', '')), ''),
         description = nullif(btrim(coalesce(p ->> 'description', '')), ''),
         excerpt = nullif(btrim(coalesce(p ->> 'excerpt', '')), ''),
         base_price = case when v_prod.kind = 'sale' then (p ->> 'base_price')::integer end,
         compare_at_price = case when v_prod.kind = 'sale' then nullif(p ->> 'compare_at_price', '')::integer end,
         unit_label = nullif(btrim(coalesce(p ->> 'unit_label', '')), ''),
         tags = private.clean_tags(p -> 'tags'),
         seo_title = nullif(btrim(coalesce(p ->> 'seo_title', '')), ''),
         seo_description = nullif(btrim(coalesce(p ->> 'seo_description', '')), ''),
         show_on_website = coalesce((p ->> 'show_on_website')::boolean, true),
         show_on_pos = coalesce((p ->> 'show_on_pos')::boolean, true),
         is_active = v_prod.deleted_at is null and coalesce((p ->> 'is_active')::boolean, true)
   where id = p_id;

  perform private.apply_product_tax(p_id, p);

  if v_prod.is_bundle or jsonb_typeof(p -> 'variants') is distinct from 'array' then
    return;
  end if;

  -- Bỏ cờ mặc định trước để có thể đổi biến thể mặc định trong cùng giao dịch.
  update public.product_variants set is_default = false where product_id = p_id and is_default;

  for v_item in
    select x.value as v, x.ord::integer as ord
      from jsonb_array_elements(p -> 'variants') with ordinality as x(value, ord)
     order by x.ord
  loop
    v_vid := nullif(v_item.v ->> 'id', '')::uuid;
    if v_vid is null then
      insert into public.product_variants (
        product_id, sku, size_label, color_label, price_override, cost_price, barcode, sort_order, is_active)
      values (
        p_id,
        upper(btrim(v_item.v ->> 'sku')),
        nullif(btrim(coalesce(v_item.v ->> 'size_label', '')), ''),
        nullif(btrim(coalesce(v_item.v ->> 'color_label', '')), ''),
        case when v_prod.kind = 'sale' then nullif(v_item.v ->> 'price_override', '')::integer end,
        nullif(v_item.v ->> 'cost_price', '')::integer,
        nullif(btrim(coalesce(v_item.v ->> 'barcode', '')), ''),
        v_item.ord,
        coalesce((v_item.v ->> 'is_active')::boolean, true))
      returning id into v_vid;
    else
      update public.product_variants
         set sku = upper(btrim(v_item.v ->> 'sku')),
             size_label = nullif(btrim(coalesce(v_item.v ->> 'size_label', '')), ''),
             color_label = nullif(btrim(coalesce(v_item.v ->> 'color_label', '')), ''),
             price_override = case when v_prod.kind = 'sale' then nullif(v_item.v ->> 'price_override', '')::integer end,
             cost_price = nullif(v_item.v ->> 'cost_price', '')::integer,
             barcode = nullif(btrim(coalesce(v_item.v ->> 'barcode', '')), ''),
             sort_order = v_item.ord,
             is_active = coalesce((v_item.v ->> 'is_active')::boolean, true)
       where id = v_vid and product_id = p_id and deleted_at is null;
      if not found then
        raise exception using errcode = 'P0001', message = 'VARIANT_NOT_FOUND';
      end if;
    end if;
    if v_default is null and coalesce((v_item.v ->> 'is_default')::boolean, false) then
      v_default := v_vid;
    end if;
  end loop;

  if cardinality(v_archived) > 0 then
    update public.product_variants
       set is_active = false, deleted_at = now()
     where product_id = p_id and id = any (v_archived) and deleted_at is null and id is distinct from v_default;
  end if;

  if v_default is null then
    select v.id into v_default from public.product_variants v
     where v.product_id = p_id and v.deleted_at is null
     order by v.sort_order, v.created_at limit 1;
  end if;
  if v_default is null then
    raise exception using errcode = 'P0001', message = 'VARIANT_REQUIRED';
  end if;
  update public.product_variants set is_default = true where id = v_default;
end;
$$;

revoke all on function public.create_product_full(jsonb) from public, anon;
revoke all on function public.update_product_full(uuid, jsonb) from public, anon;
grant execute on function public.create_product_full(jsonb) to authenticated;
grant execute on function public.update_product_full(uuid, jsonb) to authenticated;

commit;

notify pgrst, 'reload schema';
