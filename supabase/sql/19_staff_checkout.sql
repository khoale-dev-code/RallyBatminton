-- =============================================================================
-- RALLY BADMINTON — 19_staff_checkout.sql
-- Tài khoản nhân viên + thu tiền tại quầy bằng chuyển khoản SePay.
--
-- Chạy SAU 00 → 18. Chạy lại an toàn.
--
--   * shift_people: tên đồng nghiệp trên lịch ca cho nhân viên có quyền xem lịch chi nhánh (chỉ tên + mã, không SĐT).
--   * my_month_summary: tổng quan tháng của chính nhân viên (lương tạm tính, giờ công, đi trễ, tăng ca, thưởng, phạt).
--   * Bán hàng chuyển khoản: record_sale tạo khoản thu "chờ chuyển khoản" kèm mã nội dung RB…, SePay báo tiền về
--     là khoản thu tự thành "đã thu". Nhân viên đổi sang tiền mặt / hủy đơn chờ khi khách không chuyển.
--   * Thu tiền sân: dùng mã đơn đặt sân làm nội dung chuyển khoản (đã có từ 15_sepay_deposit.sql).
-- =============================================================================

begin;

-- 1. Tên đồng nghiệp trên lịch ca ------------------------------------------------------------
-- Bảng employees chỉ cho nhân viên đọc hồ sơ của chính mình (có SĐT, ghi chú…). Lịch ca chỉ cần tên.
create or replace function public.shift_people(p_branch_id uuid, p_from date, p_to date)
returns table (employee_id uuid, code text, full_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct e.id, e.code, e.full_name
    from public.shifts s
    join public.employees e on e.id = s.employee_id
   where s.branch_id = p_branch_id
     and s.work_date between p_from and p_to
     and s.deleted_at is null
     and p_to - p_from <= 62
     and ((select private.is_owner()) or (select private.staff_can(p_branch_id, 'shift.view_branch')));
$$;
revoke all on function public.shift_people(uuid, date, date) from public, anon;
grant execute on function public.shift_people(uuid, date, date) to authenticated;

-- 2. Tổng quan tháng của nhân viên -----------------------------------------------------------
-- Đi trễ: quét QR vào ca sau giờ vào ca hơn 5 phút. Lương tạm tính dùng đúng công thức chốt lương (18_overtime.sql).
create or replace function public.my_month_summary(p_month date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_emp uuid := private.current_employee_id();
  v_next date;
  v_result jsonb;
begin
  if v_emp is null then
    perform private.raise_error('STAFF_NOT_ALLOWED');
  end if;
  if p_month is null or p_month <> date_trunc('month', p_month)::date then
    perform private.raise_error('INVALID_MONTH');
  end if;
  v_next := (p_month + interval '1 month')::date;
  with s as (
    select sh.*, r.pay_type, r.hourly_rate, r.daily_rate, r.standard_day_minutes, r.id as rate_id,
           o.minutes as ot_approved, o.hourly_rate as ot_rate,
           private.overtime_worked_minutes(sh.checked_in_at, sh.checked_out_at, sh.scheduled_end, o.minutes, sh.paid_minutes) as ot
      from public.shifts sh
      left join lateral (
        select pr.* from public.employee_pay_rates pr
         where pr.employee_id = sh.employee_id and pr.effective_from <= sh.work_date
         order by pr.effective_from desc limit 1) r on true
      left join lateral (
        select ov.minutes, ov.hourly_rate from public.shift_overtime ov
         where ov.shift_id = sh.id and ov.status = 'accepted' limit 1) o on true
     where sh.employee_id = v_emp and sh.work_date >= p_month and sh.work_date < v_next and sh.deleted_at is null
  ), calc as (
    select
      count(*) filter (where status = 'present') as shifts_done,
      count(*) filter (where status = 'scheduled' and scheduled_start > now()) as shifts_upcoming,
      coalesce(sum(extract(epoch from (scheduled_end - scheduled_start)) / 60 - break_minutes)
               filter (where status = 'scheduled' and scheduled_start > now()), 0)::integer as upcoming_minutes,
      count(*) filter (where status = 'absent') as absent_count,
      count(*) filter (where status = 'leave') as leave_count,
      coalesce(sum(paid_minutes), 0)::integer as paid_minutes,
      count(*) filter (where checked_in_at > scheduled_start + interval '5 minutes') as late_count,
      coalesce(sum(greatest(0, floor(extract(epoch from (checked_in_at - scheduled_start)) / 60)))
               filter (where checked_in_at > scheduled_start + interval '5 minutes'), 0)::integer as late_minutes,
      count(*) filter (where status = 'present' and ot > 0) as overtime_count,
      coalesce(sum(ot) filter (where status = 'present'), 0)::integer as overtime_minutes,
      coalesce(sum(round(coalesce(ot_rate, 0)::numeric * ot / 60)) filter (where status = 'present'), 0)::bigint as overtime_pay,
      coalesce(sum(case
        when status <> 'present' or rate_id is null then 0
        when pay_type = 'hourly' then round(hourly_rate::numeric * (paid_minutes - ot) / 60)
        else round(daily_rate::numeric * (paid_minutes - ot) / standard_day_minutes) end), 0)::bigint as regular_pay,
      count(*) filter (where status = 'present' and rate_id is null) as missing_rate
    from s
  ), adj as (
    select coalesce(sum(amount) filter (where amount > 0), 0)::bigint as bonus,
           coalesce(-sum(amount) filter (where amount < 0), 0)::bigint as penalty,
           coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'amount', a.amount, 'reason', a.reason, 'created_at', a.created_at)
                              order by a.created_at desc), '[]'::jsonb) as items
      from public.payroll_adjustments a
     where a.employee_id = v_emp and a.month = p_month and a.voided_at is null
  )
  select jsonb_build_object(
           'month', p_month,
           'closed', private.payroll_month_closed(p_month),
           'shifts_done', c.shifts_done, 'shifts_upcoming', c.shifts_upcoming, 'upcoming_minutes', c.upcoming_minutes,
           'absent_count', c.absent_count, 'leave_count', c.leave_count,
           'paid_minutes', c.paid_minutes, 'late_count', c.late_count, 'late_minutes', c.late_minutes,
           'overtime_count', c.overtime_count, 'overtime_minutes', c.overtime_minutes, 'overtime_pay', c.overtime_pay,
           'regular_pay', c.regular_pay, 'bonus', a.bonus, 'penalty', a.penalty,
           'net_pay', c.regular_pay + c.overtime_pay + a.bonus - a.penalty,
           'missing_rate', c.missing_rate, 'adjustments', a.items,
           'pending_overtime', (select count(*) from public.shift_overtime ov join public.shifts sh on sh.id = ov.shift_id
                                 where ov.employee_id = v_emp and ov.status = 'pending'
                                   and sh.scheduled_end + make_interval(mins => ov.minutes) > now()))
    into v_result
    from calc c cross join adj a;
  return v_result;
