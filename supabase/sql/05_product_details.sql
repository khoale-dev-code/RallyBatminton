-- =============================================================================
-- RALLY BADMINTON — 05_product_details.sql   (BẮT BUỘC cho màn "Quản lý sản phẩm" mới)
-- Chạy sau 00 → 01 → 02 (03, 04 tùy chọn). Chạy lại nhiều lần an toàn.
--
--   * products: trích dẫn, đơn vị tính, nhãn, SEO, kênh hiển thị (website / quầy bán)
--   * product_variants: giá vốn, mã vạch (barcode)
--   * Giá vốn KHÔNG lộ: chỉ đọc qua get_variant_costs() khi có quyền xem danh mục
--   * create_product_full / update_product_full: tạo/sửa sản phẩm + biến thể + tồn đầu kỳ
--     trong MỘT giao dịch. SECURITY INVOKER: RLS (catalog.edit) và quyền inventory.adjust
--     của người gọi vẫn được database kiểm tra.
-- =============================================================================

begin;

-- 1. Cột mới -------------------------------------------------------------------
alter table public.products
  add column if not exists excerpt text
    constraint products_excerpt_len check (excerpt is null or char_length(excerpt) <= 300),
  add column if not exists unit_label text
    constraint products_unit_label_len check (unit_label is null or char_length(btrim(unit_label)) between 1 and 20),
  add column if not exists tags text[] not null default '{}'
    constraint products_tags_limit check (cardinality(tags) <= 20 and char_length(array_to_string(tags, ',')) <= 600),
  add column if not exists seo_title text
    constraint products_seo_title_len check (seo_title is null or char_length(seo_title) <= 70),
  add column if not exists seo_description text
    constraint products_seo_desc_len check (seo_description is null or char_length(seo_description) <= 320),
  add column if not exists show_on_website boolean not null default true,
  add column if not exists show_on_pos boolean not null default true;

create index if not exists products_tags_gin_idx on public.products using gin (tags);

alter table public.product_variants
  add column if not exists cost_price integer
    constraint product_variants_cost check (cost_price is null or cost_price between 0 and 100000000),
  add column if not exists barcode text
    constraint product_variants_barcode_fmt check (barcode is null or barcode ~ '^[0-9A-Za-z._-]{4,32}$');

create unique index if not exists product_variants_barcode_uidx
  on public.product_variants (barcode) where barcode is not null and deleted_at is null;

comment on column public.products.show_on_website is 'Hiện trên website khách (ngoài điều kiện is_active).';
comment on column public.products.show_on_pos is 'Hiện ở màn hình bán hàng tại quầy.';
comment on column public.product_variants.cost_price is 'Giá vốn — không đọc trực tiếp; dùng public.get_variant_costs (cần catalog.view).';

-- 2. RLS: website chỉ thấy sản phẩm bật kênh website ------------------------------
drop policy if exists products_anon_read on public.products;
create policy products_anon_read on public.products
  for select to anon
  using (is_active and deleted_at is null and show_on_website);

drop policy if exists products_auth_read on public.products;
create policy products_auth_read on public.products
  for select to authenticated
  using (
    (is_active and deleted_at is null and show_on_website)
    or cardinality((select private.permitted_branch_ids('catalog.view'))) > 0);

-- 3. Giá vốn không lộ: khách (anon) và nhân viên chỉ đọc được các cột công khai ----------
--    Nhân viên (authenticated) cũng vậy: giá vốn chỉ đọc qua get_variant_costs (cần quyền catalog.view).
--    Ghi chú: thêm cột mới vào product_variants sau này thì nhớ grant select cột đó cho anon, authenticated.
revoke select on public.product_variants from anon, authenticated;
grant select (id, product_id, sku, size_label, color_label, price_override, is_default, is_active,
              sort_order, created_at, updated_at, deleted_at, barcode)
  on public.product_variants to anon, authenticated;

create or replace function public.get_variant_costs(p_product_id uuid)
returns table (variant_id uuid, cost_price integer)
language sql
stable
security definer
set search_path = ''
as $$
  select v.id, v.cost_price
    from public.product_variants v
   where v.product_id = p_product_id
     and cardinality((select private.permitted_branch_ids('catalog.view'))) > 0;
$$;
comment on function public.get_variant_costs(uuid) is 'Giá vốn theo biến thể — trả rỗng nếu người gọi không có quyền xem danh mục ở chi nhánh nào.';
revoke all on function public.get_variant_costs(uuid) from public, anon;
grant execute on function public.get_variant_costs(uuid) to authenticated;

-- 4. Danh mục công khai: thêm điều kiện kênh website ----------------------------------
create or replace function public.list_catalog(
  p_kind public.product_kind,
  p_category_slug text default null,
  p_branch_id uuid default null,
  p_search text default null,
  p_limit integer default 24,
  p_offset integer default 0)
