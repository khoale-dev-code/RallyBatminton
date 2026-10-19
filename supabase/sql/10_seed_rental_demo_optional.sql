-- =============================================================================
-- RALLY BADMINTON — 10_seed_rental_demo_optional.sql   (TÙY CHỌN — dữ liệu chạy thử cho thuê)
--
-- Chạy SAU 09_rental_pricing.sql, trên dự án đã có dữ liệu mẫu 04 (2 chi nhánh, vợt/giày/combo thuê)
-- và tài khoản chủ sân. 08 không bắt buộc (có 08 thì phiếu "hết trận" gắn được vào sân đang chơi).
--
-- Tạo:
--   * Gói giá mới: "Hết trận" tại sân, "Nửa ngày" / "1 ngày" mang ra ngoài (có trần phụ phí)
--   * Nhập thêm vợt/giày cho thuê ở 2 chi nhánh
--   * Bảng cho thuê HÔM NAY (tính theo giờ chạy script): đang thuê còn giờ, sắp đến hạn, đang ân hạn,
--     trễ 1 block, trễ 2 block (thuê 1 giờ, 2 giờ sau mới trả), mang về quá hạn có cọc CCCD,
--     hết trận gắn sân; và các phiếu đã trả hôm nay có phụ phí / giảm phụ phí kèm lý do.
--
-- Chạy lại an toàn: nếu vợt đã có gói "Hết trận" thì bỏ qua toàn bộ.
-- =============================================================================

begin;

create or replace function pg_temp.seed_pay(p_rental uuid, p_method public.payment_method, p_amount bigint,
                                           p_at timestamptz, p_owner uuid, p_note text)
returns void
language plpgsql
as $$
begin
  if p_amount is null or p_amount <= 0 then
    return;
  end if;
  insert into public.payments (rental_id, kind, method, status, amount, reference, idempotency_key, note,
                               received_at, recorded_by, created_at)
  values (p_rental, 'charge', p_method, 'succeeded', p_amount,
          case p_method when 'bank_transfer' then 'FT' || to_char(p_at, 'YYMMDD') || upper(substr(md5(random()::text), 1, 8))
                        when 'e_wallet' then 'MOMO' || upper(substr(md5(random()::text), 1, 9))
                        when 'card' then 'POS' || upper(substr(md5(random()::text), 1, 9)) end,
          'seed10:' || gen_random_uuid()::text, p_note, p_at, p_owner, p_at);
end;
$$;

-- Một phiếu thuê đầy đủ: trừ kho, thu tiền thuê; có p_returned_at thì nhận trả với phụ phí đúng công thức.
create or replace function pg_temp.seed_rental(
  p_branch uuid, p_product text, p_rate text, p_usage public.rental_usage, p_billing public.rental_billing,
  p_qty integer, p_customer uuid, p_starts timestamptz, p_owner uuid,
  p_booking uuid default null, p_collateral text default null, p_returned_at timestamptz default null,
  p_charged_late integer default null, p_reason text default null, p_variant_size text default null,
  p_note text default null)
returns uuid
language plpgsql
as $$
declare
  v_prod public.products;
  v_rate public.rental_rates;
  v_variant uuid;
  v_due timestamptz;
  v_id uuid;
  v_line uuid;
  v_comp record;
  v_o record;
  v_r public.rentals;