end;
$$;
revoke all on function public.my_month_summary(date) from public, anon;
grant execute on function public.my_month_summary(date) to authenticated;

-- 2b. Giao dịch ngân hàng có thể khớp đơn bán (không chỉ đơn đặt sân) -------------------------------
alter table public.bank_transactions add column if not exists sale_id uuid references public.sales (id);
create index if not exists bank_txn_sale_idx on public.bank_transactions (sale_id) where sale_id is not null;
alter table public.bank_transactions drop constraint if exists bank_txn_matched_fields;
alter table public.bank_transactions add constraint bank_txn_matched_fields
  check (status <> 'matched' or ((booking_id is not null or sale_id is not null) and payment_id is not null));

-- 3. Mã nội dung chuyển khoản cho khoản thu tại quầy ------------------------------------------------
-- Dùng cùng dạng mã đơn đặt sân (RB + 8 ký tự) để khớp cấu trúc mã thanh toán đã khai báo ở SePay.
create or replace function private.new_transfer_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_code text;
begin
  loop
    v_code := replace(private.random_code('RB'), '-', '');
    exit when not exists (select 1 from public.bookings where replace(code, '-', '') = v_code)
          and not exists (select 1 from public.payments where upper(replace(reference, '-', '')) = v_code);
  end loop;
  return v_code;
