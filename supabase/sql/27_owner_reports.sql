-- =============================================================================
-- RALLY BADMINTON — 27_owner_reports.sql
-- Báo cáo cho chủ sân: doanh thu, lấp sân, khách hàng, hàng hóa, két tiền.
--
-- Chạy SAU 00 → 26. Chạy lại an toàn. Không tạo bảng mới — chỉ đọc dữ liệu đã có.
--
--   * Chỉ CHỦ SÂN gọi được (private.require_owner — kèm xác thực 2 lớp nếu đã bật). Nhân viên không xem doanh thu.
--   * Khoảng ngày theo giờ Việt Nam, tối đa 366 ngày; một chi nhánh hoặc tất cả.
--   * Doanh thu = THỰC THU (khoản thu đã nhận − hoàn tiền), cùng cách tính với Tổng quan.
--   * Lấp sân = giờ sân đã bán (đơn xác nhận / đang chơi / xong / không đến) ÷ giờ mở cửa × số sân đang hoạt động.
-- =============================================================================

begin;

-- Khoảng thời gian + phạm vi chi nhánh của một báo cáo (kiểm quyền chủ sân).
create or replace function private.report_window(
  p_from date, p_to date, p_branch_id uuid,
  out w_from timestamptz, out w_to timestamptz, out w_scope uuid[], out w_days integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_owner();
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 365 or p_from < date '2020-01-01' then
    perform private.raise_error('INVALID_RANGE');
  end if;
  w_from := (p_from::timestamp) at time zone 'Asia/Ho_Chi_Minh';
  w_to := ((p_to + 1)::timestamp) at time zone 'Asia/Ho_Chi_Minh';
  w_days := p_to - p_from + 1;
  if p_branch_id is null then
    select coalesce(array_agg(id order by name), '{}') into w_scope from public.branches where deleted_at is null;
  else
    if not exists (select 1 from public.branches where id = p_branch_id and deleted_at is null) then
      perform private.raise_error('BRANCH_NOT_FOUND');
    end if;
    w_scope := array[p_branch_id];
  end if;
end;
$$;

-- 1. Doanh thu (thực thu) ---------------------------------------------------------------------------------
create or replace function public.report_revenue(p_from date, p_to date, p_branch_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c_tz constant text := 'Asia/Ho_Chi_Minh';
  v_from timestamptz;
  v_to timestamptz;
  v_scope uuid[];
  v_days integer;
  v_prev_from timestamptz;
begin
  select w.w_from, w.w_to, w.w_scope, w.w_days into v_from, v_to, v_scope, v_days
    from private.report_window(p_from, p_to, p_branch_id) w;
  v_prev_from := v_from - (v_to - v_from);
  return (
    with p as (
      select pm.branch_id, pm.kind, pm.method::text as method, pm.amount, pm.received_at, bk.court_id,
             case when pm.kind = 'charge' then pm.amount else -pm.amount end as signed,
             case when pm.booking_id is not null then 'booking' when pm.sale_id is not null then 'sale' else 'rental' end as source,
             (pm.received_at at time zone c_tz)::date as day
        from public.payments pm
        left join public.bookings bk on bk.id = pm.booking_id
       where pm.branch_id = any (v_scope) and pm.status = 'succeeded'
         and pm.received_at >= v_prev_from and pm.received_at < v_to
    ), cur as (select * from p where received_at >= v_from)
    select jsonb_build_object(
      'from', p_from, 'to', p_to, 'days', v_days,
      'charge', (select coalesce(sum(amount), 0) from cur where kind = 'charge'),
      'refund', (select coalesce(sum(amount), 0) from cur where kind = 'refund'),
      'net', (select coalesce(sum(signed), 0) from cur),
      'count', (select count(*) from cur where kind = 'charge'),
      'prev_net', (select coalesce(sum(signed), 0) from p where received_at < v_from),
      'by_source', jsonb_build_object(
        'booking', (select coalesce(sum(signed), 0) from cur where source = 'booking'),
        'sale', (select coalesce(sum(signed), 0) from cur where source = 'sale'),
        'rental', (select coalesce(sum(signed), 0) from cur where source = 'rental')),
      'by_method', coalesce((select jsonb_object_agg(method, total) from (
          select method, sum(signed) as total from cur group by method) m), '{}'::jsonb),
      'series', coalesce((
        select jsonb_agg(jsonb_build_object('day', d.day::date,
                 'booking', coalesce(s.booking, 0), 'sale', coalesce(s.sale, 0), 'rental', coalesce(s.rental, 0),
                 'refund', coalesce(s.refund, 0)) order by d.day)
          from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') as d(day)
          left join (
            select day,
                   sum(amount) filter (where kind = 'charge' and source = 'booking') as booking,
                   sum(amount) filter (where kind = 'charge' and source = 'sale') as sale,
                   sum(amount) filter (where kind = 'charge' and source = 'rental') as rental,
                   sum(amount) filter (where kind = 'refund') as refund
              from cur group by day) s on s.day = d.day::date), '[]'::jsonb),
      'by_branch', coalesce((
        select jsonb_agg(jsonb_build_object('id', br.id, 'name', br.name,
                 'booking', coalesce(x.booking, 0), 'sale', coalesce(x.sale, 0), 'rental', coalesce(x.rental, 0),
                 'net', coalesce(x.net, 0)) order by coalesce(x.net, 0) desc, br.name)
          from public.branches br
          left join (
            select branch_id,
                   sum(signed) filter (where source = 'booking') as booking,
                   sum(signed) filter (where source = 'sale') as sale,
                   sum(signed) filter (where source = 'rental') as rental,
                   sum(signed) as net
              from cur group by branch_id) x on x.branch_id = br.id
         where br.id = any (v_scope)), '[]'::jsonb),
      'by_court', coalesce((
        select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'branch', br.name, 'net', x.net)
                         order by x.net desc, br.name, c.sort_order)
          from (select court_id, sum(signed) as net from cur where source = 'booking' and court_id is not null
                 group by court_id) x
          join public.courts c on c.id = x.court_id
          join public.branches br on br.id = c.branch_id), '[]'::jsonb)
    ));
