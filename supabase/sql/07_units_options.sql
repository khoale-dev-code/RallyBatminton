-- =============================================================================
-- RALLY BADMINTON — 07_units_options.sql   (BẮT BUỘC cho "Đơn vị tính" và "Biến thể" mới)
-- Chạy SAU 06_product_tax.sql. Chạy lại nhiều lần an toàn.
--
--   * products.option1_name / option2_name: tên thuộc tính biến thể (Kích thước, Màu sắc, Dung tích…).
--     Giá trị vẫn lưu ở product_variants.size_label (thuộc tính 1) và color_label (thuộc tính 2).
--   * product_units: đơn vị quy đổi (lốc = 6 lon, thùng = 24 lon…). Tồn kho luôn đếm theo đơn vị cơ bản
--     (products.unit_label); bán 1 thùng trừ kho 24.
--   * record_sale / void_sale: nhận unit_id từng dòng, trừ/hoàn kho theo hệ số quy đổi.
-- =============================================================================

begin;

-- 1. Tên thuộc tính biến thể ------------------------------------------------------------
alter table public.products
  add column if not exists option1_name text
    constraint products_option1_len check (option1_name is null or char_length(btrim(option1_name)) between 1 and 30),
  add column if not exists option2_name text
    constraint products_option2_len check (option2_name is null or char_length(btrim(option2_name)) between 1 and 30);

-- Dữ liệu cũ: biến thể có size/màu thì đặt tên thuộc tính mặc định.
update public.products p
   set option1_name = coalesce(p.option1_name, 'Kích thước')
 where p.option1_name is null
   and exists (select 1 from public.product_variants v where v.product_id = p.id and v.size_label is not null);
update public.products p
   set option2_name = coalesce(p.option2_name, 'Màu sắc')
 where p.option2_name is null
   and exists (select 1 from public.product_variants v where v.product_id = p.id and v.color_label is not null);

-- 2. Đơn vị quy đổi ---------------------------------------------------------------------
create table if not exists public.product_units (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products (id),
  name        text not null constraint product_units_name_len check (char_length(btrim(name)) between 1 and 20),
  conversion  integer not null constraint product_units_conversion check (conversion between 2 and 10000),
  price       integer constraint product_units_price check (price is null or price between 0 and 100000000),
  barcode     text constraint product_units_barcode_fmt check (barcode is null or barcode ~ '^[0-9A-Za-z._-]{4,32}$'),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
comment on table public.product_units is 'Đơn vị bán quy đổi của sản phẩm (lốc, thùng…). conversion = số đơn vị cơ bản.';
create index if not exists product_units_product_idx on public.product_units (product_id) where deleted_at is null;
create unique index if not exists product_units_name_uidx
  on public.product_units (product_id, lower(btrim(name))) where deleted_at is null;
create unique index if not exists product_units_barcode_uidx
  on public.product_units (barcode) where barcode is not null and deleted_at is null;

alter table public.product_units enable row level security;

drop trigger if exists touch_product_units on public.product_units;
create trigger touch_product_units before update on public.product_units
  for each row execute function private.touch_updated_at();
drop trigger if exists no_delete_product_units on public.product_units;
create trigger no_delete_product_units before delete on public.product_units
  for each row execute function private.forbid_hard_delete();

drop policy if exists product_units_read on public.product_units;
create policy product_units_read on public.product_units
  for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_units.product_id));
drop policy if exists product_units_editor_insert on public.product_units;
create policy product_units_editor_insert on public.product_units
  for insert to authenticated
  with check (cardinality((select private.permitted_branch_ids('catalog.edit'))) > 0);
drop policy if exists product_units_editor_update on public.product_units;
create policy product_units_editor_update on public.product_units
  for update to authenticated
  using (cardinality((select private.permitted_branch_ids('catalog.edit'))) > 0)
  with check (cardinality((select private.permitted_branch_ids('catalog.edit'))) > 0);

grant select on public.product_units to anon, authenticated;
grant insert, update on public.product_units to authenticated;

-- 3. Dòng bán ghi đơn vị đã bán -----------------------------------------------------------
alter table public.sale_lines
  add column if not exists unit_id uuid references public.product_units (id),
  add column if not exists unit_name text,
  add column if not exists unit_conversion integer not null default 1
    constraint sale_lines_unit_conversion check (unit_conversion between 1 and 10000);