end;
$$;

-- 4. Ghi tiền chuyển khoản SePay vào khoản thu đang chờ (đơn bán) -------------------------------------
create or replace function private.apply_transfer_intent(p_txn_id uuid, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.bank_transactions;
  p public.payments;
  v_sale_code text;
  v_status text;
  v_note text;
begin
  select * into t from public.bank_transactions where id = p_txn_id for update;
  select * into p from public.payments
   where method = 'bank_transfer' and status = 'pending' and kind = 'charge'
     and upper(replace(reference, '-', '')) = upper(replace(p_code, '-', ''))
   for update;
  if not found then
    return null;
  end if;
  select s.code into v_sale_code from public.sales s where s.id = p.sale_id;
  if t.amount < p.amount then
    v_status := 'review';
    v_note := format('Đơn bán %s: khách chuyển %s đ, thiếu %s đ — thu thêm hoặc hoàn tiền.', coalesce(v_sale_code, ''), t.amount, p.amount - t.amount);
  else
    perform private.set_audit_reason('sepay: ' || t.provider_txn_id);
    update public.payments
       set status = 'succeeded',
           note = left(concat_ws(' · ', nullif(note, ''), format('SePay #%s', t.provider_txn_id)), 300)
     where id = p.id;
    v_status := case when t.amount > p.amount then 'review' else 'matched' end;
    v_note := case when t.amount > p.amount
                   then format('Đơn bán %s: đã nhận đủ, khách chuyển dư %s đ — cần hoàn phần dư.', coalesce(v_sale_code, ''), t.amount - p.amount)
                   else format('Đã nhận tiền đơn bán %s.', coalesce(v_sale_code, '')) end;
  end if;
  update public.bank_transactions
     set status = v_status, status_note = left(v_note, 300), branch_id = p.branch_id, sale_id = p.sale_id,
         payment_id = case when v_status = 'matched' or t.amount >= p.amount then p.id else payment_id end
   where id = t.id;
  return jsonb_build_object('status', v_status, 'note', v_note, 'payment_id', p.id, 'sale_id', p.sale_id);
end;
$$;

-- 5. SePay: thêm khớp mã chuyển khoản của đơn bán -----------------------------------------------------
create or replace function public.record_sepay_transaction(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_txn_id text := nullif(btrim(p_payload ->> 'id'), '');
  v_type text := lower(coalesce(p_payload ->> 'transferType', ''));
  v_amount bigint;
  v_at timestamptz;
  v_code text;
  v_booking uuid;
  v_intent jsonb;
  v_existing public.bank_transactions;
  v_id uuid;
begin
  perform private.require_service_role();
  if v_txn_id is null or v_type not in ('in', 'out') then
    perform private.raise_error('INVALID_WEBHOOK_PAYLOAD');
  end if;
  begin
    v_amount := round((p_payload ->> 'transferAmount')::numeric)::bigint;
  exception when others then
    perform private.raise_error('INVALID_WEBHOOK_PAYLOAD', 'transferAmount');
  end;
  begin
    -- SePay gửi giờ Việt Nam dạng "YYYY-MM-DD HH:mm:ss".
    v_at := ((p_payload ->> 'transactionDate')::timestamp) at time zone 'Asia/Ho_Chi_Minh';
  exception when others then
    v_at := now();
  end;
  v_at := coalesce(v_at, now());

  -- Gửi lại (SePay thử lại / bấm gửi lại) → trả kết quả cũ, không ghi tiền hai lần.
  perform pg_advisory_xact_lock(hashtext('rally.sepay'), hashtext(v_txn_id));
  select * into v_existing from public.bank_transactions where provider = 'sepay' and provider_txn_id = v_txn_id;
  if found then
    return jsonb_build_object('status', v_existing.status, 'booking_id', v_existing.booking_id, 'replayed', true);
  end if;
  -- Đối soát qua API có thể trả cùng giao dịch với mã khác webhook: chống trùng thêm theo mã tham chiếu ngân hàng.
  if nullif(btrim(coalesce(p_payload ->> 'referenceCode', '')), '') is not null then
    select * into v_existing from public.bank_transactions t
     where t.provider = 'sepay'
       and t.reference_code = left(btrim(p_payload ->> 'referenceCode'), 100)
       and t.amount = greatest(coalesce(v_amount, 0), 0)
       and t.transfer_type = v_type
       and t.account_number is not distinct from left(p_payload ->> 'accountNumber', 40)
     limit 1;
    if found then
      return jsonb_build_object('status', v_existing.status, 'booking_id', v_existing.booking_id, 'replayed', true);
    end if;
  end if;

  v_code := private.extract_booking_code(p_payload ->> 'code', p_payload ->> 'content');
  insert into public.bank_transactions (provider, provider_txn_id, gateway, account_number, transfer_type, amount, content,
                                        payment_code, reference_code, transaction_at, status, raw)
  values ('sepay', v_txn_id, left(p_payload ->> 'gateway', 60), left(p_payload ->> 'accountNumber', 40), v_type,
          greatest(coalesce(v_amount, 0), 0), left(p_payload ->> 'content', 500), v_code,
          left(nullif(p_payload ->> 'referenceCode', ''), 100), v_at,
          case when v_type = 'out' then 'ignored' else 'unmatched' end, p_payload)
  returning id into v_id;

  if v_type = 'out' or coalesce(v_amount, 0) <= 0 then
    return jsonb_build_object('status', 'ignored');
  end if;
  if v_code is null then
    update public.bank_transactions set status_note = 'Nội dung không có mã đơn RB…' where id = v_id;
    return jsonb_build_object('status', 'unmatched');
  end if;
  select b.id into v_booking from public.bookings b where b.code = v_code and b.deleted_at is null and b.kind = 'customer';
  if v_booking is null then
    -- Không phải mã đơn đặt sân: có thể là mã chuyển khoản của đơn bán tại quầy (19_staff_checkout.sql).
    v_intent := private.apply_transfer_intent(v_id, v_code);
    if v_intent is not null then
      return v_intent;
    end if;
    update public.bank_transactions set status_note = format('Không có đơn %s', v_code) where id = v_id;
    return jsonb_build_object('status', 'unmatched', 'booking_code', v_code);
  end if;
  return private.apply_bank_transaction(v_id, v_booking, null);
end;
$$;

-- 6. Bán hàng: chuyển khoản không nhập mã giao dịch = chờ khách quét QR ----------------------------------
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
  v_transfer text;
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
                              'total_amount', v_existing.total_amount, 'replayed', true,
                              'transfer_code', (select p.reference from public.payments p
                                                 where p.sale_id = v_existing.id and p.status = 'pending' limit 1),
                              'payment_status', case when exists (select 1 from public.payments p
                                                                   where p.sale_id = v_existing.id and p.status = 'pending')
                                                     then 'pending' else 'succeeded' end);
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

  if v_total > 0 and p_payment_method = 'bank_transfer' and nullif(btrim(coalesce(p_payment_reference, '')), '') is null then
    -- Chuyển khoản qua mã QR: khoản thu chờ tiền về, nội dung RB… do hệ thống cấp; SePay báo về là tự "đã thu".
    v_transfer := private.new_transfer_code();
    insert into public.payments (sale_id, kind, method, status, amount, reference, idempotency_key, recorded_by, note)
    values (v_sale, 'charge', 'bank_transfer', 'pending', v_total, v_transfer, 'sale:' || p_idempotency_key,
            (select auth.uid()), 'Chờ khách chuyển khoản (mã QR)');
  elsif v_total > 0 then
    perform private.insert_payment(null, v_sale, null, 'charge', p_payment_method, v_total,
                                   p_payment_reference, null, 'sale:' || p_idempotency_key);
  end if;

  return jsonb_build_object('sale_id', v_sale,
                            'code', (select code from public.sales where id = v_sale),
                            'total_amount', v_total,
                            'transfer_code', v_transfer,
                            'payment_status', case when v_transfer is null then 'succeeded' else 'pending' end);
end;
$$;

-- 6b. Email cảnh báo: kèm mã đơn bán ------------------------------------------------------------------
create or replace function public.service_pending_alerts(p_limit integer default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s public.notification_settings;
begin
  perform private.require_service_role();
  select * into s from public.notification_settings where id;
  return jsonb_build_object(
    'recipients', to_jsonb(public.service_alert_recipients()),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', t.id, 'amount', t.amount, 'content', t.content, 'status', t.status,
               'status_note', t.status_note, 'transaction_at', t.transaction_at, 'gateway', t.gateway,
               'booking_code', b.code, 'contact_name', b.contact_name, 'contact_phone', cu.phone,
               'starts_at', lower(b.during), 'court_name', c.name, 'branch_name', coalesce(br.name, sbr.name),
               'sale_code', sa.code)
             order by t.transaction_at)
        from (select * from public.bank_transactions x
               where x.alerted_at is null and x.transfer_type = 'in'
                 and x.created_at > now() - interval '3 days'
                 and ((x.status = 'review' and coalesce(s.alert_on_review, true))
                   or (x.status = 'unmatched' and coalesce(s.alert_on_unmatched, true)))
               order by x.transaction_at
               limit least(greatest(coalesce(p_limit, 20), 1), 50)) t
        left join public.bookings b on b.id = t.booking_id
        left join public.customers cu on cu.id = b.customer_id
        left join public.courts c on c.id = b.court_id
        left join public.branches br on br.id = b.branch_id
        left join public.sales sa on sa.id = t.sale_id
        left join public.branches sbr on sbr.id = t.branch_id), '[]'::jsonb));