begin
  select * into v_prod from public.products where name = p_product and kind = 'rental' and deleted_at is null limit 1;
  select * into v_rate from public.rental_rates
   where product_id = v_prod.id and label = p_rate and usage = p_usage and billing = p_billing and is_active limit 1;
  if v_prod.id is null or v_rate.id is null then
    raise notice 'Bỏ qua: không có % / gói %', p_product, p_rate;
    return null;
  end if;
  if not v_prod.is_bundle then
    select v.id into v_variant from public.product_variants v
      join public.inventory_levels il on il.variant_id = v.id and il.branch_id = p_branch
     where v.product_id = v_prod.id and v.is_active and v.deleted_at is null and il.on_hand >= p_qty
       and (p_variant_size is null or v.size_label = p_variant_size)
     order by v.sort_order limit 1;
    if v_variant is null then
      raise notice 'Bỏ qua: hết % tại chi nhánh', p_product;
      return null;
    end if;
  end if;

  v_due := case when p_billing = 'session' and p_booking is not null
                then (select upper(during) from public.bookings where id = p_booking)
                else p_starts + make_interval(mins => v_rate.duration_minutes) end;

  insert into public.rentals (branch_id, customer_id, product_id, rate_label, duration_minutes, unit_price, quantity,
                              starts_at, due_at, note, idempotency_key, created_by, created_at,
                              usage, billing, booking_id, collateral,
                              grace_minutes, overtime_block_minutes, overtime_block_price, overtime_cap)
  values (p_branch, p_customer, v_prod.id, v_rate.label, v_rate.duration_minutes, v_rate.price, p_qty,
          p_starts, v_due, p_note, 'seed10-' || gen_random_uuid()::text, p_owner, p_starts,
          v_rate.usage, v_rate.billing, p_booking, p_collateral,
          v_rate.grace_minutes, v_rate.overtime_block_minutes,
          coalesce(v_rate.overtime_block_price,
                   private.rental_auto_block_price(v_rate.price, v_rate.duration_minutes, v_rate.overtime_block_minutes)),
          v_rate.overtime_cap)
  returning id into v_id;

  for v_comp in
    select x.variant_id, sum(x.qty)::integer as qty from (
      select bc.component_variant_id as variant_id, bc.quantity * p_qty as qty
        from public.bundle_components bc where v_prod.is_bundle and bc.bundle_product_id = v_prod.id
      union all
      select v_variant, p_qty where not v_prod.is_bundle
    ) x group by x.variant_id order by x.variant_id
  loop
    insert into public.rental_lines (rental_id, variant_id, quantity) values (v_id, v_comp.variant_id, v_comp.qty)
    returning id into v_line;
    insert into public.stock_movements (branch_id, variant_id, quantity_delta, reason, rental_line_id, created_by, created_at)
    values (p_branch, v_comp.variant_id, -v_comp.qty, 'rental_out', v_line, p_owner, p_starts);
  end loop;
  perform pg_temp.seed_pay(v_id, case when p_usage = 'take_out' then 'bank_transfer'::public.payment_method else 'cash'::public.payment_method end,
                           v_rate.price::bigint * p_qty, p_starts, p_owner, 'Tiền thuê');

  if p_returned_at is not null then
    select * into v_r from public.rentals where id = v_id;
    select * into v_o from private.rental_overtime(private.rental_effective_due(v_r), p_returned_at, v_r.quantity, v_r.grace_minutes,
                                                   v_r.overtime_block_minutes, v_r.overtime_block_price, v_r.overtime_cap);
    update public.rental_lines set returned_quantity = quantity where rental_id = v_id;
    insert into public.stock_movements (branch_id, variant_id, quantity_delta, reason, rental_line_id, created_by, created_at)
    select p_branch, l.variant_id, l.quantity, 'rental_return', l.id, p_owner, p_returned_at
      from public.rental_lines l where l.rental_id = v_id;
    update public.rentals
       set status = 'returned', returned_at = p_returned_at, returned_by = p_owner,
           late_minutes = v_o.late_minutes, late_fee_auto = v_o.fee::integer,
           late_fee = coalesce(p_charged_late, v_o.fee::integer),
           late_fee_reason = case when coalesce(p_charged_late, v_o.fee::integer) < v_o.fee then p_reason end
     where id = v_id;
    perform pg_temp.seed_pay(v_id, 'cash', coalesce(p_charged_late, v_o.fee::integer), p_returned_at, p_owner, 'Phụ phí trả trễ');
  end if;
  return v_id;
end;
$$;

do $seed$
declare
  v_owner uuid;
  v_td uuid;
  v_q7 uuid;
  v_now timestamptz := date_trunc('minute', now());
  v_cust uuid[];
  v_booking uuid;
  v_branch uuid;
  v_k integer := 0;
