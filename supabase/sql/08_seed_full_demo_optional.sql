-- =============================================================================
-- RALLY BADMINTON — 08_seed_full_demo_optional.sql   (TÙY CHỌN — dữ liệu chạy thử đầy đủ)
--
-- Chạy SAU: 00 → 01 → 02 → 04_seed_demo_optional → 05 → 06 → 07, và đã tạo tài khoản chủ sân
-- (select private.bootstrap_first_owner('email', 'Tên');).
--
-- Tạo dữ liệu theo NGÀY CHẠY SCRIPT (giờ Việt Nam):
--   * 40 khách hàng, 8 nhân viên (4 / chi nhánh) kèm mức lương
--   * Lịch ca: cả tháng trước + tháng này + hết tuần sau (có mặt / vắng / nghỉ phép, đi trễ về sớm)
--   * Bảng lương THÁNG TRƯỚC (thưởng, phạt) và CHỐT luôn — tháng này để "tạm tính"
--   * Lịch đặt sân 3 tuần: tuần trước, tuần này, tuần sau — đã chơi & thanh toán, khách bỏ không đến,
--     hủy có hoàn cọc, đang chơi, sắp tới đã cọc / chưa cọc, giữ chỗ, khóa sân bảo trì
--   * Đơn bán 3 tuần (có khách quen, giảm giá, đơn hủy hoàn kho) — trừ kho theo sổ kho
--   * Phiếu thuê 2 tuần (trả trễ có phí, hư hỏng) + vài phiếu đang thuê, một phiếu quá hạn
--
-- Chạy lại an toàn: nếu đã có nhân viên mẫu (mã NV-TD-01) thì bỏ qua toàn bộ.
-- KHÔNG chạy trên dữ liệu thật: dữ liệu mẫu không xóa cứng được (chỉ ẩn/hủy).
-- =============================================================================

begin;

-- Hàm phụ tạm thời (tự mất khi đóng kết nối) ---------------------------------------------
create or replace function pg_temp.seed_pay(
  p_booking uuid, p_sale uuid, p_rental uuid, p_kind public.payment_kind, p_method public.payment_method,
  p_amount bigint, p_at timestamptz, p_owner uuid, p_note text default null)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
  v_ref text;
begin
  if p_amount is null or p_amount <= 0 then
    return null;
  end if;
  -- Chuyển khoản/thẻ/ví bắt buộc có mã giao dịch (duy nhất) với khoản thu.
  v_ref := case
    when p_kind = 'refund' then 'HOAN' || upper(substr(md5(random()::text), 1, 10))
    when p_method = 'bank_transfer' then 'FT' || to_char(p_at, 'YYMMDD') || upper(substr(md5(random()::text), 1, 8))
    when p_method = 'card' then 'POS' || upper(substr(md5(random()::text), 1, 9))
    when p_method = 'e_wallet' then 'MOMO' || upper(substr(md5(random()::text), 1, 9))
  end;
  insert into public.payments (booking_id, sale_id, rental_id, kind, method, status, amount, reference,
                               idempotency_key, note, received_at, recorded_by, created_at)
  values (p_booking, p_sale, p_rental, p_kind, p_method, 'succeeded', p_amount, v_ref,
          'seed:' || gen_random_uuid()::text, p_note, p_at, p_owner, p_at)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function pg_temp.pick_method(p_cash numeric)
returns public.payment_method
language sql
volatile
as $$
  select case
    when r < p_cash then 'cash'::public.payment_method
    when r < p_cash + (1 - p_cash) * 0.65 then 'bank_transfer'::public.payment_method
    when r < p_cash + (1 - p_cash) * 0.9 then 'e_wallet'::public.payment_method
    else 'card'::public.payment_method end
  from (select random() as r) x;
$$;