end;
$$;

-- 7. Trạng thái khoản thu chuyển khoản của đơn bán (màn hình chờ khách quét QR) -------------------------
create or replace function public.sale_transfer_status(p_sale_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s public.sales;
begin
  select * into s from public.sales where id = p_sale_id;
  if not found then
    perform private.raise_error('SALE_NOT_FOUND');
  end if;
  if not ((select private.is_owner()) or private.staff_can(s.branch_id, 'sale.record')) then
    perform private.raise_error('PERMISSION_DENIED');
  end if;
  return jsonb_build_object(
    'sale_id', s.id, 'code', s.code, 'sale_status', s.status, 'total_amount', s.total_amount,
    'paid', coalesce((select sum(amount) from public.payments where sale_id = s.id and kind = 'charge' and status = 'succeeded'), 0),
    'pending', (select jsonb_build_object('payment_id', p.id, 'amount', p.amount, 'reference', p.reference)
                  from public.payments p where p.sale_id = s.id and p.status = 'pending' order by p.created_at desc limit 1));
end;
$$;

-- 8. Khách đổi ý trả tiền mặt (hoặc nhân viên đã thấy tiền về, nhập mã giao dịch) ----------------------
create or replace function public.settle_pending_sale(
  p_sale_id uuid, p_method public.payment_method, p_reference text default null, p_idempotency_key text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.sales;
  p public.payments;
begin
  select * into s from public.sales where id = p_sale_id for update;
  if not found then
    perform private.raise_error('SALE_NOT_FOUND');
  end if;
  perform private.require_permission(s.branch_id, 'sale.record');
  if p_method not in ('cash', 'bank_transfer', 'card', 'e_wallet') then
    perform private.raise_error('INVALID_PAYMENT_METHOD');
  end if;
  select * into p from public.payments where sale_id = s.id and status = 'pending' order by created_at desc limit 1 for update;
  if not found then
    -- Có thể SePay vừa ghi nhận xong: trả trạng thái hiện tại.
    return public.sale_transfer_status(s.id);
  end if;
  perform private.set_audit_reason('pos: đổi hình thức thanh toán');
  update public.payments set status = 'failed', note = left(concat_ws(' · ', nullif(note, ''), 'Khách đổi hình thức thanh toán'), 300)
   where id = p.id;
  perform private.insert_payment(null, s.id, null, 'charge', p_method, p.amount, p_reference, null,
                                 coalesce(p_idempotency_key, 'settle:' || p.id::text));
  return public.sale_transfer_status(s.id);
end;
$$;

-- 9. Hủy đơn bán đang chờ chuyển khoản (khách không chuyển): trả hàng về kho, giữ lịch sử ---------------
create or replace function public.cancel_pending_sale(p_sale_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.sales;
  v_line record;
begin
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then
    perform private.raise_error('REASON_REQUIRED');
  end if;
  select * into s from public.sales where id = p_sale_id for update;
  if not found then
    perform private.raise_error('SALE_NOT_FOUND');
  end if;
  perform private.require_permission(s.branch_id, 'sale.record');
  if s.status = 'voided' then
    return jsonb_build_object('sale_id', s.id, 'status', 'voided');
  end if;
  -- Nhân viên chỉ hủy được đơn chưa thu tiền, trong ngày; đơn đã thu tiền phải nhờ chủ sân hủy.
  if exists (select 1 from public.payments where sale_id = s.id and status = 'succeeded')
     or not exists (select 1 from public.payments where sale_id = s.id and status = 'pending')
     or s.sold_at < now() - interval '24 hours' then
    perform private.raise_error('SALE_NOT_PENDING');
  end if;
  perform private.set_audit_reason('pos: hủy đơn chờ chuyển khoản: ' || btrim(p_reason));
  for v_line in select * from public.sale_lines where sale_id = s.id order by variant_id loop
    insert into public.stock_movements (branch_id, variant_id, quantity_delta, reason, sale_line_id, note)
    values (s.branch_id, v_line.variant_id, v_line.quantity * coalesce(v_line.unit_conversion, 1), 'sale_void', v_line.id,
            left(p_reason, 300));
  end loop;
  update public.payments
     set status = 'voided', voided_at = now(), voided_by = (select auth.uid()), void_reason = btrim(p_reason)
   where sale_id = s.id and status = 'pending';
  update public.sales
     set status = 'voided', voided_at = now(), voided_by = (select auth.uid()), void_reason = btrim(p_reason)
   where id = s.id;
  return jsonb_build_object('sale_id', s.id, 'status', 'voided');
end;
$$;

revoke all on function private.new_transfer_code() from public, anon, authenticated;
revoke all on function private.apply_transfer_intent(uuid, text) from public, anon, authenticated;
revoke all on function public.sale_transfer_status(uuid) from public, anon;
revoke all on function public.settle_pending_sale(uuid, public.payment_method, text, text) from public, anon;
revoke all on function public.cancel_pending_sale(uuid, text) from public, anon;
grant execute on function public.sale_transfer_status(uuid) to authenticated;
grant execute on function public.settle_pending_sale(uuid, public.payment_method, text, text) to authenticated;
grant execute on function public.cancel_pending_sale(uuid, text) to authenticated;

commit;

notify pgrst, 'reload schema';