begin
  if to_regclass('public.rentals') is null
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'rentals' and column_name = 'billing') then
    raise exception 'Chưa chạy 09_rental_pricing.sql.';
  end if;
  select id into v_td from public.branches where slug = 'rally-thu-duc';
  select id into v_q7 from public.branches where slug = 'rally-quan-7';
  if v_td is null or v_q7 is null then
    raise exception 'Chưa có chi nhánh mẫu. Chạy 04_seed_demo_optional.sql trước.';
  end if;
  if exists (select 1 from public.rental_rates r join public.products p on p.id = r.product_id
              where p.name = 'Vợt Yonex Astrox 77' and r.billing = 'session') then
    raise notice 'Dữ liệu mẫu cho thuê (10) đã có — bỏ qua.';
    return;
  end if;
  select user_id into v_owner from public.staff_accounts where role = 'owner' and is_active order by created_at limit 1;
  if v_owner is null then
    raise exception 'Chưa có tài khoản chủ sân. Chạy: select private.bootstrap_first_owner(''email'', ''Tên'');';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform setseed(0.1018);

  -- 1. Gói giá theo hình thức -------------------------------------------------------------------
  insert into public.rental_rates (product_id, label, duration_minutes, price, usage, billing, overtime_cap)
  select p.id, x.label, x.minutes, x.price, x.usage::public.rental_usage, x.billing::public.rental_billing, x.cap
    from (values
      ('Vợt Yonex Astrox 77', 'Hết trận', 120, 50000, 'on_site', 'session', null::integer),
      ('Vợt Yonex Astrox 77', 'Nửa ngày', 480, 80000, 'take_out', 'duration', 120000),
      ('Vợt Yonex Astrox 77', '1 ngày', 1440, 120000, 'take_out', 'duration', 120000),
      ('Giày cầu lông', 'Hết trận', 120, 35000, 'on_site', 'session', null),
      ('Giày cầu lông', '1 ngày', 1440, 80000, 'take_out', 'duration', 80000),
      ('Combo vợt + giày', 'Hết trận', 120, 75000, 'on_site', 'session', null),
      ('Combo vợt + giày', '1 ngày', 1440, 180000, 'take_out', 'duration', 180000)
    ) as x(product, label, minutes, price, usage, billing, cap)
    join public.products p on p.name = x.product and p.kind = 'rental' and p.deleted_at is null
  on conflict (product_id, usage, billing, duration_minutes) do nothing;

  -- 2. Nhập thêm đồ cho thuê ---------------------------------------------------------------------
  insert into public.inventory_levels (branch_id, variant_id)
  select b.id, v.id from public.product_variants v
    join public.products p on p.id = v.product_id and p.kind = 'rental' and not p.is_bundle and p.deleted_at is null
   cross join (values (v_td), (v_q7)) as b(id)
  on conflict (branch_id, variant_id) do nothing;
  insert into public.stock_movements (branch_id, variant_id, quantity_delta, reason, note, created_by, created_at)
  select il.branch_id, il.variant_id, case when p.name like 'Vợt%' then 8 else 6 end, 'purchase', 'Nhập thêm đồ cho thuê (dữ liệu mẫu)',
         v_owner, v_now - interval '2 days'
    from public.inventory_levels il
    join public.product_variants v on v.id = il.variant_id
    join public.products p on p.id = v.product_id and p.kind = 'rental' and not p.is_bundle
   where il.branch_id in (v_td, v_q7);

  select array_agg(id order by created_at) into v_cust from public.customers;
  if coalesce(array_length(v_cust, 1), 0) < 12 then
    for v_k in 1..12 loop
      v_cust := array_append(v_cust, private.upsert_customer('0907' || lpad((300000 + v_k * 1117)::text, 6, '0'),
                                                             (array['Nguyễn Minh Khoa','Trần Bảo Ngọc','Lê Gia Huy','Phạm Thu Hà','Võ Đức Anh','Đỗ Mai Linh',
                                                                    'Bùi Quốc Bảo','Hồ Ngọc Trâm','Ngô Thanh Tùng','Dương Khánh Vy','Lý Hải Nam','Phan Mỹ Duyên'])[v_k]));
    end loop;
  end if;

  -- 3. Bảng cho thuê hôm nay ở 2 chi nhánh ------------------------------------------------------
  foreach v_branch in array array[v_q7, v_td] loop
    v_k := case when v_branch = v_q7 then 0 else 6 end;

    -- Hết trận gắn với sân đang chơi (nếu có lượt đặt đang diễn ra).
    select b.id into v_booking from public.bookings b
     where b.branch_id = v_branch and b.kind = 'customer' and b.status in ('checked_in', 'confirmed')
       and b.during @> v_now and upper(b.during) > v_now + interval '20 minutes'
     order by upper(b.during) limit 1;
    if v_booking is not null then
      perform pg_temp.seed_rental(v_branch, 'Vợt Yonex Astrox 77', 'Hết trận', 'on_site', 'session', 2,
                                  (select customer_id from public.bookings where id = v_booking),
                                  greatest((select lower(during) from public.bookings where id = v_booking), v_now - interval '50 minutes'),
                                  v_owner, v_booking, null, null, null, null, null, 'Vợt căng 24 lbs');
    end if;
    -- Thuê 1 giờ, đã dùng 52 phút → sắp đến hạn.
    perform pg_temp.seed_rental(v_branch, 'Vợt Yonex Astrox 77', '1 giờ', 'on_site', 'duration', 1, v_cust[v_k + 1],
                                v_now - interval '52 minutes', v_owner);
    -- Combo 2 giờ mới giao 30 phút.
    perform pg_temp.seed_rental(v_branch, 'Combo vợt + giày', '2 giờ', 'on_site', 'duration', 1, v_cust[v_k + 2],
                                v_now - interval '30 minutes', v_owner);
    -- Thuê 1 giờ, 2 giờ sau vẫn chưa trả → trễ 60 phút = 2 block.
    perform pg_temp.seed_rental(v_branch, 'Vợt Yonex Astrox 77', '1 giờ', 'on_site', 'duration', 1, v_cust[v_k + 3],
                                v_now - interval '120 minutes', v_owner);
    -- Mang về 1 ngày từ hôm qua, quá hạn 2 giờ, cầm CCCD.
    perform pg_temp.seed_rental(v_branch, 'Vợt Yonex Astrox 77', '1 ngày', 'take_out', 'duration', 1, v_cust[v_k + 4],
                                v_now - interval '26 hours', v_owner, null, 'CCCD');

    if v_branch = v_q7 then
      -- Đang ân hạn (trễ 6 phút).
      perform pg_temp.seed_rental(v_branch, 'Giày cầu lông', '1 giờ', 'on_site', 'duration', 1, v_cust[v_k + 5],
                                  v_now - interval '66 minutes', v_owner);
      -- Trễ 15 phút → 1 block.
      perform pg_temp.seed_rental(v_branch, 'Giày cầu lông', '2 giờ', 'on_site', 'duration', 2, v_cust[v_k + 6],
                                  v_now - interval '135 minutes', v_owner, null, null, null, null, null, '42');
      -- Mang về nửa ngày, còn ~5 giờ, cọc bằng lái.
      perform pg_temp.seed_rental(v_branch, 'Vợt Yonex Astrox 77', 'Nửa ngày', 'take_out', 'duration', 1, v_cust[v_k + 7],
                                  v_now - interval '3 hours', v_owner, null, 'Bằng lái xe');
    end if;

    -- Đã trả hôm nay: trễ 40 phút (2 block), đúng hạn, trong ân hạn, và một phiếu được giảm phụ phí có lý do.
    perform pg_temp.seed_rental(v_branch, 'Vợt Yonex Astrox 77', '1 giờ', 'on_site', 'duration', 1, v_cust[v_k + 8],
                                v_now - interval '5 hours', v_owner, null, null, v_now - interval '5 hours' + interval '100 minutes');
    perform pg_temp.seed_rental(v_branch, 'Giày cầu lông', '2 giờ', 'on_site', 'duration', 1, v_cust[v_k + 9],
                                v_now - interval '6 hours', v_owner, null, null, v_now - interval '4 hours' - interval '10 minutes');
    perform pg_temp.seed_rental(v_branch, 'Vợt Yonex Astrox 77', '2 giờ', 'on_site', 'duration', 2, v_cust[v_k + 10],
                                v_now - interval '4 hours', v_owner, null, null, v_now - interval '2 hours' + interval '7 minutes');
    perform pg_temp.seed_rental(v_branch, 'Combo vợt + giày', '2 giờ', 'on_site', 'duration', 1, v_cust[v_k + 11],
                                v_now - interval '7 hours', v_owner, null, null, v_now - interval '5 hours' + interval '45 minutes',
                                0, 'Khách quen, sân báo đổi giờ trễ');
  end loop;

  raise notice 'Xong: gói giá theo hình thức + bảng cho thuê hôm nay cho 2 chi nhánh.';
end
$seed$;

commit;