end;
$$;

-- 2. Lấp sân ----------------------------------------------------------------------------------------------
create or replace function public.report_occupancy(p_from date, p_to date, p_branch_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c_tz constant text := 'Asia/Ho_Chi_Minh';
  v_from timestamptz;
  v_to timestamptz;
  v_scope uuid[];
  v_days integer;
begin
  select w.w_from, w.w_to, w.w_scope, w.w_days into v_from, v_to, v_scope, v_days
    from private.report_window(p_from, p_to, p_branch_id) w;
  return (
    with br as (
      select b.id, b.name,
             extract(hour from b.opens_at)::int * 60 + extract(minute from b.opens_at)::int as open_m,
             case when b.closes_at = time '00:00' or b.closes_at <= b.opens_at then 1440
                  else extract(hour from b.closes_at)::int * 60 + extract(minute from b.closes_at)::int end as close_m
        from public.branches b where b.id = any (v_scope)
    ), ct as (
      select c.id, c.name, c.branch_id, c.sort_order
        from public.courts c
       where c.branch_id = any (v_scope) and c.deleted_at is null and c.status = 'active'
    ), dows as (
      select extract(isodow from d)::int as dow, count(*)::int as n
        from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') d group by 1
    ), br_hour as (   -- số phút mở cửa trong từng giờ của mỗi chi nhánh
      select br.id as branch_id, h,
             greatest(0, least(br.close_m, h * 60 + 60) - greatest(br.open_m, h * 60)) as m
        from br cross join generate_series(0, 23) h
    ), cap as (       -- sức chứa (phút sân) theo thứ × giờ
      select dows.dow, bh.h, sum(bh.m * dows.n)::bigint as minutes
        from br_hour bh
        join ct on ct.branch_id = bh.branch_id
        cross join dows
       where bh.m > 0
       group by dows.dow, bh.h
    ), bk as (
      select b.court_id, b.branch_id, greatest(lower(b.during), v_from) as s, least(upper(b.during), v_to) as e
        from public.bookings b
        join ct on ct.id = b.court_id
       where b.branch_id = any (v_scope) and b.kind = 'customer' and b.deleted_at is null
         and b.status in ('confirmed', 'checked_in', 'completed', 'no_show')
         and b.during && tstzrange(v_from, v_to, '[)')
    ), pieces as (
      select bk.court_id, bk.branch_id, hs,
             extract(epoch from (least(bk.e, hs + interval '1 hour') - greatest(bk.s, hs))) / 60 as m
        from bk
        cross join lateral generate_series((date_trunc('hour', bk.s at time zone c_tz)) at time zone c_tz,
                                           bk.e - interval '1 second', interval '1 hour') as g(hs)
    ), used as (
      select extract(isodow from hs at time zone c_tz)::int as dow, extract(hour from hs at time zone c_tz)::int as h,
             sum(m)::bigint as minutes
        from pieces group by 1, 2
    ), court_cap as (
      select ct.id, sum(bh.m)::bigint * v_days as minutes
        from ct join br_hour bh on bh.branch_id = ct.branch_id group by ct.id
    ), court_used as (
      select court_id, sum(extract(epoch from (e - s)) / 60)::bigint as minutes, count(*) as bookings
        from bk group by court_id
    )
    select jsonb_build_object(
      'from', p_from, 'to', p_to, 'days', v_days,
      'capacity_minutes', (select coalesce(sum(minutes), 0) from cap),
      'booked_minutes', (select coalesce(sum(minutes), 0) from court_used),
      'bookings', (select count(*) from bk),
      'courts', (select count(*) from ct),
      'heatmap', coalesce((
        select jsonb_agg(jsonb_build_object('dow', cap.dow, 'h', cap.h, 'capacity', cap.minutes,
                                            'booked', least(coalesce(used.minutes, 0), cap.minutes))
                         order by cap.dow, cap.h)
          from cap left join used on used.dow = cap.dow and used.h = cap.h), '[]'::jsonb),
      'by_court', coalesce((
        select jsonb_agg(jsonb_build_object('id', ct.id, 'name', ct.name, 'branch', br.name,
                                            'capacity', coalesce(cc.minutes, 0), 'booked', coalesce(cu.minutes, 0),
                                            'bookings', coalesce(cu.bookings, 0))
                         order by br.name, ct.sort_order, ct.name)
          from ct
          join br on br.id = ct.branch_id
          left join court_cap cc on cc.id = ct.id
          left join court_used cu on cu.court_id = ct.id), '[]'::jsonb),
      'by_branch', coalesce((
        select jsonb_agg(jsonb_build_object('id', br.id, 'name', br.name,
                                            'capacity', coalesce(x.capacity, 0), 'booked', coalesce(x.booked, 0))
                         order by br.name)
          from br
          left join (
            select ct.branch_id, sum(coalesce(cc.minutes, 0)) as capacity, sum(coalesce(cu.minutes, 0)) as booked
              from ct left join court_cap cc on cc.id = ct.id left join court_used cu on cu.court_id = ct.id
             group by ct.branch_id) x on x.branch_id = br.id), '[]'::jsonb)
    ));
end;
$$;

-- 3. Khách hàng -------------------------------------------------------------------------------------------
create or replace function public.report_customers(p_from date, p_to date, p_branch_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_from timestamptz;
  v_to timestamptz;
  v_scope uuid[];
  v_days integer;
begin
  select w.w_from, w.w_to, w.w_scope, w.w_days into v_from, v_to, v_scope, v_days
    from private.report_window(p_from, p_to, p_branch_id) w;
  return (
    with b as (   -- đơn có giờ chơi trong khoảng
      select bk.* from public.bookings bk
       where bk.branch_id = any (v_scope) and bk.kind = 'customer' and bk.deleted_at is null
         and lower(bk.during) >= v_from and lower(bk.during) < v_to
    ), played as (
      select * from b where status in ('confirmed', 'checked_in', 'completed', 'no_show')
    ), cust as (
      select customer_id, count(*) as n, max(lower(during)) as last_at
        from played where customer_id is not null group by customer_id
    ), seen as (
      select c.customer_id, c.n,
             exists (select 1 from public.bookings x
                      where x.customer_id = c.customer_id and x.kind = 'customer' and x.deleted_at is null
                        and x.status in ('confirmed', 'checked_in', 'completed', 'no_show')
                        and lower(x.during) < v_from) as is_returning
        from cust c
    ), top as (
      select c.customer_id, c.n, c.last_at from cust c order by c.n desc, c.last_at desc limit 15
    )
    select jsonb_build_object(
      'from', p_from, 'to', p_to, 'days', v_days,
      'total', (select count(*) from b where status <> 'expired'),
      'played', (select count(*) from played),
      'cancelled', (select count(*) from b where status = 'cancelled'),
      'no_show', (select count(*) from b where status = 'no_show'),
      'expired_holds', (select count(*) from b where status = 'expired'),
      'by_source', coalesce((select jsonb_object_agg(source, n) from (
          select source::text as source, count(*) as n from b where status <> 'expired' group by source) s), '{}'::jsonb),
      'unique_customers', (select count(*) from seen),
      'new_customers', (select count(*) from seen where not is_returning),
      'returning_customers', (select count(*) from seen where is_returning),
      'repeat_customers', (select count(*) from seen where n >= 2),
      'walk_in_bookings', (select count(*) from played where customer_id is null),
      'lead_hours_median', (
        select round((percentile_cont(0.5) within group (order by extract(epoch from (lower(during) - created_at)) / 3600))::numeric, 1)
          from played where source = 'online' and lower(during) > created_at),
      'members_new', (select count(*) from public.member_profiles m where m.created_at >= v_from and m.created_at < v_to),
      'members_total', (select count(*) from public.member_profiles m where m.anonymized_at is null),
      'top', coalesce((
        select jsonb_agg(jsonb_build_object('id', cu.id, 'name', cu.full_name, 'bookings', t.n, 'last_at', t.last_at,
                 'spend', (select coalesce(sum(case when pm.kind = 'charge' then pm.amount else -pm.amount end), 0)
                             from public.payments pm join played pl on pl.id = pm.booking_id
                            where pl.customer_id = t.customer_id and pm.status = 'succeeded'))
                         order by t.n desc, t.last_at desc)
          from top t join public.customers cu on cu.id = t.customer_id
         where cu.anonymized_at is null), '[]'::jsonb)
    ));
end;
$$;

-- 4. Hàng hóa ---------------------------------------------------------------------------------------------
create or replace function public.report_products(p_from date, p_to date, p_branch_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_from timestamptz;
  v_to timestamptz;
  v_scope uuid[];
  v_days integer;
begin
  select w.w_from, w.w_to, w.w_scope, w.w_days into v_from, v_to, v_scope, v_days
    from private.report_window(p_from, p_to, p_branch_id) w;
  return (
    with s as (
      select * from public.sales
       where branch_id = any (v_scope) and status = 'completed' and sold_at >= v_from and sold_at < v_to
    ), sl as (
      select l.*, s.branch_id, pv.product_id, pv.cost_price,
             l.quantity * coalesce(l.unit_conversion, 1) as base_qty
        from public.sale_lines l
        join s on s.id = l.sale_id
        join public.product_variants pv on pv.id = l.variant_id
    ), by_product as (
      select pr.id, pr.name, pr.unit_label, pc.name as category,
             sum(sl.base_qty) as qty, sum(sl.line_total) as revenue, count(distinct sl.sale_id) as orders,
             sum(sl.base_qty * sl.cost_price) as cost, bool_and(sl.cost_price is not null) as cost_known
        from sl
        join public.products pr on pr.id = sl.product_id
        left join public.product_categories pc on pc.id = pr.category_id
       group by pr.id, pr.name, pr.unit_label, pc.name
    ), sold_variants as (
      select distinct branch_id, variant_id from sl
    ), slow as (
      select il.branch_id, il.variant_id, il.on_hand, pr.name, pv.size_label, pv.color_label, br.name as branch,
             (select max(s2.sold_at) from public.sale_lines l2 join public.sales s2 on s2.id = l2.sale_id
               where l2.variant_id = il.variant_id and s2.branch_id = il.branch_id and s2.status = 'completed') as last_sold_at
        from public.inventory_levels il
        join public.product_variants pv on pv.id = il.variant_id and pv.deleted_at is null and pv.is_active
        join public.products pr on pr.id = pv.product_id and pr.kind = 'sale' and pr.deleted_at is null and pr.is_active
        join public.branches br on br.id = il.branch_id
       where il.branch_id = any (v_scope) and il.is_listed and il.on_hand > 0
         and not exists (select 1 from sold_variants sv where sv.branch_id = il.branch_id and sv.variant_id = il.variant_id)
    ), r as (
      select * from public.rentals
       where branch_id = any (v_scope) and status <> 'voided' and created_at >= v_from and created_at < v_to
    )
    select jsonb_build_object(
      'from', p_from, 'to', p_to, 'days', v_days,
      'orders', (select count(*) from s),
      'revenue', (select coalesce(sum(total_amount), 0) from s),
      'discount', (select coalesce(sum(discount_amount), 0) from s),
      'items', (select coalesce(sum(base_qty), 0) from sl),
      'offline_orders', (select count(*) from s where recorded_offline),
      'top', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'unit', unit_label, 'category', category,
                         'qty', qty, 'revenue', revenue, 'orders', orders,
                         'cost', case when cost_known then cost end) order by revenue desc, name)
                         from (select * from by_product order by revenue desc, name limit 20) t), '[]'::jsonb),
      'by_category', coalesce((select jsonb_agg(jsonb_build_object('name', coalesce(category, 'Chưa phân loại'),
                                 'revenue', revenue, 'qty', qty) order by revenue desc)
                                 from (select category, sum(revenue) as revenue, sum(qty) as qty from by_product group by category) c),
                              '[]'::jsonb),
      'slow_count', (select count(*) from slow),
      'slow', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'variant', nullif(concat_ws(' / ', size_label, color_label), ''),
                          'branch', branch, 'on_hand', on_hand, 'last_sold_at', last_sold_at) order by on_hand desc, name)
                          from (select * from slow order by on_hand desc, name limit 20) x), '[]'::jsonb),
      'low_stock', (select count(*) from public.inventory_levels il
                     join public.product_variants pv on pv.id = il.variant_id and pv.deleted_at is null and pv.is_active
                     join public.products pr on pr.id = pv.product_id and pr.kind = 'sale' and pr.deleted_at is null
                    where il.branch_id = any (v_scope) and il.is_listed and il.on_hand <= il.reorder_level),
      'rentals', (select count(*) from r),
      'rental_revenue', (select coalesce(sum(case when pm.kind = 'charge' then pm.amount else -pm.amount end), 0)
                           from public.payments pm
                          where pm.branch_id = any (v_scope) and pm.rental_id is not null and pm.status = 'succeeded'
                            and pm.received_at >= v_from and pm.received_at < v_to),
      'rental_top', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'rentals', n, 'fee', fee) order by n desc, name)
                                from (select pr.name, count(*) as n, sum(r.rental_fee) as fee
                                        from r join public.products pr on pr.id = r.product_id
                                       group by pr.name order by count(*) desc, pr.name limit 10) x), '[]'::jsonb)
    ));