returns table (
  id uuid,
  name text,
  slug text,
  kind public.product_kind,
  is_bundle boolean,
  brand_name text,
  description text,
  category_name text,
  category_slug text,
  min_price integer,
  max_price integer,
  compare_at_price integer,
  cover_path text,
  available_quantity bigint,
  total_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select nullif(btrim(coalesce(p_search, '')), '') as term,
           least(greatest(coalesce(p_limit, 24), 1), 60) as lim,
           greatest(coalesce(p_offset, 0), 0) as off
  ),
  base as (
    select p.id, p.name, p.slug, p.kind, p.is_bundle, p.brand_name, p.description, p.base_price,
           p.compare_at_price, c.name as cat_name, c.slug as cat_slug
      from public.products p
      left join public.product_categories c on c.id = p.category_id
     where p.kind = p_kind and p.is_active and p.deleted_at is null and p.show_on_website
       and (p_category_slug is null or c.slug = p_category_slug)
       and ((select term from params) is null
            or p.name ilike '%' || replace(replace((select term from params), '%', '\%'), '_', '\_') || '%'
            or coalesce(p.brand_name, '') ilike '%' || replace(replace((select term from params), '%', '\%'), '_', '\_') || '%'
            or exists (select 1 from unnest(p.tags) t where t ilike (select term from params)))
  ),
  variant_stock as (
    select v.product_id, v.id as variant_id,
           coalesce(sum(il.on_hand) filter (where il.is_listed and (p_branch_id is null or il.branch_id = p_branch_id)), 0) as on_hand,
           bool_or(il.is_listed and (p_branch_id is null or il.branch_id = p_branch_id)) as listed
      from public.product_variants v
      left join public.inventory_levels il on il.variant_id = v.id
     where v.is_active and v.deleted_at is null
     group by v.product_id, v.id
  ),
  single_stock as (
    select vs.product_id, sum(vs.on_hand) as qty, bool_or(coalesce(vs.listed, false)) as listed
      from variant_stock vs group by vs.product_id
  ),
  bundle_stock as (
    select bc.bundle_product_id as product_id,
           min(floor(coalesce(vs.on_hand, 0) / bc.quantity))::bigint as qty,
           bool_and(coalesce(vs.listed, false)) as listed
      from public.bundle_components bc
      left join variant_stock vs on vs.variant_id = bc.component_variant_id
     group by bc.bundle_product_id
  ),
  prices as (
    select b.id as product_id,
           case when b.kind = 'sale' then
             (select min(coalesce(v.price_override, b.base_price)) from public.product_variants v
               where v.product_id = b.id and v.is_active and v.deleted_at is null)
           else (select min(r.price) from public.rental_rates r where r.product_id = b.id and r.is_active) end as min_price,
           case when b.kind = 'sale' then
             (select max(coalesce(v.price_override, b.base_price)) from public.product_variants v
               where v.product_id = b.id and v.is_active and v.deleted_at is null)
           else (select max(r.price) from public.rental_rates r where r.product_id = b.id and r.is_active) end as max_price
      from base b
  ),
  joined as (
    select b.id, b.name, b.slug, b.kind, b.is_bundle, b.brand_name, b.description,
           b.cat_name, b.cat_slug, pr.min_price, pr.max_price, b.compare_at_price,
           (select ph.storage_path from public.product_photos ph
             where ph.product_id = b.id order by ph.is_cover desc, ph.sort_order, ph.created_at limit 1) as cover_path,
           case when b.is_bundle then coalesce(bs.qty, 0) else coalesce(ss.qty, 0) end as available_quantity,
           case when b.is_bundle then coalesce(bs.listed, false) else coalesce(ss.listed, false) end as listed
      from base b
      join prices pr on pr.product_id = b.id
      left join single_stock ss on ss.product_id = b.id
      left join bundle_stock bs on bs.product_id = b.id
     where pr.min_price is not null
  )
  select j.id, j.name, j.slug, j.kind, j.is_bundle, j.brand_name, j.description, j.cat_name, j.cat_slug,
         j.min_price, j.max_price, j.compare_at_price, j.cover_path, j.available_quantity,
         count(*) over () as total_count
    from joined j
   where j.listed
   order by j.available_quantity = 0, j.name
   limit (select lim from params) offset (select off from params);
$$;

-- 5. Chuẩn hóa nhãn: bỏ trống, bỏ trùng (không phân biệt hoa thường), tối đa 20 nhãn ---------
create or replace function private.clean_tags(p_tags jsonb)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(t order by first_pos), '{}')
    from (
      -- Trùng không phân biệt hoa thường: giữ cách viết xuất hiện đầu tiên.
      select (array_agg(btrim(x.value) order by x.ord))[1] as t, min(x.ord) as first_pos
        from jsonb_array_elements_text(coalesce(p_tags, '[]'::jsonb)) with ordinality as x(value, ord)
       where btrim(x.value) <> '' and char_length(btrim(x.value)) <= 30
       group by lower(btrim(x.value))
       order by min(x.ord)
       limit 20
    ) s;
$$;
grant execute on function private.clean_tags(jsonb) to authenticated, service_role;

-- 6. Tạo sản phẩm đầy đủ ------------------------------------------------------------
-- p = {
--   kind, name, category_id, brand_name, description, excerpt, base_price, compare_at_price,
--   unit_label, tags[], seo_title, seo_description, show_on_website, show_on_pos, is_active, is_bundle,
--   variants:     [{ sku, size_label, color_label, price_override, cost_price, barcode, is_default }],
--   stock:        [{ branch_id, variant_index, quantity }],      -- tạo dòng kho (bày bán) + tồn đầu kỳ
--   reorder_level: số cảnh báo sắp hết áp cho mọi dòng kho mới,
--   rental_rates: [{ label, duration_minutes, price }]
-- }
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

-- 7. Sửa sản phẩm + biến thể ----------------------------------------------------------
-- p giống create_product_full (không có stock/rental_rates), thêm:
--   variants[].id (bỏ trống = biến thể mới), variants[].is_active,
--   archived_variant_ids: [uuid] — ngừng biến thể (xóa mềm, giữ lịch sử)
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