do $seed$
declare
  v_tz constant text := 'Asia/Ho_Chi_Minh';
  v_now timestamptz := now();
  v_today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_week_start date;            -- thứ Hai tuần này
  v_prev_month date;            -- ngày 1 tháng trước
  v_this_month date;
  v_rate_from date;
  v_owner uuid;
  v_td uuid;
  v_q7 uuid;
  v_branch record;
  v_court record;
  v_day date;
  v_t integer;
  v_open integer;
  v_close integer;
  v_dur integer;
  v_p numeric;
  v_start timestamptz;
  v_end timestamptz;
  v_q record;
  v_cust uuid[];
  v_cust_names text[];
  v_ci integer;
  v_booking uuid;
  v_status text;
  v_source public.booking_source;
  v_created timestamptz;
  v_deposit_paid boolean;
  v_total integer;
  v_count_b integer := 0;
  v_count_s integer := 0;
  v_count_r integer := 0;
  v_count_sh integer := 0;
  v_emp record;
  v_emp_id uuid;
  v_shift_start timestamptz;
  v_shift_end timestamptz;
  v_break integer;
  v_r numeric;
  v_in timestamptz;
  v_out timestamptz;
  v_sale uuid;
  v_line uuid;
  v_sale_total bigint;
  v_discount bigint;
  v_n integer;
  v_k integer;
  v_qty integer;
  v_items record;
  v_var record;
  v_method public.payment_method;
  v_rental uuid;
  v_rate record;
  v_prod record;
  v_returned timestamptz;
  v_late integer;
  v_damage integer;
  v_comp record;
  v_closed_period uuid;
  v_names_first text[] := array['An','Bình','Châu','Dũng','Duy','Giang','Hà','Hải','Hạnh','Hiếu','Hoa','Hùng','Huy','Khang','Khánh','Lan','Linh','Long','Mai','Minh','My','Nam','Ngân','Ngọc','Nhân','Nhi','Phát','Phúc','Phương','Quân','Quang','Quỳnh','Sơn','Tâm','Thảo','Thắng','Thư','Trang','Trí','Tú','Tuấn','Uyên','Việt','Vy','Yến'];
  v_names_last text[] := array['Nguyễn','Trần','Lê','Phạm','Hoàng','Huỳnh','Phan','Vũ','Võ','Đặng','Bùi','Đỗ','Hồ','Ngô','Dương','Lý'];
  v_names_mid text[] := array['Văn','Thị','Minh','Ngọc','Hoàng','Thanh','Gia','Quốc','Thu','Đức','Bảo','Anh'];
  v_cancel_reasons text[] := array['Khách báo bận đột xuất','Trùng lịch công ty','Trời mưa, khách xin hủy','Khách đổi sang ngày khác','Không đủ người chơi'];
  v_notes text[] := array['Cho mượn thêm 1 quả cầu','Khách quen, đặt sân gần cửa','Cần chỗ để xe hơi','Đánh đôi nam nữ','Nhóm công ty, xuất hóa đơn sau', null, null, null, null];