-- 4. Ghi phần mở rộng khi tạo/sửa sản phẩm --------------------------------------------------
--    create_product_full / update_product_full (06) đã gọi private.apply_product_tax ngay sau khi ghi
--    sản phẩm; hàm này nay ghi cả thuế, tên thuộc tính biến thể và đơn vị quy đổi. INVOKER: RLS vẫn áp dụng.
create or replace function private.apply_product_tax(p_id uuid, p jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item record;
  v_uid uuid;
  v_archived uuid[] := coalesce(
    (select array_agg(x::uuid) from jsonb_array_elements_text(coalesce(p -> 'archived_unit_ids', '[]'::jsonb)) as x), '{}');
begin
  if p ? 'taxable' then
    update public.products
       set invoice_name = nullif(btrim(coalesce(p ->> 'invoice_name', '')), ''),
           taxable = coalesce((p ->> 'taxable')::boolean, false),
           tax_industry = nullif(p ->> 'tax_industry', ''),
           vat_use_default = coalesce((p ->> 'vat_use_default')::boolean, true),
           vat_rate = case when coalesce((p ->> 'vat_use_default')::boolean, true) then null
                           else nullif(p ->> 'vat_rate', '')::numeric end
     where id = p_id;
  end if;

  if p ? 'option1_name' then
    update public.products
       set option1_name = nullif(btrim(coalesce(p ->> 'option1_name', '')), ''),
           option2_name = nullif(btrim(coalesce(p ->> 'option2_name', '')), '')
     where id = p_id;
  end if;

  if jsonb_typeof(p -> 'units') = 'array' then
    if cardinality(v_archived) > 0 then
      update public.product_units set deleted_at = now()
       where product_id = p_id and id = any (v_archived) and deleted_at is null;
    end if;
    for v_item in
      select x.value as u, x.ord::integer as ord
        from jsonb_array_elements(p -> 'units') with ordinality as x(value, ord)
       order by x.ord
    loop
      v_uid := nullif(v_item.u ->> 'id', '')::uuid;
      if v_uid is null then
        insert into public.product_units (product_id, name, conversion, price, barcode, sort_order)
        values (p_id, btrim(v_item.u ->> 'name'), (v_item.u ->> 'conversion')::integer,
                nullif(v_item.u ->> 'price', '')::integer, nullif(btrim(coalesce(v_item.u ->> 'barcode', '')), ''), v_item.ord);
      else
        update public.product_units
           set name = btrim(v_item.u ->> 'name'),
               conversion = (v_item.u ->> 'conversion')::integer,
               price = nullif(v_item.u ->> 'price', '')::integer,
               barcode = nullif(btrim(coalesce(v_item.u ->> 'barcode', '')), ''),
               sort_order = v_item.ord
         where id = v_uid and product_id = p_id and deleted_at is null;
        if not found then
          raise exception using errcode = 'P0001', message = 'UNIT_NOT_FOUND';
        end if;
      end if;
    end loop;
  end if;
end;
$$;
grant execute on function private.apply_product_tax(uuid, jsonb) to authenticated;

-- 5. Bán hàng & hủy đơn theo đơn vị quy đổi -------------------------------------------------
create or replace function public.record_sale(
  p_branch_id uuid,
  p_lines jsonb,
  p_payment_method public.payment_method,
  p_payment_reference text default null,
  p_discount_amount bigint default 0,
  p_customer_phone text default null,
  p_customer_name text default null,
  p_note text default null,
  p_idempotency_key text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.sales;
  v_sale uuid;
  v_customer uuid;
  v_subtotal bigint := 0;
  v_line record;
  v_line_id uuid;
  v_total bigint;
begin
  perform private.require_permission(p_branch_id, 'sale.record');
  if coalesce(p_discount_amount, 0) <> 0 and not private.is_owner() then
    perform private.raise_error('DISCOUNT_OWNER_ONLY');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) < 8 then
    perform private.raise_error('IDEMPOTENCY_KEY_REQUIRED');
  end if;
  select * into v_existing from public.sales where idempotency_key = p_idempotency_key;
  if found then
    if v_existing.branch_id <> p_branch_id then
      perform private.raise_error('IDEMPOTENCY_CONFLICT');
    end if;
    return jsonb_build_object('sale_id', v_existing.id, 'code', v_existing.code,
                              'total_amount', v_existing.total_amount, 'replayed', true);
  end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) not between 1 and 30 then
    perform private.raise_error('INVALID_LINES');
  end if;

  if p_customer_phone is not null and btrim(p_customer_phone) <> '' then
    v_customer := private.upsert_customer(p_customer_phone, coalesce(p_customer_name, 'Khách lẻ'));
  end if;

  insert into public.sales (branch_id, customer_id, subtotal_amount, discount_amount, note, idempotency_key, sold_by)
  values (p_branch_id, v_customer, 0, 0, nullif(btrim(coalesce(p_note, '')), ''), p_idempotency_key, (select auth.uid()))
  returning id into v_sale;

  -- Gộp dòng trùng biến thể, xử lý theo thứ tự variant_id để khóa nhất quán (tránh deadlock).
  for v_line in
    select l.variant_id, l.unit_id, sum(l.quantity)::integer as quantity
      from jsonb_to_recordset(p_lines) as l(variant_id uuid, unit_id uuid, quantity integer)
     group by l.variant_id, l.unit_id
     order by l.variant_id, l.unit_id nulls first
  loop
    declare
      v_name text;
      v_label text;
      v_price integer;
      v_base_unit text;
      v_unit_name text;
      v_conv integer := 1;
    begin
      if v_line.variant_id is null or v_line.quantity is null or v_line.quantity not between 1 and 1000 then
        perform private.raise_error('INVALID_LINES');
      end if;
      select p.name,
             nullif(concat_ws(' / ', v.size_label, v.color_label), ''),
             coalesce(v.price_override, p.base_price),
             p.unit_label
        into v_name, v_label, v_price, v_base_unit
        from public.product_variants v
        join public.products p on p.id = v.product_id
       where v.id = v_line.variant_id
         and v.is_active and v.deleted_at is null
         and p.kind = 'sale' and p.is_active and p.deleted_at is null;
      if not found or v_price is null then
        perform private.raise_error('PRODUCT_UNAVAILABLE', v_line.variant_id::text);
      end if;
      v_unit_name := v_base_unit;
      -- Bán theo đơn vị quy đổi (lốc, thùng…): giá riêng của đơn vị hoặc giá cơ bản × hệ số; kho trừ theo đơn vị cơ bản.
      if v_line.unit_id is not null then
        select u.name, u.conversion, coalesce(u.price, v_price * u.conversion)
          into v_unit_name, v_conv, v_price
          from public.product_units u
          join public.product_variants v2 on v2.product_id = u.product_id
         where u.id = v_line.unit_id and v2.id = v_line.variant_id and u.deleted_at is null;
        if not found then
          perform private.raise_error('PRODUCT_UNAVAILABLE', v_line.unit_id::text);
        end if;
      end if;
      insert into public.sale_lines (sale_id, variant_id, product_name, variant_label, quantity, unit_price,
                                     unit_id, unit_name, unit_conversion)
      values (v_sale, v_line.variant_id, v_name, v_label, v_line.quantity, v_price,
              v_line.unit_id, v_unit_name, v_conv)
      returning id into v_line_id;
      insert into public.stock_movements (branch_id, variant_id, quantity_delta, reason, sale_line_id)
      values (p_branch_id, v_line.variant_id, -(v_line.quantity * v_conv), 'sale', v_line_id);
      v_subtotal := v_subtotal + v_line.quantity::bigint * v_price;
    end;
  end loop;

  if coalesce(p_discount_amount, 0) < 0 or coalesce(p_discount_amount, 0) > v_subtotal then
    perform private.raise_error('INVALID_DISCOUNT');
  end if;
  update public.sales
     set subtotal_amount = v_subtotal, discount_amount = coalesce(p_discount_amount, 0)
   where id = v_sale
  returning total_amount into v_total;

  if v_total > 0 then
    perform private.insert_payment(null, v_sale, null, 'charge', p_payment_method, v_total,
                                   p_payment_reference, null, 'sale:' || p_idempotency_key);
  end if;

  return jsonb_build_object('sale_id', v_sale,
                            'code', (select code from public.sales where id = v_sale),
                            'total_amount', v_total);