end;
$$;

-- 5. Két tiền (tiền mặt, thu ngân, ca, ngăn kéo) -------------------------------------------------------
create or replace function public.report_cash(p_from date, p_to date, p_branch_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c_tz constant text := 'Asia/Ho_Chi_Minh';
  v_from timestamptz;
  v_to timestamptz;
  v_scope uuid[];
  v_days integer;
begin
  select w.w_from, w.w_to, w.w_scope, w.w_days into v_from, v_to, v_scope, v_days
    from private.report_window(p_from, p_to, p_branch_id) w;
  return (
    with pay as (
      select pm.*, case when pm.kind = 'charge' then pm.amount else -pm.amount end as signed
        from public.payments pm
       where pm.branch_id = any (v_scope) and pm.status = 'succeeded' and pm.received_at >= v_from and pm.received_at < v_to
    ), cash as (select * from pay where method = 'cash'), dr as (
      select * from public.cash_drawer_events e
       where e.branch_id = any (v_scope) and e.occurred_at >= v_from and e.occurred_at < v_to
    ), offline as (
      select * from public.sales
       where branch_id = any (v_scope) and status = 'completed' and recorded_offline and sold_at >= v_from and sold_at < v_to
    ), people as (
      select recorded_by as user_id from pay where recorded_by is not null group by 1
      union select user_id from dr where user_id is not null
    ), sh as (
      select s.id, s.branch_id, s.checked_in_at as s_at,
             coalesce(s.checked_out_at, least(now(), s.scheduled_end)) as e_at,
             e.full_name, sa.user_id, br.name as branch
        from public.shifts s
        join public.employees e on e.id = s.employee_id
        join public.branches br on br.id = s.branch_id
        left join public.staff_accounts sa on sa.employee_id = s.employee_id
       where s.branch_id = any (v_scope) and s.deleted_at is null and s.checked_in_at is not null
         and s.checked_in_at >= v_from and s.checked_in_at < v_to
       order by s.checked_in_at desc
       limit 100
    )
    select jsonb_build_object(
      'from', p_from, 'to', p_to, 'days', v_days,
      'cash_in', (select coalesce(sum(amount), 0) from cash where kind = 'charge'),
      'cash_refund', (select coalesce(sum(amount), 0) from cash where kind = 'refund'),
      'cash_net', (select coalesce(sum(signed), 0) from cash),
      'non_cash_net', (select coalesce(sum(signed), 0) from pay where method <> 'cash'),
      'drawer', jsonb_build_object(
        'total', (select count(*) from dr),
        'manual', (select count(*) from dr where trigger = 'manual'),
        'sale', (select count(*) from dr where trigger = 'sale'),
        'booking_payment', (select count(*) from dr where trigger = 'booking_payment'),
        'rental', (select count(*) from dr where trigger = 'rental')),
      'offline_sales', (select count(*) from offline),
      'offline_total', (select coalesce(sum(total_amount), 0) from offline),
      'by_day', coalesce((
        select jsonb_agg(jsonb_build_object('day', d.day::date, 'cash_in', coalesce(x.cash_in, 0), 'cash_refund', coalesce(x.cash_refund, 0))
                         order by d.day)
          from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') d(day)
          left join (
            select (received_at at time zone c_tz)::date as day,
                   sum(amount) filter (where kind = 'charge') as cash_in,
                   sum(amount) filter (where kind = 'refund') as cash_refund
              from cash group by 1) x on x.day = d.day::date), '[]'::jsonb),
      'by_cashier', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'user_id', pp.user_id,
                 'name', coalesce(sa.display_name, 'Tài khoản đã xóa'),
                 'cash_in', (select coalesce(sum(amount), 0) from cash where recorded_by = pp.user_id and kind = 'charge'),
                 'cash_refund', (select coalesce(sum(amount), 0) from cash where recorded_by = pp.user_id and kind = 'refund'),
                 'cash_count', (select count(*) from cash where recorded_by = pp.user_id and kind = 'charge'),
                 'other_net', (select coalesce(sum(signed), 0) from pay where recorded_by = pp.user_id and method <> 'cash'),
                 'drawer_auto', (select count(*) from dr where dr.user_id = pp.user_id and trigger <> 'manual'),
                 'drawer_manual', (select count(*) from dr where dr.user_id = pp.user_id and trigger = 'manual'),
                 'offline_sales', (select count(*) from offline o where o.sold_by = pp.user_id))
               order by coalesce(sa.display_name, 'zzz'))
          from people pp left join public.staff_accounts sa on sa.user_id = pp.user_id), '[]'::jsonb),
      'shifts', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', sh.id, 'name', sh.full_name, 'branch', sh.branch, 'start', sh.s_at, 'end', sh.e_at,
                 'cash_in', (select coalesce(sum(amount), 0) from cash
                              where sh.user_id is not null and recorded_by = sh.user_id and branch_id = sh.branch_id
                                and kind = 'charge' and received_at >= sh.s_at and received_at < sh.e_at),
                 'cash_refund', (select coalesce(sum(amount), 0) from cash
                                  where sh.user_id is not null and recorded_by = sh.user_id and branch_id = sh.branch_id
                                    and kind = 'refund' and received_at >= sh.s_at and received_at < sh.e_at),
                 'drawer_manual', (select count(*) from dr
                                    where sh.user_id is not null and dr.user_id = sh.user_id and dr.branch_id = sh.branch_id
                                      and trigger = 'manual' and occurred_at >= sh.s_at and occurred_at < sh.e_at))
               order by sh.s_at desc)
          from sh), '[]'::jsonb),
      'manual_opens', coalesce((
        select jsonb_agg(jsonb_build_object('at', x.occurred_at, 'name', coalesce(sa.display_name, 'Tài khoản đã xóa'),
                                            'branch', br.name, 'ref', x.ref_code, 'device', x.device_label)
                         order by x.occurred_at desc)
          from (select * from dr where trigger = 'manual' order by occurred_at desc limit 50) x
          left join public.staff_accounts sa on sa.user_id = x.user_id
          join public.branches br on br.id = x.branch_id), '[]'::jsonb)
    ));
end;
$$;

revoke all on function private.report_window(date, date, uuid) from public, anon, authenticated;
revoke all on function public.report_revenue(date, date, uuid) from public, anon;
revoke all on function public.report_occupancy(date, date, uuid) from public, anon;
revoke all on function public.report_customers(date, date, uuid) from public, anon;
revoke all on function public.report_products(date, date, uuid) from public, anon;
revoke all on function public.report_cash(date, date, uuid) from public, anon;
grant execute on function public.report_revenue(date, date, uuid) to authenticated;
grant execute on function public.report_occupancy(date, date, uuid) to authenticated;
grant execute on function public.report_customers(date, date, uuid) to authenticated;
grant execute on function public.report_products(date, date, uuid) to authenticated;
grant execute on function public.report_cash(date, date, uuid) to authenticated;

commit;

notify pgrst, 'reload schema';