begin
  -- 0. Điều kiện chạy ---------------------------------------------------------------------
  if exists (select 1 from public.employees where code = 'NV-TD-01') then
    raise notice 'Dữ liệu mẫu đầy đủ đã có (nhân viên NV-TD-01) — bỏ qua.';
    return;
  end if;
  select id into v_td from public.branches where slug = 'rally-thu-duc';
  select id into v_q7 from public.branches where slug = 'rally-quan-7';
  if v_td is null or v_q7 is null then
    raise exception 'Chưa có chi nhánh mẫu. Chạy 04_seed_demo_optional.sql trước.';
  end if;
  select user_id into v_owner from public.staff_accounts where role = 'owner' and is_active order by created_at limit 1;
  if v_owner is null then
    raise exception 'Chưa có tài khoản chủ sân. Tạo user trong Authentication rồi chạy: select private.bootstrap_first_owner(''email'', ''Tên'');';
  end if;
  if to_regclass('public.product_units') is null then
    raise exception 'Chưa chạy 05, 06, 07. Chạy đủ các file SQL trước khi tạo dữ liệu mẫu.';
  end if;

  -- Thực hiện "với tư cách chủ sân": các trigger ghi đúng người tạo; cho phép ghi chấm công kèm lý do.
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('rally.audit_reason', 'Dữ liệu mẫu', true);
  perform setseed(0.2026);

  v_week_start := v_today - (extract(isodow from v_today)::integer - 1);
  v_this_month := date_trunc('month', v_today)::date;
  v_prev_month := (v_this_month - interval '1 month')::date;

  update public.brand_settings
     set address_line = coalesce(address_line, '12 Võ Văn Ngân, TP. Thủ Đức, TP. Hồ Chí Minh'),
         tax_code = coalesce(tax_code, '0318888888')
   where id;
  -- Hàng bán có thuế VAT mặc định để thấy phần thuế trên quầy, phiếu in, chi tiết đơn.
  update public.products set taxable = true, tax_industry = 'goods'
   where kind = 'sale' and deleted_at is null and not taxable
     and name in ('Nước suối Aquafina 500ml', 'Revive chanh muối', 'Pocari Sweat 500ml',
                  'Cầu lông Thành Công (hộp 12 quả)', 'Cầu lông Yonex AS-30 (hộp 12 quả)', 'Quấn cán Yonex AC102');
  update public.products set unit_label = 'chai' where unit_label is null and name in ('Nước suối Aquafina 500ml', 'Revive chanh muối', 'Pocari Sweat 500ml');
  update public.products set unit_label = 'hộp' where unit_label is null and name like 'Cầu lông % (hộp 12 quả)';
  -- Thùng 24 chai cho nước suối (bán theo đơn vị quy đổi).
  insert into public.product_units (product_id, name, conversion, price, sort_order)
  select p.id, 'Thùng', 24, 220000, 1 from public.products p
   where p.name = 'Nước suối Aquafina 500ml' and p.deleted_at is null
     and not exists (select 1 from public.product_units u where u.product_id = p.id and u.deleted_at is null);

  -- 1. Khách hàng ---------------------------------------------------------------------------
  for v_ci in 1..40 loop
    insert into public.customers (phone, full_name, email, marketing_opt_in, staff_note, created_at)
    values (
      '09' || lpad((10000000 + v_ci * 7919 % 90000000)::text, 8, '0'),
      v_names_last[1 + (v_ci * 7) % array_length(v_names_last, 1)] || ' '
        || v_names_mid[1 + (v_ci * 5) % array_length(v_names_mid, 1)] || ' '
        || v_names_first[1 + (v_ci * 11) % array_length(v_names_first, 1)],
      case when v_ci % 4 = 0 then 'khach' || v_ci || '@vidu.vn' end,
      v_ci % 3 = 0,
      case v_ci when 1 then 'Khách VIP, thích sân 1. Đặt cố định tối thứ 3, 5.'
                when 2 then 'Hay đến trễ 10 phút, nhắc trước 1 tiếng.'
                when 7 then 'Đội công ty ABC — xuất hóa đơn VAT cuối tháng.' end,
      v_now - make_interval(days => 150 - v_ci * 3))
    on conflict (phone) do nothing;
  end loop;
  -- Danh sách theo thứ tự tạo: khách đầu danh sách là khách quen (đến nhiều, mua nhiều).
  select array_agg(c.id order by g.i), array_agg(c.full_name order by g.i)
    into v_cust, v_cust_names
    from generate_series(1, 40) as g(i)
    join public.customers c on c.phone = '09' || lpad((10000000 + g.i * 7919 % 90000000)::text, 8, '0');

  -- 2. Nhân viên + mức lương ---------------------------------------------------------------
  -- Mức lương có hiệu lực từ đầu tháng trước tháng cần chốt (không chèn vào kỳ đã chốt).
  v_rate_from := (v_prev_month - interval '1 month')::date;
  select greatest(v_rate_from, coalesce((max(month) + interval '1 month')::date, v_rate_from))
    into v_rate_from from public.payroll_periods;

  create temporary table seed_emp (
    code text, name text, phone text, branch uuid, etype public.employment_type, ptype public.pay_type, rate integer,
    days int[], start_min integer, end_min integer, start2 integer, end2 integer, id uuid
  ) on commit drop;
  -- days: thứ trong tuần đi làm (1 = thứ Hai … 7 = Chủ nhật); start/end: phút trong ngày
  insert into seed_emp values
    ('NV-TD-01', 'Nguyễn Văn An',     '0901110001', v_td, 'full_time', 'daily',  380000, '{2,3,4,5,6,7}', 360, 840, null, null, null),
    ('NV-TD-02', 'Trần Thị Bích',     '0901110002', v_td, 'full_time', 'daily',  380000, '{1,2,3,4,6,7}', 900, 1380, null, null, null),
    ('NV-TD-03', 'Lê Hoàng Minh',     '0901110003', v_td, 'part_time', 'hourly', 28000,  '{1,3,5,6}',     1020, 1380, null, null, null),
    ('NV-TD-04', 'Phạm Thu Trang',    '0901110004', v_td, 'part_time', 'hourly', 27000,  '{6,7}',         420, 720, 1020, 1320, null),
    ('NV-Q7-01', 'Võ Quốc Huy',       '0901110005', v_q7, 'full_time', 'daily',  400000, '{1,2,3,5,6,7}', 330, 810, null, null, null),
    ('NV-Q7-02', 'Đặng Ngọc Hân',     '0901110006', v_q7, 'full_time', 'daily',  400000, '{1,2,4,5,6,7}', 930, 1410, null, null, null),
    ('NV-Q7-03', 'Bùi Gia Bảo',       '0901110007', v_q7, 'part_time', 'hourly', 30000,  '{2,4,6,7}',     1020, 1320, null, null, null),
    ('NV-Q7-04', 'Huỳnh Mai Anh',     '0901110008', v_q7, 'part_time', 'hourly', 28000,  '{6,7}',         480, 960, null, null, null);

  for v_emp in select * from seed_emp loop
    insert into public.employees (code, full_name, phone, home_branch_id, employment_type, hired_on, notes)
    values (v_emp.code, v_emp.name, v_emp.phone, v_emp.branch, v_emp.etype, v_prev_month - 120,
            case v_emp.etype when 'full_time' then 'Toàn thời gian, nghỉ 1 ngày/tuần.' else 'Bán thời gian theo lịch đăng ký.' end)
    returning id into v_emp_id;
    update seed_emp set id = v_emp_id where code = v_emp.code;
    insert into public.employee_pay_rates (employee_id, pay_type, hourly_rate, daily_rate, standard_day_minutes, effective_from, note, created_by)
    values (v_emp_id, v_emp.ptype,
            case when v_emp.ptype = 'hourly' then v_emp.rate end,
            case when v_emp.ptype = 'daily' then v_emp.rate end,
            480, v_rate_from, 'Mức lương mẫu', v_owner);
  end loop;

  -- 3. Lịch ca: từ đầu tháng trước đến hết tuần sau ----------------------------------------
  for v_emp in select * from seed_emp loop
    for v_day in select generate_series(v_prev_month, v_week_start + 13, interval '1 day')::date loop
      continue when not (extract(isodow from v_day)::integer = any (v_emp.days));
      continue when private.payroll_month_closed(v_day);
      for v_k in 1..(case when v_emp.start2 is null then 1 else 2 end) loop
        v_shift_start := (v_day + make_interval(mins => case v_k when 1 then v_emp.start_min else v_emp.start2 end))::timestamp at time zone v_tz;
        v_shift_end := (v_day + make_interval(mins => case v_k when 1 then v_emp.end_min else v_emp.end2 end))::timestamp at time zone v_tz;
        v_break := case when v_shift_end - v_shift_start >= interval '8 hours' then 30 else 0 end;
        if v_shift_end <= v_now then
          v_r := random();
          if v_r < 0.04 then
            insert into public.shifts (employee_id, branch_id, scheduled_start, scheduled_end, break_minutes, status, note, created_by, created_at)
            values (v_emp.id, v_emp.branch, v_shift_start, v_shift_end, v_break, 'absent', 'Vắng không báo trước', v_owner, v_shift_start - interval '7 days');
          elsif v_r < 0.08 then
            insert into public.shifts (employee_id, branch_id, scheduled_start, scheduled_end, break_minutes, status, note, created_by, created_at)
            values (v_emp.id, v_emp.branch, v_shift_start, v_shift_end, v_break, 'leave', 'Nghỉ phép có báo', v_owner, v_shift_start - interval '7 days');
          else
            -- Có mặt: vào ca lệch -8..+15 phút (đôi khi trễ), ra ca -5..+25 phút.
            v_in := v_shift_start + make_interval(mins => (floor(random() * 24) - 8)::integer);
            v_out := v_shift_end + make_interval(mins => (floor(random() * 31) - 5)::integer);
            v_out := greatest(v_in + interval '1 hour', least(v_out, v_now - interval '1 minute'));
            insert into public.shifts (employee_id, branch_id, scheduled_start, scheduled_end, break_minutes, status,
                                       checked_in_at, checked_out_at, actual_break_minutes, note, created_by, created_at)
            values (v_emp.id, v_emp.branch, v_shift_start, v_shift_end, v_break, 'present', v_in, v_out, v_break,
                    case when v_in > v_shift_start + interval '5 minutes' then 'Đi trễ' end, v_owner, v_shift_start - interval '7 days');
          end if;
        elsif v_shift_start <= v_now then
          -- Đang trong ca: đã quét QR vào ca.
          insert into public.shifts (employee_id, branch_id, scheduled_start, scheduled_end, break_minutes, status, checked_in_at, created_by, created_at)
          values (v_emp.id, v_emp.branch, v_shift_start, v_shift_end, v_break, 'scheduled', v_shift_start + interval '3 minutes', v_owner, v_shift_start - interval '7 days');
        else
          insert into public.shifts (employee_id, branch_id, scheduled_start, scheduled_end, break_minutes, status, created_by, created_at)
          values (v_emp.id, v_emp.branch, v_shift_start, v_shift_end, v_break, 'scheduled', v_owner, least(v_now, v_shift_start - interval '7 days'));
        end if;
        v_count_sh := v_count_sh + 1;
      end loop;
    end loop;
  end loop;

  -- 4. Thưởng / phạt tháng trước rồi chốt lương ---------------------------------------------
  if not private.payroll_month_closed(v_prev_month) then
    insert into public.payroll_adjustments (employee_id, month, amount, reason, created_by)
    select id, v_prev_month, 300000, 'Thưởng chuyên cần', v_owner from seed_emp where code in ('NV-TD-01', 'NV-Q7-01')
    union all
    select id, v_prev_month, 200000, 'Thưởng doanh số bán nước', v_owner from seed_emp where code = 'NV-TD-02'
    union all
    select id, v_prev_month, -50000, 'Đi trễ 3 lần trong tháng', v_owner from seed_emp where code = 'NV-TD-03'
    union all
    select id, v_prev_month, 150000, 'Phụ cấp xăng xe', v_owner from seed_emp where code = 'NV-Q7-02';
    begin
      v_closed_period := public.close_payroll_month(v_prev_month);
      raise notice 'Đã chốt bảng lương tháng %.', to_char(v_prev_month, 'MM/YYYY');
    exception when others then
      raise notice 'Chưa chốt được bảng lương tháng % (%): vào Bảng lương để xử lý ca còn dở rồi chốt.',
        to_char(v_prev_month, 'MM/YYYY'), sqlerrm;
    end;
  end if;
  -- Tháng này: một khoản ứng lương để màn "tạm tính" có điều chỉnh.
  insert into public.payroll_adjustments (employee_id, month, amount, reason, created_by)
  select id, v_this_month, -500000, 'Ứng lương giữa tháng', v_owner from seed_emp where code = 'NV-Q7-01';

  -- 5. Lịch đặt sân: tuần trước, tuần này, tuần sau ------------------------------------------
  for v_court in
    select c.id, c.branch_id, c.name, b.opens_at, b.closes_at, b.slot_minutes, b.free_cancel_hours
      from public.courts c join public.branches b on b.id = c.branch_id
     where c.branch_id in (v_td, v_q7) and c.status = 'active' and c.deleted_at is null
     order by c.branch_id, c.sort_order
  loop
    v_open := extract(hour from v_court.opens_at)::integer * 60 + extract(minute from v_court.opens_at)::integer;
    v_close := extract(hour from v_court.closes_at)::integer * 60 + extract(minute from v_court.closes_at)::integer;
    if v_close = 0 then v_close := 1440; end if;
    for v_day in select generate_series(v_week_start - 7, v_week_start + 13, interval '1 day')::date loop
      v_t := v_open;
      while v_t + 60 <= v_close loop
        -- Tối và cuối tuần đông hơn.
        v_p := case when v_t >= 17 * 60 then 0.62 when v_t < 8 * 60 then 0.30 else 0.20 end
               + case when extract(isodow from v_day) >= 6 then 0.18 else 0 end;
        if random() >= v_p then
          v_t := v_t + 60;
          continue;
        end if;
        v_dur := case when random() < 0.55 then 60 when random() < 0.8 then 120 else 90 end;
        if v_t + v_dur > v_close then
          v_dur := 60;
        end if;
        exit when v_t + v_dur > v_close;
        v_start := (v_day + make_interval(mins => v_t))::timestamp at time zone v_tz;
        v_end := v_start + make_interval(mins => v_dur);
        v_t := v_t + v_dur + case when random() < 0.3 then 30 else 0 end;

        select * into v_q from private.quote_court_price(v_court.id, tstzrange(v_start, v_end, '[)'));
        v_ci := 1 + floor(power(random(), 1.5) * array_length(v_cust, 1))::integer;
        v_source := case when random() < 0.55 then 'online'::public.booking_source else 'counter'::public.booking_source end;
        v_created := least(v_now - interval '10 minutes', v_start - make_interval(hours => 2 + floor(random() * 96)::integer));

        -- Kết cục
        if v_end <= v_now then
          v_r := random();
          v_status := case when v_r < 0.80 then 'completed' when v_r < 0.89 then 'no_show' else 'cancelled' end;
        elsif v_start <= v_now then
          v_status := 'checked_in';
        else
          v_r := random();
          v_status := case when v_r < 0.84 then 'confirmed'
                           when v_r < 0.90 and v_start < v_now + interval '2 days' then 'held'
                           else 'cancelled' end;
        end if;

        begin
          insert into public.bookings (branch_id, court_id, kind, source, status, during, customer_id, contact_name,
                                       hold_expires_at, subtotal_amount, discount_amount, deposit_amount, price_snapshot,
                                       customer_note, internal_note, created_by, created_at)
          values (v_court.branch_id, v_court.id, 'customer', v_source,
                  case when v_status = 'held' then 'held'::public.booking_status else 'confirmed'::public.booking_status end,
                  tstzrange(v_start, v_end, '[)'), v_cust[v_ci], v_cust_names[v_ci],
                  case when v_status = 'held' then v_now + interval '9 minutes' end,
                  v_q.total_amount, 0, v_q.deposit_amount, v_q.breakdown,
                  case when v_source = 'online' then v_notes[1 + floor(random() * array_length(v_notes, 1))::integer] end,
                  case when v_source = 'counter' and random() < 0.2 then 'Khách gọi điện đặt' end,
                  case when v_source = 'counter' then v_owner end, v_created)
          returning id, total_amount into v_booking, v_total;
        exception when exclusion_violation then
          continue;  -- trùng lịch sẵn có trong hệ thống: bỏ qua
        end;

        -- Tiền cọc: khách online chuyển khoản cọc khi đặt; tại quầy thường trả khi đến.
        v_deposit_paid := v_status <> 'held'
                          and ((v_source = 'online' and random() < 0.9) or (v_source = 'counter' and random() < 0.25));
        if v_deposit_paid then
          perform pg_temp.seed_pay(v_booking, null, null, 'charge', 'bank_transfer', v_q.deposit_amount,
                                   v_created + interval '15 minutes', v_owner, 'Tiền cọc');
        end if;

        if v_status in ('checked_in', 'completed') then
          update public.bookings set status = 'checked_in' where id = v_booking;
          if v_status = 'completed' then
            update public.bookings set status = 'completed' where id = v_booking;
          end if;
          perform pg_temp.seed_pay(v_booking, null, null, 'charge', pg_temp.pick_method(0.55),
                                   v_total - case when v_deposit_paid then v_q.deposit_amount else 0 end,
                                   v_start - interval '5 minutes', v_owner,
                                   case when v_deposit_paid then 'Thu phần còn lại' else 'Thu đủ tại quầy' end);
          update public.bookings
             set confirmed_at = v_created + interval '20 minutes',
                 checked_in_at = v_start - interval '5 minutes',
                 completed_at = case when v_status = 'completed' then v_end end,
                 status_changed_at = case when v_status = 'completed' then v_end else v_start - interval '5 minutes' end
           where id = v_booking;
        elsif v_status = 'no_show' then
          update public.bookings set status = 'no_show', status_reason = 'Khách không đến, không báo trước' where id = v_booking;
          update public.bookings
             set confirmed_at = v_created + interval '20 minutes', status_changed_at = v_start + interval '30 minutes',
                 internal_note = 'Giữ tiền cọc theo chính sách'
           where id = v_booking;
        elsif v_status = 'cancelled' then
          update public.bookings
             set status = 'cancelled',
                 status_reason = v_cancel_reasons[1 + floor(random() * array_length(v_cancel_reasons, 1))::integer],
                 refund_entitlement = case when v_deposit_paid then v_q.deposit_amount else 0 end
           where id = v_booking;
          if v_deposit_paid then
            perform pg_temp.seed_pay(v_booking, null, null, 'refund', 'bank_transfer', v_q.deposit_amount,
                                     least(v_now, v_created + interval '1 day'), v_owner, 'Hoàn cọc do hủy trước 24 giờ');
          end if;
          update public.bookings
             set confirmed_at = v_created + interval '20 minutes',
                 cancelled_at = least(v_now - interval '1 minute', v_created + interval '1 day'),
                 status_changed_at = least(v_now - interval '1 minute', v_created + interval '1 day')
           where id = v_booking;
        elsif v_status = 'confirmed' then
          update public.bookings set confirmed_at = v_created + interval '20 minutes', status_changed_at = v_created + interval '20 minutes'
           where id = v_booking;
        end if;
        v_count_b := v_count_b + 1;
      end loop;
    end loop;
  end loop;

  -- Khóa sân bảo trì tuần sau (mỗi chi nhánh một sân, buổi sáng thứ Ba).
  for v_court in
    select distinct on (c.branch_id) c.id, c.branch_id from public.courts c
     where c.branch_id in (v_td, v_q7) and c.status = 'active' and c.deleted_at is null
     order by c.branch_id, c.sort_order desc
  loop
    begin
      insert into public.bookings (branch_id, court_id, kind, source, status, during, internal_note, created_by, created_at)
      values (v_court.branch_id, v_court.id, 'block', 'system', 'confirmed',
              tstzrange(((v_week_start + 8) + time '08:00')::timestamp at time zone v_tz,
                        ((v_week_start + 8) + time '11:00')::timestamp at time zone v_tz, '[)'),
              'Bảo trì: thay thảm và căng lại lưới', v_owner, v_now);
    exception when exclusion_violation then
      null;
    end;
  end loop;

  -- 6. Đơn bán 3 tuần ------------------------------------------------------------------------
  -- Nhập hàng đầu kỳ để đủ bán (ghi sổ kho, không sửa tồn trực tiếp).
  insert into public.stock_movements (branch_id, variant_id, quantity_delta, reason, note, created_by, created_at)
  select il.branch_id, il.variant_id, 240, 'purchase', 'Nhập hàng (dữ liệu mẫu)', v_owner,
         ((v_week_start - 8) + time '07:00')::timestamp at time zone v_tz
    from public.inventory_levels il
    join public.product_variants v on v.id = il.variant_id and v.deleted_at is null
    join public.products p on p.id = v.product_id and p.kind = 'sale' and p.deleted_at is null
   where il.branch_id in (v_td, v_q7);

  create temporary table seed_items on commit drop as
  select il.branch_id, v.id as variant_id, p.name, p.unit_label,
         nullif(concat_ws(' / ', v.size_label, v.color_label), '') as label,
         coalesce(v.price_override, p.base_price) as price
    from public.inventory_levels il
    join public.product_variants v on v.id = il.variant_id and v.is_active and v.deleted_at is null
    join public.products p on p.id = v.product_id and p.kind = 'sale' and p.is_active and p.deleted_at is null
   where il.branch_id in (v_td, v_q7) and coalesce(v.price_override, p.base_price) is not null;

  for v_branch in select id from public.branches where id in (v_td, v_q7) loop
    for v_day in select generate_series(v_week_start - 14, v_today, interval '1 day')::date loop
      for v_k in 1..(case when v_branch.id = v_td then 6 else 4 end
                     + floor(random() * 5)::integer
                     + case when extract(isodow from v_day) >= 6 then 3 else 0 end) loop
        v_start := (v_day + make_interval(mins => 420 + floor(random() * 900)::integer))::timestamp at time zone v_tz;
        continue when v_start > v_now - interval '5 minutes';
        v_ci := 1 + floor(power(random(), 1.5) * array_length(v_cust, 1))::integer;
        insert into public.sales (branch_id, customer_id, subtotal_amount, discount_amount, note, idempotency_key, sold_by, sold_at)
        values (v_branch.id, case when random() < 0.35 then v_cust[v_ci] end, 0, 0,
                case when random() < 0.05 then 'Khách lấy thêm đá lạnh' end,
                'seed-sale-' || gen_random_uuid()::text, v_owner, v_start)
        returning id into v_sale;
        v_sale_total := 0;
        v_n := 1 + floor(random() * random() * 3.5)::integer;
        for v_var in
          select * from seed_items where branch_id = v_branch.id order by random() limit v_n
        loop
          v_qty := case when v_var.price >= 200000 then 1 else 1 + floor(random() * random() * 4)::integer end;
          insert into public.sale_lines (sale_id, variant_id, product_name, variant_label, quantity, unit_price, unit_name)
          values (v_sale, v_var.variant_id, v_var.name, v_var.label, v_qty, v_var.price, v_var.unit_label)
          returning id into v_line;
          insert into public.stock_movements (branch_id, variant_id, quantity_delta, reason, sale_line_id, created_by, created_at)
          values (v_branch.id, v_var.variant_id, -v_qty, 'sale', v_line, v_owner, v_start);
          v_sale_total := v_sale_total + v_qty * v_var.price;
        end loop;
        v_discount := case when v_sale_total >= 300000 and random() < 0.25 then round(v_sale_total * 0.05 / 1000) * 1000 else 0 end;
        update public.sales set subtotal_amount = v_sale_total, discount_amount = v_discount where id = v_sale;
        v_method := pg_temp.pick_method(0.6);
        perform pg_temp.seed_pay(null, v_sale, null, 'charge', v_method, v_sale_total - v_discount, v_start, v_owner);

        -- Một ít đơn bị hủy: hoàn kho, hủy thanh toán.
        if random() < 0.03 then
          insert into public.stock_movements (branch_id, variant_id, quantity_delta, reason, sale_line_id, note, created_by, created_at)
          select v_branch.id, sl.variant_id, sl.quantity, 'sale_void', sl.id, 'Khách trả lại hàng', v_owner, v_start + interval '10 minutes'
            from public.sale_lines sl where sl.sale_id = v_sale;
          update public.payments
             set status = 'voided', voided_at = v_start + interval '10 minutes', voided_by = v_owner, void_reason = 'Khách trả lại hàng'
           where sale_id = v_sale;
          update public.sales
             set status = 'voided', voided_at = v_start + interval '10 minutes', voided_by = v_owner, void_reason = 'Khách trả lại hàng'
           where id = v_sale;
        end if;
        v_count_s := v_count_s + 1;
      end loop;
    end loop;
  end loop;

  -- 7. Cho thuê: 2 tuần đã trả + đang thuê hôm nay ----------------------------------------------
  for v_branch in select id from public.branches where id in (v_td, v_q7) loop
    for v_day in select generate_series(v_today - 13, v_today, interval '1 day')::date loop
      for v_k in 1..(1 + floor(random() * 3)::integer + case when extract(isodow from v_day) >= 6 then 2 else 0 end) loop
        -- Món thuê có tồn ở chi nhánh (combo: đủ thành phần).
        select p.id, p.name, p.is_bundle,
               (select v.id from public.product_variants v
                  join public.inventory_levels il on il.variant_id = v.id and il.branch_id = v_branch.id
                 where v.product_id = p.id and v.is_active and v.deleted_at is null and il.on_hand > 0
                 order by random() limit 1) as variant_id
          into v_prod
          from public.products p
         where p.kind = 'rental' and p.is_active and p.deleted_at is null
           and exists (select 1 from public.rental_rates r where r.product_id = p.id and r.is_active)
           and (p.is_bundle
                or exists (select 1 from public.product_variants v
                             join public.inventory_levels il on il.variant_id = v.id and il.branch_id = v_branch.id
                            where v.product_id = p.id and il.on_hand > 0))
           and (not p.is_bundle or not exists (
                 select 1 from public.bundle_components bc
                  left join public.inventory_levels il on il.variant_id = bc.component_variant_id and il.branch_id = v_branch.id
                  where bc.bundle_product_id = p.id and coalesce(il.on_hand, 0) < bc.quantity))
         order by random() limit 1;
        continue when v_prod.id is null;
        select * into v_rate from public.rental_rates where product_id = v_prod.id and is_active order by random() limit 1;

        v_start := (v_day + make_interval(mins => 420 + floor(random() * 840)::integer))::timestamp at time zone v_tz;
        continue when v_start > v_now - interval '20 minutes';
        v_ci := 1 + floor(power(random(), 1.5) * array_length(v_cust, 1))::integer;
        v_returned := v_start + make_interval(mins => v_rate.duration_minutes + (floor(random() * 60) - 20)::integer);
        v_late := case when v_returned > v_start + make_interval(mins => v_rate.duration_minutes + 15)
                       then case when v_returned > v_start + make_interval(mins => v_rate.duration_minutes + 30) then 20000 else 10000 end
                       else 0 end;
        v_damage := case when v_count_r % 25 = 7 then 50000 else 0 end;

        insert into public.rentals (branch_id, customer_id, product_id, rate_label, duration_minutes, unit_price, quantity,
                                    starts_at, due_at, note, idempotency_key, created_by, created_at)
        values (v_branch.id, v_cust[v_ci], v_prod.id, v_rate.label, v_rate.duration_minutes, v_rate.price, 1,
                v_start, v_start + make_interval(mins => v_rate.duration_minutes),
                case when random() < 0.1 then 'Khách để lại CCCD' end,
                'seed-rent-' || gen_random_uuid()::text, v_owner, v_start)
        returning id into v_rental;

        for v_comp in
          select x.variant_id, sum(x.qty)::integer as qty from (
            select bc.component_variant_id as variant_id, bc.quantity as qty
              from public.bundle_components bc where v_prod.is_bundle and bc.bundle_product_id = v_prod.id
            union all
            select v_prod.variant_id, 1 where not v_prod.is_bundle
          ) x group by x.variant_id order by x.variant_id
        loop
          insert into public.rental_lines (rental_id, variant_id, quantity) values (v_rental, v_comp.variant_id, v_comp.qty)
          returning id into v_line;
          insert into public.stock_movements (branch_id, variant_id, quantity_delta, reason, rental_line_id, created_by, created_at)
          values (v_branch.id, v_comp.variant_id, -v_comp.qty, 'rental_out', v_line, v_owner, v_start);
        end loop;
        perform pg_temp.seed_pay(null, null, v_rental, 'charge', pg_temp.pick_method(0.7), v_rate.price, v_start, v_owner, 'Tiền thuê');

        -- Phiếu bắt đầu trong 3 giờ gần đây (hôm nay) để "đang thuê"; còn lại đã trả.
        if v_day = v_today and v_start > v_now - interval '3 hours' then
          null;
        else
          if v_returned > v_now then
            v_returned := v_now - interval '5 minutes';
            v_late := 0;
          end if;
          for v_comp in select * from public.rental_lines where rental_id = v_rental order by variant_id loop
            if v_damage > 0 and v_comp.quantity = 1 and v_comp.variant_id = (select min(variant_id::text)::uuid from public.rental_lines where rental_id = v_rental) then
              update public.rental_lines set damaged_quantity = 1 where id = v_comp.id;
            else
              update public.rental_lines set returned_quantity = v_comp.quantity where id = v_comp.id;
              insert into public.stock_movements (branch_id, variant_id, quantity_delta, reason, rental_line_id, created_by, created_at)
              values (v_branch.id, v_comp.variant_id, v_comp.quantity, 'rental_return', v_comp.id, v_owner, v_returned);
            end if;
          end loop;
          update public.rentals
             set status = 'returned', returned_at = v_returned, returned_by = v_owner, late_fee = v_late, damage_fee = v_damage,
                 note = case when v_damage > 0 then 'Vợt gãy khung, thu phí sửa' when v_late > 0 then 'Trả trễ' else note end
           where id = v_rental;
          perform pg_temp.seed_pay(null, null, v_rental, 'charge', 'cash', v_late + v_damage, v_returned, v_owner, 'Phí trả trễ / hư hỏng');
        end if;
        v_count_r := v_count_r + 1;
      end loop;
    end loop;
  end loop;

  -- Một phiếu quá hạn chưa trả (để thấy cảnh báo quá giờ).
  select p.id, p.name, (select v.id from public.product_variants v
                          join public.inventory_levels il on il.variant_id = v.id and il.branch_id = v_td
                         where v.product_id = p.id and il.on_hand > 0 order by v.sort_order limit 1) as variant_id
    into v_prod
    from public.products p where p.kind = 'rental' and not p.is_bundle and p.is_active and p.deleted_at is null
   order by p.name limit 1;
  select * into v_rate from public.rental_rates where product_id = v_prod.id and is_active order by duration_minutes limit 1;
  if v_prod.variant_id is not null and v_rate.id is not null then
    v_start := v_now - make_interval(mins => v_rate.duration_minutes + 50);
    insert into public.rentals (branch_id, customer_id, product_id, rate_label, duration_minutes, unit_price, quantity,
                                starts_at, due_at, note, idempotency_key, created_by, created_at)
    values (v_td, v_cust[2], v_prod.id, v_rate.label, v_rate.duration_minutes, v_rate.price, 1,
            v_start, v_start + make_interval(mins => v_rate.duration_minutes), 'Đã gọi nhắc khách trả',
            'seed-rent-' || gen_random_uuid()::text, v_owner, v_start)
    returning id into v_rental;
    insert into public.rental_lines (rental_id, variant_id, quantity) values (v_rental, v_prod.variant_id, 1) returning id into v_line;
    insert into public.stock_movements (branch_id, variant_id, quantity_delta, reason, rental_line_id, created_by, created_at)
    values (v_td, v_prod.variant_id, -1, 'rental_out', v_line, v_owner, v_start);
    perform pg_temp.seed_pay(null, null, v_rental, 'charge', 'cash', v_rate.price, v_start, v_owner, 'Tiền thuê');
    v_count_r := v_count_r + 1;
  end if;

  raise notice 'Xong: % lượt đặt sân, % đơn bán, % phiếu thuê, % ca làm, 8 nhân viên, 40 khách.',
    v_count_b, v_count_s, v_count_r, v_count_sh;
end
$seed$;

commit;