end;
$$;

create or replace function public.void_sale(p_sale_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.sales;
  v_line record;
begin
  perform private.require_owner();
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then
    perform private.raise_error('REASON_REQUIRED');
  end if;
  select * into v from public.sales where id = p_sale_id for update;
  if not found then
    perform private.raise_error('SALE_NOT_FOUND');
  end if;
  if v.status = 'voided' then
    return jsonb_build_object('sale_id', v.id, 'status', v.status);
  end if;
  perform private.set_audit_reason('void sale: ' || p_reason);
  for v_line in select * from public.sale_lines where sale_id = v.id order by variant_id loop
    insert into public.stock_movements (branch_id, variant_id, quantity_delta, reason, sale_line_id, note)
    values (v.branch_id, v_line.variant_id, v_line.quantity * coalesce(v_line.unit_conversion, 1), 'sale_void', v_line.id,
            left(p_reason, 300));
  end loop;
  update public.payments
     set status = 'voided', voided_at = now(), voided_by = (select auth.uid()), void_reason = btrim(p_reason)
   where sale_id = v.id and status in ('pending', 'succeeded');
  update public.sales
     set status = 'voided', voided_at = now(), voided_by = (select auth.uid()), void_reason = btrim(p_reason)
   where id = v.id;
  return jsonb_build_object('sale_id', v.id, 'status', 'voided');
end;
$$;

revoke all on function public.record_sale(uuid, jsonb, public.payment_method, text, bigint, text, text, text, text) from public, anon;
revoke all on function public.void_sale(uuid, text) from public, anon;
grant execute on function public.record_sale(uuid, jsonb, public.payment_method, text, bigint, text, text, text, text) to authenticated;
grant execute on function public.void_sale(uuid, text) to authenticated;

commit;

notify pgrst, 'reload schema';
